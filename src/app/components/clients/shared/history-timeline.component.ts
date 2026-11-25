import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, TemplateRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { dateKey } from './client-plan-utils';
import { WeekMark, WeekStripComponent, addDays, mondayOf } from './week-strip.component';

interface HistoryDay { date: Date; key: string; label: string; today: boolean; }

/** The list never goes further back than a year. */
const MAX_DAYS = 366;
/** Days drawn at first, and added each time the bottom of the list comes near. */
const PAGE_DAYS = 30;

/**
 * History of the client Workout and Nutrition pages (same as the mobile HistoryTimeline): the week strip stays on
 * top, the days follow from today back to `firstDay`. A day picked in the strip comes into view in the list; the
 * list scrolled by hand moves the day picked in the strip. Display only: the page gives what each day holds.
 */
@Component({
  selector: 'app-history-timeline',
  standalone: true,
  imports: [CommonModule, WeekStripComponent],
  template: `
    <div #strip class="ht__strip" [style.top.px]="stickyTop">
      <app-week-strip [weekStart]="weekStart" [selected]="selected" [marks]="marks" [fr]="fr" [firstDay]="first" [lastDay]="today"
                      (shift)="shiftWeek($event)" (pick)="goTo($event)" (today)="goTo(today)"></app-week-strip>
    </div>
    <ol #list class="ht__list" [class.ht__list--whole]="shown >= days.length">
      <li *ngFor="let day of shownDays; trackBy: trackByDay" class="ht__day" [class.is-today]="day.today"
          [class.is-selected]="day.key === selectedKey" [attr.data-day]="day.key">
        <span class="ht__dot" [ngClass]="marks[day.key] ? 'ht__dot--' + marks[day.key] : ''">{{ marks[day.key] === 'done' ? '✓' : '' }}</span>
        <div class="ht__body">
          <div class="ht__label">{{ day.label }}</div>
          <ng-container *ngTemplateOutlet="dayTemplate; context: { $implicit: day.date, key: day.key }"></ng-container>
        </div>
      </li>
    </ol>
  `,
  styles: [`
    :host { display: block; }
    .ht__strip {
      position: sticky; top: 0; z-index: 6; margin: 0 -16px; padding: 6px 16px 2px;
      background: var(--yc-background);
    }
    .ht__list { list-style: none; margin: 0; padding: 4px 0 55vh; }
    .ht__day { position: relative; display: flex; gap: 12px; padding-bottom: 16px; }
    .ht__day::before {
      content: ''; position: absolute; left: 5px; top: 18px; bottom: 0; width: 1.5px;
      background: light-dark(#dde2ea, #33373e);
    }
    .ht__list--whole .ht__day:last-child::before { display: none; }
    .ht__dot {
      flex: none; position: relative; width: 12px; height: 12px; margin-top: 6px; border-radius: 50%;
      background: light-dark(#b9c0cc, #5a606b); box-shadow: 0 0 0 2px var(--yc-background);
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 8px; font-weight: 800; line-height: 1;
    }
    .is-today .ht__dot { background: var(--yc-primary); }
    .ht__dot.ht__dot--planned { background: var(--yc-primary); }
    .ht__dot.ht__dot--done { background: #1e8e4e; }
    .ht__dot.ht__dot--missed { background: #d93a3a; }
    .ht__dot.ht__dot--late { background: #d99100; }
    .ht__dot.ht__dot--off { background: #7455d9; }
    .ht__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .ht__label {
      min-height: 24px; display: flex; align-items: center;
      font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
      color: var(--yc-text-secondary);
    }
    .is-today .ht__label, .is-selected .ht__label { color: var(--yc-primary); }
  `],
})
export class HistoryTimelineComponent implements OnChanges, AfterViewInit, OnDestroy {
  /** Oldest day listed. */
  @Input() firstDay: Date = new Date();
  /** Day shown first (a day the client comes back from); today when not given. */
  @Input() startDay: Date | null = null;
  /** Mark of each day, by dateKey ("2026-11-16"). */
  @Input() marks: Record<string, WeekMark> = {};
  @Input() fr = false;
  /**
   * Only these days are listed (dateKey), today always: for a sparse history (check-ins, once a week or so),
   * where a row for every empty day only makes the list long. Null = every day, like Workouts and Nutrition.
   */
  @Input() onlyDays: string[] | null = null;
  /** What a day holds: `let-date`, `let-key="key"`. Nothing rendered = only the date shows. */
  @Input() dayTemplate!: TemplateRef<{ $implicit: Date; key: string }>;

  @ViewChild('strip') private strip?: ElementRef<HTMLElement>;
  @ViewChild('list') private list?: ElementRef<HTMLElement>;

  today = startOfDay(new Date());
  first = this.today;
  selected = this.today;
  /** The whole history, today first. */
  days: HistoryDay[] = [];
  /** How many of them are drawn. */
  shown = PAGE_DAYS;
  shownDays: HistoryDay[] = [];
  stickyTop = 0;

  private lastFirstKey = '';
  private lastSignature = '';

