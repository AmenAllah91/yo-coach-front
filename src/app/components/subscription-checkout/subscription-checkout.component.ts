import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { CoachSubscriptionState, indicativeUsd } from 'app/models/coach-subscription-state.model';
import { CheckoutQuote, SalesBillingCycle, SubscriptionPlanDto } from 'app/models/subscription-onboarding.model';

/** Promo code refusals that have their own message (SUB-45); anything else gets the generic one. */
const PROMO_ERRORS = ['COUPON_NOT_FOUND', 'COUPON_EXPIRED', 'COUPON_NOT_FOR_PLAN', 'COUPON_EXHAUSTED',
  'COUPON_ALREADY_APPLIED', 'COUPON_NOT_ALLOWED', 'PAYMENT_IN_PROGRESS'];

/** SUB-23: the payment return page, which confirms the payment and refreshes the subscription. */
export const PAYMENT_SUCCESS_PATH = '/payment/success';

/** Statuses for which the coach starts (or restarts) a paid plan from this screen. */
const PAYABLE_STATUSES = ['TRIAL', 'EXPIRED', 'CANCELLED', 'PENDING'];

/**
 * SUB-22: payment screen. The chosen plan is preselected, the coach can switch plan or cycle, plans too small for
 * the active clients are greyed, and "Pay with Flouci" creates the invoice (checkout) then opens the Flouci page.
 * SUB-45: the amount shown is the one YoSales will bill (promo codes included), and the coach can enter a promo code.
 */
@Component({
  selector: 'app-subscription-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FeatherModule],
  templateUrl: './subscription-checkout.component.html',
  styleUrl: './subscription-checkout.component.scss',
})
export class SubscriptionCheckoutComponent implements OnInit, OnDestroy {
  loading = true;
  loadError = false;
  paying = false;
  payError = '';
  state: CoachSubscriptionState | null = null;
  plans: SubscriptionPlanDto[] = [];
  cycle: SalesBillingCycle = 'MONTHLY';
  selectedPlanId: number | null = null;
  quote: CheckoutQuote | null = null;
  promoCode = '';
  promoBusy = false;
  promoError = '';
  private destroy$ = new Subject<void>();
  private quote$ = new Subject<void>();

  constructor(
    private stateService: CoachSubscriptionStateService,
    private billingService: CoachBillingService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.quote$.complete();
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    forkJoin({
      state: this.stateService.refresh(),
      plans: this.billingService.getPlans().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ state, plans }) => {
        this.loading = false;
        if (!state || !plans) {
          this.loadError = true;
          return;
        }
        this.state = state;
        this.plans = [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        const current = this.plans.find((p) => p.id === state.planId);
        this.cycle = current?.billingCycle ?? (this.hasCycle('MONTHLY') ? 'MONTHLY' : 'YEARLY');
        this.selectedPlanId = current && !this.isTooSmall(current) ? current.id : null;
        this.selectDefaultIfNeeded();
        this.refreshQuote();
      });
  }

  /** The quote of the selected plan, when it is the one shown (it can arrive after a plan change). */
  /** SUB-60: indicative whole-dollar amount for a coach outside Tunisia (null = not shown). */
  usd(amountTnd: number | null | undefined): number | null {
    return indicativeUsd(amountTnd, this.state);
  }

  /** SUB-49: a 100% promo code: nothing to pay, the subscription is activated without Flouci. */
  get nothingToPay(): boolean {
    return this.selectedQuote?.amount === 0;
  }

  get selectedQuote(): CheckoutQuote | null {
    return this.quote && this.quote.planId === this.selectedPlanId ? this.quote : null;
  }

  setPromoCode(value: string): void {
    this.promoCode = value;
    this.promoError = '';
  }

