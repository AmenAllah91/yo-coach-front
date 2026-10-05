import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, takeUntil } from 'rxjs';

import { SubscriptionNotice, SubscriptionNoticeService } from 'app/service/subscription-notice.service';
import { CHANGE_PLAN_PATH } from 'app/components/change-plan/change-plan.path';
import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';

export interface NoticeView {
  icon: string;
  titleKey: string;
  titleParams?: Record<string, unknown>;
  textKey: string;
  textParams?: Record<string, unknown>;
  /** Main button: label and route. None = only "Close". */
  actionKey?: string;
  actionPath?: string;
  actionQuery?: Record<string, unknown>;
}

/**
 * SUB-29: the message shown when CE refuses an action because of the subscription: active client limit (SUB-26),
 * paid branding (SUB-27) or blocked account (SUB-28). Placed once in the main layout.
 */
@Component({
  selector: 'app-subscription-notice',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './subscription-notice.component.html',
  styleUrl: './subscription-notice.component.scss',
})
export class SubscriptionNoticeComponent implements OnInit, OnDestroy {
  view: NoticeView | null = null;
  private destroy$ = new Subject<void>();

  constructor(private notices: SubscriptionNoticeService, private router: Router) {}

  ngOnInit(): void {
    this.notices.notices$.pipe(takeUntil(this.destroy$)).subscribe((notice) => (this.view = SubscriptionNoticeComponent.viewOf(notice)));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.view = null;
  }

  act(): void {
    const path = this.view?.actionPath;
    this.view = null;
    if (path) {
      void this.router.navigate([path], { queryParams: this.view?.actionQuery });
    }
  }

  static viewOf(notice: SubscriptionNotice): NoticeView {
    const blocked: NoticeView = {
      icon: 'lock',
      titleKey: 'NOTICE_READ_ONLY_TITLE',
      textKey: 'NOTICE_READ_ONLY_TEXT',
      actionKey: 'NOTICE_CHOOSE_PLAN',
      actionPath: CHECKOUT_PATH,
    };
    if (notice.code === 'SUBSCRIPTION_READ_ONLY' || notice.reason === 'READ_ONLY') {
      return blocked;
    }
    if (notice.code === 'FEATURE_LOCKED') {
      return {
        icon: 'lock',
        titleKey: 'NOTICE_BRANDING_TITLE',
        textKey: 'NOTICE_BRANDING_TEXT',
        actionKey: 'NOTICE_UNLOCK_BRANDING',
        actionPath: CHECKOUT_PATH,
      };
    }
    // CLIENT_LIMIT_REACHED
    const title = { titleKey: 'NOTICE_LIMIT_TITLE', titleParams: { count: notice.limit ?? notice.current ?? '' } };
    if (notice.reason === 'TRIAL') {
      return {
        icon: 'users',
        ...title,
        textKey: 'NOTICE_LIMIT_TRIAL_TEXT',
        actionKey: 'UPGRADE_TO_PAID_PLAN',
        actionPath: CHECKOUT_PATH,
      };
    }
    if (notice.suggestedPlan?.planName) {
      const plan = notice.suggestedPlan;
      return {
        icon: 'users',
        ...title,
        textKey: plan.proratedCost ? 'NOTICE_LIMIT_PLAN_SUGGESTED_NOW_TEXT' : 'NOTICE_LIMIT_PLAN_SUGGESTED_TEXT',
        textParams: { plan: plan.planName, price: plan.price ?? '', now: plan.proratedCost ?? '' },
        // SUB-46: the plan-change screen, the suggested plan preselected.
        actionKey: 'NOTICE_CHANGE_TO_PLAN',
        actionPath: CHANGE_PLAN_PATH,
        actionQuery: plan.planId ? { planId: plan.planId } : undefined,
      };
    }
    return {
      icon: 'users',
      ...title,
      textKey: 'NOTICE_LIMIT_PLAN_TEXT',
      actionKey: 'NOTICE_MANAGE_CLIENTS',
      actionPath: '/clients',
    };
  }
}
