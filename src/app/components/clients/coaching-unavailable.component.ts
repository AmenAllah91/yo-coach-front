import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../config/auth.service';
import { CoachingAccessService } from '../../service/coaching-access.service';

/**
 * Shown instead of the client's pages when coaching access is not granted (app.component and the
 * /coaching-unavailable route). Two cases: the coach archived the client (server answer), or the server could not be
 * reached at all (no answer: never called « archived », 2026-11-23). Both offer to check again and to sign out.
 */
@Component({
  standalone: true,
  selector: 'app-coaching-unavailable',
  imports: [CommonModule, TranslateModule],
  template: `<main role="alert">
    <section>
      <div class="icon" aria-hidden="true">{{ (access.unreachable$ | async) ? '&#128246;' : '&#9208;' }}</div>
      <ng-container *ngIf="(access.unreachable$ | async); else archived">
        <h1>{{ 'COACHING_ACCESS_UNREACHABLE_TITLE' | translate }}</h1>
        <p>{{ 'COACHING_ACCESS_UNREACHABLE_MESSAGE' | translate }}</p>
      </ng-container>
      <ng-template #archived>
        <h1>{{ 'COACHING_ACCESS_ARCHIVED_TITLE' | translate }}</h1>
        <p>{{ 'COACHING_ACCESS_ARCHIVED_MESSAGE' | translate }}</p>
      </ng-template>
      <div>
        <button type="button" (click)="retry()" [disabled]="checking">{{ (checking ? 'ACCOUNT_ACCESS_CHECKING_TITLE' : 'ACCOUNT_ACCESS_RECHECK') | translate }}</button>
        <button type="button" class="secondary" (click)="logout()">{{ 'ACCOUNT_ACCESS_LOGOUT' | translate }}</button>
      </div>
    </section>
  </main>`,
  styles: [`main{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:light-dark(#f8fafc, #171a1f);color:light-dark(#020c20, #e9eff9)}
    section{max-width:540px;text-align:center;background:light-dark(white, #1d2125);border:1px solid light-dark(#e2e8f0, #34393f);border-radius:16px;padding:40px 28px}
    .icon{font-size:36px;margin-bottom:20px}h1{font-size:25px;margin-bottom:18px}p{color:light-dark(#64748b, #a5abb4);line-height:1.7}
    button{border:0;background:#020c20;color:white;border-radius:8px;padding:12px 18px;margin:16px 4px 0;cursor:pointer}
    .secondary{background:light-dark(#eef2f7, #14171b);color:light-dark(#334155, #d1d7e0)}button:disabled{opacity:.5}
    button:focus-visible{outline:2px solid #0ea5e9;outline-offset:3px}`]
})
export class CoachingUnavailableComponent {
  checking = false;

  constructor(public access: CoachingAccessService, private auth: AuthService, private router: Router) {}

  async retry(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      // Back on the client's home when the access is granted again (the shell then shows the pages by itself).
      if (await this.access.refresh() && this.router.url.split('?')[0] === '/coaching-unavailable') {
        await this.router.navigateByUrl('/client-dashboard');
      }
    } finally {
      this.checking = false;
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
