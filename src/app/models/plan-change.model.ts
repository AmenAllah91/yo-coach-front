import { CoachInvoice } from './coach-invoice.model';
import { SalesBillingCycle } from './subscription-onboarding.model';

/** UPGRADE = pay now, at once; TO_YEARLY = pay now, year from the period start; DOWNGRADE / TO_MONTHLY = at renewal. */
export type PlanChangeKind = 'CURRENT' | 'UPGRADE' | 'DOWNGRADE' | 'TO_YEARLY' | 'TO_MONTHLY';

/** SUB-44: a plan whose minimum is above the active clients is allowed; a plan that fits is proposed. */
export interface PlanTooBigAdvice {
  activeClients: number;
  minClients: number;
  suggestedPlan: { planId: number; planName: string; price: number } | null;
}

/** One plan of the plan-change screen, computed by YoSales exactly as the change will apply (SUB-46). */
export interface PlanChangeOption {
  planId: number;
  planName: string;
  price: number;
  billingCycle: SalesBillingCycle;
  fromUnits?: number | null;
  toUnits?: number | null;
  kind: PlanChangeKind;
  allowed: boolean;
  refusalCode?: string | null;
  /** To pay now (UPGRADE, TO_YEARLY; 0 = free). */
  amountNow?: number | null;
  /** Day the plan changes (DOWNGRADE, TO_MONTHLY); null = at once once paid. */
  effectiveAt?: string | null;
  /** New yearly period (TO_YEARLY). */
  periodStart?: string | null;
  periodEnd?: string | null;
  clientsToArchive?: number | null;
  planTooBig?: PlanTooBigAdvice | null;
  couponsNotKept?: string[];
}

export interface PlanChangeOptions {
  status: string | null;
  /** SUB-61: currency of every amount below (TND, or USD by Stripe). */
  currency?: string | null;
  /** PAY_FIRST, UPGRADE_USE_CHECKOUT, PLAN_CHANGE_NOT_ALLOWED: nothing can be changed now. */
  blockedCode?: string | null;
  currentPlanId: number | null;
  currentPlanName: string | null;
  currentCycle: SalesBillingCycle | null;
  currentPeriodEnd?: string | null;
  activeClients?: number | null;
  /** Upgrade or yearly switch waiting for payment (one at a time, expires after 3 days). */
  pendingRequest?: {
    invoiceId: number;
    planId: number;
    planName: string;
    amount: number;
    expiresAt: string | null;
    kind: PlanChangeKind;
    paymentInProgress: boolean;
  } | null;
  /** Downgrade or yearly -> monthly scheduled for the renewal. */
  scheduledChange?: { planId: number; planName: string; effectiveAt: string | null; kind: PlanChangeKind } | null;
  plans: PlanChangeOption[];
}

/** Answer of an upgrade or a yearly switch: applied at once (free) or an invoice to pay. */
export interface PaidPlanChangeResult {
  applied: boolean;
  invoice: CoachInvoice | null;
  planTooBig?: PlanTooBigAdvice | null;
  couponsNotKept?: string[];
}

/** Answer of a downgrade or a yearly -> monthly switch, scheduled for the renewal. */
export interface ScheduledPlanChangeResult {
  pendingPlanId: number | null;
  effectiveAt: string | null;
  planTooBig?: PlanTooBigAdvice | null;
  couponsNotKept?: string[];
}
