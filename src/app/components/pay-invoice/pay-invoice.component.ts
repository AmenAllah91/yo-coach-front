import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { catchError, forkJoin, of } from 'rxjs';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { CoachInvoice } from 'app/models/coach-invoice.model';
import { cardLabel } from 'app/models/coach-subscription-state.model';
import { formatAmount } from 'app/models/subscription-onboarding.model';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';

/**
 * SUB-36: target of the "Pay my invoice" link of the billing emails (/billing/pay?invoiceId=...). Payment audit CE-M6:
 * the coach first sees what is paid (plan, amount, method or saved card) and confirms; opening the link never charges
 * the card by itself. CE checks that the invoice belongs to the connected coach.
 */
@Component({
  selector: 'app-pay-invoice',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <section class="pay-invoice">
      <div class="card" *ngIf="error; else ready" role="alert">
        <i-feather name="alert-circle" class="icon"></i-feather>
        <h1>{{ error | translate }}</h1>
        <button type="button" class="btn-primary" (click)="toCheckout()">{{ 'NOTICE_CHOOSE_PLAN' | translate }}</button>
        <button type="button" class="btn-link" (click)="toDashboard()">{{ 'CHECKOUT_BACK_TO_DASHBOARD' | translate }}</button>
      </div>
      <ng-template #ready>
        <div class="card" *ngIf="invoice && !paying; else waiting">
          <h1>{{ 'MY_SUB_INVOICE' | translate }}<ng-container *ngIf="invoice.planName"> · {{ invoice.planName }}</ng-container></h1>
          <p class="label">{{ 'CHECKOUT_TOTAL' | translate }}</p>
          <p class="amount">{{ amount }}</p>
          <button type="button" class="btn-primary" (click)="pay()">
            {{ (savedCard ? 'MY_SUB_PAY_WITH_CARD' : method === 'STRIPE' ? 'CHECKOUT_PAY_BY_CARD' : 'CHECKOUT_PAY_WITH_FLOUCI') | translate: { card: savedCard } }}
          </button>
          <p class="secure"><i-feather name="lock"></i-feather>{{ (method === 'STRIPE' ? 'CHECKOUT_SECURE_STRIPE' : 'CHECKOUT_SECURE_FLOUCI') | translate }}</p>
          <button type="button" class="btn-link" (click)="toDashboard()">{{ 'CHECKOUT_BACK_TO_DASHBOARD' | translate }}</button>
        </div>
      </ng-template>
      <ng-template #waiting>
        <div class="card" role="status">
          <span class="spinner"></span>
          <!-- While the invoice loads: only a spinner (nothing is charged without the click below). -->
          <h1 *ngIf="paying">{{ 'CHECKOUT_REDIRECTING' | translate }}</h1>
        </div>
      </ng-template>
    </section>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f7f8fb; }
    .pay-invoice { display: flex; justify-content: center; padding: 48px 16px; box-sizing: border-box; color: #111827; }
    .card { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 440px; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff; text-align: center; }
    h1 { margin: 4px 0 0; font-size: 19px; font-weight: 700; }
    .label { margin: 8px 0 0; color: #6b7280; font-size: 14px; }
    .amount { margin: 0; font-size: 28px; font-weight: 800; }
    .secure { display: flex; align-items: center; gap: 6px; margin: 0; color: #6b7280; font-size: 13px; }
    .secure i-feather { width: 14px; height: 14px; }
    .icon { width: 44px; height: 44px; color: #d97706; }
    button { font: inherit; cursor: pointer; }
    .btn-primary { width: 100%; min-height: 44px; margin-top: 8px; border: 0; border-radius: 10px; background: #38ace0; color: #ffffff; font-weight: 700; }
    .btn-link { border: 0; background: none; color: #4b5563; text-decoration: underline; }
    .spinner { display: inline-block; width: 36px; height: 36px; border: 4px solid #d9eef9; border-top-color: #39aeef; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PayInvoiceComponent implements OnInit {
  error = '';
  invoice: CoachInvoice | null = null;
  /** FLOUCI, STRIPE: the method of the subscription, decided by YoSales. */
  method = 'FLOUCI';
  /** "Visa •••• 4242" when the payment is charged on the saved card; empty otherwise. */
  savedCard = '';
  paying = false;

  constructor(private route: ActivatedRoute, private router: Router, private billing: CoachBillingService,
              private states: CoachSubscriptionStateService) {}

  get amount(): string {
    return formatAmount(this.invoice?.amount, this.invoice?.currency);
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('invoiceId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error = 'PAY_INVOICE_NOT_FOUND';
      return;
    }
    forkJoin({
      invoices: this.billing.getInvoices(),
      state: this.states.refresh().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ invoices, state }) => {
        const invoice = (invoices ?? []).find((i) => i.id === id) ?? null;
        if (!invoice) {
          this.error = 'PAY_INVOICE_NOT_FOUND';
          return;
        }
        const status = (invoice.status ?? '').toUpperCase();
        if (status === 'PAID') {
          this.error = 'PAY_INVOICE_ALREADY_PAID';
          return;
        }
        if (status === 'VOID' || status === 'CANCELLED') {
          this.error = 'PAY_INVOICE_NOT_PAYABLE'; // cancelled meanwhile (plan changed, request expired): nothing to pay
          return;
        }
        this.invoice = invoice;
        this.method = (state?.paymentGateway ?? 'FLOUCI').toUpperCase();
        this.savedCard = this.method === 'STRIPE' && state?.autoCharge && state?.card ? cardLabel(state.card) : '';
      },
      error: () => (this.error = 'PAY_INVOICE_NOT_PAYABLE'),
    });
  }

  /** Only on the coach's click: the payment page opens, or the saved card is charged. */
  pay(): void {
    if (!this.invoice || this.paying) {
      return;
    }
    this.paying = true;
    this.billing.initiateInvoicePayment(this.invoice.id).subscribe({
      next: (response) => {
        const url = response?.redirectUrl?.trim();
        if (url) {
          this.redirectTo(url);
          return;
        }
        this.paying = false;
        this.error = 'CHECKOUT_PAYMENT_PAGE_ERROR';
      },
      error: (err: HttpErrorResponse) => {
        this.paying = false;
        const message = String(err?.error?.error || err?.error?.message || '');
        this.error = message.includes('already been paid') ? 'PAY_INVOICE_ALREADY_PAID'
          : err?.status === 404 ? 'PAY_INVOICE_NOT_FOUND'
          : 'PAY_INVOICE_NOT_PAYABLE';
      },
    });
  }

  toCheckout(): void {
    void this.router.navigate([CHECKOUT_PATH]);
  }

  toDashboard(): void {
    void this.router.navigate(['/coach-dashboard']);
  }

  protected redirectTo(url: string): void {
    window.location.assign(url);
  }
}
