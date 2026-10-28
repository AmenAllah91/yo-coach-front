import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';

import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { SubscriptionNoticeService } from 'app/service/subscription-notice.service';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { CHECKOUT_PATH, PAY_INVOICE_PATH } from 'app/template/layout/sidebar/sidebar.component';

/** The trial banner appears in the last 7 days. */
export const TRIAL_BANNER_DAYS = 7;

export interface BannerView {
  tone: 'info' | 'warning' | 'danger';
  icon: string;
  textKey: string;
  textParams?: Record<string, unknown>;
  actionKey: string;
  /** 'pay' = page of the open invoice (amount, then confirmation); 'checkout' = payment screen. */
  action: 'pay' | 'checkout';
}

/**
 * SUB-30: banner at the top of the app, from the subscription state computed by YoSales: trial ending (7 days or
 * less), trial over, late payment ("pay before ..."), read-only account. A SUBSCRIPTION_READ_ONLY refusal reloads the
 * state so the banner shows up at once.
 */
@Component({
  selector: 'app-subscription-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './subscription-banner.component.html',
  styleUrl: './subscription-banner.component.scss',
})
export class SubscriptionBannerComponent implements OnInit, OnDestroy {
  view: BannerView | null = null;
  private state: CoachSubscriptionState | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private stateService: CoachSubscriptionStateService,
    private notices: SubscriptionNoticeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // A read-only refusal means the account just got blocked: read the state again (banner + buttons follow).
    this.notices.notices$
      .pipe(
        filter((n) => n.code === 'SUBSCRIPTION_READ_ONLY' || n.reason === 'READ_ONLY'),
        switchMap(() => this.stateService.refresh()),
        takeUntil(this.destroy$),
      )
      .subscribe();
    this.stateService.getState().subscribe();
    this.stateService.states$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.state = state;
        this.view = SubscriptionBannerComponent.viewOf(state);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  act(): void {
    const view = this.view;
    if (!view) return;
    const invoiceId = this.state?.openInvoiceId;
    if (view.action === 'pay' && invoiceId) {
      // Late payment: the invoice page shows the amount and the method (or saved card) and pays only after the
      // coach confirms (payment audit CE-M6); the banner never charges in one click.
      void this.router.navigate([PAY_INVOICE_PATH], { queryParams: { invoiceId } });
      return;
    }
    void this.router.navigate([CHECKOUT_PATH]);
  }

  static viewOf(state: CoachSubscriptionState | null): BannerView | null {
    if (!state) return null;
    switch (state.status) {
      case 'TRIAL': {
        // YoSales counts today: 1 = today is the last day (the "Last day" email goes out at 1), 0 = the trial is over.
        const days = state.trialDaysLeft;
        if (days == null || days > TRIAL_BANNER_DAYS) return null;
        if (days <= 0) {
          return { tone: 'danger', icon: 'lock', textKey: 'BANNER_TRIAL_OVER', actionKey: 'NOTICE_CHOOSE_PLAN', action: 'checkout' };
        }
        return {
          tone: 'info',
          icon: 'clock',
          textKey: days === 1 ? 'BANNER_TRIAL_LAST_DAY' : days === 2 ? 'BANNER_TRIAL_ONE_DAY' : 'BANNER_TRIAL_DAYS',
          textParams: { count: days },
          actionKey: 'UPGRADE_TO_PAID_PLAN',
          action: 'checkout',
        };
      }
      case 'PAST_DUE':
        return {
          tone: 'warning',
          icon: 'alert-triangle',
          textKey: state.openInvoiceDueDate ? 'BANNER_PAST_DUE_BEFORE' : 'BANNER_PAST_DUE',
          textParams: { date: SubscriptionBannerComponent.formatDay(state.openInvoiceDueDate) },
          actionKey: 'BANNER_PAY',
          action: state.openInvoiceId ? 'pay' : 'checkout',
        };
      case 'EXPIRED':
        // Never paid (no paid period): the trial is over. Otherwise the paid subscription ended unpaid.
        return state.currentPeriodEnd
          ? { tone: 'danger', icon: 'lock', textKey: 'BANNER_EXPIRED', actionKey: 'BANNER_REACTIVATE', action: 'checkout' }
          : { tone: 'danger', icon: 'lock', textKey: 'BANNER_TRIAL_OVER', actionKey: 'NOTICE_CHOOSE_PLAN', action: 'checkout' };
      case 'CANCELLED':
        return { tone: 'danger', icon: 'lock', textKey: 'BANNER_CANCELLED', actionKey: 'BANNER_REACTIVATE', action: 'checkout' };
      case 'PENDING':
        return { tone: 'danger', icon: 'lock', textKey: 'BANNER_PENDING', actionKey: 'BANNER_PAY', action: 'checkout' };
      case 'ACTIVE':
        return null;
      default:
        // No subscription at all: read-only.
        return state.readOnly
          ? { tone: 'danger', icon: 'lock', textKey: 'BANNER_NO_SUBSCRIPTION', actionKey: 'NOTICE_CHOOSE_PLAN', action: 'checkout' }
          : null;
    }
  }

  /** yyyy-MM-dd (coach zone, from YoSales) shown as dd/MM/yyyy, without any time-zone conversion. */
  static formatDay(day: string | null | undefined): string {
    if (!day) return '';
    const [y, m, d] = day.split('-');
    return d && m && y ? `${d}/${m}/${y}` : day;
  }
}
