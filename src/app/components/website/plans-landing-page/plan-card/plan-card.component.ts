import { CommonModule } from '@angular/common';
import { PlanFeatureListComponent } from 'app/components/plan-feature-list/plan-feature-list.component';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export interface LandingPlan {
  id: number;
  name: string;
  subtitle: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  icon: string;
  ctaLabel: string;
  highlighted: boolean;
  features: string[];
  /** Plan features (2026-11-11): the plan as YoSales sends it, for the ✓ / ✗ of its features. */
  source?: import('app/models/subscription-onboarding.model').SubscriptionPlanDto;
  info: {
    label: string;
    value: string;
  }[];
}

@Component({
  selector: 'app-plan-card',
  standalone: true,
  imports: [CommonModule, MatIcon, PlanFeatureListComponent],
  templateUrl: './plan-card.component.html',
  styleUrl: './plan-card.component.scss'
})
export class PlanCardComponent {
  @Input({ required: true }) plan!: LandingPlan;
  @Output() selectPlan = new EventEmitter<LandingPlan>();

  onSelectPlan(): void {
    this.selectPlan.emit(this.plan);
  }
}
