import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

/**
 * "Save draft" in a workout or nutrition builder while some weeks have their 7 days ready but are not published:
 * the coach may not know a draft week stays hidden from the client, nor how to publish it. Lists those weeks
 * (all ticked), explains, and lets the coach publish them at once or keep them as drafts.
 */
@Component({
  selector: 'app-ready-weeks-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="rw" role="dialog" aria-modal="true" aria-labelledby="rw-title">
      <div class="rw__backdrop" (click)="close.emit()"></div>
      <section class="rw__card">
        <button type="button" class="rw__close" [attr.aria-label]="'CLOSE' | translate" (click)="close.emit()">
          <i-feather name="x" class="rw__closeIcon"></i-feather>
        </button>

        <div class="rw__icon"><i-feather name="send" class="rw__iconSvg"></i-feather></div>

        <div>
          <h2 id="rw-title" class="rw__title">{{ (weeks.length === 1 ? 'READY_WEEKS_TITLE_ONE' : 'READY_WEEKS_TITLE') | translate:{ count: weeks.length } }}</h2>
          <p class="rw__text">{{ (weeks.length === 1 ? 'READY_WEEKS_TEXT_ONE' : 'READY_WEEKS_TEXT') | translate }}</p>
        </div>

        <div class="rw__notice">
          <i-feather name="eye-off" class="rw__noticeIcon"></i-feather>
          <span>{{ 'READY_WEEKS_HIDDEN_NOTICE' | translate }}</span>
        </div>

        <ul class="rw__weeks">
          <li *ngFor="let week of weeks">
            <label class="rw__week" [class.is-selected]="selected.has(week)">
              <input class="rw__input" type="checkbox" [checked]="selected.has(week)" (change)="toggle(week)" />
              <span class="rw__check" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </span>
              <span class="rw__weekName">{{ 'WEEK_NUMBER' | translate:{ number: week } }}</span>
              <span class="rw__badge rw__badge--ready">{{ 'READY_WEEKS_DAYS_READY' | translate }}</span>
              <span class="rw__badge rw__badge--draft">{{ 'READY_WEEKS_DRAFT' | translate }}</span>
            </label>
          </li>
        </ul>

        <div class="rw__howto">
          <p class="rw__howtoTitle">{{ 'READY_WEEKS_HOWTO_TITLE' | translate }}</p>
          <ol class="rw__steps">
            <li>{{ 'READY_WEEKS_HOWTO_STEP_1' | translate }}</li>
            <li>{{ publishStepKey | translate }}</li>
            <li>{{ 'READY_WEEKS_HOWTO_STEP_3' | translate }}</li>
          </ol>
        </div>

        <div class="rw__actions">
          <button type="button" class="rw__btn rw__btn--ghost" [disabled]="saving" (click)="keepDraft.emit()">
            {{ 'READY_WEEKS_KEEP_DRAFT' | translate }}
          </button>
          <button type="button" class="rw__btn rw__btn--primary" [disabled]="saving || !selected.size" (click)="publishSelected()">
            {{ (selected.size === 1 ? 'READY_WEEKS_PUBLISH_ONE' : 'READY_WEEKS_PUBLISH') | translate:{ count: selected.size } }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .rw { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; }
    .rw__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .48); backdrop-filter: blur(2px); }
    .rw__card {
      position: relative; width: min(540px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
      border-radius: 12px; border: 1px solid #dbeafe; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
      padding: 28px; display: grid; gap: 16px;
    }
    .rw__close { position: absolute; top: 16px; right: 16px; border: 0; background: transparent; color: #64748b; cursor: pointer; }
    .rw__closeIcon { width: 20px; height: 20px; }
    .rw__icon { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; color: #44b4df; background: rgba(68, 180, 223, .12); }
    .rw__iconSvg { width: 24px; height: 24px; }
    .rw__title { margin: 0 32px 8px 0; color: #0f172a; font-size: 22px; font-weight: 900; }
    .rw__text { margin: 0; color: #334155; font-size: 15px; line-height: 1.55; }
    .rw__notice {
      display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px;
      background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13.5px; font-weight: 600; line-height: 1.45;
    }
    .rw__noticeIcon { width: 18px; height: 18px; flex: none; margin-top: 1px; }
    .rw__weeks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .rw__week {
      position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #dce3ea;
      border-radius: 10px; background: #fff; cursor: pointer; transition: border-color .15s, background .15s, box-shadow .15s;
    }
    .rw__week:hover { border-color: #b9dcee; }
    .rw__week.is-selected { border-color: #44b4df; background: #f6fbff; box-shadow: 0 0 0 3px rgba(68, 180, 223, .12); }
    /* Native checkbox kept for keyboard and screen readers, drawn by .rw__check. */
    .rw__input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
    .rw__check {
      display: grid; place-items: center; flex: none; width: 20px; height: 20px; border: 1.5px solid #c3d0dd; border-radius: 6px;
      background: #fff; transition: background .15s, border-color .15s, transform .15s;
    }
    .rw__check svg { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round;
      stroke-linejoin: round; opacity: 0; transform: scale(.6); transition: opacity .15s, transform .15s; }
    .rw__input:checked + .rw__check { border-color: #44b4df; background: #44b4df; }
    .rw__input:checked + .rw__check svg { opacity: 1; transform: scale(1); }
    .rw__input:focus-visible + .rw__check { outline: 2px solid #0d1b33; outline-offset: 2px; }
    .rw__week:active .rw__check { transform: scale(.94); }
    .rw__weekName { flex: 1; color: #102038; font-weight: 800; font-size: 15px; }
    .rw__badge { padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .rw__badge--ready { background: #ecfdf5; color: #047857; }
    .rw__badge--draft { background: #f1f5f9; color: #475569; }
    .rw__howto { padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e5e7eb; }
    .rw__howtoTitle { margin: 0 0 6px; color: #0f172a; font-size: 13.5px; font-weight: 800; }
    .rw__steps { margin: 0; padding-left: 18px; color: #475569; font-size: 13.5px; line-height: 1.6; }
    .rw__actions { display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
    .rw__btn { border-radius: 8px; padding: 11px 18px; border: 1px solid transparent; font-weight: 800; cursor: pointer; }
    .rw__btn:disabled { opacity: .55; cursor: default; }
    .rw__btn--ghost { background: #fff; color: #0f172a; border-color: #d7e2ef; }
    .rw__btn--primary { background: #0d1b33; color: #fff; }
    @media (max-width: 520px) {
      .rw { padding: 12px; }
      .rw__card { padding: 22px 18px; }
      .rw__actions { flex-direction: column-reverse; }
      .rw__btn { width: 100%; }
    }
  `],
})
export class ReadyWeeksModalComponent implements OnChanges {
  /** One-based week numbers whose 7 days are ready and which are not published yet. */
  @Input() weeks: number[] = [];
  @Input() saving = false;
  /** The builder's own "publish the week" wording (workout or nutrition). */
  @Input() publishStepKey = 'READY_WEEKS_HOWTO_STEP_2';
  @Output() publish = new EventEmitter<number[]>();
  @Output() keepDraft = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  selected = new Set<number>();

  ngOnChanges(): void {
    this.selected = new Set(this.weeks);
  }

  toggle(week: number): void {
    const next = new Set(this.selected);
    if (next.has(week)) next.delete(week); else next.add(week);
    this.selected = next;
  }

  publishSelected(): void {
    this.publish.emit(this.weeks.filter((week) => this.selected.has(week)));
  }
}
