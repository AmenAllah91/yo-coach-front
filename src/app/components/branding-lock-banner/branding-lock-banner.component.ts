import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

import { CHECKOUT_PATH } from 'app/template/layout/sidebar/sidebar.component';

/** SUB-29 (decision SUB-03): shown on the branding pages during the trial; the page stays visible, fields disabled. */
@Component({
  selector: 'app-branding-lock-banner',
  standalone: true,
  imports: [RouterModule, TranslateModule, FeatherModule],
  template: `
    <div class="branding-lock" role="note">
      <span class="lock-icon"><i-feather name="lock"></i-feather></span>
      <div class="lock-copy">
        <strong>{{ 'BRANDING_PAID_FEATURE' | translate }}</strong>
        <span>{{ 'NOTICE_BRANDING_TEXT' | translate }}</span>
      </div>
      <a class="lock-cta" [routerLink]="checkoutPath">{{ 'NOTICE_UNLOCK_BRANDING' | translate }}</a>
    </div>
  `,
  styles: [`
    .branding-lock { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 12px 16px; padding: 12px 14px; border: 1px solid #f3d9a4; border-radius: 12px; background: #fff8eb; color: #7a4b00; }
    .lock-icon { display: grid; place-items: center; flex: 0 0 36px; height: 36px; border-radius: 50%; background: #fdecc8; }
    .lock-icon i-feather { width: 18px; height: 18px; }
    .lock-copy { display: flex; flex-direction: column; gap: 2px; flex: 1 1 220px; min-width: 0; font-size: 13px; line-height: 1.4; }
    .lock-copy strong { font-size: 14px; }
    .lock-cta { padding: 8px 14px; border-radius: 8px; background: #38ace0; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .lock-cta:hover { filter: brightness(1.05); color: #ffffff; }
  `],
})
export class BrandingLockBannerComponent {
  readonly checkoutPath = CHECKOUT_PATH;
}
