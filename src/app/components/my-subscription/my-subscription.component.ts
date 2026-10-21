import { Component, OnDestroy, OnInit } from '@angular/core';
import { formatAmount } from 'app/models/subscription-onboarding.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { CoachInvoice } from 'app/models/coach-invoice.model';
import { CoachSubscriptionState, cardExpiry, cardLabel, indicativeUsd } from 'app/models/coach-subscription-state.model';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';
import { CHANGE_PLAN_PATH } from 'app/components/change-plan/change-plan.path';
import { CancelSubscriptionDialogComponent } from './cancel-subscription-dialog/cancel-subscription-dialog.component';

/** Invoices the coach can still pay. */
const PAYABLE = ['UNPAID', 'OVERDUE', 'PENDING'];
/** Statuses in which the coach can cancel (SUB-35). */
const CANCELLABLE = ['ACTIVE', 'TRIAL', 'PAST_DUE'];
/** Read-only statuses: the coach reactivates through the payment screen (SUB-18). */
const READ_ONLY = ['EXPIRED', 'CANCELLED', 'PENDING'];
/** Invoices per page of the invoice list. */
export const INVOICES_PER_PAGE = 5;

/**
 * SUB-37: "My subscription": plan, status, next payment date, invoices (pay an open one), cancel / take the
 * cancellation back, reactivate when read-only. Every rule comes from YoSales (SUB-13); the page only shows it.
 */
