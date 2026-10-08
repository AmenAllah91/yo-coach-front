import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MySubscriptionComponent } from 'app/components/my-subscription/my-subscription.component';

/**
 * "Plan & Billing" tab of the coach settings: the same information and actions as "My subscription" (SUB-37),
 * laid out like the other settings tabs. The behaviour is the one of MySubscriptionComponent, only the view differs.
 */
@Component({
  selector: 'app-plan-billing-tab',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './plan-billing-tab.component.html',
  styleUrl: './plan-billing-tab.component.scss',
})
export class PlanBillingTabComponent extends MySubscriptionComponent {
  /** Width of the usage bar: active clients out of the plan limit, from 0 to 100. */
  get usagePercent(): number {
    const max = this.state?.maxActiveClients;
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round(((this.state?.activeClients ?? 0) / max) * 100));
  }

  /** At least one action can be shown in the footer of the plan card. */
  get hasPlanActions(): boolean {
    return this.isTrial || this.isReadOnly || this.canChangePlan || this.canResume || this.canCancel;
  }
}
