import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

export interface AdminCoach {
  id: string;
  name: string;
  email: string;
  registeredAt: string | null;
  accountStatus: string;
  trialStatus: string;
  activeClients: number;
  billingAvailable: boolean;
  clientLimitStatus?: string;
  accountHistory?: CoachAccountEvent[];
  subscription: {
    subscriptionId: number | null;
    status: string | null;
    planId: number | null;
    planName: string | null;
    maxActiveClients: number | null;
    trialEndsAt: string | null;
    trialDaysLeft: number | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    billingCycle?: string | null;
    trialStartedAt?: string | null;
    trialMaxClients?: number | null;
    planMaxClients?: number | null;
    currentPeriodStart?: string | null;
    readOnly?: boolean;
    timeZone?: string;
    openInvoiceId?: number | null;
  } | null;
}
export interface CoachPage {
  content: AdminCoach[];
  totalElements: number;
  page: number;
  size: number;
  billingAvailable: boolean;
  plans: { id: number; name: string }[];
}
export interface CoachFilters { search: string; account: string; trial: string; planId: string; usage?: string; page: number; size: number; }
export interface CoachInvoice {
  id: number; amount: number; currency: string; status: string; invoiceDate: string | null;
  dueDate: string | null; planName: string | null;
  events: { id: number; eventType: string; occurredAt: string }[] | null;
}
export type CoachAccountAction = 'ACTIVATE' | 'BLOCK' | 'UNBLOCK' | 'DISABLE';
export interface SubscriptionAdminEvent {id:number;subscriptionId:number;action:string;actor:string;reason:string;occurredAt:string;
  oldPlanId:number;oldPlanName:string;newPlanId:number;newPlanName:string;oldTrialEnd:string|null;newTrialEnd:string|null;status:string;}
export interface CoachAccountEvent {
  action: CoachAccountAction; previousStatus: string; status: string; reason: string | null;
  note: string | null; occurredAt: string; actor: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminCoachesService {
  private url = `${environment.baseApiUrl}/api/admin/coaches`;
  constructor(private http: HttpClient) {}
  list(filters: CoachFilters) {
    let params = new HttpParams().set('page', filters.page).set('size', filters.size);
    for (const key of ['search', 'account', 'trial', 'planId', 'usage'] as const) {
      if (filters[key]?.trim()) params = params.set(key, filters[key]!.trim());
    }
    return this.http.get<CoachPage>(this.url, { params });
  }
  detail(id: string) { return this.http.get<AdminCoach>(`${this.url}/${encodeURIComponent(id)}`); }
  invoices(id: string) { return this.http.get<CoachInvoice[]>(`${this.url}/${encodeURIComponent(id)}/invoices`); }
  changeAccount(id: string, command: {action: CoachAccountAction; expectedStatus: string; reason: string | null; note: string | null}) {
    return this.http.patch<AdminCoach>(`${this.url}/${encodeURIComponent(id)}/account`, command);
  }
  subscriptionHistory(id:string) {return this.http.get<SubscriptionAdminEvent[]>(`${this.url}/${encodeURIComponent(id)}/subscription/history`);}
  subscriptionChange(id:string,action:string,command:object) {return this.http.post<SubscriptionAdminEvent>(`${this.url}/${encodeURIComponent(id)}/subscription/${action}`,command);}
}
