import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, ReplaySubject, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { environment } from '@env/environment';
import { CoachSubscriptionState } from '../models/coach-subscription-state.model';

/** Back on the window, the state is read again when the last read is older than this (at most once a minute). */
export const STATE_MAX_AGE_MS = 60000;

/**
 * SUB-21: subscription state of the connected coach, shared by every screen. Call refresh() after a payment or a plan
 * change. Like AccountAccessService, it is read again when the coach comes back to the window (focus, tab visible) and
 * the last read is over a minute old: a payment made in another tab, a renewal or a change made by YoSales shows up
 * without reloading the page.
 */
@Injectable({
  providedIn: 'root'
})
export class CoachSubscriptionStateService implements OnDestroy {
  private state$?: Observable<CoachSubscriptionState | null>;
  private readonly latest$ = new ReplaySubject<CoachSubscriptionState | null>(1);
  /** SUB-30: every state read (first load and each refresh), for what must follow changes (banner, buttons). */
  readonly states$: Observable<CoachSubscriptionState | null> = this.latest$.asObservable();

  /** Last state read in this session (undefined: none yet), shown at once while a fresh one is asked. */
  snapshot: CoachSubscriptionState | null | undefined;
  /** A screen asked for the state (a coach): only then is it read again on return to the window. */
  private asked = false;
  /** Time of the last read started (Date.now()), so the window events never ask more than once a minute. */
  private readAt = 0;
  /** The last answer was 404 (no subscription for this account). */
  private withoutSubscription = false;

  private readonly onReturn = () => this.refreshIfStale();

  constructor(private http: HttpClient, @Inject(DOCUMENT) private document: Document) {
    this.document.defaultView?.addEventListener('focus', this.onReturn);
    this.document.addEventListener('visibilitychange', this.onReturn);
  }

  ngOnDestroy(): void {
    this.document.defaultView?.removeEventListener('focus', this.onReturn);
    this.document.removeEventListener('visibilitychange', this.onReturn);
  }

  /**
   * Reads the state again if a screen uses it, the window is visible and the last read is older than maxAgeMs. An
   * account without subscription (404: not a coach, no customer yet) keeps that answer, as getState does.
   */
  refreshIfStale(maxAgeMs = STATE_MAX_AGE_MS): void {
    if (!this.asked || this.withoutSubscription || this.document.hidden) return;
    if (Date.now() - this.readAt < maxAgeMs) return;
    this.refresh().subscribe();
  }

  getState(): Observable<CoachSubscriptionState | null> {
    this.asked = true;
    if (!this.state$) {
      this.readAt = Date.now();
      const headers = new HttpHeaders({
        'X-Skip-Toast': 'true',
        'X-Skip-Loader': 'true'
      });
      this.state$ = this.http
        .get<CoachSubscriptionState>(`${environment.baseApiUrl}/api/billing/subscription-state`, { headers })
        .pipe(
          // No state (YoSales down, coach without customer): show nothing rather than an error. A coach without
          // subscription (404) keeps that answer; another failure is asked again a minute later, not on every screen.
          tap(() => (this.withoutSubscription = false)),
          catchError((error) => {
            this.withoutSubscription = error?.status === 404;
            if (error?.status !== 404) {
              const failed = this.state$;
              setTimeout(() => { if (this.state$ === failed) this.state$ = undefined; }, 60000);
            }
            return of(null);
          }),
          tap((state) => { this.snapshot = state; this.latest$.next(state); }),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this.state$;
  }

  refresh(): Observable<CoachSubscriptionState | null> {
    this.state$ = undefined;
    return this.getState();
  }

  /** SUB-29: custom branding is locked (trial or blocked). Unknown state = not locked (SUB-24 policy). */
  brandingLocked(): Observable<boolean> {
    return this.getState().pipe(map((state) => !!state && !state.brandingAllowed));
  }

  clear(): void {
    this.state$ = undefined;
    this.asked = false;
  }
}
