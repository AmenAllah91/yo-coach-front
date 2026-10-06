/** SUB-13: subscription state of the connected coach, computed by YoSales (CE GET /api/billing/subscription-state). */
export type CoachSubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface CoachSubscriptionState {
  customerId?: number | null;
  subscriptionId?: number | null;
  /** Null when the coach has no subscription. */
  status?: CoachSubscriptionStatus | null;
  readOnly: boolean;
  trialEndsAt?: string | null;
  /** Days of trial left in the coach's time zone (0 = last day). Null outside a trial. */
  trialDaysLeft?: number | null;
  currentPeriodEnd?: string | null;
  planId?: number | null;
  planName?: string | null;
  billingCycle?: 'MONTHLY' | 'YEARLY' | string | null;
  maxActiveClients?: number | null;
  brandingAllowed: boolean;
  /** Active clients of the coach, demo client excluded (added by CE, SUB-22). */
  activeClients?: number | null;
  openInvoiceId?: number | null;
  /** SUB-35: cancelled by the coach; access until accessUntil, then read-only. */
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string | null;
  /** Last day to pay the open invoice (yyyy-MM-dd, coach time zone). SUB-30. */
  openInvoiceDueDate?: string | null;
  pendingPlanChange?: { planId: number; planName: string; effectiveAt: string } | null;
  /** SUB-39: upgrade waiting for payment (the plan changes once it is paid; expires after 3 days). */
  pendingUpgrade?: { invoiceId: number; planId: number; planName: string; amount: number; expiresAt: string } | null;
  /** SUB-41: smaller plan proposed from the usage; applied only if the coach confirms it. */
  suggestedDowngrade?: { planId: number; planName: string } | null;
  /** SUB-45: the plan is no longer offered; the coach keeps it at its price until changing. */
  planArchived?: boolean;
  timeZone?: string | null;
  /** SUB-58: ISO 3166 alpha-2 country chosen in the onboarding country list (null until then). */
  billingCountry?: string | null;
  /** SUB-58: currency the subscription is charged in (TND today). */
  currency?: string | null;
  /** SUB-60: TND for 1 USD, reference rate set by the administrator (null = no dollar amount). */
  usdRateTnd?: number | null;
}

/**
 * SUB-60: indicative amount in WHOLE dollars (no decimals) of a TND amount, for a coach whose chosen country is not
 * Tunisia, using the reference rate of the administrator. Display only: the coach is always charged in TND. Null when
 * nothing must be shown (Tunisian coach, no country chosen yet, no rate, no amount, subscription not in TND).
 */
export function indicativeUsd(amountTnd: number | null | undefined, state: CoachSubscriptionState | null | undefined): number | null {
  const country = (state?.billingCountry ?? '').toUpperCase();
  const rate = state?.usdRateTnd ?? 0;
  const currency = (state?.currency ?? 'TND').toUpperCase();
  if (!country || country === 'TN' || currency !== 'TND' || !(rate > 0) || amountTnd == null || !(amountTnd > 0)) {
    return null;
  }
  return Math.max(1, Math.round(amountTnd / rate));
}
