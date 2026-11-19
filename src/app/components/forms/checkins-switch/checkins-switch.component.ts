import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';
import { CheckinInboxService } from '../../../service/checkin-inbox.service';

/**
 * « Client check-ins | Templates » on top of both check-in pages (2026-11-19): the menu has a single « Check-ins »
 * entry, the coach switches here between the answers to read and the templates.
 */
@Component({
  selector: 'app-checkins-switch',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <nav class="ck-switch" [attr.aria-label]="'CHECK_INS' | translate">
      <a class="ck-switch__btn" routerLink="/forms/manage-checkins" routerLinkActive="ck-switch__btn--active"
         [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
        {{ 'CHK_NAV_INBOX' | translate }}
        <span *ngIf="(toReview$ | async) as n" class="ck-switch__badge">{{ n > 99 ? '99+' : n }}</span>
      </a>
      <a class="ck-switch__btn" routerLink="/forms" routerLinkActive="ck-switch__btn--active"
         [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
        {{ 'CHK_NAV_TEMPLATES' | translate }}
      </a>
    </nav>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ck-switch {
      display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px;
      background: light-dark(#f0f9ff, #1f303b); border: 1px solid light-dark(#bae6fd, #0a3a4e);
    }
    .ck-switch__btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px;
      font-size: 14px; font-weight: 500; white-space: nowrap; text-decoration: none;
      color: light-dark(#4b5563, #bfc5cd); transition: background-color 150ms ease, color 150ms ease;
    }
    .ck-switch__btn:hover { color: #44b4df; }
    .ck-switch__btn:focus-visible { outline: 2px solid #44b4df; outline-offset: 1px; }
    .ck-switch__btn--active {
      background: light-dark(#fff, #1d2125); color: #44b4df; font-weight: 600;
      box-shadow: 0 1px 2px rgba(17, 24, 39, .08);
    }
    .ck-switch__badge {
      min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: inline-flex;
      align-items: center; justify-content: center; font-size: 12px; font-weight: 600; background: #44b4df; color: #fff;
    }
    @media (max-width: 600px) {
      :host { display: flex; width: 100%; }
      .ck-switch { width: 100%; }
      .ck-switch__btn { flex: 1 1 0; justify-content: center; padding: 8px 10px; font-size: 13.5px; }
    }
  `],
})
export class CheckinsSwitchComponent implements OnInit {
  readonly toReview$ = this.inbox.counts$.pipe(map(c => c?.toReview ?? 0));

  constructor(private inbox: CheckinInboxService) {}

  ngOnInit(): void {
    this.inbox.refresh();
  }
}
