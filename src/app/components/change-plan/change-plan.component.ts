import { Component, OnDestroy, OnInit } from '@angular/core';
import { cardLabel } from 'app/models/coach-subscription-state.model';
import { formatAmount } from 'app/models/subscription-onboarding.model';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { MySubscriptionComponent } from 'app/components/my-subscription/my-subscription.component';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';
import { SalesBillingCycle } from 'app/models/subscription-onboarding.model';
import {
  PaidPlanChangeResult,
  PlanChangeOption,
  PlanChangeOptions,
  ScheduledPlanChangeResult,
} from 'app/models/plan-change.model';

const MY_SUBSCRIPTION_PATH = '/subscription';

/** Refusals with their own message; anything else gets the generic one. */
const KNOWN_ERRORS = ['PLAN_TOO_SMALL', 'UPGRADE_PENDING', 'PAY_FIRST', 'UPGRADE_USE_CHECKOUT', 'PLAN_ARCHIVED',
  'NOT_SAME_LEVEL', 'PAYMENT_IN_PROGRESS', 'NO_PENDING_REQUEST', 'NO_PENDING_DOWNGRADE'];

/**
 * SUB-46: plan-change screen. Every amount and date comes from YoSales (plan-change-options), computed as the change
 * will apply: upgrade (pay now, at once), downgrade (at renewal), monthly -> yearly (pay now, the year starts at the
 * start of the current period), yearly -> monthly (at the end of the year). The coach confirms before any payment.
 * {@code ?planId=} preselects a plan (suggested plan of the client-limit notice, SUB-29).
 */
@Component({
  selector: 'app-change-plan',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FeatherModule],
  templateUrl: './change-plan.component.html',
  styleUrl: './change-plan.component.scss',
})
export class ChangePlanComponent implements OnInit, OnDestroy {
  loading = true;
  loadError = false;
  busy = false;
  error = '';
  success: { key: string; params: Record<string, unknown> } | null = null;
  options: PlanChangeOptions | null = null;
  timeZone: string | undefined;
  cycle: SalesBillingCycle = 'MONTHLY';
  selectedPlanId: number | null = null;
  private requestedPlanId: number | null = null;
  private destroy$ = new Subject<void>();

  /** SUB-62: "Visa •••• 4242" when the payment is charged on the saved card, empty otherwise. */
  savedCard = '';

  /** SUB-61: amounts in the currency of the subscription ("50 TND" / "15 $"). */
  money(amount: number | null | undefined): string {
    return formatAmount(amount, this.options?.currency ?? 'TND');
  }

