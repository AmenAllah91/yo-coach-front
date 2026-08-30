import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import {
  CoachInvoice,
  InvoicePaymentGateway,
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
}
