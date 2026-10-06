export type SalesBillingCycle = 'MONTHLY' | 'YEARLY';

export interface SubscriptionPlanDto {
  id: number;
  planCode: string;
  name: string;
  description?: string | null;
  price: number;
  /** SUB-59: price in whole US dollars (null = not offered in dollars). */
  priceUsd?: number | null;
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
  /** SUB-61: currency of the amounts (TND by Flouci, USD by Stripe). */
  currency?: string | null;
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

/** SUB-61: price of a plan in the currency of the subscription (dollar price for USD). */
export function priceInCurrency(plan: { price: number; priceUsd?: number | null }, currency: string | null | undefined): number | null {
  return (currency ?? 'TND').toUpperCase() === 'USD' ? (plan.priceUsd ?? null) : plan.price;
}

/** SUB-61: "50,000 TND" / "15 $": TND with 3 decimals, dollars with 2 (none when whole). */
export function formatAmount(amount: number | null | undefined, currency: string | null | undefined, locale = 'fr-FR'): string {
  if (amount == null) {
    return '';
  }
  if ((currency ?? 'TND').toUpperCase() === 'USD') {
    const whole = Math.round(amount * 100) % 100 === 0;
    return new Intl.NumberFormat(locale, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount) + ' $';
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(amount) + ' TND';
}
