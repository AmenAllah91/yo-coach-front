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
