import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { formatAmount } from 'app/models/subscription-onboarding.model';

/**
 * AFF-28: the referral credit of the coach in "My subscription" and in "Plan & billing" (one component for both):
 * what is available, what is waiting and from when, and whether it is taken off the next invoice. Hidden without credit.
 */
@Component({
  selector: 'app-referral-credit-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule],
  template: `
    <div *ngIf="shown" class="referral-credit">
      <div class="head">
        <span class="icon"><i-feather name="gift"></i-feather></span>
        <div class="title">
          <span class="label">{{ 'MY_SUB_REFERRAL_CREDIT' | translate }}</span>
          <strong class="amount">{{ money(available) }}</strong>
        </div>
        <a routerLink="/referral" [queryParams]="{ tab: 'EARNINGS' }" class="link">{{ 'REFERRAL_PAGE.SEE_EARNINGS' | translate }}</a>
      </div>
      <p *ngIf="pending > 0" class="muted">
        {{ (state?.referralCreditPendingAvailableAt ? 'MY_SUB_REFERRAL_PENDING_ON' : 'MY_SUB_REFERRAL_PENDING')
          | translate: { amount: money(pending), date: (state?.referralCreditPendingAvailableAt | date: 'dd/MM/yyyy') } }}
      </p>
      <p *ngIf="available > 0" class="note">
        {{ (state?.referralCreditDeduction ? 'MY_SUB_REFERRAL_DEDUCTED_NEXT' : 'MY_SUB_REFERRAL_KEPT') | translate }}
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .referral-credit { margin-bottom: 16px; padding: 16px 18px; border: 1px solid light-dark(#cdeaf8, #23414d); border-radius: 14px;
      background: light-dark(#f3fbff, #172a31); color: light-dark(#111827, #e8ecf6); }
    .head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: light-dark(#e1f4fc, #1d3a45); color: #38ace0; }
    .icon i-feather { width: 20px; height: 20px; }
    .title { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .label { color: light-dark(#6b7280, #a7abb4); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .amount { color: light-dark(#1d6f8f, #70bcdf); font-size: 22px; font-weight: 800; }
    .link { color: light-dark(#1d6f8f, #70bcdf); font-size: 14px; font-weight: 600; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    p { margin: 10px 0 0; font-size: 14px; }
    .muted { color: light-dark(#6b7280, #a7abb4); }
    .note { color: light-dark(#1d6f8f, #9fd6ef); }
  `],
})
export class ReferralCreditCardComponent {
  @Input() state: CoachSubscriptionState | null | undefined = null;

  /** A balance below zero (a reward taken back) is shown as 0: it is never asked for. */
  get available(): number {
    return Math.max(0, Number(this.state?.referralCreditAvailable ?? 0));
  }

  get pending(): number {
    return Math.max(0, Number(this.state?.referralCreditPending ?? 0));
  }

  get shown(): boolean {
    return this.available > 0 || this.pending > 0;
  }

  /** Written like the other amounts of the billing pages ("26,7 TND"). */
  money(amount: number): string {
    return formatAmount(amount, this.state?.referralCreditCurrency ?? 'TND');
  }
}
