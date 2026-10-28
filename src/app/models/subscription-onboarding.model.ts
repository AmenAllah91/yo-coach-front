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
  /** Payment method of this plan for this coach (FLOUCI, STRIPE), decided by YoSales. */
  gateway?: string | null;
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

/**
 * SUB-61 / generic billing model: price of a plan in a currency: the price set for it (prices), the base price when
 * it is the base currency of the product, the older whole-dollar price for USD; null when not sold in it.
 */
export function priceInCurrency(
  plan: { price: number; priceUsd?: number | null; prices?: Record<string, number> | null; currency?: string | null },
  currency: string | null | undefined,
): number | null {
  const code = (currency ?? 'TND').toUpperCase();
  const base = (plan.currency ?? 'TND').toUpperCase();
  const set = plan.prices?.[code];
  if (set != null) {
    return set;
  }
  if (code === base) {
    return plan.price;
  }
  return code === 'USD' ? (plan.priceUsd ?? null) : null;
}

/** Decimals of a currency (TND 3, USD 2, JPY 0), from the browser; 2 when unknown. */
function decimalsOf(code: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * SUB-61: "50,000 TND" / "15 $" / "13,50 EUR": each currency with its own decimals (none when whole, except TND), the
 * code after the amount ("$" for dollars). Payment audit D6: never "TND" for another currency.
 */
export function formatAmount(amount: number | null | undefined, currency: string | null | undefined, locale = 'fr-FR'): string {
  if (amount == null) {
    return '';
  }
  const code = (currency ?? 'TND').toUpperCase();
  if (code === 'TND') {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(amount) + ' TND';
  }
  const decimals = decimalsOf(code);
  const whole = Math.round(amount * 10 ** decimals) % 10 ** decimals === 0;
  const text = new Intl.NumberFormat(locale, { minimumFractionDigits: whole ? 0 : decimals, maximumFractionDigits: decimals }).format(amount);
  return text + ' ' + (code === 'USD' ? '$' : code);
}
