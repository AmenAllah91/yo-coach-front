/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { ProgramCopyController } from './program-copy-controller';

/**
 * Day kept with « Copier vers un autre programme »: shown at the top of the day editor of every program of the same
 * kind, with « Coller sur des jours… » and « ✕ » to forget it. Nothing is shown when no day is kept.
 */
@Component({
  selector: 'app-copied-day-banner',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="cdb" *ngIf="copy.copied as copied" role="status">
      <span class="cdb__icon"><i-feather name="clipboard"></i-feather></span>
      <div class="cdb__text">
        <strong>{{ 'COPY_DAYS.BANNER_TITLE' | translate }}</strong>
        <span>{{ copied.label }}</span>
      </div>
      <button type="button" class="cdb__paste" (click)="copy.openPaste()">
        <i-feather name="corner-down-right"></i-feather>{{ 'COPY_DAYS.BANNER_PASTE' | translate }}
      </button>
      <button type="button" class="cdb__cancel" (click)="copy.cancelKept()" [title]="'COPY_DAYS.BANNER_CANCEL' | translate" [attr.aria-label]="'COPY_DAYS.BANNER_CANCEL' | translate">
        <i-feather name="x"></i-feather>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cdb {
      display: flex; align-items: center; gap: 12px; margin: 0 0 14px; padding: 10px 12px 10px 14px;
      border: 1px solid light-dark(#bfdbfe, #324966); border-radius: 12px; background: light-dark(#f0f7ff, #232f3d);
    }
    .cdb__icon { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; background: light-dark(#dbeafe, #1c3350); color: light-dark(#0c86c8, #4fb5fa); }
    .cdb__icon i-feather { width: 17px; height: 17px; }
    .cdb__text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
    .cdb__text strong { color: light-dark(#0f172a, #e8ecf6); font-size: 13.5px; font-weight: 700; }
    .cdb__text span { color: light-dark(#475569, #bfc5ce); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cdb__paste {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px;
      border: 1px solid #0c86c8; border-radius: 9px; background: #0c86c8; color: #fff;
      font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer;
    }
    .cdb__paste:hover { background: #0a74ad; }
    .cdb__paste i-feather { width: 15px; height: 15px; }
    .cdb__cancel {
      flex: 0 0 auto; width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px;
      background: transparent; color: light-dark(#64748b, #a5abb4); cursor: pointer;
    }
    .cdb__cancel:hover { background: light-dark(#e2e8f0, #283342); color: light-dark(#0f172a, #e8ecf6); }
    .cdb__cancel i-feather { width: 17px; height: 17px; }
    @media (max-width: 560px) {
      .cdb { flex-wrap: wrap; }
      .cdb__text { flex-basis: calc(100% - 90px); }
      .cdb__paste { order: 4; width: 100%; justify-content: center; }
    }
  `],
})
export class CopiedDayBannerComponent {
  @Input({ required: true }) copy!: ProgramCopyController<any>;
}
