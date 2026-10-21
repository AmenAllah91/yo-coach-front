import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { WidgetStatus } from '../../../models/coach-dashboard.model';

/** Loading skeleton, error with retry, or empty message of one dashboard widget. Shows nothing once there is content. */
@Component({
  selector: 'app-widget-state',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ws-skeleton" *ngIf="status === 'loading'" aria-busy="true" [attr.aria-label]="'LOADING' | translate">
      <div class="ws-row" *ngFor="let row of skeletonRows">
        <span class="ws-dot"></span>
        <span class="ws-lines"><span class="ws-line"></span><span class="ws-line ws-line--short"></span></span>
      </div>
    </div>
    <div class="ws-message ws-message--error" *ngIf="status === 'error'" role="alert">
      <i-feather name="alert-triangle"></i-feather>
      <p>{{ 'CDASH.WIDGET_ERROR' | translate }}</p>
      <button type="button" class="ws-retry" (click)="retry.emit()">
        <i-feather name="refresh-cw"></i-feather>{{ 'RETRY' | translate }}
      </button>
    </div>
    <div class="ws-message" *ngIf="status === 'ready' && empty">
      <i-feather [name]="emptyIcon"></i-feather>
      <p>{{ emptyText | translate }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ws-skeleton { display: grid; gap: 14px; padding: 4px 0; }
    .ws-row { display: flex; align-items: center; gap: 12px; }
    .ws-dot { width: 32px; height: 32px; border-radius: 50%; background: #eef2f6; flex: none; animation: ws-pulse 1.4s ease-in-out infinite; }
    .ws-lines { display: grid; gap: 6px; flex: 1; }
    .ws-line { height: 9px; border-radius: 5px; background: #eef2f6; animation: ws-pulse 1.4s ease-in-out infinite; }
    .ws-line--short { width: 45%; }
    .ws-message { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 12px; text-align: center; color: #64748b; font-size: 13px; }
    .ws-message i-feather { width: 20px; height: 20px; color: #94a3b8; }
    .ws-message p { margin: 0; line-height: 1.45; }
    .ws-message--error i-feather { color: #d06449; }
    .ws-retry { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #d9e2ec; border-radius: 6px; background: #fff; color: #0f172a; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ws-retry:hover { background: #f1f5f9; }
    .ws-retry i-feather { width: 13px; height: 13px; color: inherit; }
    @keyframes ws-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
  `],
})
export class WidgetStateComponent {
  @Input() status: WidgetStatus = 'loading';
  @Input() empty = false;
  @Input() emptyText = 'CDASH.EMPTY';
  @Input() emptyIcon = 'inbox';
  @Input() set rows(value: number) {
    this.skeletonRows = Array.from({ length: Math.max(1, value) });
  }
  @Output() retry = new EventEmitter<void>();

  skeletonRows: unknown[] = Array.from({ length: 3 });
}
