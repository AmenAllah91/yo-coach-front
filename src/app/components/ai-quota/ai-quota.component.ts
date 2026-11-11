import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AiQuotaService, AiQuotaStatus, quotaExhausted, quotaOf } from 'app/service/ai-quota.service';

/**
 * IA-50: the AI counter of one assistant ("2 of 3 left this month"), and the message when nothing is left.
 * - badge: "2/3" inside a button (nothing when there is no limit);
 * - line: one sentence under a button;
 * - notice: the sentence of the AI dialogs, with the link to the plans when nothing is left.
 * Without a {@code quota} input, the counter is read from the server once.
 */
@Component({
  selector: 'app-ai-quota',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <ng-container *ngIf="current as q">
      <small class="aiq-badge" *ngIf="variant === 'badge' && q.limit !== null" [title]="leftKey | translate: { remaining: q.remaining, limit: q.limit }">{{ q.remaining }}/{{ q.limit }}</small>
      <ng-container *ngIf="variant !== 'badge'">
        <p class="aiq-line" *ngIf="!exhausted">
          {{ (q.limit === null ? 'AI_QUOTA_UNLIMITED' : leftKey) | translate: { remaining: q.remaining, limit: q.limit } }}
        </p>
        <div class="aiq-empty" *ngIf="exhausted" role="status">
          <span>{{ usedKey | translate: { limit: q.limit } }}<ng-container *ngIf="q.limit && q.resetAt && !q.trial"> {{ 'AI_QUOTA_RESET' | translate: { date: (q.resetAt | date: 'mediumDate') } }}</ng-container></span>
          <a *ngIf="variant === 'notice'" routerLink="/subscription/change-plan" (click)="leave.emit()">{{ 'AI_GO_PRO' | translate }}</a>
        </div>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    :host { display: contents; }
    .aiq-badge { margin-inline-start: 6px; font-size: 11px; font-weight: 600; opacity: .8; }
    .aiq-line { font-size: 13px; color: light-dark(#5f7392, #a6acb4); margin: 0 0 14px; }
    .aiq-empty { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-size: 13px; padding: 10px 12px;
      margin-bottom: 14px; border: 1px solid light-dark(#e1e8f0, #33393f); border-radius: 8px;
      a { color: #44b4df; font-weight: 600; } }
  `],
})
export class AiQuotaComponent implements OnInit {
  /** ai.workout, ai.nutrition or ai.website. */
  @Input({ required: true }) code!: string;
  @Input() variant: 'badge' | 'line' | 'notice' = 'notice';
  /** Given by the dialogs (they read it at each opening); else read here. */
  @Input() quota: AiQuotaStatus | null | undefined = undefined;
  /** The link to the plans was clicked (the dialog closes). */
  @Output() leave = new EventEmitter<void>();

  private loaded: AiQuotaStatus | null = null;

  constructor(private quotas: AiQuotaService) {}

  ngOnInit(): void {
    if (this.quota !== undefined) return;
    this.quotas.overview().subscribe({ next: (o) => (this.loaded = quotaOf(o, this.code)), error: () => (this.loaded = null) });
  }

  get current(): AiQuotaStatus | null { return this.quota !== undefined ? this.quota : this.loaded; }
  get exhausted(): boolean { return quotaExhausted(this.current); }

  private get kind(): string { return this.code.replace(/^ai\./, '').toUpperCase(); }

  get leftKey(): string { return this.current?.trial ? 'AI_QUOTA_LEFT_TRIAL' : 'AI_QUOTA_LEFT'; }

  /** "You used your 3 AI programs this month", or "Your plan does not include..." when the limit is 0. */
  get usedKey(): string {
    const q = this.current;
    if (q && q.active === false) return 'AI_ERROR_NO_SUBSCRIPTION';
    if (!q?.limit) return `AI_QUOTA_NONE_${this.kind}`;
    return `AI_QUOTA_USED_${this.kind}${q.trial ? '_TRIAL' : ''}`;
  }
}
