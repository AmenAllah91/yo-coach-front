import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { DAYS_PER_WEEK, DayCopy, weekCopies } from './program-day-copy';

export type CopyDaysMode = 'day' | 'week' | 'paste';

/**
 * Picks where a day (or a week) is copied, in one click per target:
 *  - day: the selected day onto other days (or kept for another program),
 *  - week: a whole week onto other weeks (its empty days are not copied),
 *  - paste: the day kept from another program onto several days.
 * Past days of a client's program are locked: their history is not overwritten.
 */
@Component({
  selector: 'app-copy-days-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="cd" role="dialog" aria-modal="true" aria-labelledby="cd-title" (keydown.escape)="close.emit()">
      <div class="cd__backdrop" (click)="close.emit()"></div>
      <section class="cd__card">
        <header class="cd__head">
          <span class="cd__icon"><i-feather [name]="mode === 'paste' ? 'clipboard' : 'copy'"></i-feather></span>
          <div class="cd__headText">
            <h2 id="cd-title" class="cd__title">
              <ng-container [ngSwitch]="mode">
                <ng-container *ngSwitchCase="'week'">{{ 'COPY_DAYS.TITLE_WEEK' | translate:{ week: sourceWeek } }}</ng-container>
                <ng-container *ngSwitchCase="'paste'">{{ 'COPY_DAYS.TITLE_PASTE' | translate }}</ng-container>
                <ng-container *ngSwitchDefault>{{ 'COPY_DAYS.TITLE_DAY' | translate:{ week: weekOf(sourceIndex ?? 0), day: ((sourceIndex ?? 0) % 7) + 1 } }}</ng-container>
              </ng-container>
            </h2>
            <p class="cd__sub">
              <ng-container [ngSwitch]="mode">
                <ng-container *ngSwitchCase="'week'">{{ 'COPY_DAYS.SUB_WEEK' | translate }}</ng-container>
                <ng-container *ngSwitchCase="'paste'">{{ sourceLabel }}</ng-container>
                <ng-container *ngSwitchDefault>{{ 'COPY_DAYS.SUB_DAY' | translate }}</ng-container>
              </ng-container>
            </p>
          </div>
          <button type="button" class="cd__close" [attr.aria-label]="'CLOSE' | translate" (click)="close.emit()">
            <i-feather name="x"></i-feather>
          </button>
        </header>

        <div class="cd__chips">
          <ng-container *ngIf="mode === 'week'; else dayChips">
            <button type="button" class="cd__chip" [disabled]="sourceWeek >= weekCount" (click)="selectNextWeek()">{{ 'COPY_DAYS.NEXT_WEEK' | translate }}</button>
            <button type="button" class="cd__chip" [disabled]="sourceWeek >= weekCount" (click)="selectFollowingWeeks()">{{ 'COPY_DAYS.FOLLOWING_WEEKS' | translate }}</button>
          </ng-container>
          <ng-template #dayChips>
            <button type="button" class="cd__chip" *ngIf="sourceIndex !== null && weekCount > 1" (click)="selectSameWeekday()">
              {{ 'COPY_DAYS.SAME_DAY_EVERY_WEEK' | translate:{ day: (sourceIndex % 7) + 1 } }}
            </button>
            <button type="button" class="cd__chip" (click)="selectEmptyDays()">{{ 'COPY_DAYS.EMPTY_DAYS' | translate }}</button>
            <button type="button" class="cd__chip" (click)="selectAll()">{{ 'COPY_DAYS.ALL_DAYS' | translate }}</button>
          </ng-template>
          <button type="button" class="cd__chip cd__chip--ghost" *ngIf="selected.size" (click)="selected.clear()">{{ 'COPY_DAYS.CLEAR' | translate }}</button>
        </div>

        <div class="cd__body">
          <!-- Weeks: one row each, with how many of its days are filled. -->
          <ng-container *ngIf="mode === 'week'; else daysGrid">
            <button
              *ngFor="let week of weeks"
              type="button"
              class="cd__week"
              [class.is-on]="selected.has(week)"
              [class.is-source]="week === sourceWeek"
              [disabled]="week === sourceWeek || weekLocked(week)"
              [attr.aria-pressed]="selected.has(week)"
              (click)="toggle(week)"
            >
              <span class="cd__check"><i-feather name="check"></i-feather></span>
              <strong>{{ 'WEEK_NUMBER' | translate:{ number: week } }}</strong>
              <small *ngIf="week === sourceWeek; else weekInfo">{{ 'COPY_DAYS.SOURCE_WEEK' | translate }}</small>
              <ng-template #weekInfo>
                <small *ngIf="weekLocked(week); else weekFill">{{ 'COPY_DAYS.PAST_WEEK' | translate }}</small>
                <ng-template #weekFill><small>{{ 'PROGRAM_DAYS_FILLED_SHORT' | translate:{ count: filledInWeek(week), total: daysInWeek(week) } }}</small></ng-template>
              </ng-template>
            </button>
            <p class="cd__note"><i-feather name="info"></i-feather>{{ 'COPY_DAYS.WEEK_EMPTY_SKIPPED' | translate }}</p>
          </ng-container>

          <!-- Days: weeks in rows, the 7 days in columns; a dot marks a day that already has content. -->
          <ng-template #daysGrid>
            <div class="cd__grid" *ngFor="let week of weeks">
              <span class="cd__weekLabel">{{ 'COPY_DAYS.WEEK_SHORT' | translate:{ number: week } }}</span>
              <div class="cd__days">
                <button
                  *ngFor="let index of daysOf(week)"
                  type="button"
                  class="cd__day"
                  [class.is-on]="selected.has(index)"
                  [class.is-source]="index === sourceIndex"
                  [class.is-locked]="isLocked(index) && index !== sourceIndex"
                  [disabled]="index === sourceIndex || isLocked(index)"
                  [attr.aria-pressed]="selected.has(index)"
                  [attr.title]="dayTitle(index, week) | translate:{ week: week, day: (index % 7) + 1 }"
                  (click)="toggle(index)"
                >
                  <!-- The copied day shows as the source, even when it is past (copying from it changes nothing). -->
                  <i-feather *ngIf="isLocked(index) && index !== sourceIndex; else dayNumber" name="lock" class="cd__lock"></i-feather>
                  <ng-template #dayNumber>{{ (index % 7) + 1 }}</ng-template>
                  <span class="cd__dot" *ngIf="filled[index] && index !== sourceIndex && !isLocked(index)"></span>
                </button>
              </div>
            </div>
            <div class="cd__legend">
              <span><span class="cd__dot cd__dot--legend"></span>{{ 'COPY_DAYS.LEGEND_FILLED' | translate }}</span>
              <span *ngIf="hasLocked"><i-feather name="lock" class="cd__lock cd__lock--legend"></i-feather>{{ 'COPY_DAYS.LEGEND_PAST' | translate }}</span>
            </div>
          </ng-template>
        </div>

        <footer class="cd__foot">
          <p class="cd__warn cd__warn--info" *ngIf="keptCount" role="status">
            <i-feather name="info"></i-feather>
            {{ (keptCount === 1 ? 'COPY_DAYS.KEEP_FILLED_ONE' : 'COPY_DAYS.KEEP_FILLED') | translate:{ count: keptCount } }}
          </p>
          <p class="cd__warn" *ngIf="overwriteCount" role="status">
            <i-feather name="alert-triangle"></i-feather>
            {{ (overwriteCount === 1 ? 'COPY_DAYS.OVERWRITE_ONE' : 'COPY_DAYS.OVERWRITE') | translate:{ count: overwriteCount } }}
          </p>
          <div class="cd__actions">
            <button type="button" class="cd__link" *ngIf="mode === 'day'" (click)="keep.emit()">
              <i-feather name="external-link"></i-feather>{{ 'COPY_DAYS.KEEP_FOR_OTHER' | translate }}
            </button>
            <span class="cd__spacer"></span>
            <button type="button" class="cd__btn cd__btn--ghost" (click)="close.emit()">{{ 'CANCEL' | translate }}</button>
            <button type="button" class="cd__btn cd__btn--primary" [disabled]="!copies.length" (click)="confirm.emit(copies)">
              {{ (copies.length === 1 ? 'COPY_DAYS.CONFIRM_ONE' : copies.length ? 'COPY_DAYS.CONFIRM' : 'COPY_DAYS.CONFIRM_NONE') | translate:{ count: copies.length } }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    .cd { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; }
    .cd__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .48); backdrop-filter: blur(2px); }
    .cd__card {
      position: relative; width: min(580px, 100%); max-height: calc(100vh - 48px); display: flex; flex-direction: column;
      border-radius: 14px; border: 1px solid #dbeafe; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .22); overflow: hidden;
    }
    .cd__head { display: flex; align-items: flex-start; gap: 12px; padding: 22px 22px 14px; }
    .cd__icon { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; color: #0c86c8; background: #e8f3fa; }
    .cd__icon i-feather { width: 20px; height: 20px; }
    .cd__headText { flex: 1 1 auto; min-width: 0; }
    .cd__title { margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.3; }
    .cd__sub { margin: 4px 0 0; color: #64748b; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
    .cd__close { border: 0; background: transparent; color: #64748b; cursor: pointer; padding: 2px; }
    .cd__close i-feather { width: 20px; height: 20px; }

    .cd__chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 22px 14px; }
    .cd__chip {
      min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid #bfdbfe; background: #eff6ff;
      color: #0369a1; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
    }
    .cd__chip:hover:not(:disabled) { background: #dbeafe; }
    .cd__chip:disabled { opacity: .45; cursor: not-allowed; }
    .cd__chip--ghost { border-color: #e2e8f0; background: #fff; color: #475569; }

    .cd__body { flex: 1 1 auto; overflow-y: auto; padding: 4px 22px 16px; display: grid; gap: 10px; align-content: start; }
    .cd__grid { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 10px; }
    .cd__weekLabel { color: #475569; font-size: 12.5px; font-weight: 700; }
    .cd__days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .cd__day {
      position: relative; height: 40px; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff;
      color: #0f172a; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background-color .12s, border-color .12s;
    }
    .cd__day:hover:not(:disabled) { border-color: #93c5fd; background: #f8fbff; }
    .cd__day.is-on { border-color: #0c86c8; background: #0c86c8; color: #fff; }
    .cd__day.is-source { border: 2px solid #0c86c8; background: #e8f3fa; color: #0c86c8; cursor: default; }
    .cd__day.is-locked { border-style: dashed; background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .cd__lock { width: 14px; height: 14px; }
    .cd__lock--legend { width: 13px; height: 13px; color: #94a3b8; }
    .cd__dot { position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; }
    .cd__day.is-on .cd__dot { background: #fde68a; }
    .cd__legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .cd__legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .cd__dot--legend { position: static; }

    .cd__week {
      display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 46px;
      padding: 0 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a;
      font: inherit; font-size: 14px; text-align: left; cursor: pointer;
    }
    .cd__week small { color: #64748b; font-size: 12.5px; }
    .cd__week.is-on { border-color: #0c86c8; background: #f0f9ff; }
    .cd__week.is-source { border: 2px solid #0c86c8; background: #e8f3fa; color: #0c86c8; cursor: default; }
    .cd__week:disabled:not(.is-source) { border-style: dashed; background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .cd__check { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #cbd5e1; display: grid; place-items: center; color: transparent; }
    .cd__check i-feather { width: 14px; height: 14px; }
    .cd__week.is-on .cd__check { border-color: #0c86c8; background: #0c86c8; color: #fff; }
    .cd__week.is-source .cd__check { border-color: #0c86c8; background: #0c86c8; color: #fff; }
    .cd__note { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; color: #64748b; font-size: 12.5px; }
    .cd__note i-feather { flex: 0 0 auto; width: 14px; height: 14px; }

    .cd__foot { border-top: 1px solid #eef2f6; padding: 14px 22px 18px; display: grid; gap: 12px; }
    .cd__warn { display: flex; align-items: center; gap: 8px; margin: 0; padding: 9px 12px; border-radius: 9px; background: #fffbeb; color: #92400e; font-size: 13px; }
    .cd__warn i-feather { flex: 0 0 auto; width: 16px; height: 16px; }
    .cd__warn--info { background: #eff6ff; color: #1e40af; }
    .cd__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .cd__spacer { flex: 1 1 auto; }
    .cd__link {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 2px; border: 0; background: transparent;
      color: #0369a1; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
    }
    .cd__link:hover { text-decoration: underline; }
    .cd__link i-feather { width: 14px; height: 14px; }
    .cd__btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; padding: 0 18px; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .cd__btn:disabled { opacity: .5; cursor: not-allowed; }
    .cd__btn--ghost { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; }
    .cd__btn--primary { border: 1px solid #0c86c8; background: #0c86c8; color: #fff; }
    @media (max-width: 520px) {
      .cd { padding: 0; align-items: end; }
      .cd__card { width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0; }
      .cd__grid { grid-template-columns: 34px minmax(0, 1fr); gap: 6px; }
      .cd__days { gap: 4px; }
      .cd__day { height: 38px; font-size: 13px; }
      .cd__spacer { display: none; }
      .cd__link { order: 3; width: 100%; justify-content: center; }
      .cd__btn { flex: 1 1 0; }
    }
  `],
})
export class CopyDaysModalComponent implements OnChanges {
  @Input() mode: CopyDaysMode = 'day';
  @Input() dayCount = 0;
  /** Day copied (mode day). */
  @Input() sourceIndex: number | null = null;
  /** Week copied, 1-based (mode week). */
  @Input() sourceWeek = 1;
  /** Days that already have content (replaced by the copy; an empty source day is not copied). */
  @Input() filled: boolean[] = [];
  /** Past days of a client's program: never targets. */
  @Input() locked: boolean[] = [];
  /** Day kept from another program (mode paste). */
  @Input() sourceLabel = '';
  /**
   * The client's calendar (backlog-programmes.md, calendar lot C): the copy goes only onto empty days, the days
   * already planned stay as they are (the editor replaces them).
   */
  @Input() emptyOnly = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<DayCopy[]>();
  /** « Copier vers un autre programme » (mode day). */
  @Output() keep = new EventEmitter<void>();

  /** Day indexes (modes day / paste) or week numbers (mode week). */
  selected = new Set<number>();

  get weekCount(): number {
    return Math.ceil(this.dayCount / DAYS_PER_WEEK);
  }

  get weeks(): number[] {
    return Array.from({ length: this.weekCount }, (_, i) => i + 1);
  }

  get hasLocked(): boolean {
    return this.locked.some(Boolean);
  }

  /** The host passes values set once when it opens the modal: a change starts a new selection. */
  ngOnChanges(): void {
    this.selected.clear();
    // Most common case: the week goes onto the next one.
    if (this.mode === 'week') this.selectNextWeek();
  }

  /** Every copy the selection asks for (empty source days and locked targets left out). */
  private get asked(): DayCopy[] {
    const sorted = [...this.selected].sort((a, b) => a - b);
    if (this.mode === 'week') {
      // Empty days of the copied week are skipped: they would only erase the target days.
      return weekCopies(this.sourceWeek, sorted, this.dayCount).filter(
        (copy) => this.filled[copy.from as number] && !this.isLocked(copy.to),
      );
    }
    const from = this.mode === 'paste' ? null : this.sourceIndex;
    return sorted.filter((to) => !this.isLocked(to)).map((to) => ({ from, to }));
  }

  get copies(): DayCopy[] {
    return this.emptyOnly ? this.asked.filter((copy) => !this.filled[copy.to]) : this.asked;
  }

  get overwriteCount(): number {
    return this.emptyOnly ? 0 : this.copies.filter((copy) => this.filled[copy.to]).length;
  }

  /** Days already planned that the copy leaves alone (empty days only). */
  get keptCount(): number {
    return this.emptyOnly ? this.asked.filter((copy) => this.filled[copy.to]).length : 0;
  }

  isLocked(index: number): boolean {
    return !!this.locked[index];
  }

  /** A week whose days are all past (or locked) cannot receive the copy. */
  weekLocked(week: number): boolean {
    const days = this.daysOf(week);
    return days.length > 0 && days.every((index) => this.isLocked(index));
  }

  dayTitle(index: number, _week: number): string {
    if (index === this.sourceIndex) return 'COPY_DAYS.SOURCE';
    return this.isLocked(index) ? 'COPY_DAYS.PAST_DAY' : 'COPY_DAYS.DAY_OF_WEEK';
  }

  daysOf(week: number): number[] {
    const start = (week - 1) * DAYS_PER_WEEK;
    return Array.from({ length: Math.min(DAYS_PER_WEEK, this.dayCount - start) }, (_, i) => start + i);
  }

  daysInWeek(week: number): number {
    return this.daysOf(week).length;
  }

  filledInWeek(week: number): number {
    return this.daysOf(week).filter((index) => this.filled[index]).length;
  }

  weekOf(index: number): number {
    return Math.floor(index / DAYS_PER_WEEK) + 1;
  }

  toggle(value: number): void {
    if (this.selected.has(value)) this.selected.delete(value);
    else this.selected.add(value);
  }

  private selectable(index: number): boolean {
    return index !== this.sourceIndex && !this.isLocked(index);
  }

  selectSameWeekday(): void {
    if (this.sourceIndex === null) return;
    for (let index = this.sourceIndex % DAYS_PER_WEEK; index < this.dayCount; index += DAYS_PER_WEEK) {
      if (this.selectable(index)) this.selected.add(index);
    }
  }

  selectEmptyDays(): void {
    for (let index = 0; index < this.dayCount; index++) {
      if (!this.filled[index] && this.selectable(index)) this.selected.add(index);
    }
  }

  selectAll(): void {
    for (let index = 0; index < this.dayCount; index++) {
      if (this.selectable(index)) this.selected.add(index);
    }
  }

  selectNextWeek(): void {
    for (let week = this.sourceWeek + 1; week <= this.weekCount; week++) {
      if (!this.weekLocked(week)) {
        this.selected.add(week);
        return;
      }
    }
  }

  selectFollowingWeeks(): void {
    for (let week = this.sourceWeek + 1; week <= this.weekCount; week++) {
      if (!this.weekLocked(week)) this.selected.add(week);
    }
  }
}
