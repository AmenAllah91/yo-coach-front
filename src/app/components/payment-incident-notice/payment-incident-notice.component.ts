import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';

/**
 * Shown next to a payment button while the admin switched the payment incident on: the payment is unavailable for
 * now, the access continues. The screens also disable their button ({@link CoachSubscriptionStateService.paymentsPaused}).
 */
@Component({
  selector: 'app-payment-incident-notice',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <p *ngIf="states.paymentsPaused" class="payment-incident-notice" role="status">
      <i-feather name="info"></i-feather>
      <span>{{ 'PAYMENT_PAUSED_NOTICE' | translate }}</span>
    </p>
  `,
  styles: [`
    .payment-incident-notice { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0; padding: 10px 12px; border-radius: 10px;
      background: light-dark(#fff8eb, #362c17); border: 1px solid light-dark(#f3d9a4, #594414); color: light-dark(#7a4b00, #dda86c);
      font-size: 13px; line-height: 1.4; text-align: start; }
    i-feather { flex: 0 0 16px; width: 16px; height: 16px; margin-top: 1px; }
  `],
})
export class PaymentIncidentNoticeComponent {
  constructor(public states: CoachSubscriptionStateService) {}
}
