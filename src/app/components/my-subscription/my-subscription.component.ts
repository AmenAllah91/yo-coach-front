import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { CoachInvoice } from 'app/models/coach-invoice.model';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';
import { CHANGE_PLAN_PATH } from 'app/components/change-plan/change-plan.path';

/** Invoices the coach can still pay. */
const PAYABLE = ['UNPAID', 'OVERDUE', 'PENDING'];
/** Statuses in which the coach can cancel (SUB-35). */
const CANCELLABLE = ['ACTIVE', 'TRIAL', 'PAST_DUE'];
/** Read-only statuses: the coach reactivates through the payment screen (SUB-18). */
const READ_ONLY = ['EXPIRED', 'CANCELLED', 'PENDING'];

/**
 * SUB-37: "My subscription": plan, status, next payment date, invoices (pay an open one), cancel / take the
 * cancellation back, reactivate when read-only. Every rule comes from YoSales (SUB-13); the page only shows it.
 */
@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './my-subscription.component.html',
  styleUrl: './my-subscription.component.scss',
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  loading = true;
  loadError = false;
  state: CoachSubscriptionState | null = null;
  invoices: CoachInvoice[] = [];
  busy = false;
  payingInvoiceId: number | null = null;
  actionError = '';
  private destroy$ = new Subject<void>();

  constructor(
    private stateService: CoachSubscriptionStateService,
    private billing: CoachBillingService,
    private translate: TranslateService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    forkJoin({
      state: this.stateService.refresh(),
      invoices: this.billing.getInvoices().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ state, invoices }) => {
        this.loading = false;
        this.state = state;
        this.invoices = invoices ?? [];
        this.loadError = !state;
      });
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
        return s.currentPeriodEnd ? { key: 'MY_SUB_NEXT_PAYMENT', date: MySubscriptionComponent.day(s.currentPeriodEnd, zone) } : null;
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
    const confirmed = await this.confirm(
      this.translate.instant('MY_SUB_CANCEL_CONFIRM_TITLE'),
      this.translate.instant('MY_SUB_CANCEL_CONFIRM_TEXT', { date: until }),
      this.translate.instant('MY_SUB_CANCEL'),
    );
    if (!confirmed) return;
    this.run(this.billing.cancelSubscription());
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
