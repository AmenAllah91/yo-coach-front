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
          <span class="week-panel__status" [class.published]="published">
            {{ (published ? 'WORKOUT_PUBLISHED' : 'WORKOUT_DRAFT') | translate }}
          </span>
          <strong>{{ ready }}/7 {{ 'WORKOUT_READY' | translate | lowercase }}</strong>
        </div>

        <div class="week-panel__support">
          <div class="week-panel__progress" aria-hidden="true">
            <i [style.width.%]="ready / 7 * 100"></i>
          </div>
          <p class="week-panel__hint">
            <span class="week-panel__info" aria-hidden="true">i</span>
            {{ published ? ('WORKOUT_PUBLISHED_HINT' | translate) : ('WORKOUT_DRAFT_HINT' | translate) }}
          </p>
        </div>

        <small class="saved" *ngIf="savedAt">
          {{ 'WORKOUT_SAVED' | translate }} {{ savedAt | date:'HH:mm' }}
        </small>
      </div>

      <div class="week-panel__buttons">
        <button type="button" (click)="save.emit()" [disabled]="saving">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6" />
          </svg>
          {{ saving ? ('LOADING' | translate) : ('SAVE_DRAFT' | translate) }}
        </button>
        <button
          type="button"
          class="primary"
          (click)="publish.emit()"
          [disabled]="saving || ready !== 7 || published"
        >
          {{ published ? ('WORKOUT_PUBLISHED' | translate) : ('WORKOUT_PUBLISH_WEEK' | translate:{ number: week }) }}
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
      border: 1px solid #dce3ea;
      border-radius: 14px;
      background: #fff;
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
      color: #102038;
      font-size: 22px;
      font-weight: 650;
      line-height: 28px;
    }

    .week-panel__range {
      overflow: hidden;
      color: #61748a;
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
      background: #f1f5f9;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      line-height: 18px;
    }

    .week-panel__status.published {
      border: 1px solid #82e3bd;
      background: #ecfdf5;
      color: #07875f;
    }

    .week-panel__title strong {
      flex: 0 0 auto;
      color: #26384e;
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
      background: #e5eaf0;
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
      color: #71829a;
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
      border: 1.5px solid #7d8da2;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    }

    .saved {
      display: block;
      margin-top: 8px;
      color: #8a99b5;
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
      border: 1px solid #cbd6e2;
      border-radius: 9px;
      background: #fff;
      color: #102038;
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

    .week-panel button.primary {
      background: #0d1b33;
      color: #fff;
    }

    .week-panel button:disabled {
      cursor: not-allowed;
      border-color: #e2e8f0;
      background: #e1e7ef;
      color: #94a3b8;
    }

    .error {
      grid-column: 1 / -1;
      margin: 0;
      color: #c62828 !important;
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
      color: #079669;
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
  `],
})
export class WorkoutWeekPanelComponent {
  @Input() week = 1;
  @Input() ready = 0;
  @Input() published = false;
  @Input() saving = false;
  @Input() savedAt: Date | null = null;
  @Input() error = '';
  @Input() range = '';
  @Input() compact = false;
  @Input() narrow = false;

  @Output() save = new EventEmitter<void>();
  @Output() publish = new EventEmitter<void>();
}
