import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
export interface SalesPlan {
  id: number | null; productId?: number; currency?: string; planCode: string; name: string; description: string;
  price: number; billingCycle: string; pricingModel: string; fromUnits: number; toUnits: number;
  freeTrialDays: number; trialMaxClients: number | null; extraFeePerUnit: number; active: boolean; archived?: boolean;
}
export interface SubscriptionEntry {
  coachId: string; coachName: string; email: string; accountStatus: string;
  subscription: {id: number; planId: number; planName: string; billingCycle: string; start: string | null;
    end: string | null; status: string | null; cancelAtPeriodEnd: boolean};
}
export interface SubscriptionPage {content: SubscriptionEntry[]; totalElements: number; page: number; size: number;}
@Injectable({providedIn:'root'})
export class AdminBillingService {
  private url = `${environment.baseApiUrl}/api/admin`;
  constructor(private http: HttpClient) {}
  subscriptions(filters: {search: string; status: string; planId: string; account: string; page: number; size: number}) {
    let params = new HttpParams().set('page',filters.page).set('size',filters.size);
    for (const key of ['search','status','planId','account'] as const) if(filters[key].trim()) params=params.set(key,filters[key].trim());
    return this.http.get<SubscriptionPage>(`${this.url}/subscriptions`,{params});
  }
  plans() {return this.http.get<SalesPlan[]>(`${this.url}/plans`);}
  save(plan: SalesPlan) {return plan.id == null ? this.http.post<SalesPlan>(`${this.url}/plans`,plan) : this.http.put<SalesPlan>(`${this.url}/plans/${plan.id}`,plan);}
  active(id: number, active: boolean) {return this.http.patch<SalesPlan>(`${this.url}/plans/${id}/active`,{active});}
}
