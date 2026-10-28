import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { OverviewItem, ProgramKind } from '@shared/models/program-schedule';

/**
 * « Retirer » a client program (backlog-programmes.md P10): always asked, and it says what the client loses.
 */
@Component({
  selector: 'app-remove-program-confirm',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <div class="rp-backdrop" (click)="cancel()">
      <div class="rp" role="alertdialog" aria-modal="true" aria-labelledby="rp-title" (click)="$event.stopPropagation()">
        <span class="rp-icon" aria-hidden="true"><i-feather name="trash-2"></i-feather></span>
        <h3 class="rp-title" id="rp-title">{{ 'CLIENT_PROGRAMS.REMOVE_TITLE' | translate: { name: item?.name || '' } }}</h3>
        <p class="rp-text">{{ 'CLIENT_PROGRAMS.REMOVE_TEXT' | translate: { client: clientName } }}</p>
        <p class="rp-loss" [class.rp-loss--none]="!lost">
          <i-feather [name]="lost ? 'alert-triangle' : 'check-circle'" class="rp-ico"></i-feather>
          <span>{{ lossKey | translate: { count: lost } }}</span>
        </p>
        <p class="rp-note">{{ 'CLIENT_PROGRAMS.REMOVE_LIBRARY' | translate }}</p>
        <div class="rp-actions">
          <button type="button" class="rp-btn rp-btn--ghost" (click)="cancel()" [disabled]="busy">{{ 'CLIENT_PROGRAMS.CANCEL' | translate }}</button>
          <button type="button" class="rp-btn rp-btn--danger" (click)="confirmed.emit()" [disabled]="busy">
            <span class="rp-spinner" *ngIf="busy" aria-hidden="true"></span>{{ 'CLIENT_PROGRAMS.REMOVE_CONFIRM' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rp-backdrop { position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, 0.45); }
    .rp { width: min(440px, 100%); display: grid; gap: 10px; padding: 24px; border-radius: 18px; background: #fff; box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25); color: #0f172a; }
    .rp-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #fee2e2; color: #b91c1c; }
    .rp-icon ::ng-deep svg { width: 20px; height: 20px; }
    .rp-title { margin: 4px 0 0; font-size: 18px; font-weight: 600; }
    .rp-text, .rp-note { margin: 0; font-size: 14px; color: #475569; line-height: 1.5; }
    .rp-note { font-size: 13px; color: #64748b; }
    .rp-loss { display: flex; gap: 8px; margin: 2px 0; padding: 10px 12px; border-radius: 10px; background: #fef2f2; color: #991b1b; font-size: 14px; line-height: 1.45; }
    .rp-loss--none { background: #f0fdf4; color: #166534; }
    .rp-ico { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
    .rp-ico ::ng-deep svg { width: 16px; height: 16px; }
    .rp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .rp-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .rp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .rp-btn--ghost { border: 1px solid #e2e8f0; background: #fff; color: #0f172a; }
    .rp-btn--danger { border: 1px solid #b91c1c; background: #b91c1c; color: #fff; }
    .rp-btn--danger:hover:not(:disabled) { background: #991b1b; }
    .rp-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.5); border-top-color: #fff; animation: rp-spin 0.8s linear infinite; }
    @keyframes rp-spin { to { transform: rotate(360deg); } }
  `],
})
export class RemoveProgramConfirmComponent {
  @Input() item: OverviewItem | null = null;
  @Input() kind: ProgramKind = 'WORKOUT';
  @Input() clientName = '';
  @Input() busy = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get lost(): number {
    return this.item?.file ? 0 : this.item?.doneDays || 0;
  }

  get lossKey(): string {
    if (!this.lost) return 'CLIENT_PROGRAMS.REMOVE_NO_LOSS';
    const kind = this.kind === 'WORKOUT' ? 'WORKOUT' : 'NUTRITION';
    return this.lost === 1 ? `CLIENT_PROGRAMS.REMOVE_LOSS_ONE_${kind}` : `CLIENT_PROGRAMS.REMOVE_LOSS_${kind}`;
  }

  @HostListener('document:keydown.escape')
  cancel(): void {
    if (!this.busy) this.cancelled.emit();
  }
}
