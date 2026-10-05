import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import {
  CoachInvoice,
  InvoicePaymentGateway,
  InvoicePaymentStatus,
  SubscriptionCancellation,
  InvoicePaymentResponse
} from '../models/coach-invoice.model';
import { CheckoutQuote, SubscriptionPlanDto } from '../models/subscription-onboarding.model';
import { PaidPlanChangeResult, PlanChangeOptions, ScheduledPlanChangeResult } from '../models/plan-change.model';

@Injectable({
  providedIn: 'root'
})
export class CoachBillingService {
  constructor(private http: HttpClient) {}

  getInvoices(): Observable<CoachInvoice[]> {
    const headers = new HttpHeaders({
      'X-Skip-Toast': 'true',
      'X-Skip-Loader': 'true'
    });

    return this.http.get<CoachInvoice[]>(
      `${environment.baseApiUrl}/api/billing/invoices`,
      { headers }
    );
  }

  getInvoicePaymentGateways(invoiceId: number): Observable<InvoicePaymentGateway[]> {
    const headers = new HttpHeaders({
      'X-Skip-Toast': 'true',
      'X-Skip-Loader': 'true'
    });

    return this.http.get<InvoicePaymentGateway[]>(
      `${environment.baseApiUrl}/api/billing/invoices/${invoiceId}/payment-gateways`,
      { headers }
    );
  }

  initiateInvoicePayment(
    invoiceId: number,
    gateway: string
  ): Observable<InvoicePaymentResponse> {
    const headers = new HttpHeaders({
      'X-Skip-Toast': 'true',
      'X-Skip-Loader': 'true'
    });
    const params = new HttpParams().set('gateway', gateway);

    return this.http.post<InvoicePaymentResponse>(
      `${environment.baseApiUrl}/api/billing/invoices/${invoiceId}/pay`,
      {},
      { headers, params }
    );
  }

  /** SUB-15 / SUB-17: the invoice to pay for the chosen plan (409 PLAN_TOO_SMALL when the plan is too small). */
  checkout(planId: number): Observable<CoachInvoice> {
    const headers = new HttpHeaders({
      'X-Skip-Toast': 'true',
      'X-Skip-Loader': 'true'
    });

    return this.http.post<CoachInvoice>(
      `${environment.baseApiUrl}/api/billing/checkout`,
      { planId },
      { headers }
    );
  }

  /** SUB-45: plans the coach can pay for: the offered ones, and their own plan even when it is archived. */
  getPlans(): Observable<SubscriptionPlanDto[]> {
    return this.http.get<SubscriptionPlanDto[]>(`${environment.baseApiUrl}/api/billing/plans`, { headers: this.quiet() });
  }

  /** SUB-45: what the first payment of a plan costs now, promo codes included. */
  getCheckoutQuote(planId: number): Observable<CheckoutQuote> {
    const params = new HttpParams().set('planId', planId);
    return this.http.get<CheckoutQuote>(`${environment.baseApiUrl}/api/billing/checkout-quote`, { headers: this.quiet(), params });
  }

  /** SUB-45: promo code entered on the payment screen; answers the new amount (409 COUPON_* when refused). */
  applyCoupon(code: string, planId: number): Observable<CheckoutQuote> {
    return this.http.post<CheckoutQuote>(`${environment.baseApiUrl}/api/billing/coupon`, { code, planId }, { headers: this.quiet() });
  }

  /** SUB-45: removes a promo code before paying. */
  removeCoupon(code: string, planId: number): Observable<CheckoutQuote> {
    const params = new HttpParams().set('planId', planId);
    return this.http.delete<CheckoutQuote>(
      `${environment.baseApiUrl}/api/billing/coupon/${encodeURIComponent(code)}`,
      { headers: this.quiet(), params }
    );
  }

  /** SUB-46: every plan the coach can move to, with the amount and the date computed by YoSales. */
  getPlanChangeOptions(): Observable<PlanChangeOptions> {
    return this.http.get<PlanChangeOptions>(`${environment.baseApiUrl}/api/billing/plan-change-options`, { headers: this.quiet() });
  }

  /** SUB-39: bigger plan of the same cycle; paid first (invoice), or applied at once when free. */
  requestUpgrade(planId: number): Observable<PaidPlanChangeResult> {
    return this.http.post<PaidPlanChangeResult>(`${environment.baseApiUrl}/api/billing/upgrade`, { planId }, { headers: this.quiet() });
  }

  /** SUB-42: monthly -> yearly; paid first (invoice), or applied at once when nothing is left to pay. */
  switchToYearly(planId: number): Observable<PaidPlanChangeResult> {
    return this.http.post<PaidPlanChangeResult>(`${environment.baseApiUrl}/api/billing/switch-to-yearly`, { planId }, { headers: this.quiet() });
  }

  /** SUB-41: smaller plan at the next renewal. */
  requestDowngrade(planId: number): Observable<ScheduledPlanChangeResult> {
    return this.http.post<ScheduledPlanChangeResult>(`${environment.baseApiUrl}/api/billing/downgrade`, { planId }, { headers: this.quiet() });
  }

  /** SUB-43: yearly -> monthly at the end of the year. */
  switchToMonthly(planId: number): Observable<ScheduledPlanChangeResult> {
    return this.http.post<ScheduledPlanChangeResult>(`${environment.baseApiUrl}/api/billing/switch-to-monthly`, { planId }, { headers: this.quiet() });
  }

  /** SUB-41 / SUB-43: takes back the change scheduled for the renewal. */
  cancelScheduledChange(): Observable<unknown> {
    return this.http.post(`${environment.baseApiUrl}/api/billing/downgrade/cancel`, {}, { headers: this.quiet() });
  }

  /** SUB-46: takes back the change waiting for payment (its invoice is cancelled). */
  cancelPendingRequest(): Observable<unknown> {
    return this.http.post(`${environment.baseApiUrl}/api/billing/upgrade/cancel`, {}, { headers: this.quiet() });
  }

  private quiet(): HttpHeaders {
    return new HttpHeaders({ 'X-Skip-Toast': 'true', 'X-Skip-Loader': 'true' });
  }

  /** SUB-23: status of an invoice payment, polled after the return from Flouci. */
  getInvoicePaymentStatus(invoiceId: number): Observable<InvoicePaymentStatus> {
    const headers = new HttpHeaders({
      'X-Skip-Toast': 'true',
      'X-Skip-Loader': 'true'
    });

    return this.http.get<InvoicePaymentStatus>(
      `${environment.baseApiUrl}/api/billing/invoices/${invoiceId}/payment-status`,
      { headers }
    );
  }

  /** SUB-35: cancel at the end of the access (paid period, trial or grace). No refund. */
  cancelSubscription(): Observable<SubscriptionCancellation> {
    return this.http.post<SubscriptionCancellation>(
      `${environment.baseApiUrl}/api/billing/subscription/cancel`,
      {},
      { headers: new HttpHeaders({ 'X-Skip-Toast': 'true' }) }
    );
  }

  /** SUB-35: take the cancellation back before the end of the access. */
  resumeSubscription(): Observable<SubscriptionCancellation> {
    return this.http.post<SubscriptionCancellation>(
      `${environment.baseApiUrl}/api/billing/subscription/resume`,
      {},
      { headers: new HttpHeaders({ 'X-Skip-Toast': 'true' }) }
    );
  }
}
