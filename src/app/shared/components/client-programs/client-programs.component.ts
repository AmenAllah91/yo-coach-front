import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import {
  OverviewAlert,
  OverviewDay,
  OverviewItem,
  ProgramKind,
  ProgramOverview,
  daysFrom,
} from '@shared/models/program-schedule';

export type ClientProgramActionType =
  | 'assign' | 'edit' | 'view' | 'dates' | 'remove' | 'duplicate' | 'open' | 'download' | 'replace' | 'calendar'
  | 'shift';

/** What the coach asked for; the tab that hosts the page does it (it has the windows and the plans). */
export interface ClientProgramAction {
  type: ClientProgramActionType;
  item?: OverviewItem;
  programId?: string;
  /** edit: the day to open. */
  dayNumber?: number | null;
  /** assign: the start to propose; calendar: the day to show. */
  date?: string | null;
}

interface AlertView {
  alert: OverviewAlert;
  text: string;
  button: string;
  action: ClientProgramAction;
}

/**
 * The client's « Programmes » tab (backlog-programmes.md P1-P8), for workout and nutrition: what needs the coach,
 * where the client is (the week day by day), what comes next, then the upcoming and finished programs.
 */
@Component({
  selector: 'app-client-programs',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './client-programs.component.html',
  styleUrls: ['./client-programs.component.scss'],
})
export class ClientProgramsComponent implements OnInit, OnChanges {
  @Input() kind: ProgramKind = 'WORKOUT';
  @Input() clientId = '';
  @Input() clientName = '';
  @Input() canWrite = true;
  @Output() action = new EventEmitter<ClientProgramAction>();

  overview: ProgramOverview | null = null;
  loading = true;
  failed = false;
  listTab: 'UPCOMING' | 'FINISHED' = 'UPCOMING';
  finished: OverviewItem[] = [];
  loadingMore = false;
  openMenuId: string | null = null;
  /** The coach account is read-only (subscription): nothing to change (SUB-30). */
  private readOnlyAccount = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(public schedule: ProgramScheduleService, private translate: TranslateService,
              private subscriptionState: CoachSubscriptionStateService) {}

