import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SubscriptionPlanDto } from '../../../models/subscription-onboarding.model';
import { SubscriptionOnboardingService } from '../../../service/subscription-onboarding.service';
import { LandingPlan, PlanCardComponent } from './plan-card/plan-card.component';

interface PlanHighlight {
  icon: string;
  title: string;
  description: string;
}

interface PlanStep {
  title: string;
  description: string;
}

@Component({
  selector: 'app-plans-landing-page',
  standalone: true,
  imports: [CommonModule, MatIcon, RouterLink, PlanCardComponent, TranslateModule],
  templateUrl: './plans-landing-page.component.html',
  styleUrl: './plans-landing-page.component.scss'
})
export class PlansLandingPageComponent implements OnInit {
  /** A translation key until the plans are there, then the name of a plan. */
  selectedPlanName = 'PLANS_PAGE_SELECT_A_PLAN';
  plans: LandingPlan[] = [];
  isLoading = true;
  loadError: string | null = null;

  highlights: PlanHighlight[] = [
    {
      icon: 'insights',
      title: 'PLANS_PAGE_HL1_TITLE',
      description: 'PLANS_PAGE_HL1_TEXT'
    },
    {
      icon: 'dynamic_form',
      title: 'PLANS_PAGE_HL2_TITLE',
      description: 'PLANS_PAGE_HL2_TEXT'
    },
    {
      icon: 'verified_user',
      title: 'PLANS_PAGE_HL3_TITLE',
      description: 'PLANS_PAGE_HL3_TEXT'
    }
  ];

  steps: PlanStep[] = [
    {
      title: 'PLANS_PAGE_STEP1_TITLE',
      description: 'PLANS_PAGE_STEP1_TEXT'
    },
    {
      title: 'PLANS_PAGE_STEP2_TITLE',
      description: 'PLANS_PAGE_STEP2_TEXT'
    },
    {
      title: 'PLANS_PAGE_STEP3_TITLE',
      description: 'PLANS_PAGE_STEP3_TEXT'
    }
  ];

  constructor(
    private onboardingService: SubscriptionOnboardingService,
    private router: Router,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  selectPlan(plan: LandingPlan): void {
    this.selectedPlanName = plan.name;
    this.router.navigate(['/register'], {
      queryParams: { planId: plan.id }
    });
  }

  loadPlans(): void {
    this.isLoading = true;
    this.loadError = null;

    this.onboardingService.getPlans().subscribe({
      next: (plans) => {
        this.plans = plans.map((plan, index) => this.toLandingPlan(plan, index));
        this.selectedPlanName = this.plans[0]?.name ?? 'PLANS_PAGE_NO_PLANS';
        this.isLoading = false;
      },
      error: () => {
        this.plans = [];
        this.loadError = 'PLANS_PAGE_LOAD_ERROR';
        this.isLoading = false;
      }
    });
  }

  scrollToPlans(): void {
    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private toLandingPlan(plan: SubscriptionPlanDto, index: number): LandingPlan {
    // Free plan (2026-11-10): price 0, no trial (it is free for ever), limited by its number of clients.
    const free = plan.free ?? plan.price === 0;
    const hasTrial = !free && (plan.freeTrialDays ?? 0) > 0;
    const unitRange = this.getUnitRange(plan);
    const tr = (key: string, params?: object) => this.translate.instant(key, params);
    const features = [
      plan.description,
      hasTrial ? tr('PLANS_PAGE_TRIAL_DAYS', { days: plan.freeTrialDays }) : null,
      unitRange ? tr('PLANS_PAGE_SUPPORTS', { range: unitRange }) : null,
      plan.extraFeePerUnit != null ? tr('PLANS_PAGE_EXTRA_FEE', { fee: plan.extraFeePerUnit }) : null
    ].filter((feature): feature is string => !!feature);

    return {
      id: plan.id,
      name: plan.name,
      subtitle: tr(free ? 'PLANS_PAGE_FREE_SUBTITLE' : plan.billingCycle === 'YEARLY' ? 'PLANS_PAGE_BILLED_YEARLY' : 'PLANS_PAGE_BILLED_MONTHLY'),
      price: free ? tr('PLANS_PAGE_FREE') : `${new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 }).format(plan.price)} DT`,
      period: free ? '' : tr(plan.billingCycle === 'YEARLY' ? 'PLANS_PAGE_PER_YEAR' : 'PLANS_PAGE_PER_MONTH'),
      description: plan.description || tr('PLANS_PAGE_DEFAULT_DESCRIPTION'),
      badge: hasTrial ? tr('PLANS_PAGE_DAYS_FREE', { days: plan.freeTrialDays }) : undefined,
      icon: this.getPlanIcon(index),
      ctaLabel: free ? tr('PLANS_PAGE_START_FREE') : hasTrial ? tr('PLANS_PAGE_START_TRIAL') : tr('PLANS_PAGE_CHOOSE', { name: plan.name }),
      highlighted: hasTrial,
      info: [
        { label: tr('PLANS_PAGE_BILLING'), value: tr(free ? 'PLANS_PAGE_NONE' : plan.billingCycle === 'YEARLY' ? 'PLANS_PAGE_YEARLY' : 'PLANS_PAGE_MONTHLY') },
        { label: tr('PLANS_PAGE_PLAN_CODE'), value: plan.planCode }
      ],
      features: features.length ? features : [tr('PLANS_PAGE_PLATFORM_ACCESS')],
      source: plan
    };
  }

  private getUnitRange(plan: SubscriptionPlanDto): string | null {
    if (plan.fromUnits != null && plan.toUnits != null) {
      return this.translate.instant('PLANS_PAGE_UNITS_RANGE', { from: plan.fromUnits, to: plan.toUnits });
    }
    if (plan.toUnits != null) {
      return this.translate.instant('PLANS_PAGE_UNITS_UP_TO', { to: plan.toUnits });
    }
    if (plan.fromUnits != null) {
      return this.translate.instant('PLANS_PAGE_UNITS_FROM', { from: plan.fromUnits });
    }
    return null;
  }

  private getPlanIcon(index: number): string {
    const icons = ['rocket_launch', 'workspace_premium', 'groups'];
    return icons[index % icons.length];
  }
}
