import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { dateKey } from './client-plan-utils';

/** What a day of the strip tells at a glance: ✓ done, ✗ missed, a dot for the rest (nothing = rest day / no plan). */
export type WeekMark = 'done' | 'missed' | 'late' | 'planned' | 'off';

/** Monday of the week of `date`, at midnight (local). */
export function mondayOf(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Week strip of the client Workout and Nutrition pages (same as the mobile WeekStrip): Monday to Sunday, one mark
 * per day, arrows and swipe to change week, « Today » to come back. Display only: the page keeps its own data.
 */
@Component({
  selector: 'app-week-strip',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="ws__card">
      <div class="ws__head">
        <span class="ws__label">{{ label }}</span>
        <button *ngIf="!isCurrentWeek" type="button" class="ws__today" (click)="today.emit()">{{ fr ? 'Aujourd’hui' : 'Today' }}</button>
      </div>
      <div class="ws__bar" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
        <button type="button" class="ws__arrow" [attr.aria-label]="fr ? 'Semaine précédente' : 'Previous week'" [disabled]="!canGoPrevious" (click)="shift.emit(-1)">
          <i-feather name="chevron-left"></i-feather>
        </button>
        <div class="ws__days">
          <button *ngFor="let day of days" type="button" class="ws__day" [class.is-today]="day.today" [class.is-selected]="day.selected"
                  [class.is-done]="day.mark === 'done'" [class.is-missed]="day.mark === 'missed'"
                  [disabled]="day.out" [attr.aria-label]="day.aria" [attr.aria-pressed]="day.selected" (click)="pick.emit(day.date)">
            <small>{{ day.letter }}</small>
            <span class="ws__num">
              <ng-container *ngIf="day.selected || (day.mark !== 'done' && day.mark !== 'missed'); else markIcon">{{ day.number }}</ng-container>
              <ng-template #markIcon><i-feather [name]="day.mark === 'done' ? 'check' : 'x'"></i-feather></ng-template>
            </span>
            <i class="ws__mark" [ngClass]="day.mark ? 'ws__mark--' + day.mark : ''"></i>
          </button>
        </div>
        <button type="button" class="ws__arrow" [attr.aria-label]="fr ? 'Semaine suivante' : 'Next week'" [disabled]="!canGoNext" (click)="shift.emit(1)">
          <i-feather name="chevron-right"></i-feather>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin: 4px 0 6px; }
    .ws__card {
      padding: 14px 8px 10px; border-radius: 18px;
      background: var(--yc-surface); border: 1px solid var(--yc-hairline); box-shadow: var(--yc-shadow-card);
    }
    .ws__head { display: flex; align-items: center; gap: 8px; min-height: 28px; margin-bottom: 10px; padding: 0 10px; }
    .ws__label { flex: 1; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--yc-text-primary); }
    .ws__today {
      height: 28px; padding: 0 12px; border: 0; border-radius: 99px; cursor: pointer;
      background: color-mix(in srgb, var(--yc-primary) 10%, transparent); color: var(--yc-primary);
      font-size: 12.5px; font-weight: 600;
    }
    .ws__bar { display: flex; align-items: center; gap: 2px; touch-action: pan-y; }
    .ws__arrow {
      flex: none; width: 30px; height: 40px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: 10px; background: none; color: var(--yc-text-secondary); cursor: pointer;
    }
    .ws__arrow:hover { background: color-mix(in srgb, var(--yc-primary) 8%, transparent); color: var(--yc-primary); }
    .ws__arrow i-feather { width: 18px; height: 18px; }
    .ws__arrow:disabled { opacity: 0.35; cursor: default; background: none; color: var(--yc-text-secondary); }
    .ws__day:disabled { opacity: 0.4; cursor: default; }
    .ws__day:disabled .ws__num { background: none; }
    .ws__days { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(7, 1fr); }
    .ws__day {
      display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 2px 0; min-width: 0;
      border: 0; background: none; cursor: pointer; color: var(--yc-text-primary);
    }
    .ws__day small { font-size: 11px; font-weight: 600; letter-spacing: 0.3px; color: var(--yc-text-secondary); }
    .ws__num {
      width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 1.6px solid transparent; font-size: 15px; font-weight: 600;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .ws__num i-feather { width: 17px; height: 17px; stroke-width: 2.6; }
    .ws__day:hover .ws__num { background: color-mix(in srgb, var(--yc-primary) 8%, transparent); }
    .ws__day.is-done .ws__num { background: color-mix(in srgb, #1e8e4e 13%, transparent); color: #1e8e4e; }
    .ws__day.is-missed .ws__num { background: color-mix(in srgb, #d93a3a 11%, transparent); color: #d93a3a; }
    .ws__day.is-today small { color: var(--yc-primary); }
    .ws__day.is-today .ws__num { border-color: var(--yc-primary); color: var(--yc-primary); }
    .ws__day.is-selected .ws__num { background: var(--yc-primary); border-color: var(--yc-primary); color: #fff; }
    .ws__mark { height: 6px; width: 6px; border-radius: 50%; font-style: normal; }
    .ws__mark--planned { background: var(--yc-primary); }
    .ws__mark--late { background: #d99100; }
    .ws__mark--off { background: #7455d9; }
    .ws__day.is-selected .ws__mark--done { background: #1e8e4e; }
    .ws__day.is-selected .ws__mark--missed { background: #d93a3a; }
    @media (max-width: 420px) {
      .ws__card { padding-left: 4px; padding-right: 4px; }
      .ws__arrow { width: 24px; }
      .ws__num { width: 32px; height: 32px; font-size: 14px; }
    }
  `],
})
export class WeekStripComponent {
  /** Monday of the week shown. */
  @Input() weekStart: Date = mondayOf(new Date());
  @Input() selected: Date | null = null;
  /** Mark of each day, by dateKey ("2026-11-16"). */
  @Input() marks: Record<string, WeekMark> = {};
  @Input() fr = false;
  /** Bounds of the days that can be picked (the history stops today): the days outside are greyed. */
  @Input() firstDay: Date | null = null;
  @Input() lastDay: Date | null = null;
  /** -1 / +1 week. */
  @Output() shift = new EventEmitter<number>();
  @Output() pick = new EventEmitter<Date>();
  @Output() today = new EventEmitter<void>();

  private touchX: number | null = null;
  private touchY = 0;

  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }

  get isCurrentWeek(): boolean { return this.weekStart.getTime() === mondayOf(new Date()).getTime(); }

  get canGoPrevious(): boolean { return !this.firstDay || this.weekStart.getTime() > mondayOf(this.firstDay).getTime(); }
  get canGoNext(): boolean { return !this.lastDay || this.weekStart.getTime() < mondayOf(this.lastDay).getTime(); }

  get days(): { date: Date; letter: string; number: number; today: boolean; selected: boolean; out: boolean; mark?: WeekMark; aria: string }[] {
    const today = dateKey(new Date());
    const selected = this.selected ? dateKey(this.selected) : '';
    const letter = new Intl.DateTimeFormat(this.locale, { weekday: 'narrow' });
    const full = new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(this.weekStart, index);
      const key = dateKey(date);
      return {
        date, letter: letter.format(date).toUpperCase(), number: date.getDate(),
        today: key === today, selected: key === selected, mark: this.marks[key], aria: full.format(date),
        out: (!!this.firstDay && key < dateKey(this.firstDay)) || (!!this.lastDay && key > dateKey(this.lastDay)),
      };
    });
  }

  /** « 16 – 22 novembre 2026 », « 30 nov. – 6 déc. 2026 ». */
  get label(): string {
    const start = this.weekStart;
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const month = (date: Date, long: boolean) => new Intl.DateTimeFormat(this.locale, { month: long ? 'long' : 'short' }).format(date);
    if (this.fr) {
      return sameMonth ? `${start.getDate()} – ${end.getDate()} ${month(end, true)} ${end.getFullYear()}`
        : `${start.getDate()} ${month(start, false)} – ${end.getDate()} ${month(end, false)} ${end.getFullYear()}`;
    }
    return sameMonth ? `${month(start, true)} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
      : `${month(start, false)} ${start.getDate()} – ${month(end, false)} ${end.getDate()}, ${end.getFullYear()}`;
  }

  onTouchStart(event: TouchEvent): void {
    this.touchX = event.touches[0]?.clientX ?? null;
    this.touchY = event.touches[0]?.clientY ?? 0;
  }

  /** Swipe left = next week, right = previous week (as on the mobile app). */
  onTouchEnd(event: TouchEvent): void {
    if (this.touchX == null) return;
    const dx = (event.changedTouches[0]?.clientX ?? this.touchX) - this.touchX;
    const dy = (event.changedTouches[0]?.clientY ?? this.touchY) - this.touchY;
    this.touchX = null;
    if (Math.abs(dx) <= 45 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    if (dx < 0 ? this.canGoNext : this.canGoPrevious) this.shift.emit(dx < 0 ? 1 : -1);
  }
}