  applyPromo(): void {
    const code = this.promoCode.trim();
    const plan = this.selectedPlan;
    if (!code || !plan || this.promoBusy || this.paying) return;
    this.promoBusy = true;
    this.promoError = '';
    this.billingService
      .applyCoupon(code, plan.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (quote) => {
          this.promoBusy = false;
          this.promoCode = '';
          this.quote = quote;
        },
        error: (error: HttpErrorResponse) => {
          this.promoBusy = false;
          const code = error?.error?.code;
          this.promoError = PROMO_ERRORS.includes(code) ? `CHECKOUT_PROMO_${code}` : 'CHECKOUT_PROMO_ERROR';
        },
      });
  }

  removePromo(code: string): void {
    const plan = this.selectedPlan;
    if (!plan || this.promoBusy || this.paying) return;
    this.promoBusy = true;
    this.promoError = '';
    this.billingService
      .removeCoupon(code, plan.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (quote) => {
          this.promoBusy = false;
          this.quote = quote;
        },
        error: () => {
          this.promoBusy = false;
          this.promoError = 'CHECKOUT_PROMO_ERROR';
        },
      });
  }

  get canPay(): boolean {
    return !!this.state?.status && PAYABLE_STATUSES.includes(this.state.status);
  }

  get isTrial(): boolean {
    return this.state?.status === 'TRIAL';
  }

  get visiblePlans(): SubscriptionPlanDto[] {
    return this.plans.filter((p) => p.billingCycle === this.cycle);
  }

  get selectedPlan(): SubscriptionPlanDto | null {
    return this.plans.find((p) => p.id === this.selectedPlanId) ?? null;
  }

  get showCycleToggle(): boolean {
    return this.hasCycle('MONTHLY') && this.hasCycle('YEARLY');
  }

  hasCycle(cycle: SalesBillingCycle): boolean {
    return this.plans.some((p) => p.billingCycle === cycle);
  }

  setCycle(cycle: SalesBillingCycle): void {
    if (this.cycle === cycle) return;
    this.cycle = cycle;
    this.payError = '';
    // Keep the same plan name in the other cycle when it exists ("Pro" monthly -> "Pro" yearly).
    const name = this.selectedPlan?.name?.trim().toLowerCase();
    const twin = this.visiblePlans.find((p) => p.name?.trim().toLowerCase() === name && !this.isTooSmall(p));
    this.selectedPlanId = twin?.id ?? null;
    this.selectDefaultIfNeeded();
    this.refreshQuote();
  }

  select(plan: SubscriptionPlanDto): void {
    if (this.isTooSmall(plan) || this.paying) return;
    this.selectedPlanId = plan.id;
    this.payError = '';
    this.promoError = '';
    this.refreshQuote();
  }

  /** A plan whose upper limit is below the coach's active clients cannot be chosen (YoSales refuses it too). */
  isTooSmall(plan: SubscriptionPlanDto): boolean {
    const active = this.state?.activeClients;
    return active != null && plan.toUnits != null && active > plan.toUnits;
  }

  isCurrent(plan: SubscriptionPlanDto): boolean {
    return plan.id === this.state?.planId;
  }

  pay(): void {
    const plan = this.selectedPlan;
    if (!plan || this.paying || !this.canPay) return;
    this.paying = true;
    this.payError = '';
    this.billingService
      .checkout(plan.id)
      .pipe(
        // SUB-49: an invoice already paid by a 100% promo code never goes to Flouci.
        switchMap((invoice) => invoice?.status === 'PAID'
          ? of({ invoiceId: invoice.id, status: 'PAID', redirectUrl: null as string | null })
          : this.billingService.initiateInvoicePayment(invoice.id, 'FLOUCI').pipe(map((r) => ({ ...r, invoiceId: invoice.id })))),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          const url = response?.redirectUrl?.trim();
          if (url) {
            this.redirectTo(url);
            return;
          }
          if (response?.status === 'PAID') {
            void this.router.navigate([PAYMENT_SUCCESS_PATH], { queryParams: { invoiceId: response.invoiceId } });
            return;
          }
          this.paying = false;
          this.payError = 'CHECKOUT_PAYMENT_PAGE_ERROR';
        },
        error: (error: HttpErrorResponse) => {
          this.paying = false;
          const code = error?.error?.code;
          this.payError = code === 'PLAN_TOO_SMALL' ? 'CHECKOUT_PLAN_TOO_SMALL'
            : code === 'PLAN_ARCHIVED' ? 'CHECKOUT_PLAN_ARCHIVED' : 'CHECKOUT_PAYMENT_ERROR';
          if (code === 'PLAN_TOO_SMALL' || code === 'PLAN_ARCHIVED') {
            // The client count changed meanwhile: reload to grey the right plans.
            this.load();
          }
        },
      });
  }

  goToDashboard(): void {
    void this.router.navigate(['/coach-dashboard']);
  }

  /** Leaves the app for the Flouci payment page. */
  protected redirectTo(url: string): void {
    window.location.assign(url);
  }

  /** Asks YoSales the amount of the selected plan; a quote that comes back late for another plan is ignored. */
  private refreshQuote(): void {
    this.quote$.next();
    const planId = this.selectedPlanId;
    if (planId == null || !this.canPay) return;
    this.billingService
      .getCheckoutQuote(planId)
      .pipe(catchError(() => of(null)), takeUntil(this.quote$), takeUntil(this.destroy$))
      .subscribe((quote) => {
        if (quote && quote.planId === this.selectedPlanId) this.quote = quote;
      });
  }

  private selectDefaultIfNeeded(): void {
    if (this.selectedPlanId != null) return;
    this.selectedPlanId = this.visiblePlans.find((p) => !this.isTooSmall(p))?.id ?? null;
  }
}
