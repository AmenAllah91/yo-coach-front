import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
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
  imports: [CommonModule, MatIcon, RouterLink, PlanCardComponent],
  templateUrl: './plans-landing-page.component.html',
  styleUrl: './plans-landing-page.component.scss'
})
export class PlansLandingPageComponent implements OnInit {
  selectedPlanName = 'Select a plan';
  plans: LandingPlan[] = [];
  isLoading = true;
  loadError: string | null = null;

  highlights: PlanHighlight[] = [
    {
      icon: 'insights',
      title: 'Clear plan comparison',
      description: 'Compare pricing, billing frequency, limits, and free trials in one clean view.'
    },
    {
      icon: 'dynamic_form',
      title: 'Live subscription catalog',
      description: 'Every offer shown here is loaded directly from the YoCoach subscription catalog.'
    },
    {
      icon: 'verified_user',
      title: 'Safe onboarding',
      description: 'Your account, customer profile, and subscription are created together.'
    }
  ];

  steps: PlanStep[] = [
    {
      title: 'Pick a plan',
      description: 'Compare each offer and choose the right starting point.'
    },
    {
      title: 'Create your account',
      description: 'Register once with the selected plan already attached.'
    },
    {
      title: 'Start coaching',
      description: 'Your customer profile and subscription are prepared automatically.'
    }
  ];

  constructor(
    private onboardingService: SubscriptionOnboardingService,
    private router: Router
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
        this.selectedPlanName = this.plans[0]?.name ?? 'No plans available';
        this.isLoading = false;
      },
      error: () => {
        this.plans = [];
        this.loadError = 'We could not load the plans. Please try again.';
        this.isLoading = false;
      }
    });
  }

  scrollToPlans(): void {
    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private toLandingPlan(plan: SubscriptionPlanDto, index: number): LandingPlan {
    const hasTrial = (plan.freeTrialDays ?? 0) > 0;
    const unitRange = this.getUnitRange(plan);
    const features = [
      plan.description,
      hasTrial ? `${plan.freeTrialDays}-day free trial` : null,
      unitRange ? `Supports ${unitRange}` : null,
      plan.extraFeePerUnit != null ? `${plan.extraFeePerUnit} DT per additional unit` : null
    ].filter((feature): feature is string => !!feature);

    return {
      id: plan.id,
      name: plan.name,
      subtitle: plan.billingCycle === 'YEARLY' ? 'Billed yearly' : 'Billed monthly',
      price: `${new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 }).format(plan.price)} DT`,
      period: plan.billingCycle === 'YEARLY' ? '/ year' : '/ month',
      description: plan.description || 'A YoCoach subscription plan built for coaching businesses.',
      badge: hasTrial ? `${plan.freeTrialDays} days free` : undefined,
      icon: this.getPlanIcon(index),
      ctaLabel: hasTrial ? 'Start free trial' : `Choose ${plan.name}`,
      highlighted: hasTrial,
      info: [
        { label: 'Billing', value: plan.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly' },
        { label: 'Plan code', value: plan.planCode }
      ],
      features: features.length ? features : ['YoCoach platform access']
    };
  }

  private getUnitRange(plan: SubscriptionPlanDto): string | null {
    if (plan.fromUnits != null && plan.toUnits != null) {
      return `${plan.fromUnits}-${plan.toUnits} units`;
    }
    if (plan.toUnits != null) {
      return `up to ${plan.toUnits} units`;
    }
    if (plan.fromUnits != null) {
      return `${plan.fromUnits}+ units`;
    }
    return null;
  }

  private getPlanIcon(index: number): string {
    const icons = ['rocket_launch', 'workspace_premium', 'groups'];
    return icons[index % icons.length];
  }
}
