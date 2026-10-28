import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { ProgramScheduleService } from 'app/service/program-schedule.service';

/**
 * Top of an editor opened on a stopped or finished client program (backlog-programmes.md A9): it can be looked at,
 * not changed; « Dupliquer » makes a full copy in the library to reuse or assign again.
 */
@Component({
  selector: 'app-locked-program-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <div class="lpb" role="status">
      <span class="lpb-icon" aria-hidden="true"><i-feather name="lock"></i-feather></span>
      <div class="lpb-text">
        <strong>{{ stoppedAt
          ? ('ASSIGN_FLOW.LOCKED_STOPPED' | translate: { date: schedule.formatDate(stoppedAt) })
          : ('ASSIGN_FLOW.LOCKED_FINISHED' | translate) }}</strong>
        <span>{{ 'ASSIGN_FLOW.LOCKED_HINT' | translate }}</span>
      </div>
      <button type="button" class="lpb-btn" (click)="duplicate.emit()" [disabled]="busy">
        <i-feather name="copy"></i-feather>{{ 'ASSIGN_FLOW.DUPLICATE' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: 14px; }
    .lpb { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px;
      border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; }
    .lpb-icon { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
      background: #e2e8f0; color: #475569; }
    .lpb-icon ::ng-deep svg { width: 17px; height: 17px; }
    .lpb-text { flex: 1; display: grid; gap: 2px; font-size: 13.5px; line-height: 1.45; }
    .lpb-text strong { color: #0f172a; font-weight: 700; }
    .lpb-btn { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px;
      border-radius: 10px; border: 1.5px solid #0f172a; background: #0f172a; color: #fff; font-size: 13px;
      font-weight: 700; cursor: pointer; }
    .lpb-btn ::ng-deep svg { width: 15px; height: 15px; }
    .lpb-btn:disabled { opacity: 0.6; cursor: wait; }
    @media (max-width: 640px) { .lpb { flex-wrap: wrap; } .lpb-btn { width: 100%; justify-content: center; } }
  `],
})
export class LockedProgramBannerComponent {
  @Input() stoppedAt: string | null = null;
  @Input() busy = false;
  @Output() duplicate = new EventEmitter<void>();

  constructor(public schedule: ProgramScheduleService) {}
}
