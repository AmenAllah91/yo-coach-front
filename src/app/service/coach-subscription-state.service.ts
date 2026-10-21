import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { environment } from '@env/environment';
import { CoachSubscriptionState } from '../models/coach-subscription-state.model';

/**
 * SUB-21: subscription state of the connected coach, read once per session and shared by every screen.
 * Call refresh() after a payment or a plan change.
 */
@Injectable({
  providedIn: 'root'
})
export class CoachSubscriptionStateService {
  private state$?: Observable<CoachSubscriptionState | null>;
  private readonly latest$ = new ReplaySubject<CoachSubscriptionState | null>(1);
  /** SUB-30: every state read (first load and each refresh), for what must follow changes (banner, buttons). */
  readonly states$: Observable<CoachSubscriptionState | null> = this.latest$.asObservable();

  /** Last state read in this session (undefined: none yet), shown at once while a fresh one is asked. */
  snapshot: CoachSubscriptionState | null | undefined;

  constructor(private http: HttpClient) {}

  getState(): Observable<CoachSubscriptionState | null> {
    if (!this.state$) {
      const headers = new HttpHeaders({
        'X-Skip-Toast': 'true',
        'X-Skip-Loader': 'true'
      });
      this.state$ = this.http
        .get<CoachSubscriptionState>(`${environment.baseApiUrl}/api/billing/subscription-state`, { headers })
        .pipe(
          // No state (YoSales down, coach without customer): show nothing rather than an error. A coach without
          // subscription (404) keeps that answer; another failure is asked again a minute later, not on every screen.
          catchError((error) => {
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
  }
}
