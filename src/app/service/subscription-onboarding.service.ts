import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import {
  OnboardingRequest,
  OnboardingResponse,
  ReferralCodeCheck,
  SubscriptionPlanDto
} from '../models/subscription-onboarding.model';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionOnboardingService {
  private readonly publicUrl = `${environment.baseApiUrl}/public`;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<SubscriptionPlanDto[]> {
    return this.http.get<SubscriptionPlanDto[]>(`${this.publicUrl}/subscription-plans`, {
      headers: { 'X-Skip-Toast': 'true' }
    });
  }

  onboard(request: OnboardingRequest): Observable<OnboardingResponse> {
    return this.http.post<OnboardingResponse>(`${this.publicUrl}/onboarding`, request, {
      headers: { 'X-Skip-Toast': 'true' }
    });
  }

  /** AFF-10: checks a referral code; an error of the server means "not checked", never "invalid". */
  checkReferralCode(code: string): Observable<ReferralCodeCheck> {
    return this.http.get<ReferralCodeCheck>(`${this.publicUrl}/referral/code`, {
      params: { code },
      headers: { 'X-Skip-Toast': 'true' }
    });
  }
}