@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, CancelSubscriptionDialogComponent],
  templateUrl: './my-subscription.component.html',
  styleUrl: './my-subscription.component.scss',
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  loading = true;
  loadError = false;
  state: CoachSubscriptionState | null = null;

  /** SUB-61: "50 TND" or "15 $" (currency of the invoice). */
  money(amount: number | null | undefined, currency?: string | null): string {
    return formatAmount(amount, currency ?? this.state?.currency ?? 'TND');
  }

  /** SUB-60: indicative whole-dollar amount for a coach outside Tunisia (null = not shown). */
  usd(amountTnd: number | null | undefined, currency?: string | null): number | null {
    return (currency ?? 'TND').toUpperCase() === 'TND' ? indicativeUsd(amountTnd, this.state) : null;
  }
  invoices: CoachInvoice[] = [];
  /** The invoices come from YoSales, slower than the plan: they load in their own block. */
  invoicesLoading = false;
  /** Page of the invoice list, from 0. */
  invoicePage = 0;
  busy = false;
  /** SUB-35: cancellation dialog shown, with the last day of access. */
  cancelDialog: { until: string } | null = null;
  private resolveCancelDialog?: (confirmed: boolean) => void;
  payingInvoiceId: number | null = null;
  actionError = '';
  private destroy$ = new Subject<void>();

  constructor(
    private stateService: CoachSubscriptionStateService,
    private billing: CoachBillingService,
    private translate: TranslateService,
    private router: Router,
  ) {}

  /** SUB-62: back from the Stripe page of "change my card" (?card=saved or ?card=cancelled). */
  cardNotice: 'saved' | 'cancelled' | null = null;

  ngOnInit(): void {
    const card = this.router.url ? this.router.parseUrl(this.router.url).queryParams['card'] : null;
    this.cardNotice = card === 'saved' || card === 'cancelled' ? card : null;
    this.load();
  }

  /** SUB-62: the subscription is paid by card (Stripe): card, automatic renewal, change of card. */
  get paidByCard(): boolean {
    return (this.state?.paymentGateway ?? '').toUpperCase() === 'STRIPE';
  }

  get cardLabel(): string {
    return cardLabel(this.state?.card);
  }

  get cardExpiry(): string {
    return cardExpiry(this.state?.card);
  }

  /** SUB-62: Stripe page where the coach saves another card (no money moves). */
  changeCard(): void {
    if (this.busy) return;
    this.busy = true;
    this.actionError = '';
    this.billing.startCardChange().subscribe({
      next: (link) => {
        const url = link?.redirectUrl?.trim();
        if (url) {
          this.redirectTo(url);
          return;
        }
        this.busy = false;
        this.actionError = 'CHECKOUT_PAYMENT_PAGE_ERROR';
      },
      error: () => {
        this.busy = false;
        this.actionError = 'MY_SUB_CARD_ERROR';
      },
    });
  }

  /** SUB-62: automatic renewal on the saved card, or "I pay each invoice myself" (invoice by link). */
  async setAutoCharge(enabled: boolean): Promise<void> {
    if (this.busy || !this.state || this.state.autoCharge === enabled) return;
    if (!enabled) {
      const confirmed = await this.confirm(
        this.translate.instant('MY_SUB_PAY_MYSELF_CONFIRM_TITLE'),
        this.translate.instant('MY_SUB_PAY_MYSELF_CONFIRM_TEXT'),
        this.translate.instant('MY_SUB_PAY_MYSELF'),
      );
      if (!confirmed) return;
    }
    this.busy = true;
    this.actionError = '';
    this.billing.setAutoCharge(enabled).subscribe({
      next: () => {
        this.busy = false;
        this.load();
      },
      error: () => {
        this.busy = false;
        this.actionError = 'MY_SUB_CARD_ERROR';
      },
    });
  }

  ngOnDestroy(): void {
    this.closeCancelDialog(false);
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * The plan shows at once with the state already read in this session, then refreshes; the invoices (slower,
   * from YoSales) arrive in their own block instead of holding the whole page.
   */
  load(): void {
    const known = this.stateService.snapshot;
    this.loading = !known;
    this.loadError = false;
    if (known) this.state = known;
    this.stateService.refresh()
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.loading = false;
        this.state = state ?? (known || null);
        this.loadError = !this.state;
      });

    // The invoices already read in this session (or prefetched by the settings page) show at once, then refresh.
    const knownInvoices = this.billing.invoicesSnapshot;
    if (knownInvoices) this.invoices = knownInvoices;
    this.invoicesLoading = !knownInvoices;
    this.billing.getInvoices()
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe((invoices) => {
        this.invoicesLoading = false;
        this.invoices = invoices ?? [];
        // After a reload (payment, cancellation) the coach stays on the same page when it still exists.
        this.invoicePage = Math.min(this.invoicePage, Math.max(0, this.invoicePageCount - 1));
      });
  }

  get invoicePageCount(): number {
    return Math.ceil(this.invoices.length / INVOICES_PER_PAGE);
  }

  /** Page numbers of the invoice list, from 0. */
  get invoicePages(): number[] {
    return Array.from({ length: this.invoicePageCount }, (_, page) => page);
  }

  /** The invoices of the current page. */
  get pagedInvoices(): CoachInvoice[] {
    const start = this.invoicePage * INVOICES_PER_PAGE;
    return this.invoices.slice(start, start + INVOICES_PER_PAGE);
  }

  goToInvoicePage(page: number): void {
    if (page < 0 || page >= this.invoicePageCount || page === this.invoicePage) return;
    this.invoicePage = page;
  }

  get status(): string {
    return this.state?.status ?? 'NONE';
  }

  get canCancel(): boolean {
    return CANCELLABLE.includes(this.status) && !this.state?.cancelAtPeriodEnd;
  }

  get canResume(): boolean {
    return CANCELLABLE.includes(this.status) && !!this.state?.cancelAtPeriodEnd;
  }

  get isReadOnly(): boolean {
    return READ_ONLY.includes(this.status) || (!!this.state?.readOnly && !this.state?.status);
  }

  get isTrial(): boolean {
    return this.status === 'TRIAL';
  }

  /** The main date line of the summary, already translated with its date. */
  get dateLine(): { key: string; date: string } | null {
    const s = this.state;
    if (!s) return null;
    const zone = s.timeZone || undefined;
    if (s.cancelAtPeriodEnd && s.accessUntil) {
      return { key: 'MY_SUB_ACCESS_UNTIL', date: MySubscriptionComponent.lastDay(s.accessUntil, zone) };
    }
    switch (s.status) {
      case 'TRIAL':
        return s.trialEndsAt ? { key: 'MY_SUB_TRIAL_UNTIL', date: MySubscriptionComponent.lastDay(s.trialEndsAt, zone) } : null;
      case 'ACTIVE':
        if (!s.currentPeriodEnd) return null;
        // SUB-62: renewed on the saved card, no action of the coach.
        return { key: s.autoCharge && s.card ? 'MY_SUB_NEXT_CHARGE' : 'MY_SUB_NEXT_PAYMENT', date: MySubscriptionComponent.day(s.currentPeriodEnd, zone) };
      case 'PAST_DUE':
        return s.openInvoiceDueDate ? { key: 'MY_SUB_PAY_BEFORE', date: MySubscriptionComponent.formatDay(s.openInvoiceDueDate) } : null;
      default:
        return null;
    }
  }

  /** For the template: yyyy-MM-dd as dd/MM/yyyy. */
  formatDay(day: string | null | undefined): string {
    return MySubscriptionComponent.formatDay(day);
  }

  isPayable(invoice: CoachInvoice): boolean {
    return PAYABLE.includes((invoice.status || '').toUpperCase());
  }

  statusKey(invoiceStatus: string | null | undefined): string {
    return 'INVOICE_STATUS_' + (invoiceStatus || 'UNKNOWN').toUpperCase();
  }

  pay(invoice: CoachInvoice): void {
    if (this.payingInvoiceId != null || !this.isPayable(invoice)) return;
    this.payingInvoiceId = invoice.id;
    this.actionError = '';
    // The system chooses Flouci (SUB-20).
    this.billing.initiateInvoicePayment(invoice.id, 'FLOUCI').subscribe({
      next: (response) => {
        const url = response?.redirectUrl?.trim();
        if (url) {
          this.redirectTo(url);
          return;
        }
        if (response?.status === 'PAID') {
          // SUB-49: nothing to pay (100% promo code): already paid, no Flouci page.
          void this.router.navigate(['/payment/success'], { queryParams: { invoiceId: invoice.id } });
          return;
        }
        this.payingInvoiceId = null;
        this.actionError = 'CHECKOUT_PAYMENT_PAGE_ERROR';
      },
      error: () => {
        this.payingInvoiceId = null;
        this.actionError = 'CHECKOUT_PAYMENT_ERROR';
      },
    });
  }

  async cancel(): Promise<void> {
    if (!this.canCancel || this.busy) return;
    const until = this.state?.accessUntil
      ? MySubscriptionComponent.lastDay(this.state.accessUntil, this.state.timeZone || undefined) : '';
    const confirmed = await this.confirmCancellation(until);
    if (!confirmed) return;
    this.run(this.billing.cancelSubscription());
  }

  /** Opens the cancellation dialog; the coach's answer settles the returned promise. */
  protected confirmCancellation(until: string): Promise<boolean> {
    this.resolveCancelDialog?.(false);
    this.cancelDialog = { until };
    return new Promise((resolve) => (this.resolveCancelDialog = resolve));
  }

  closeCancelDialog(confirmed: boolean): void {
    const resolve = this.resolveCancelDialog;
    this.cancelDialog = null;
    this.resolveCancelDialog = undefined;
    resolve?.(confirmed);
  }

  resume(): void {
    if (!this.canResume || this.busy) return;
    this.run(this.billing.resumeSubscription());
  }

  reactivate(): void {
    void this.router.navigate([CHECKOUT_PATH]);
  }

  /** SUB-46: a paying coach changes plan (upgrade, downgrade, monthly / yearly). */
  get canChangePlan(): boolean {
    return this.status === 'ACTIVE';
  }

  changePlan(planId?: number): void {
    void this.router.navigate([CHANGE_PLAN_PATH], { queryParams: planId ? { planId } : undefined });
  }

  protected redirectTo(url: string): void {
    window.location.assign(url);
  }

  protected async confirm(title: string, text: string, confirmButtonText: string): Promise<boolean> {
    const result = await Swal.fire({
      title, text, icon: 'warning', showCancelButton: true, focusCancel: true,
      confirmButtonText, cancelButtonText: this.translate.instant('MY_SUB_KEEP'),
    });
    return !!result.isConfirmed;
  }

  private run(action: ReturnType<CoachBillingService['cancelSubscription']>): void {
    this.busy = true;
    this.actionError = '';
    action.subscribe({
      next: () => {
        this.busy = false;
        this.load(); // state (and the sidebar, banner, buttons through states$) and invoices
      },
      error: (err) => {
        this.busy = false;
        this.actionError = err?.error?.code === 'RESUME_NOT_ALLOWED' ? 'MY_SUB_RESUME_NOT_ALLOWED' : 'MY_SUB_ACTION_ERROR';
      },
    });
  }

  /** Calendar day of an instant in the coach zone, dd/MM/yyyy. */
  static day(instant: string, timeZone?: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(instant));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('day')}/${get('month')}/${get('year')}`;
  }

  /** The last day included before an end (an end is the first instant without access), dd/MM/yyyy. */
  static lastDay(exclusiveEnd: string, timeZone?: string): string {
    const [d, m, y] = MySubscriptionComponent.day(exclusiveEnd, timeZone).split('/').map(Number);
    const previous = new Date(Date.UTC(y, m - 1, d - 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(previous.getUTCDate())}/${pad(previous.getUTCMonth() + 1)}/${previous.getUTCFullYear()}`;
  }

  /** yyyy-MM-dd as dd/MM/yyyy. */
  static formatDay(day: string | null | undefined): string {
    if (!day) return '';
    const [y, m, d] = day.slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : day;
  }
}
