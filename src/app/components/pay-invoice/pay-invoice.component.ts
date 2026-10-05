import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';

/**
 * SUB-36: target of the "Pay my invoice" link of the billing emails (/billing/pay?invoiceId=...). Opens the Flouci
 * payment of that invoice directly; CE checks that the invoice belongs to the connected coach.
 */
@Component({
  selector: 'app-pay-invoice',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <section class="pay-invoice">
      <div class="card" *ngIf="!error; else failed" role="status">
        <span class="spinner"></span>
        <h1>{{ 'CHECKOUT_REDIRECTING' | translate }}</h1>
      </div>
      <ng-template #failed>
        <div class="card" role="alert">
          <i-feather name="alert-circle" class="icon"></i-feather>
          <h1>{{ error | translate }}</h1>
          <button type="button" class="btn-primary" (click)="toCheckout()">{{ 'NOTICE_CHOOSE_PLAN' | translate }}</button>
          <button type="button" class="btn-link" (click)="toDashboard()">{{ 'CHECKOUT_BACK_TO_DASHBOARD' | translate }}</button>
        </div>
      </ng-template>
    </section>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f7f8fb; }
    .pay-invoice { display: flex; justify-content: center; padding: 48px 16px; box-sizing: border-box; color: #111827; }
    .card { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 440px; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff; text-align: center; }
    h1 { margin: 4px 0 0; font-size: 19px; font-weight: 700; }
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

  constructor(private route: ActivatedRoute, private router: Router, private billing: CoachBillingService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('invoiceId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error = 'PAY_INVOICE_NOT_FOUND';
      return;
    }
    this.billing.initiateInvoicePayment(id, 'FLOUCI').subscribe({
      next: (response) => {
        const url = response?.redirectUrl?.trim();
        if (url) {
          this.redirectTo(url);
          return;
        }
        this.error = 'CHECKOUT_PAYMENT_PAGE_ERROR';
      },
      error: (err: HttpErrorResponse) => {
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
