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
  productId: number;
  extraFeePerUnit?: number | null;
  fromUnits?: number | null;
  toUnits?: number | null;
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
