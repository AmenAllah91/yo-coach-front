import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Refusals sent by CE when the subscription does not allow an action (SUB-26, SUB-27, SUB-28). */
export type SubscriptionNoticeCode = 'CLIENT_LIMIT_REACHED' | 'FEATURE_LOCKED' | 'SUBSCRIPTION_READ_ONLY';

export interface SubscriptionNotice {
  code: SubscriptionNoticeCode;
  /**
   * CLIENT_LIMIT_REACHED: TRIAL | PLAN | READ_ONLY | SCHEDULED_DOWNGRADE (limit lowered by the plan change scheduled for
   * the renewal, no suggested plan). FEATURE_LOCKED: TRIAL | READ_ONLY.
   */
  reason?: string | null;
  limit?: number | null;
  current?: number | null;
  /** FEATURE_LOCKED: WEBSITE | MOBILE_THEME. */
  feature?: string | null;
  /** CLIENT_LIMIT_REACHED with reason PLAN: smallest bigger plan (SUB-40); proratedCost = amount to pay now. Null when none fits. */
  /** currency: the one of the subscription, for both amounts (payment audit D6). */
  suggestedPlan?: { planId?: number; planName?: string; price?: number; proratedCost?: number | null; currency?: string | null } | null;
  /** CLIENT_LIMIT_REACHED with reason SCHEDULED_DOWNGRADE: the smaller plan asked for (its limit applies until the renewal). */
  scheduledPlanName?: string | null;
}

const CODES: SubscriptionNoticeCode[] = ['CLIENT_LIMIT_REACHED', 'FEATURE_LOCKED', 'SUBSCRIPTION_READ_ONLY'];

/**
 * SUB-29: the HTTP interceptor publishes these refusals here, and the layout shows a clear message (with the right
 * button) instead of a technical error.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionNoticeService {
  readonly notices$ = new Subject<SubscriptionNotice>();

  /** Returns true when the error body is a subscription refusal (then published). */
  publishIfSubscriptionRefusal(body: unknown): boolean {
    const code = (body as { code?: string } | null)?.code;
    if (!code || !CODES.includes(code as SubscriptionNoticeCode)) {
      return false;
    }
    this.notices$.next(body as SubscriptionNotice);
    return true;
  }
}