  /** True while the list moves to a day picked in the strip: the strip keeps that day, whatever passes on top. */
  private jumping = false;
  private jumpTimer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private readonly onScroll = () => {
    if (this.jumping || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.syncFromScroll(); });
  };

  constructor(private zone: NgZone, private changes: ChangeDetectorRef) {}

  get weekStart(): Date { return mondayOf(this.selected); }
  get selectedKey(): string { return dateKey(this.selected); }

  ngOnChanges(): void {
    this.today = startOfDay(new Date());
    const oldest = addDays(this.today, -(MAX_DAYS - 1));
    const first = startOfDay(this.firstDay);
    this.first = first > this.today ? this.today : first < oldest ? oldest : first;
    const only = this.onlyDays ? new Set(this.onlyDays) : null;
    const signature = only ? [...only].sort().join(',') : '';
    if (this.days.length && this.days[0].key === dateKey(this.today) && this.lastFirstKey === dateKey(this.first)
      && this.days[0].label === this.labelOf(this.today) && this.lastSignature === signature) return;
    this.lastFirstKey = dateKey(this.first);
    this.lastSignature = signature;
    this.days = [];
    for (let day = this.today; day >= this.first; day = addDays(day, -1)) {
      const key = dateKey(day);
      const today = day.getTime() === this.today.getTime();
      if (only && !today && !only.has(key)) continue;
      this.days.push({ date: day, key, label: this.labelOf(day), today });
    }
    this.shownDays = this.days.slice(0, this.shown);
  }

  ngAfterViewInit(): void {
    // Under a fixed page header, the strip sticks just below it.
    const header = document.querySelector<HTMLElement>('app-header');
    if (header && ['fixed', 'sticky'].includes(getComputedStyle(header).position)) {
      const bottom = header.getBoundingClientRect().bottom;
      if (bottom > 0 && bottom < 200) setTimeout(() => (this.stickyTop = Math.round(bottom)), 0);
    }
    // Whatever element scrolls the page (window or the layout body): the event is caught on its way down.
    this.zone.runOutsideAngular(() => document.addEventListener('scroll', this.onScroll, { capture: true, passive: true }));
    if (this.startDay && dateKey(this.startDay) !== dateKey(this.today)) setTimeout(() => this.goTo(this.startDay!, false), 0);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.jumpTimer) clearTimeout(this.jumpTimer);
  }

  /** « Aujourd’hui », « dim. 15 nov. ». */
  private labelOf(day: Date): string {
    if (day.getTime() === this.today.getTime()) return this.fr ? 'Aujourd’hui' : 'Today';
    return new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(day).replace(/\./g, '');
  }

  private get stripBottom(): number { return this.strip?.nativeElement.getBoundingClientRect().bottom ?? 0; }

  /** The list was scrolled by hand: the day on top of it (just under the strip) becomes the day picked in the strip. */
  private syncFromScroll(): void {
    const rows = this.list?.nativeElement.children;
    if (!rows?.length) return;
    // The last day drawn comes near the bottom of the window: the next ones are added.
    if (this.shown < this.days.length && rows[rows.length - 1].getBoundingClientRect().top < window.innerHeight * 2.5) {
      this.zone.run(() => this.show(this.shown + PAGE_DAYS));
    }
    const top = this.stripBottom + 24;
    // The days go down the page in order: the first one whose bottom is under the strip is the one on top.
    let low = 0; let high = rows.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (rows[mid].getBoundingClientRect().bottom > top) high = mid; else low = mid + 1;
    }
    const day = this.days[low];
    if (day && day.key !== this.selectedKey) this.zone.run(() => (this.selected = day.date));
  }

  /** A day is picked in the strip: it becomes the selected one and comes on top of the list. */
  goTo(date: Date, smooth = true): void {
    const day = startOfDay(date);
    const target = day > this.today ? this.today : day < this.first ? this.first : day;
    this.selected = target;
    // Only some days listed: a day without a row goes to the closest listed day before it.
    let index = this.days.findIndex(d => d.date.getTime() <= target.getTime());
    if (index < 0) index = this.days.length - 1;
    const rowDay = this.days[index];
    if (!rowDay) return;
    // A day not drawn yet (picked in the strip): the list is first drawn down to it, a few days further.
    const needed = index + 1 + 7;
    if (needed > this.shown) {
      this.show(Math.ceil(needed / PAGE_DAYS) * PAGE_DAYS);
      this.changes.detectChanges();
    }
    const row = this.list?.nativeElement.querySelector<HTMLElement>(`[data-day="${rowDay.key}"]`);
    if (!row) return;
    this.jumping = true;
    if (this.jumpTimer) clearTimeout(this.jumpTimer);
    this.jumpTimer = setTimeout(() => (this.jumping = false), smooth ? 800 : 150);
    row.style.scrollMarginTop = `${Math.round(this.stripBottom) + 6}px`;
    row.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  }

  private show(count: number): void {
    this.shown = Math.min(count, Math.max(this.days.length, PAGE_DAYS));
    this.shownDays = this.days.slice(0, this.shown);
  }

  /** Another week is asked for: the same weekday is picked in it (kept inside the history). */
  shiftWeek(delta: number): void { this.goTo(addDays(this.selected, delta * 7)); }

  trackByDay = (_: number, day: HistoryDay) => day.key;
}

function startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
