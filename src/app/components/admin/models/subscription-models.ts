export type SubscriptionStatus = 'Actif' | 'Expiré' | 'Annulé' | 'Suspendu';

export type RevenueModalMode =
  | 'add-plan'
  | 'edit-plan'
  | 'delete-plan'
  | 'view-subscription'
  | 'edit-subscription'
  | 'suspend-subscription'
  | 'renew-subscription'
  | 'cancel-subscription'
  | null;

export interface PlanDto {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  subscriberCount: number;
  isPopular?: boolean;
}

export interface CoachSubscriptionDto {
  id: string;
  coachId: string;
  coachName: string;
  email: string;
  avatarUrl?: string | null;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  amountPaid: number;
}

export interface RevenuePointDto {
  month: string;
  revenue: number;
}

export interface RevenueByYearDto {
  year: string;
  points: RevenuePointDto[];
}

export interface SubscriptionStatsDto {
  totalCoaches: number;
  activeSubs: number;
  expiredSubs: number;
  canceledSubs: number;
  currentMonthlyRevenue: number;
  totalRevenue: number;
  yearTotal: number;
  yearAverage: number;
}

export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PlanForm {
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  featuresText: string;
  isPopular: boolean;
}

export interface SubscriptionForm {
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  amountPaid: number;
}
