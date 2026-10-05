export type SalesBillingCycle = 'MONTHLY' | 'YEARLY';

export interface SubscriptionPlanDto {
  id: number;
  planCode: string;
  name: string;
  description?: string | null;
  price: number;
  pricingModel: 'FLAT_FEE' | 'STAIR_STEP' | 'FEATURE_BASED';
  billingCycle: SalesBillingCycle;
  freeTrialDays?: number | null;
  /** Maximum active clients during the free trial (YoSales, SUB-09). */
  trialMaxClients?: number | null;
  productId: number;
  extraFeePerUnit?: number | null;
  fromUnits?: number | null;
  toUnits?: number | null;
  /** SUB-45: no longer offered; only listed for the coach who already has it. */
  archived?: boolean | null;
  /** SUB-57: what the plan brings, in display order (YoSales is the only source). */
  features?: SubscriptionPlanFeatureDto[] | null;
}

/** SUB-57: one feature of a plan, with its texts in the languages of the app. */
export interface SubscriptionPlanFeatureDto {
  id?: number;
  textFr: string;
  textEn?: string | null;
  textAr?: string | null;
  icon?: string | null;
  /** false = locked during the free trial. */
  includedInTrial?: boolean | null;
}

/** SUB-57: the text of a feature in the given language; English and Arabic fall back on the French text. */
export function planFeatureText(feature: SubscriptionPlanFeatureDto, lang: string): string {
  const text = lang === 'en' ? feature.textEn : lang === 'ar' ? feature.textAr : feature.textFr;
  return (text ?? '').trim() || feature.textFr;
}

/** SUB-45: amount of the first payment for a plan, promo codes included (no invoice created). */
export interface CheckoutQuote {
  planId: number;
  baseAmount: number;
  addonAmount: number;
  discountAmount: number;
  amount: number;
  couponsApplied: string[];
  couponsNotApplied: string[];
}

export interface RegistrationUser {
  login: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  authorities: string[];
}

export interface OnboardingRequest {
  user: RegistrationUser;
  planId: number;
  /** IANA time zone of the browser (e.g. America/Montreal): trial and periods end at midnight there. */
  timeZone?: string;
}

export interface OnboardingResponse {
  userId: string;
  customerId: number;
  subscriptionId: number;
  subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'PENDING' | 'EXPIRED' | 'TRIAL' | 'PAST_DUE';
  subscription: SalesSubscriptionDto;
}

export interface SalesSubscriptionDto {
  id: number;
  planId: number;
  customerId: number;
  startDate?: string | null;
  endDate?: string | null;
  status: OnboardingResponse['subscriptionStatus'];
  invoiceIds?: number[] | null;
  couponIds?: number[] | null;
  addonIds?: number[] | null;
  note?: string | null;
  currentItemCount?: number | null;
  lastUsageUpdate?: string | null;
  pendingUpgradeCharge?: number | null;
  pendingExtrasCharge?: number | null;
  upgradeDate?: string | null;
  extraClients?: number | null;
  daysBelowDowngradeThreshold?: number | null;
  pendingDowngradePlanId?: number | null;
  eligibleForDowngrade?: boolean | null;
  cancelAtPeriodEnd?: boolean | null;
  customerName?: string | null;
  customerEmail?: string | null;
  planName?: string | null;
  planPrice?: number | null;
}
