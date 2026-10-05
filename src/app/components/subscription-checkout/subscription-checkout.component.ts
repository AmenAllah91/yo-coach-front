import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';

import { CoachBillingService } from 'app/service/coach-billing.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { SubscriptionOnboardingService } from 'app/service/subscription-onboarding.service';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { SalesBillingCycle, SubscriptionPlanDto } from 'app/models/subscription-onboarding.model';

/** Statuses for which the coach starts (or restarts) a paid plan from this screen. */
const PAYABLE_STATUSES = ['TRIAL', 'EXPIRED', 'CANCELLED', 'PENDING'];

/**
 * SUB-22: payment screen. The chosen plan is preselected, the coach can switch plan or cycle, plans too small for
 * the active clients are greyed, and "Pay with Flouci" creates the invoice (checkout) then opens the Flouci page.
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
  private destroy$ = new Subject<void>();

  constructor(
    private stateService: CoachSubscriptionStateService,
    private onboardingService: SubscriptionOnboardingService,
    private billingService: CoachBillingService,
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
      plans: this.onboardingService.getPlans().pipe(catchError(() => of(null))),
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
  }

  select(plan: SubscriptionPlanDto): void {
    if (this.isTooSmall(plan) || this.paying) return;
    this.selectedPlanId = plan.id;
    this.payError = '';
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
        switchMap((invoice) => this.billingService.initiateInvoicePayment(invoice.id, 'FLOUCI')),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          const url = response?.redirectUrl?.trim();
          if (url) {
            this.redirectTo(url);
            return;
          }
          this.paying = false;
          this.payError = 'CHECKOUT_PAYMENT_PAGE_ERROR';
        },
        error: (error: HttpErrorResponse) => {
          this.paying = false;
          this.payError = error?.error?.code === 'PLAN_TOO_SMALL' ? 'CHECKOUT_PLAN_TOO_SMALL' : 'CHECKOUT_PAYMENT_ERROR';
          if (error?.error?.code === 'PLAN_TOO_SMALL') {
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

  private selectDefaultIfNeeded(): void {
    if (this.selectedPlanId != null) return;
    this.selectedPlanId = this.visiblePlans.find((p) => !this.isTooSmall(p))?.id ?? null;
  }
}
