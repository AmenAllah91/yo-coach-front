import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, of, timer } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';

export type PaymentReturnPhase = 'checking' | 'paid' | 'failed' | 'timeout';

/** Polling: every 3 s for 2 minutes. The activation itself comes from the payment confirmation (SUB-10). */
export const POLL_INTERVAL_MS = 3000;
export const POLL_MAX_ATTEMPTS = 40;
/** Delay before going to the dashboard after a confirmed payment. */
export const REDIRECT_DELAY_MS = 3000;

/**
 * SUB-23: page where Flouci sends the coach back (through the payment service: /payment/success or /payment/failed).
 * It never creates an invoice or a payment: it only reads the invoice status.
 */
@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FeatherModule],
  templateUrl: './payment-return.component.html',
  styleUrl: './payment-return.component.scss',
})
export class PaymentReturnComponent implements OnInit, OnDestroy {
  phase: PaymentReturnPhase = 'checking';
  readonly checkoutPath = CHECKOUT_PATH;
  private invoiceId: number | null = null;
  private polling?: Subscription;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private billingService: CoachBillingService,
    private stateService: CoachSubscriptionStateService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('invoiceId'));
    this.invoiceId = Number.isFinite(id) && id > 0 ? id : null;
    const returnedAsFailed = this.route.snapshot.data?.['outcome'] === 'failed';

    if (this.invoiceId == null) {
      // No invoice to follow: a failure can be retried from the checkout, a success is confirmed in the background.
      this.phase = returnedAsFailed ? 'failed' : 'timeout';
      return;
    }
    // Flouci said "failed": one check is enough (the payment may still have gone through).
    this.poll(returnedAsFailed ? 1 : POLL_MAX_ATTEMPTS, returnedAsFailed);
  }

  ngOnDestroy(): void {
    this.polling?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry(): void {
    void this.router.navigate([this.checkoutPath]);
  }

  goToDashboard(): void {
    void this.router.navigate(['/coach-dashboard']);
  }

  private poll(maxAttempts: number, returnedAsFailed: boolean): void {
    let attempts = 0;
    const invoiceId = this.invoiceId as number;
    this.polling = timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          attempts++;
          // A network error is just one missed check.
          return this.billingService.getInvoicePaymentStatus(invoiceId).pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((status) => {
        if (status?.paid) {
          this.finish('paid');
          this.stateService.refresh().subscribe();
          timer(REDIRECT_DELAY_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.goToDashboard());
          return;
        }
        if (status?.paymentFailed) {
          this.finish('failed');
          return;
        }
        if (attempts >= maxAttempts) {
          this.finish(returnedAsFailed ? 'failed' : 'timeout');
        }
      });
  }

  private finish(phase: PaymentReturnPhase): void {
    this.phase = phase;
    this.polling?.unsubscribe();
  }
}
