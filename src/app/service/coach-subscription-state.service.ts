import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, ReplaySubject, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { environment } from '@env/environment';
import { CoachSubscriptionState } from '../models/coach-subscription-state.model';

/** Plan features (2026-11-11): the codes of CE (config/FeatureCodes.java) used by the coach app. */
export const FEATURE = {
  WEBSITE: 'feature.website',
  BRANDING: 'feature.branding',
  CUSTOM_DOMAIN: 'feature.custom_domain',
  JOIN_LINK: 'feature.join_link',
  CONTACT_FORM: 'feature.contact_form',
  CHECKINS: 'feature.checkins',
  TASKS: 'feature.tasks',
  VIDEO_CALL: 'feature.video_call',
  REFERRAL: 'feature.referral',
} as const;

/**
 * Is a feature locked for this state? 'website' / 'theme' (IA-23) or a code of the plan features (2026-11-11).
 * The list of the plan (features) decides; without it, the website and the branding keep their rule of before
 * (websiteAllowed / themeAllowed, else brandingAllowed) and any other feature is open (the server checks anyway).
 * No state (unknown) = not locked (SUB-24 policy).
 */
export function featureLocked(state: CoachSubscriptionState | null | undefined, feature: string): boolean {
  if (!state) return false;
  const code = feature === 'website' ? FEATURE.WEBSITE : feature === 'theme' ? FEATURE.BRANDING : feature;
  if (code === FEATURE.WEBSITE || code === FEATURE.BRANDING) {
    // CE already merged the plan's answer into websiteAllowed / themeAllowed.
    const allowed = code === FEATURE.WEBSITE ? state.websiteAllowed : state.themeAllowed;
    return !(allowed ?? state.brandingAllowed);
  }
  const line = (state.features ?? []).find((f) => f.code === code);
  return line ? !line.allowed : false;
}

/** Name of a feature of the plan in the language of the app (French by default), or null when unknown. */
export function featureLabel(state: CoachSubscriptionState | null | undefined, code: string | null | undefined,
                             lang: string | null | undefined): string | null {
  const line = (state?.features ?? []).find((f) => f.code === code);
  if (!line) return null;
  const byLang = lang === 'en' ? line.labelEn : lang === 'ar' ? line.labelAr : null;
  return byLang || line.labelFr || null;
}

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
  /** The admin switched the payment incident on: the payment buttons wait (the access continues). */
  get paymentsPaused(): boolean {
    return !!this.snapshot?.paymentIncident;
  }

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

  /**
   * SUB-29: app colors and logo are locked (trial, blocked, or not in the plan: IA-23). Unknown state = not locked
   * (SUB-24 policy).
   */
  brandingLocked(): Observable<boolean> {
    return this.getState().pipe(map((state) => featureLocked(state, 'theme')));
  }

  /** IA-23: the coach website is locked (trial, blocked, or not in the plan). */
  websiteLocked(): Observable<boolean> {
    return this.getState().pipe(map((state) => featureLocked(state, 'website')));
  }

  clear(): void {
    this.state$ = undefined;
    this.asked = false;
  }
}