  ngOnInit(): void {
    this.subscriptionState.states$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => (this.readOnlyAccount = !!state?.readOnly));
    this.subscriptionState.getState().subscribe();
    this.schedule.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['clientId'] || changes['kind']) && this.clientId) {
      if (changes['clientId'] && !changes['clientId'].firstChange) { // another client
        this.overview = null;
        this.loading = true;
      }
      this.reload(false);
    }
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.openMenuId = null;
  }

  /**
   * Reads the tab again (after a change made elsewhere). {@code fresh} false: the tab just opened, a read of a few
   * seconds ago (the profile prefetches both tabs) is not made again.
   */
  reload(fresh = true): void {
    if (!this.clientId) return;
    this.failed = false;
    // Opened again (or prefetched by the profile): the last read shows at once, the new one replaces it.
    const known = this.overview?.type === this.kind ? null : this.schedule.overviewSnapshot(this.kind, this.clientId);
    if (known) this.apply(known);
    if (!fresh && known && this.schedule.overviewSnapshot(this.kind, this.clientId, 15_000)) return;
    const clientId = this.clientId;
    this.schedule.overview(this.kind, clientId).subscribe({
      next: overview => {
        if (clientId === this.clientId) this.apply(overview);
      },
      error: () => {
        this.loading = false;
        this.failed = !this.overview;
      },
    });
  }

  private apply(overview: ProgramOverview): void {
    this.overview = overview;
    this.finished = overview.finished || [];
    this.loading = false;
    if (this.listTab === 'UPCOMING' && !overview.upcoming.length && overview.finishedCount) this.listTab = 'FINISHED';
    if (this.listTab === 'FINISHED' && !overview.finishedCount && overview.upcoming.length) this.listTab = 'UPCOMING';
  }

  loadMoreFinished(): void {
    if (this.loadingMore || !this.overview) return;
    this.loadingMore = true;
    this.schedule.overview(this.kind, this.clientId, this.finished.length).subscribe({
      next: overview => {
        this.finished = [...this.finished, ...(overview.finished || [])];
        this.loadingMore = false;
      },
      error: () => (this.loadingMore = false),
    });
  }

  /* ---------------- what the page shows ---------------- */

  get writable(): boolean {
    return this.canWrite && !this.readOnlyAccount;
  }

  get isWorkout(): boolean {
    return this.kind === 'WORKOUT';
  }

  get today(): string {
    return this.overview?.today || '';
  }

  /** Nothing going on, nothing planned. */
  get isEmpty(): boolean {
    const o = this.overview;
    return !!o && !o.current && !o.next && !o.upcoming.length;
  }

  get hasList(): boolean {
    const o = this.overview;
    return !!o && (o.upcoming.length > 0 || o.finishedCount > 0);
  }

  get alerts(): AlertView[] {
    const o = this.overview;
    if (!o) return [];
    return o.alerts.map(alert => this.alertView(alert, o)).filter((view): view is AlertView => !!view);
  }

  private alertView(alert: OverviewAlert, o: ProgramOverview): AlertView | null {
    const t = (key: string, params?: object) => this.translate.instant(`CLIENT_PROGRAMS.${key}`, params);
    switch (alert.kind) {
      case 'ENDING_SOON': {
        const name = o.current?.program.name || '';
        return {
          alert,
          text: t('ALERT_ENDING', { name, when: this.whenLabel(alert.from) }),
          button: t('ASSIGN_NEXT'),
          action: { type: 'assign' },
        };
      }
      case 'GAP':
        return {
          alert,
          text: alert.from === alert.to
            ? t('ALERT_GAP_ONE', { date: this.dayMonth(alert.from) })
            : t('ALERT_GAP', { from: this.dayMonth(alert.from), to: this.dayMonth(alert.to) }),
          button: t('ASSIGN'),
          action: { type: 'assign', date: alert.from },
        };
      case 'EMPTY_DAYS':
        return {
          alert,
          text: t(alert.count === 1 ? 'ALERT_EMPTY_ONE' : 'ALERT_EMPTY', { count: alert.count, date: this.dayMonth(alert.from) }),
          button: t('FILL'),
          action: { type: 'edit', programId: alert.programId || undefined, dayNumber: alert.dayNumber },
        };
      case 'OVERLAP':
        return {
          alert,
          text: t('ALERT_OVERLAP', { from: this.dayMonth(alert.from), to: this.dayMonth(alert.to) }),
          button: t('SEE'),
          action: { type: 'edit', programId: alert.otherProgramId || alert.programId || undefined },
        };
      default:
        return null;
    }
  }

  /** "Semaine 2 sur 3 · finit le 20 oct. (dans 4 jours) · 3 séances sur 4 faites cette semaine" */
  get currentLine(): string {
    const c = this.overview?.current;
    if (!c) return '';
    const t = (key: string, params?: object) => this.translate.instant(`CLIENT_PROGRAMS.${key}`, params);
    const parts: string[] = [];
    if (c.program.file) {
      parts.push(t('FILE_RANGE', { from: this.dayMonth(c.program.startDate), to: this.dayMonth(c.program.endDate) }));
      parts.push(t('FILE_NO_TRACKING'));
      return parts.join(' · ');
    }
    parts.push(t('WEEK_OF', { week: c.week, weeks: c.weeks }));
    if (c.program.endDate) parts.push(t('ENDS', { date: this.dayMonth(c.program.endDate), when: this.relative(c.program.endDate) }));
    return parts.join(' · ');
  }

  /** "Cette semaine" bar: sessions done (days logged) out of the planned ones. */
  get progress(): { done: number; planned: number; percent: number } | null {
    const c = this.overview?.current;
    if (!c || c.program.file || c.plannedThisWeek <= 0) return null;
    const done = Math.min(c.doneThisWeek, c.plannedThisWeek);
    return { done, planned: c.plannedThisWeek, percent: Math.round((done / c.plannedThisWeek) * 100) };
  }

  get progressLabel(): string {
    const p = this.progress;
    if (!p) return '';
    return this.translate.instant(this.isWorkout ? 'CLIENT_PROGRAMS.PROGRESS_SESSIONS' : 'CLIENT_PROGRAMS.PROGRESS_DAYS', { done: p.done, planned: p.planned });
  }

  /** The client's initials, next to what they wrote. */
  get clientInitials(): string {
    const letters = (this.clientName || '').trim().split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('');
    return (letters || '?').toUpperCase();
  }

  get nextLine(): string {
    const n = this.overview?.next;
    if (!n) return '';
    return this.translate.instant('CLIENT_PROGRAMS.NEXT_STARTS', {
      date: this.dayMonth(n.program.startDate),
      when: this.relative(n.program.startDate),
    });
  }

  /** The next program's first week is not ready (the client would see nothing on some days). */
  get nextIncomplete(): boolean {
    const n = this.overview?.next;
    return !!n && !n.program.file && n.firstWeekDays > 0 && n.firstWeekReady < n.firstWeekDays;
  }

  get lastActivityLabel(): string {
    const o = this.overview;
    if (!o) return '';
    const key = this.isWorkout ? 'LAST_SESSION' : 'LAST_DAY';
    if (!o.lastActivity) return this.translate.instant(`CLIENT_PROGRAMS.${key}_NONE`);
    return this.translate.instant(`CLIENT_PROGRAMS.${key}`, { when: this.relative(o.lastActivity, true) });
  }

  weeksLabel(item: OverviewItem): string {
    if (item.file) return this.translate.instant(item.fileKind === 'EXCEL' ? 'CLIENT_PROGRAMS.FILE_EXCEL' : 'CLIENT_PROGRAMS.FILE_PDF');
    return this.translate.instant(item.weeks === 1 ? 'CLIENT_PROGRAMS.WEEKS_ONE' : 'CLIENT_PROGRAMS.WEEKS', { count: item.weeks });
  }

  rowDate(item: OverviewItem): string {
    const t = (key: string, params?: object) => this.translate.instant(`CLIENT_PROGRAMS.${key}`, params);
    if (item.status === 'UPCOMING') return t('FROM_DATE', { date: this.dayMonth(item.startDate) });
    if (item.stoppedAt) return t('STOPPED_ON', { date: this.dayMonth(item.stoppedAt) });
    return t('ENDED_ON', { date: this.dayMonth(item.endDate) });
  }

  dayLabel(day: OverviewDay): string {
    return this.weekday(day.date);
  }

  dayOfMonth(day: OverviewDay): number {
    return this.toDate(day.date).getDate();
  }

  /** The card's color: done, missed, started, today, rest, empty, planned, outside the program. */
  dayTone(day: OverviewDay): string {
    if (day.state === 'DONE' || day.state === 'MISSED' || day.state === 'PARTIAL' || day.state === 'OUT') return day.state.toLowerCase();
    if (day.today) return 'today';
    return day.state.toLowerCase();
  }

  /** The mark at the top right of the card ('dot': today, nothing done yet). */
  dayIcon(day: OverviewDay): string | null {
    switch (this.dayTone(day)) {
      case 'done': return 'check';
      case 'missed': return 'x';
      case 'partial': return 'more-horizontal';
      case 'today': return 'dot';
      default: return null;
    }
  }

  /** The workout's name (nutrition: the calories, else the day). Only the name: no exercise, set or time. */
  dayHeadline(day: OverviewDay): string {
    const t = (key: string, params?: object) => this.translate.instant(`CLIENT_PROGRAMS.${key}`, params);
    if (day.state === 'EMPTY') return t('DAY_EMPTY_TITLE');
    // "Main Session": the name the builders give a new workout, shown in the coach's language.
    if (this.isWorkout) return day.title?.trim() && day.title.trim() !== 'Main Session' ? day.title.trim() : t('DAY_SESSION');
    if (day.calories) return t('KCAL', { count: day.calories.toLocaleString(this.locale()) });
    return t('DAY_NUMBER', { number: day.dayNumber });
  }

  /** "6 exercices" ("3 repas"). */
  dayMeta(day: OverviewDay): string {
    const count = day.items || 0;
    if (day.state === 'OUT' || day.state === 'REST' || day.state === 'EMPTY' || count <= 0) return '';
    const key = this.isWorkout ? (count === 1 ? 'EXERCISES_ONE' : 'EXERCISES') : (count === 1 ? 'MEALS_ONE' : 'MEALS');
    return this.translate.instant(`CLIENT_PROGRAMS.${key}`, { count });
  }

  /** "Terminée", "Manquée", "Aujourd'hui", "Prévue", "Jour de repos"... */
  dayStatus(day: OverviewDay): string {
    const kind = this.isWorkout ? 'WORKOUT' : 'NUTRITION';
    const t = (key: string) => this.translate.instant(`CLIENT_PROGRAMS.${key}`);
    // Empty today: what matters is that the client sees nothing (the card keeps the « today » border).
    if (day.state === 'EMPTY') return t('STATUS_EMPTY');
    switch (this.dayTone(day)) {
      case 'done': return t(`STATUS_DONE_${kind}`);
      case 'missed': return t(`STATUS_MISSED_${kind}`);
      case 'partial': return t(`STATUS_PARTIAL_${kind}`);
      case 'today': return t('STATUS_TODAY');
      case 'rest': return t(`STATUS_REST_${kind}`);
      case 'empty': return t('STATUS_EMPTY');
      case 'out': return t('STATUS_OUT');
      default: return t(`STATUS_PLANNED_${kind}`);
    }
  }

  dayTitle(day: OverviewDay): string {
    const what = day.state === 'REST' || day.state === 'OUT' ? '' : ` · ${this.dayHeadline(day)}`;
    return `${this.weekday(day.date)} ${this.dayMonth(day.date)}${what} · ${this.dayStatus(day)}`;
  }

  /** « Décaler la suite » (DS-10): a program going on or to come, even started; not a stopped or finished one. */
  canShift(item: OverviewItem): boolean {
    return item.status !== 'FINISHED' && !item.stoppedAt;
  }

  /** Can the coach move its dates (not once the client started it, a file only moves its end). */
  canMove(item: OverviewItem): boolean {
    return item.status !== 'FINISHED' && !item.stoppedAt && (item.file || item.doneDays === 0);
  }

  /* ---------------- actions ---------------- */

  emit(action: ClientProgramAction, event?: Event): void {
    event?.stopPropagation();
    this.openMenuId = null;
    this.action.emit(action);
  }

  onDay(day: OverviewDay, item: OverviewItem, event: Event): void {
    if (day.state === 'OUT') return;
    if (day.date < this.today) this.emit({ type: 'calendar', date: day.date, item, programId: item.id }, event);
    else if (this.writable) this.emit({ type: 'edit', item, programId: item.id, dayNumber: day.dayNumber }, event);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  /* ---------------- dates ---------------- */

  private locale(): string {
    return (this.translate.currentLang || this.translate.defaultLang || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR';
  }

  private toDate(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  /** "20 oct." ("20 oct. 2027" another year). */
  dayMonth(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = this.toDate(iso);
    const sameYear = date.getFullYear() === this.toDate(this.today || iso).getFullYear();
    return date.toLocaleDateString(this.locale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  }

  weekday(iso: string): string {
    return this.toDate(iso).toLocaleDateString(this.locale(), { weekday: 'short' });
  }

  /** "aujourd'hui", "demain", "dans 4 jours", "hier", "il y a 3 jours". */
  relative(iso: string | null | undefined, past = false): string {
    const days = daysFrom(this.today, iso);
    const t = (key: string, params?: object) => this.translate.instant(`CLIENT_PROGRAMS.${key}`, params);
    if (days === 0) return t('TODAY');
    if (days === 1) return t('TOMORROW');
    if (days === -1) return t('YESTERDAY');
    if (days > 1) return t('IN_DAYS', { count: days });
    return past || days < 0 ? t('DAYS_AGO', { count: -days }) : '';
  }

  /** "aujourd'hui", "demain", "le 20 oct. (dans 4 jours)". */
  whenLabel(iso: string | null | undefined): string {
    const days = daysFrom(this.today, iso);
    if (days === 0 || days === 1) return this.relative(iso);
    return this.translate.instant('CLIENT_PROGRAMS.ON_DATE', { date: this.dayMonth(iso), when: this.relative(iso) });
  }

  trackById = (_: number, item: OverviewItem) => item.id;
}
