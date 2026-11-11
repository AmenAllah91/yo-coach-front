import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  PlanFeatureLine,
  planFeatureChanges,
  planFeatureLines,
  SubscriptionPlanDto,
} from 'app/models/subscription-onboarding.model';

/**
 * Plan features (2026-11-11): what a plan gives, from the catalog of YoSales (✓ included, 🔒 after the trial,
 * ✗ not included, amount per month). With [compareTo] (the current plan), only what changes: gained, lost, more / less.
 * Used on the plans page, the sign-up, the payment and the plan change, so every screen says the same as the server.
 */
@Component({
  selector: 'app-plan-feature-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <ng-container *ngIf="!compareTo; else diff">
      <ul class="pfl" *ngIf="lines.length">
        <li *ngFor="let l of lines" [class]="'pfl-' + l.state" [attr.data-feature]="l.code">
          <span class="pfl-icon" aria-hidden="true">{{ l.state === 'included' ? '✓' : l.state === 'afterTrial' ? '🔒' : '✗' }}</span>
          <span>
            <span class="pfl-text">{{ text(l) }}</span>
            <em *ngIf="l.state === 'afterTrial'"> ({{ 'REGISTER_FEATURE_AFTER_TRIAL' | translate }})</em>
            <span *ngIf="l.state === 'excluded'" class="pfl-sr"> ({{ 'PLAN_FEATURE_NOT_INCLUDED' | translate }})</span>
          </span>
        </li>
      </ul>
    </ng-container>
    <ng-template #diff>
      <div class="pfl-diff" *ngIf="changes.gained.length || changes.lost.length || changes.changed.length">
        <p *ngIf="changes.gained.length" class="pfl-title">{{ 'PLAN_FEATURES_GAINED' | translate }}</p>
        <ul class="pfl" *ngIf="changes.gained.length">
          <li *ngFor="let l of changes.gained" class="pfl-included" [attr.data-feature]="l.code">
            <span class="pfl-icon" aria-hidden="true">+</span><span>{{ text(l) }}</span>
          </li>
        </ul>
        <p *ngIf="changes.lost.length" class="pfl-title">{{ 'PLAN_FEATURES_LOST' | translate }}</p>
        <ul class="pfl" *ngIf="changes.lost.length">
          <li *ngFor="let l of changes.lost" class="pfl-excluded" [attr.data-feature]="l.code">
            <span class="pfl-icon" aria-hidden="true">−</span><span>{{ l.name }}</span>
          </li>
        </ul>
        <p *ngIf="changes.changed.length" class="pfl-title">{{ 'PLAN_FEATURES_CHANGED' | translate }}</p>
        <ul class="pfl" *ngIf="changes.changed.length">
          <li *ngFor="let c of changes.changed" class="pfl-included" [attr.data-feature]="c.line.code">
            <span class="pfl-icon" aria-hidden="true">↔</span>
            <span>{{ text(c.line) }} <em>({{ 'PLAN_FEATURES_BEFORE' | translate: { value: amountText(c.before) } }})</em></span>
          </li>
        </ul>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .pfl { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; font-size: 14px; text-align: start; }
    .pfl li { display: flex; gap: 8px; align-items: flex-start; }
    .pfl-icon { width: 16px; flex: none; text-align: center; font-weight: 700; color: var(--primary, #2563eb); }
    .pfl-afterTrial, .pfl-excluded { opacity: .6; }
    .pfl-excluded .pfl-icon { color: inherit; }
    .pfl-excluded .pfl-text { text-decoration: line-through; }
    .pfl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    em { font-style: normal; font-size: 12px; opacity: .8; }
    .pfl-title { margin: 10px 0 0; font-size: 13px; font-weight: 600; }
  `],
})
export class PlanFeatureListComponent {
  @Input() plan: SubscriptionPlanDto | null | undefined;
  /** The current plan: shows only what changes. */
  @Input() compareTo: SubscriptionPlanDto | null | undefined;

  constructor(private translate: TranslateService) {}

  private get lang(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'fr';
  }

  get lines(): PlanFeatureLine[] {
    return planFeatureLines(this.plan, this.lang);
  }

  get changes() {
    return planFeatureChanges(this.compareTo, this.plan, this.lang);
  }

  text(l: PlanFeatureLine): string {
    if (l.amount != null) return this.translate.instant('PLAN_FEATURE_PER_MONTH', { name: l.name, count: l.amount });
    if (l.unlimited) return this.translate.instant('PLAN_FEATURE_UNLIMITED', { name: l.name });
    return l.name;
  }

  amountText(l: PlanFeatureLine): string {
    return l.unlimited ? this.translate.instant('PLAN_FEATURE_NO_LIMIT') : String(l.amount ?? 0);
  }
}
