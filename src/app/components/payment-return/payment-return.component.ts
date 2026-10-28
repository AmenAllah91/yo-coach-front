import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, of, timer } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { InvoicePaymentStatus } from 'app/models/coach-invoice.model';
import { CHECKOUT_PATH, PAY_INVOICE_PATH } from 'app/template/layout/sidebar/sidebar.component';

/** 'notApplied': the payment will never pay this invoice (invoice cancelled or unknown, payment received but not applied). */
export type PaymentReturnPhase = 'checking' | 'paid' | 'failed' | 'timeout' | 'notApplied';
/** Why the payment was not applied: the invoice was cancelled (VOID), is unknown (404) or the payment was rejected. */
export type NotAppliedReason = 'void' | 'notFound' | 'rejected';

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
  /** Set with the 'notApplied' phase. */
  notAppliedReason: NotAppliedReason | null = null;
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
      if (this.phase === 'timeout') this.stateService.refresh().subscribe();
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

  /** The invoice is known: back to its payment screen (amount + confirmation); otherwise the checkout. */
  retry(): void {
    if (this.invoiceId != null) {
      void this.router.navigate([PAY_INVOICE_PATH], { queryParams: { invoiceId: this.invoiceId } });
      return;
    }
    void this.router.navigate([this.checkoutPath]);
  }

  /** A cancelled or unknown invoice cannot be paid again: the coach starts from the plans. */
  toCheckout(): void {
    void this.router.navigate([this.checkoutPath]);
  }

  /** Text of the 'notApplied' card, from the existing invoice messages; none for a rejected payment. */
  get notAppliedTextKey(): string | null {
    if (this.notAppliedReason === 'void') return 'PAY_INVOICE_NOT_PAYABLE';
    if (this.notAppliedReason === 'notFound') return 'PAY_INVOICE_NOT_FOUND';
    return null;
  }

  goToDashboard(): void {
    void this.router.navigate(['/coach-dashboard']);
  }

  /** Never paid by this payment: invoice cancelled (VOID) or payment received but not applied (to refund). */
  static notAppliedReasonOf(status: InvoicePaymentStatus): NotAppliedReason | null {
    if (status.invoiceVoid || status.status?.toUpperCase() === 'VOID') return 'void';
    return status.paymentRejected ? 'rejected' : null;
  }

  private poll(maxAttempts: number, returnedAsFailed: boolean): void {
    let attempts = 0;
    const invoiceId = this.invoiceId as number;
    this.polling = timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          attempts++;
          // A network error is just one missed check; an unknown invoice (404) will never be paid.
          return this.billingService.getInvoicePaymentStatus(invoiceId).pipe(
            catchError((error: unknown) => of(error instanceof HttpErrorResponse && error.status === 404 ? 'notFound' as const : null)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((status) => {
        if (status === 'notFound') {
          this.notApplied('notFound');
          return;
        }
        if (status?.paid) {
          this.finish('paid');
          this.stateService.refresh().subscribe();
          timer(REDIRECT_DELAY_MS).pipe(takeUntil(this.destroy$)).subscribe(() => this.goToDashboard());
          return;
        }
        const notApplied = status ? PaymentReturnComponent.notAppliedReasonOf(status) : null;
        if (notApplied) {
          this.notApplied(notApplied);
          return;
        }
        if (status?.paymentFailed) {
          this.finish('failed');
          return;
        }
        if (attempts >= maxAttempts) {
          const phase = returnedAsFailed ? 'failed' : 'timeout';
          this.finish(phase);
          // The confirmation may have arrived without this page seeing it: the banner and the locks follow.
          if (phase === 'timeout') this.stateService.refresh().subscribe();
        }
      });
  }

  private notApplied(reason: NotAppliedReason): void {
    this.notAppliedReason = reason;
    this.finish('notApplied');
    // The invoice or the subscription changed (cancelled invoice, refund to review): read the state again.
    this.stateService.refresh().subscribe();
  }

  private finish(phase: PaymentReturnPhase): void {
    this.phase = phase;
    this.polling?.unsubscribe();
  }
}
