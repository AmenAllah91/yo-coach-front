import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Save of a workout or nutrition program with empty days before the last filled one (backlog-programmes.md R4): the
 * client follows the days in order, so the coach marks them as rest / free days in one click, or goes to fill them.
 */
@Component({
  selector: 'app-empty-days-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="ed" role="dialog" aria-modal="true" aria-labelledby="ed-title">
      <div class="ed__backdrop" (click)="close.emit()"></div>
      <section class="ed__card">
        <button type="button" class="ed__close" [attr.aria-label]="'CLOSE' | translate" (click)="close.emit()">
          <i-feather name="x" class="ed__closeIcon"></i-feather>
        </button>

        <div class="ed__icon"><i-feather name="calendar" class="ed__iconSvg"></i-feather></div>

        <div>
          <h2 id="ed-title" class="ed__title">
            {{ (days.length === 1 ? 'EMPTY_DAYS_TITLE_ONE' : 'EMPTY_DAYS_TITLE') | translate:{ day: days[0], count: days.length } }}
          </h2>
          <p class="ed__text">{{ 'EMPTY_DAYS_TEXT' | translate }}</p>
        </div>

        <ul class="ed__days">
          <li *ngFor="let day of days" class="ed__day">{{ 'DAY_NUMBER' | translate:{ number: day } }}</li>
        </ul>

        <div class="ed__actions">
          <button type="button" class="ed__btn ed__btn--ghost" [disabled]="saving" (click)="fill.emit(days[0])">
            {{ (days.length === 1 ? 'EMPTY_DAYS_FILL_ONE' : 'EMPTY_DAYS_FILL') | translate }}
          </button>
          <button type="button" class="ed__btn ed__btn--primary" [disabled]="saving" (click)="markRest.emit()">
            {{ (kind === 'nutrition' ? 'EMPTY_DAYS_MARK_FREE' : 'EMPTY_DAYS_MARK_REST') | translate:{ count: days.length } }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .ed { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; }
    .ed__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .48); backdrop-filter: blur(2px); }
    .ed__card {
      position: relative; width: min(480px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
      border-radius: 12px; border: 1px solid light-dark(#dbeafe, #313943); background: light-dark(#fff, #1d2125); box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
      padding: 28px; display: grid; gap: 16px;
    }
    .ed__close { position: absolute; top: 16px; right: 16px; border: 0; background: transparent; color: light-dark(#64748b, #a5abb4); cursor: pointer; }
    .ed__closeIcon { width: 20px; height: 20px; }
    .ed__icon { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; color: light-dark(#d97706, #ee8a2c); background: light-dark(#fef3c7, #382f03); }
    .ed__iconSvg { width: 24px; height: 24px; }
    .ed__title { margin: 0 0 6px; color: light-dark(#0f172a, #e8ecf6); font-size: 20px; font-weight: 700; line-height: 1.3; }
    .ed__text { margin: 0; color: light-dark(#475569, #bfc5ce); font-size: 14px; line-height: 1.5; }
    .ed__days { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .ed__day { padding: 6px 12px; border-radius: 999px; border: 1px solid #fcd34d; background: light-dark(#fffbeb, #332c12); color: light-dark(#92400e, #f4996c); font-size: 13px; font-weight: 600; }
    .ed__actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    .ed__btn { min-height: 42px; padding: 0 18px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .ed__btn:disabled { opacity: .6; cursor: not-allowed; }
    .ed__btn--ghost { border: 1px solid light-dark(#cbd5e1, #363e47); background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); }
    .ed__btn--primary { border: 1px solid #0d1b33; background: #0d1b33; color: #fff; }
    @media (max-width: 480px) {
      .ed { padding: 16px; }
      .ed__card { padding: 22px 18px; }
      .ed__actions { flex-direction: column-reverse; }
      .ed__btn { width: 100%; }
    }
  `],
})
export class EmptyDaysModalComponent {
  /** Day numbers (1-based). */
  @Input() days: number[] = [];
  @Input() kind: 'workout' | 'nutrition' = 'workout';
  @Input() saving = false;

  /** Mark every listed day as a rest day (workout) or a free day (nutrition), then save. */
  @Output() markRest = new EventEmitter<void>();
  /** Go to the given day to fill it. */
  @Output() fill = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();
}
