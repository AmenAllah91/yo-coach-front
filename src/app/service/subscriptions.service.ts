import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CoachSubscriptionDto,
  PageDto,
  PlanDto,
  RevenueByYearDto,
  SubscriptionStatsDto,
  SubscriptionStatus
} from '../components/admin/models/subscription-models';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private baseUrl = `${environment.baseApiUrl}/api/subscriptions`;
  private plansUrl = `${environment.baseApiUrl}/api/subscription-plans`;
  private revenueUrl = `${environment.baseApiUrl}/api/subscriptions/revenue`;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlanDto[]> {
    return this.http.get<PlanDto[]>(this.plansUrl);
  }

  getSubscriptions(params: {
    search?: string;
    status?: SubscriptionStatus | 'Tous';
    planId?: string | 'Tous';
    page?: number;
    size?: number;
  }): Observable<PageDto<CoachSubscriptionDto>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 10);

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params.status && params.status !== 'Tous') {
      httpParams = httpParams.set('status', params.status);
    }

    if (params.planId && params.planId !== 'Tous') {
      httpParams = httpParams.set('planId', params.planId);
    }

    return this.http.get<PageDto<CoachSubscriptionDto>>(this.baseUrl, { params: httpParams });
  }

  getSubscriptionStats(year: string): Observable<SubscriptionStatsDto> {
    return this.http.get<SubscriptionStatsDto>(`${this.baseUrl}/stats`, {
      params: new HttpParams().set('year', year)
    });
  }

  getRevenueByYear(): Observable<RevenueByYearDto[]> {
    return this.http.get<RevenueByYearDto[]>(this.revenueUrl);
  }

  createPlan(payload: Partial<PlanDto>): Observable<PlanDto> {
    return this.http.post<PlanDto>(this.plansUrl, payload);
  }

  updatePlan(id: string, payload: Partial<PlanDto>): Observable<PlanDto> {
    return this.http.put<PlanDto>(`${this.plansUrl}/${id}`, payload);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.plansUrl}/${id}`);
  }

  getSubscriptionById(id: string): Observable<CoachSubscriptionDto> {
    return this.http.get<CoachSubscriptionDto>(`${this.baseUrl}/${id}`);
  }

  updateSubscription(id: string, payload: Partial<CoachSubscriptionDto>): Observable<CoachSubscriptionDto> {
    return this.http.put<CoachSubscriptionDto>(`${this.baseUrl}/${id}`, payload);
  }

  suspendSubscription(id: string): Observable<CoachSubscriptionDto> {
    return this.http.patch<CoachSubscriptionDto>(`${this.baseUrl}/${id}/suspend`, {});
  }

  renewSubscription(id: string): Observable<CoachSubscriptionDto> {
    return this.http.patch<CoachSubscriptionDto>(`${this.baseUrl}/${id}/renew`, {});
  }

  cancelSubscription(id: string): Observable<CoachSubscriptionDto> {
    return this.http.patch<CoachSubscriptionDto>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