  constructor(
    private billing: CoachBillingService,
    private stateService: CoachSubscriptionStateService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const planId = Number(this.route.snapshot.queryParamMap.get('planId'));
    this.requestedPlanId = Number.isFinite(planId) && planId > 0 ? planId : null;
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
      options: this.billing.getPlanChangeOptions().pipe(catchError(() => of(null))),
      state: this.stateService.refresh(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ options, state }) => {
        this.loading = false;
        if (!options) {
          this.loadError = true;
          return;
        }
        this.options = options;
        this.timeZone = state?.timeZone || undefined;
        // SUB-62: the payment confirmed here is charged on the saved card (no page).
        this.savedCard = state?.autoCharge && state?.card ? cardLabel(state.card) : '';
        const wanted = options.plans.find((p) => p.planId === (this.requestedPlanId ?? this.selectedPlanId));
        this.cycle = wanted?.billingCycle ?? options.currentCycle ?? 'MONTHLY';
        this.selectedPlanId = wanted && wanted.allowed ? wanted.planId : null;
        this.requestedPlanId = null;
      });
  }

  get visiblePlans(): PlanChangeOption[] {
    return (this.options?.plans ?? []).filter((p) => p.billingCycle === this.cycle);
  }

  get showCycleToggle(): boolean {
    const plans = this.options?.plans ?? [];
    return plans.some((p) => p.billingCycle === 'MONTHLY') && plans.some((p) => p.billingCycle === 'YEARLY');
  }

  get selected(): PlanChangeOption | null {
    return this.options?.plans.find((p) => p.planId === this.selectedPlanId) ?? null;
  }

  /** Nothing can be changed now (late, blocked, trial): the screen says what to do instead. */
  get blockedCode(): string | null {
    return this.options?.blockedCode ?? null;
  }

  setCycle(cycle: SalesBillingCycle): void {
    if (this.cycle === cycle || this.busy) return;
    this.cycle = cycle;
    this.selectedPlanId = null;
    this.error = '';
  }

  select(plan: PlanChangeOption): void {
    if (!plan.allowed || this.busy) return;
    this.selectedPlanId = plan.planId;
    this.error = '';
    this.success = null;
  }

  /** The line under a plan: what the change costs and when it applies, or why it is not possible. */
  lineOf(plan: PlanChangeOption): { key: string; params: Record<string, unknown> } | null {
    if (plan.kind === 'CURRENT') return { key: 'CHANGE_PLAN_LINE_CURRENT', params: {} };
    if (!plan.allowed) {
      const code = plan.refusalCode ?? '';
      return {
        key: KNOWN_ERRORS.includes(code) ? `CHANGE_PLAN_REFUSED_${code}` : 'CHANGE_PLAN_REFUSED',
        params: { count: plan.clientsToArchive ?? '' },
      };
    }
    switch (plan.kind) {
      case 'UPGRADE':
        return plan.amountNow
          ? { key: 'CHANGE_PLAN_LINE_UPGRADE', params: { amount: this.amount(plan.amountNow) } }
          : { key: 'CHANGE_PLAN_LINE_UPGRADE_FREE', params: {} };
      case 'TO_YEARLY':
        return {
          key: plan.amountNow ? 'CHANGE_PLAN_LINE_TO_YEARLY' : 'CHANGE_PLAN_LINE_TO_YEARLY_FREE',
          params: { amount: this.amount(plan.amountNow ?? 0), start: this.day(plan.periodStart), end: this.lastDay(plan.periodEnd) },
        };
      case 'DOWNGRADE':
        return { key: 'CHANGE_PLAN_LINE_DOWNGRADE', params: { date: this.day(plan.effectiveAt) } };
      case 'TO_MONTHLY':
        return { key: 'CHANGE_PLAN_LINE_TO_MONTHLY', params: { date: this.day(plan.effectiveAt) } };
      default:
        return null;
    }
  }

  /** The change needs a payment now: the button says how much. */
  paysNow(plan: PlanChangeOption): boolean {
    return (plan.kind === 'UPGRADE' || plan.kind === 'TO_YEARLY') && !!plan.amountNow;
  }

  confirm(): void {
    const plan = this.selected;
    if (!plan || !plan.allowed || this.busy) return;
    this.busy = true;
    this.error = '';
    this.success = null;
    switch (plan.kind) {
      case 'UPGRADE':
        this.paid(plan, this.billing.requestUpgrade(plan.planId));
        break;
      case 'TO_YEARLY':
        this.paid(plan, this.billing.switchToYearly(plan.planId));
        break;
      case 'DOWNGRADE':
        this.scheduled(plan, this.billing.requestDowngrade(plan.planId));
        break;
      case 'TO_MONTHLY':
        this.scheduled(plan, this.billing.switchToMonthly(plan.planId));
        break;
      default:
        this.busy = false;
    }
  }

  /** Pays the change waiting for payment (Flouci, chosen by the system). */
  payPending(): void {
    const pending = this.options?.pendingRequest;
    if (!pending || this.busy || pending.paymentInProgress) return;
    this.busy = true;
    this.error = '';
    this.pay(pending.invoiceId);
  }

  cancelPending(): void {
    if (!this.options?.pendingRequest || this.busy) return;
    this.run(this.billing.cancelPendingRequest(), { key: 'CHANGE_PLAN_PENDING_CANCELLED', params: {} });
  }

  cancelScheduled(): void {
    if (!this.options?.scheduledChange || this.busy) return;
    this.run(this.billing.cancelScheduledChange(), { key: 'CHANGE_PLAN_SCHEDULED_CANCELLED', params: {} });
  }

  /** Where a blocked coach goes: pay the late renewal on "My subscription", else the payment screen. */
  goToPayment(): void {
    const late = this.options?.status === 'PAST_DUE';
    void this.router.navigate([late ? MY_SUBSCRIPTION_PATH : CHECKOUT_PATH]);
  }

  backToSubscription(): void {
    void this.router.navigate([MY_SUBSCRIPTION_PATH]);
  }

  day(instant: string | null | undefined): string {
    return instant ? MySubscriptionComponent.day(instant, this.timeZone) : '';
  }

  /** Last day included before an exclusive end. */
  lastDay(instant: string | null | undefined): string {
    return instant ? MySubscriptionComponent.lastDay(instant, this.timeZone) : '';
  }

  /** SUB-61: an amount with its currency ("50 TND", "4,33 $"): the texts no longer say TND themselves. */
  amount(value: number | null | undefined): string {
    return formatAmount(value ?? 0, this.options?.currency ?? 'TND');
  }

  protected redirectTo(url: string): void {
    window.location.assign(url);
  }

  private paid(plan: PlanChangeOption, request: Observable<PaidPlanChangeResult>): void {
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (result?.invoice?.id) {
          this.pay(result.invoice.id);
          return;
        }
        this.done({ key: 'CHANGE_PLAN_DONE_NOW', params: { plan: plan.planName } });
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private scheduled(plan: PlanChangeOption, request: Observable<ScheduledPlanChangeResult>): void {
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => this.done({
        key: 'CHANGE_PLAN_DONE_SCHEDULED',
        params: { plan: plan.planName, date: this.day(result?.effectiveAt ?? plan.effectiveAt) },
      }),
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private pay(invoiceId: number): void {
    this.billing.initiateInvoicePayment(invoiceId, 'FLOUCI').pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const url = response?.redirectUrl?.trim();
        if (url) {
          this.redirectTo(url);
          return;
        }
        if (response?.status === 'PAID') {
          // SUB-49: nothing to pay (100% promo code): already paid, no Flouci page.
          void this.router.navigate(['/payment/success'], { queryParams: { invoiceId } });
          return;
        }
        this.busy = false;
        this.error = 'CHECKOUT_PAYMENT_PAGE_ERROR';
        this.load(); // the request now waits for payment: show it
      },
      error: () => {
        this.busy = false;
        this.error = 'CHECKOUT_PAYMENT_ERROR';
        this.load();
      },
    });
  }

  private run(request: Observable<unknown>, success: { key: string; params: Record<string, unknown> }): void {
    this.busy = true;
    this.error = '';
    this.success = null;
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.done(success),
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private done(success: { key: string; params: Record<string, unknown> }): void {
    this.busy = false;
    this.success = success;
    this.selectedPlanId = null;
    this.load(); // options, state (sidebar, banner, limits through states$)
  }

  private fail(error: HttpErrorResponse): void {
    this.busy = false;
    const code = error?.error?.code ?? '';
    this.error = KNOWN_ERRORS.includes(code) ? `CHANGE_PLAN_ERROR_${code}` : 'CHANGE_PLAN_ERROR';
    this.load(); // the situation changed meanwhile: show the current one
  }
}
