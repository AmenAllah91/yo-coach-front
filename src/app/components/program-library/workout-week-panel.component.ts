import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-workout-week-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section class="week-panel" [class.compact]="compact" [class.narrow]="narrow">
      <div class="week-panel__identity">
        <div class="week-panel__title">
          <h2>{{ 'WEEK_NUMBER' | translate:{ number: week } }}</h2>
          <small class="week-panel__range" *ngIf="range && !compact">{{ range }}</small>
          <strong>{{ 'PROGRAM_DAYS_FILLED' | translate:{ count: ready, total: 7 } }}</strong>
        </div>

        <div class="week-panel__support">
          <div class="week-panel__progress" aria-hidden="true">
            <i [style.width.%]="ready / 7 * 100"></i>
          </div>
          <p class="week-panel__hint" *ngIf="'PROGRAM_DAYS_HINT' | translate as hint" [attr.title]="hint">
            <span class="week-panel__info" aria-hidden="true">i</span>
            <span class="week-panel__hint-text">{{ hint }}</span>
          </p>
        </div>

        <small class="saved" *ngIf="savedAt && showSave">
          {{ 'WORKOUT_SAVED' | translate }} {{ savedAt | date:'HH:mm' }}
        </small>
      </div>

      <div class="week-panel__buttons" *ngIf="showSave || canDuplicate">
        <!-- « Dupliquer la semaine » (copy-days-modal, mode week): the whole week onto the next ones. -->
        <button type="button" class="week-panel__duplicate" *ngIf="canDuplicate" (click)="duplicate.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {{ 'COPY_DAYS.BUTTON_DUPLICATE_WEEK' | translate }}
        </button>
        <button type="button" class="primary" *ngIf="showSave" (click)="save.emit()" [disabled]="saving">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6" />
          </svg>
          {{ saving ? ('SAVING' | translate) : ('SAVE' | translate) }}
        </button>
      </div>

      <small class="week-panel__range week-panel__range--compact" *ngIf="range && compact">
        {{ range }}
      </small>
      <p class="error" *ngIf="error">{{ error }}</p>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .week-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 152px;
      align-items: center;
      gap: 24px;
      margin: 0;
      padding: 24px 26px;
      overflow: hidden;
      border: 1px solid light-dark(#dce3ea, #353a40);
      border-radius: 14px;
      background: light-dark(#fff, #1d2125);
      box-shadow: 0 2px 4px rgba(15, 23, 42, .07);
      box-sizing: border-box;
    }

    .week-panel__identity {
      min-width: 0;
    }

    .week-panel__title {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }

    .week-panel h2 {
      flex: 0 0 auto;
      margin: 0;
      color: light-dark(#102038, #e5ebf4);
      font-size: 22px;
      font-weight: 650;
      line-height: 28px;
    }

    .week-panel__range {
      overflow: hidden;
      color: light-dark(#61748a, #a5acb4);
      font-size: 14px;
      font-weight: 400;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .week-panel__status {
      flex: 0 0 auto;
      padding: 4px 10px;
      border-radius: 6px;
      background: light-dark(#f1f5f9, #15181d);
      color: light-dark(#64748b, #a5abb4);
      font-size: 13px;
      font-weight: 500;
      line-height: 18px;
    }

    .week-panel__status.published {
      border: 1px solid #82e3bd;
      background: light-dark(#ecfdf5, #173429);
      color: light-dark(#07875f, #5dc599);
    }

    .week-panel__title strong {
      flex: 0 0 auto;
      color: light-dark(#26384e, #d9e0e8);
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
    }

    .week-panel__support {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      gap: 16px;
      margin-top: 20px;
    }

    .week-panel__progress {
      width: 200px;
      height: 7px;
      flex: 0 0 200px;
      margin-top: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: light-dark(#e5eaf0, #2b2f33);
    }

    .week-panel__progress i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #2aa9d8;
    }

    .week-panel__hint {
      display: flex;
      min-width: 0;
      max-width: 330px;
      align-items: flex-start;
      gap: 7px;
      margin: 0;
      color: light-dark(#71829a, #999fa7);
      font-size: 14px;
      line-height: 1.45;
    }

    .week-panel__info {
      display: inline-grid;
      width: 17px;
      height: 17px;
      flex: 0 0 17px;
      place-items: center;
      margin-top: 1px;
      border: 1.5px solid light-dark(#7d8da2, #48566a);
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    }

    .saved {
      display: block;
      margin-top: 8px;
      color: light-dark(#8a99b5, #90959d);
      white-space: nowrap;
    }

    .week-panel__buttons {
      display: flex;
      align-items: center;
      justify-self: end;
      gap: 10px;
    }

    .week-panel button {
      display: inline-flex;
      min-height: 52px;
      align-items: center;
      justify-content: center;
      gap: 9px;
      padding: 10px 20px;
      border: 1px solid light-dark(#cbd6e2, #353e47);
      border-radius: 9px;
      background: light-dark(#fff, #1d2125);
      color: light-dark(#102038, #e5ebf4);
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }

    .week-panel button svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .week-panel button.week-panel__duplicate {
      min-height: 38px;
      padding: 0 14px;
      border-color: light-dark(#bfdbfe, #324966);
      background: light-dark(#eff6ff, #242f3d);
      color: light-dark(#0369a1, #68baf7);
      font-size: 13.5px;
      cursor: pointer;
    }

    .week-panel button.week-panel__duplicate:hover {
      border-color: light-dark(#93c5fd, #2a4a6c);
      background: light-dark(#dbeafe, #1c3350);
    }

    .week-panel button.week-panel__duplicate svg {
      width: 16px;
      height: 16px;
    }

    .week-panel button.primary {
      background: #0d1b33;
      color: #fff;
    }

    .week-panel button:disabled {
      cursor: not-allowed;
      border-color: light-dark(#e2e8f0, #34393f);
      background: light-dark(#e1e7ef, #293442);
      color: light-dark(#94a3b8, #8c919a);
    }

    .error {
      grid-column: 1 / -1;
      margin: 0;
      color: light-dark(#c62828, #ff867b) !important;
    }

    .week-panel.narrow {
      min-height: 132px;
      gap: 16px;
      padding: 20px;
    }

    .week-panel.narrow h2 {
      font-size: 18px;
      line-height: 24px;
    }

    .week-panel.narrow .week-panel__title {
      gap: 7px;
    }

    .week-panel.narrow .week-panel__range {
      display: none;
    }

    .week-panel.narrow .week-panel__support {
      margin-top: 16px;
    }

    .week-panel.narrow .week-panel__progress {
      width: min(180px, 42%);
      flex-basis: min(180px, 42%);
    }

    .week-panel.narrow .week-panel__hint {
      font-size: 12px;
    }

    .week-panel.narrow .week-panel__buttons {
      flex-direction: row;
      align-items: center;
    }

    .week-panel.narrow button {
      width: auto;
      min-height: 42px;
      padding: 8px 12px;
      font-size: 12px;
    }

    .week-panel.compact {
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 0;
      margin: 16px;
      padding: 16px;
      border-radius: 12px;
    }

    .week-panel.compact h2 {
      font-size: 16px;
      line-height: 22px;
    }

    .week-panel.compact .week-panel__status {
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
    }

    .week-panel.compact .week-panel__title strong {
      color: light-dark(#079669, #50c494);
      font-size: 12px;
    }

    .week-panel.compact .week-panel__support {
      margin-top: 13px;
    }

    .week-panel.compact .week-panel__progress {
      width: 72px;
      height: 4px;
      flex-basis: 72px;
    }

    .week-panel.compact .week-panel__progress i {
      background: #19b889;
    }

    .week-panel.compact .week-panel__hint {
      font-size: 12px;
      line-height: 1.35;
    }

    .week-panel.compact button {
      min-height: 40px;
      padding: 8px 14px;
      font-size: 12px;
    }

    .week-panel__range--compact {
      grid-column: 1;
    }

    @media (max-width: 900px) {
      .week-panel,
      .week-panel.compact,
      .week-panel.narrow {
        grid-template-columns: 1fr;
        min-height: 0;
        margin: 0;
        padding: 16px;
      }

      .week-panel__title {
        flex-wrap: wrap;
        white-space: normal;
      }

      .week-panel__support {
        flex-direction: column;
      }

      .week-panel__progress,
      .week-panel.narrow .week-panel__progress {
        width: 100%;
        flex-basis: auto;
      }

      .week-panel__buttons,
      .week-panel.narrow .week-panel__buttons {
        width: 100%;
        flex-direction: row;
        justify-self: stretch;
      }

      .week-panel button,
      .week-panel.narrow button {
        width: auto;
        flex: 1 1 0;
      }
    }

    /* Full (non compact) panel: it follows the width it is given (the workout builder content gets narrower when
       the exercise panel opens), not the screen.
       - wide: one line (title, progress, explanation as an (i) tooltip, publish button);
       - medium: two compact lines;
       - narrow: stacked, without empty space.
       The explanation text keeps a natural height (a flex basis on it became a 240px height in column layout). */
    :host {
      container-type: inline-size;
    }

    .week-panel:not(.compact) {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px 16px;
      min-height: 0;
      margin: 0;
      padding: 14px 18px;
    }

    .week-panel:not(.compact) h2 {
      font-size: 18px;
      line-height: 24px;
    }

    .week-panel:not(.compact) .week-panel__title {
      flex-wrap: wrap;
      row-gap: 4px;
      white-space: normal;
    }

    .week-panel:not(.compact) .week-panel__support {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
    }

    .week-panel:not(.compact) .week-panel__progress {
      width: auto;
      height: 6px;
      flex: 0 1 180px;
      min-width: 72px;
      margin-top: 0;
    }

    .week-panel:not(.compact) .week-panel__hint {
      flex: 1 1 auto;
      max-width: 560px;
      font-size: 13px;
      line-height: 1.4;
    }

    .week-panel:not(.compact) .week-panel__buttons {
      width: auto;
      justify-self: end;
      flex-wrap: wrap;
    }

    .week-panel:not(.compact) button {
      width: auto;
      flex: 0 0 auto;
      min-height: 40px;
      padding: 8px 16px;
      font-size: 13px;
    }

    @container (min-width: 720px) {
      .week-panel:not(.compact) .week-panel__identity {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 18px;
      }

      .week-panel:not(.compact) .week-panel__title {
        flex: 0 0 auto;
        flex-wrap: nowrap;
        white-space: nowrap;
      }

      .week-panel:not(.compact) .week-panel__support {
        min-width: 0;
        flex: 1 1 auto;
        margin-top: 0;
      }

      .week-panel:not(.compact) .week-panel__hint {
        flex: 0 0 auto;
        cursor: help;
      }

      .week-panel:not(.compact) .week-panel__hint-text {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      .week-panel:not(.compact) .saved {
        flex: 0 0 auto;
        margin-top: 0;
      }
    }

    /* Phones: three short lines — week + status, progress bar with the publish button beside it, the hint. */
    @container (max-width: 480px) {
      .week-panel:not(.compact) {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'title title'
          'progress buttons'
          'hint hint';
        gap: 8px 12px;
        padding: 12px 14px;
      }

      .week-panel:not(.compact) .week-panel__identity,
      .week-panel:not(.compact) .week-panel__support {
        display: contents;
      }

      .week-panel:not(.compact) .week-panel__title {
        grid-area: title;
      }

      .week-panel:not(.compact) h2 {
        font-size: 17px;
      }

      .week-panel:not(.compact) .week-panel__progress {
        grid-area: progress;
        width: 100%;
        min-width: 0;
        align-self: center;
      }

      .week-panel:not(.compact) .week-panel__hint {
        grid-area: hint;
        max-width: none;
        font-size: 12px;
        line-height: 1.35;
      }

      .week-panel:not(.compact) .week-panel__buttons {
        grid-area: buttons;
        justify-self: end;
        flex-wrap: nowrap;
      }

      .week-panel:not(.compact) button {
        min-height: 34px;
        padding: 6px 12px;
        font-size: 12.5px;
      }

      .week-panel:not(.compact) .saved,
      .week-panel:not(.compact) .error {
        grid-column: 1 / -1;
        margin-top: 0;
      }
    }
  `],
})
/**
 * Week header of the workout and nutrition builders: its progress in filled days. No weekly publication any more
 * (backlog-programmes.md): the client sees the filled days as soon as the coach saves.
 */
export class WorkoutWeekPanelComponent {
  @Input() week = 1;
  /** Filled and rest / free days of the week. */
  @Input() ready = 0;
  @Input() saving = false;
  @Input() savedAt: Date | null = null;
  @Input() error = '';
  @Input() range = '';
  @Input() compact = false;
  @Input() narrow = false;
  /** False when the page already has its own save button (the workout builder toolbar). */
  @Input() showSave = true;
  /** Shows « Dupliquer la semaine » (the builder opens the copy modal on `duplicate`). */
  @Input() canDuplicate = false;

  @Output() save = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<void>();
}
