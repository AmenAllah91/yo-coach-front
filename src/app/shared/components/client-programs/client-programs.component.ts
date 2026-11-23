import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ProgramCalendarComponent } from '@shared/program-calendar/program-calendar.component';
import { dayWindowPlan, prefetchDayWindowPlan } from '@shared/program-calendar/day-window-prefetch';
import { nutritionPlanKind } from '@shared/models/nutrition-plan-kind';
import { CalendarCell, CalendarLine, CalendarMenuItem, CalendarTone, CalendarWeek, calendarIcon } from '@shared/program-calendar/program-calendar.model';
import { exerciseLines } from '@shared/models/calendar-day';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { CalendarCopyResult, ProgramScheduleService } from 'app/service/program-schedule.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { ToastService } from 'app/service/toast.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { ClientActivityDetailComponent } from 'app/components/clients/profil-client/client-activity/client-activity-detail.component';
import {
  NutritionActivity,
  WorkoutActivity,
  buildNutritionActivities,
  buildWorkoutActivities,
} from 'app/components/clients/profil-client/client-activity/client-activity';
import {
  OverviewAlert,
  OverviewDay,
  OverviewExercise,
  OverviewItem,
  ProgramKind,
  ProgramOverview,
  daysFrom,
} from '@shared/models/program-schedule';

export type ClientProgramActionType =
  | 'assign' | 'edit' | 'view' | 'dates' | 'remove' | 'duplicate' | 'open' | 'download' | 'replace' | 'calendar'
  | 'shift' | 'message';

/** What the coach asked for; the tab that hosts the page does it (it has the windows and the plans). */
export interface ClientProgramAction {
  type: ClientProgramActionType;
  item?: OverviewItem;
  programId?: string;
  /** edit: the day to open. */
  dayNumber?: number | null;
  /** edit: the day opens in its window (like a click in the editor's calendar), « Fermer » comes back here. */
  open?: boolean;
  /** assign: the start to propose; calendar: the day to show. */
  date?: string | null;
  /** message: a text ready in the chat (a missed workout), the coach changes it or sends it. */
  draft?: string | null;
}

/**
 * The coach picks a day on the week (quick changes, workout only): where to move or copy a day (MOVE, COPY_TO), or
 * which day to copy onto an empty one (COPY_FROM).
 */
interface DayPick {
  mode: 'MOVE' | 'COPY_TO' | 'COPY_FROM';
  day: OverviewDay;
  programId: string;
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
  imports: [CommonModule, TranslateModule, FeatherModule, ClientActivityDetailComponent, ProgramCalendarComponent],
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
  /** The week shown by the arrows (1 = the program's first); null: the week going on. */
  shownWeek: number | null = null;
  /** The coach is choosing a day on the week (move, copy). */
  pick: DayPick | null = null;
  /** A quick change of a day is being saved. */
  savingDay = false;
  /**
   * « Répéter la semaine »: week {@code source} copied onto the next week or every next week, only on their empty days.
   * {@code preview}: what the server would do (dry run), read again when the choice changes.
   */
  repeat: {
    source: number;
    mode: 'ALL' | 'NEXT';
    loading: boolean;
    failed: boolean;
    saving: boolean;
    preview: CalendarCopyResult | null;
  } | null = null;
  private repeatRead = 0;
  /** The missed workouts the coach closed (« × »), kept in this browser: `programId:dayNumber`. */
  private dismissedMissed = new Set<string>(ClientProgramsComponent.readDismissedMissed());
  /** The menu of a day, fixed on the screen (the week scrolls sideways: a menu inside it would be cut). */
  dayMenu: { day: OverviewDay; top: number; left: number } | null = null;
  /**
   * A day's workout (or nutrition report) shown without leaving the page: planned / done, the client's notes.
   * {@code loading}: the program is being read; {@code edit}: « Modifier » opens the editor on that day.
   */
  preview: {
    loading: boolean;
    notice: string | null;
    workout: WorkoutActivity | null;
    nutrition: NutritionActivity | null;
    edit: ClientProgramAction | null;
  } | null = null;
  private shownProgramId: string | null = null;
  /** The coach account is read-only (subscription): nothing to change (SUB-30). */
  private readOnlyAccount = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(public schedule: ProgramScheduleService, private translate: TranslateService,
              private subscriptionState: CoachSubscriptionStateService, private toast: ToastService,
              private workoutService: WorkoutService, private nutritionService: NutritionService) {}

  ngOnInit(): void {
    this.subscriptionState.states$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => (this.readOnlyAccount = !!state?.readOnly));
    this.subscriptionState.getState().subscribe();
    this.schedule.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());
    this.destroyRef.onDestroy(() => {
      if (this.preview) this.lockScroll(false);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['clientId'] || changes['kind']) && this.clientId) {
      if (changes['clientId'] && !changes['clientId'].firstChange) { // another client
        this.overview = null;
        this.loading = true;
        this.shownWeek = null;
        this.pick = null;
        this.closePreview();
        this.listExpanded = false;
      }
      this.reload(false);
    }
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.openMenuId = null;
    this.dayMenu = null;
  }

  /** A fixed menu would stay where it was while the page moves. */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  closeDayMenu(): void {
    this.dayMenu = null;
  }

  @HostListener('document:keydown.escape')
  cancelPick(): void {
    if (this.repeat) {
      this.closeRepeat();
      return;
    }
    if (this.preview) {
      this.closePreview();
      return;
    }
    this.pick = null;
    this.closeMenus();
  }

  /** The menu of a day, under the element clicked (the card, or its ⋯). */
  openDayMenu(day: OverviewDay, event: Event): void {
    event.stopPropagation();
    this.openMenuId = null;
    if (this.dayMenu?.day.date === day.date) {
      this.dayMenu = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 240;
    // Under the card (or the ⋯), its right edge on theirs; always inside the screen.
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + 150 > window.innerHeight ? Math.max(8, rect.top - 156) : below;
    this.dayMenu = { day, top, left };
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
    const programId = overview.current?.program.id || null;
    if (programId !== this.shownProgramId) { // another program going on: back to its week
      this.shownProgramId = programId;
      this.shownWeek = null;
      this.pick = null;
    }
    const weeks = overview.current?.allWeeks?.length || 0;
    if (this.shownWeek && this.shownWeek > weeks) this.shownWeek = null;
    this.overview = overview;
    this.finished = overview.finished || [];
    this.loading = false;
    this.prefetchDayWindow(true);
    if (this.listTab === 'UPCOMING' && !overview.upcoming.length && overview.finishedCount) this.listTab = 'FINISHED';
    if (this.listTab === 'FINISHED' && !overview.finishedCount && overview.upcoming.length) this.listTab = 'UPCOMING';
  }

  /**
   * A click on a day opens its window at once (2026-11-23): the editor's code and the program going on are read ahead,
   * once the week is shown. {@code fresh}: the tab was read again (the program may have changed).
   */
  prefetchDayWindow(fresh = false): void {
    const program = this.overview?.current?.program;
    if (!program || program.file || !this.writable) return;
    const id = program.id;
    const read = () => (this.isWorkout ? this.workoutService.getWorkoutById(id, true) : this.nutritionService.getNutritionPlanById(id, true));
    prefetchDayWindowPlan<unknown>(id, read, fresh ? 5_000 : undefined);
    if (this.warmedEditor) return;
    this.warmedEditor = true;
    const warm = () => {
      if (this.isWorkout) {
        void import('app/components/program-library/create-workout/create-workout.component');
        return;
      }
      // The nutrition editor of this plan (the window opens the one of its kind).
      dayWindowPlan<unknown>(id, read).subscribe({
        next: (plan) => {
          const kind = nutritionPlanKind(plan);
          if (kind === 'DAY_MACROS') void import('app/components/nutrition/create-macro-plan-total-day/create-macro-plan-total-day.component');
          else if (kind === 'MEAL_MACROS') void import('app/components/nutrition/create-macro-plan/create-macro-plan.component');
          else void import('app/components/nutrition/create-full-plan/create-full-plan.component');
        },
        error: () => (this.warmedEditor = false),
      });
    };
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (win.requestIdleCallback) win.requestIdleCallback(warm, { timeout: 2000 });
    else setTimeout(warm, 500);
  }

  private warmedEditor = false;

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

  /** The upcoming / finished list shows a few programs; « Voir tout » the others. */
  readonly listLimit = 3;
  listExpanded = false;

  get listTotal(): number {
    if (!this.overview) return 0;
    return this.listTab === 'UPCOMING' ? this.overview.upcoming.length : Math.max(this.overview.finishedCount, this.finished.length);
  }

  get listRows(): OverviewItem[] {
    const rows = this.listTab === 'UPCOMING' ? this.overview?.upcoming || [] : this.finished;
    return this.listExpanded ? rows : rows.slice(0, this.listLimit);
  }

  setListTab(tab: 'UPCOMING' | 'FINISHED'): void {
    this.listTab = tab;
    this.listExpanded = false;
  }

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
    return o.alerts
      .filter(alert => !this.weekShowsEmptyDays(alert, o))
      .map(alert => this.alertView(alert, o)).filter((view): view is AlertView => !!view);
  }

  /** « N jours vides » starting in the week going on: the line under the week says it (and does it) already. */
  private weekShowsEmptyDays(alert: OverviewAlert, o: ProgramOverview): boolean {
    const c = o.current;
    if (alert.kind !== 'EMPTY_DAYS' || !c || c.program.file || alert.programId !== c.program.id || !alert.from) return false;
    return c.days.some(day => day.date === alert.from);
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

  /* ---------------- the week shown (arrows) ---------------- */

  /** The days of the week shown: the week going on, or the one the arrows chose. */
  get weekDays(): OverviewDay[] {
    const c = this.overview?.current;
    if (!c) return [];
    const weeks = c.allWeeks || [];
    return (this.shownWeek && weeks[this.shownWeek - 1]) || c.days;
  }

  /** The arrows: an older server sends only the week going on. */
  get canBrowseWeeks(): boolean {
    return (this.overview?.current?.allWeeks?.length || 0) > 1;
  }

  get shownWeekNumber(): number {
    return this.shownWeek || this.overview?.current?.week || 1;
  }

  get weekCount(): number {
    const c = this.overview?.current;
    return c?.allWeeks?.length || c?.weeks || 1;
  }

  get showingCurrentWeek(): boolean {
    return this.shownWeekNumber === (this.overview?.current?.week || 1);
  }

  /** "Semaine 3 sur 4 · 30 nov. – 6 déc." */
  get weekTitle(): string {
    const days = this.weekDays;
    const range = days.length ? `${this.dayMonth(days[0].date)} – ${this.dayMonth(days[days.length - 1].date)}` : '';
    return `${this.translate.instant('CLIENT_PROGRAMS.WEEK_OF', { week: this.shownWeekNumber, weeks: this.weekCount })} · ${range}`;
  }

  goToWeek(week: number, event?: Event): void {
    event?.stopPropagation();
    this.closeMenus();
    const target = Math.min(Math.max(1, week), this.weekCount);
    this.shownWeek = target === this.overview?.current?.week ? null : target;
  }

  /* ---------------- quick changes of a day (workout: move, copy, rest) ---------------- */

  /**
   * The days of the program the coach can change here without the editor. {@code allWeeks}: a server that knows the
   * quick changes (deployed first); an older one keeps the card as it was (a click opens the editor).
   */
  get quickEdit(): boolean {
    const c = this.overview?.current;
    // Workout and nutrition alike (the server moves, copies and frees nutrition days too, 2026-11-23).
    return this.writable && !!c && !c.program.file && !!c.allWeeks;
  }

  private isComing(day: OverviewDay): boolean {
    return !!day.date && day.date >= this.today;
  }

  /** A day not started by the client, today or later: it can move, receive a copy, rest. */
  canChange(day: OverviewDay): boolean {
    return this.quickEdit && this.isComing(day) && !!day.dayId && day.dayNumber > 0
      && day.state !== 'OUT' && day.state !== 'DONE' && day.state !== 'PARTIAL';
  }

  /** An empty day today or later: the « + » of the card. */
  isAddable(day: OverviewDay): boolean {
    return this.writable && day.state === 'EMPTY' && day.dayNumber > 0 && this.isComing(day);
  }

  /** A day with something in it (a workout or a rest): it can be copied. */
  private hasContent(day: OverviewDay): boolean {
    return day.dayNumber > 0 && day.state !== 'EMPTY' && day.state !== 'OUT';
  }

  /** The ⋯ of a day to come: planned, rest or empty (its click opens the day's window). */
  hasDayMenu(day: OverviewDay): boolean {
    return this.canChange(day);
  }

  /** The empty days the client will see as nothing, in the week shown (today or later). */
  get emptyComingDays(): OverviewDay[] {
    return this.weekDays.filter(day => this.isAddable(day));
  }

  /** While picking: can this day be chosen? */
  isPickTarget(day: OverviewDay): boolean {
    const pick = this.pick;
    if (!pick || day.date === pick.day.date) return false;
    switch (pick.mode) {
      case 'MOVE': return this.canChange(day);
      case 'COPY_TO': return this.canChange(day) && day.state === 'EMPTY';
      case 'COPY_FROM': return this.hasContent(day);
      default: return false;
    }
  }

  isPickSource(day: OverviewDay): boolean {
    return !!this.pick && this.pick.day.date === day.date;
  }

  get pickText(): string {
    const pick = this.pick;
    if (!pick) return '';
    const date = `${this.weekday(pick.day.date)} ${this.dayMonth(pick.day.date)}`;
    const name = pick.day.state === 'REST' ? this.translate.instant(`CLIENT_PROGRAMS.REST_TITLE_${this.isWorkout ? 'WORKOUT' : 'NUTRITION'}`) : this.dayHeadline(pick.day);
    const key = pick.mode === 'MOVE' ? 'PICK_MOVE' : pick.mode === 'COPY_TO' ? 'PICK_COPY_TO' : 'PICK_COPY_FROM';
    return this.translate.instant(`CLIENT_PROGRAMS.${key}`, { name, date });
  }

  startPick(mode: DayPick['mode'], day: OverviewDay, item: OverviewItem, event?: Event): void {
    event?.stopPropagation();
    this.closeMenus();
    this.pick = { mode, day, programId: item.id };
  }

  /** « Modifier » of the top: the editor opens on the week shown when the arrows moved. */
  editProgram(item: OverviewItem): void {
    const first = this.showingCurrentWeek ? null : this.weekDays.find(day => day.dayNumber > 0);
    this.emit({ type: 'edit', item, programId: item.id, dayNumber: first?.dayNumber });
  }

  /** « Mettre en repos » one empty day, or every empty day of the week shown. */
  restDays(days: OverviewDay[], item: OverviewItem, event?: Event): void {
    event?.stopPropagation();
    this.closeMenus();
    const numbers = days.filter(day => day.dayNumber > 0).map(day => day.dayNumber);
    if (!numbers.length || this.savingDay) return;
    this.savingDay = true;
    this.schedule.restDays(item.id, numbers).subscribe({
      next: result => {
        this.savingDay = false;
        if (!result.rested.length) {
          this.toast.error(this.isWorkout ? this.translate.instant('CLIENT_PROGRAMS.REST_NOTHING')
            : this.ht('No day became a free day: they are already planned, past or done.', "Aucun jour n'est devenu jour libre : ils sont déjà prévus, passés ou faits."));
          return;
        }
        const date = this.longDate(this.dateOfDay(item, result.rested[0]));
        const title = this.isWorkout
          ? (result.rested.length === 1
            ? this.translate.instant('CLIENT_PROGRAMS.RESTED_ONE', { date })
            : this.translate.instant('CLIENT_PROGRAMS.RESTED', { count: result.rested.length }))
          : (result.rested.length === 1
            ? this.ht(`${date} is a free day`, `Le ${date} est un jour libre`)
            : this.ht(`${result.rested.length} free days`, `${result.rested.length} jours mis en jour libre`));
        this.schedule.announceCalendarChange(result.undoId, title, this.skippedLines(result.skipped, item));
      },
      error: err => {
        this.savingDay = false;
        this.toast.error(this.changeError(err));
      },
    });
  }

  /* ---------------- missed workouts: tell the client, or do it another day ---------------- */

  trackByDate = (_: number, day: OverviewDay) => day.date;

  /** How far back a missed workout is shown (yesterday and the 2 days before). */
  static readonly MISSED_DAYS = 3;
  private static readonly MISSED_KEY = 'yc-missed-dismissed';

  private static readDismissedMissed(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(ClientProgramsComponent.MISSED_KEY) || '[]');
      return Array.isArray(value) ? value.map(String) : [];
    } catch {
      return [];
    }
  }

  private missedKey(day: OverviewDay): string {
    return `${this.overview?.current?.program.id || ''}:${day.dayNumber}`;
  }

  private isoMinus(days: number): string {
    const date = this.toDate(this.today);
    date.setDate(date.getDate() - days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** The workouts of the last 3 days the client did not do (not today: the day is not over), the latest first. */
  get missedDays(): OverviewDay[] {
    const c = this.overview?.current;
    if (!this.isWorkout || !this.writable || !c || c.program.file || this.pick) return [];
    const from = this.isoMinus(ClientProgramsComponent.MISSED_DAYS);
    const days = (c.allWeeks?.length ? c.allWeeks.flat() : c.days)
      .filter(day => day.state === 'MISSED' && day.dayNumber > 0 && day.date < this.today && day.date >= from)
      .filter(day => !this.dismissedMissed.has(this.missedKey(day)));
    return days.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  }

  /** The first empty day from today: where « Refaire » puts the missed workout in one click. */
  get nextEmptyDay(): OverviewDay | null {
    const c = this.overview?.current;
    if (!c || !this.quickEdit) return null;
    const days = c.allWeeks?.flat() || [];
    return days.find(day => day.state === 'EMPTY' && this.canChange(day)) || null;
  }

  /** « Lun. 22 nov. · Push A » (a workout without its own name: « Séance »). */
  missedLabel(day: OverviewDay): string {
    return `${this.weekday(day.date)} ${this.dayMonth(day.date)} · ${this.dayHeadline(day)}`;
  }

  /** « Refaire mer. 25 nov. » */
  redoLabel(target: OverviewDay): string {
    return this.ht(`Redo on ${this.weekday(target.date)} ${this.dayMonth(target.date)}`, `Refaire ${this.weekday(target.date)} ${this.dayMonth(target.date)}`);
  }

  /** The missed workout copied onto the first empty day to come (the missed day stays in the history), with « Annuler ». */
  redoMissed(day: OverviewDay, event?: Event): void {
    event?.stopPropagation();
    const item = this.overview?.current?.program;
    const target = this.nextEmptyDay;
    if (!item || !target || this.savingDay) return;
    this.savingDay = true;
    this.schedule.copyDays(item.id, [{ from: day.dayNumber, to: target.dayNumber }]).subscribe({
      next: result => {
        this.savingDay = false;
        if (!result.copied.length) {
          const line = this.skippedLines(result.skipped, item)[0];
          this.toast.error(line || this.translate.instant('CALENDAR_CHANGE_ERROR'));
          return;
        }
        this.schedule.announceCalendarChange(result.undoId,
          this.ht(`« ${this.dayHeadline(day)} » planned again on ${this.longDate(target.date)}`, `« ${this.dayHeadline(day)} » reprogrammée le ${this.longDate(target.date)}`),
          [this.ht('The missed day stays in the history.', 'Le jour manqué reste dans l’historique.')]);
      },
      error: err => {
        this.savingDay = false;
        this.toast.error(this.changeError(err));
      },
    });
  }

  /** « Autre jour »: the coach touches the empty day where the workout goes (the arrows show the other weeks). */
  pickForMissed(day: OverviewDay, event?: Event): void {
    const item = this.overview?.current?.program;
    if (item) this.startPick('COPY_TO', day, item, event);
  }

  /** The chat opens with a kind message ready, in the coach's language: the coach changes it or sends it. */
  messageForMissed(day: OverviewDay, event?: Event): void {
    event?.stopPropagation();
    const name = (this.clientName || '').trim().split(/\s+/)[0] || '';
    const weekday = this.toDate(day.date).toLocaleDateString(this.locale(), { weekday: 'long' });
    const title = day.title?.trim() && day.title.trim() !== 'Main Session' ? day.title.trim() : '';
    const draft = this.ht(
      `Hi${name ? ' ' + name : ''} 👋 I saw your ${title ? '« ' + title + ' » ' : ''}workout on ${weekday} wasn't done. Everything OK? We can move it to another day if you need.`,
      `Salut${name ? ' ' + name : ''} 👋 J’ai vu que ta séance ${title ? '« ' + title + ' » ' : ''}de ${weekday} n’a pas été faite. Tout va bien ? Si besoin, on la déplace à un autre jour.`,
    );
    this.emit({ type: 'message', draft });
  }

  /** « × »: the coach saw it; it does not come back for that day (in this browser). */
  dismissMissed(day: OverviewDay, event?: Event): void {
    event?.stopPropagation();
    this.dismissedMissed.add(this.missedKey(day));
    try {
      localStorage.setItem(ClientProgramsComponent.MISSED_KEY, JSON.stringify([...this.dismissedMissed].slice(-200)));
    } catch {
      // Private window: hidden until the page is reloaded.
    }
  }

  /* ---------------- « Répéter la semaine » ---------------- */

  private weekAt(number: number): OverviewDay[] {
    return this.overview?.current?.allWeeks?.[number - 1] || [];
  }

  /** A week with something in it and at least one week after it: it can be repeated. */
  canRepeat(week: number): boolean {
    return this.quickEdit && !this.pick && week >= 1 && week < this.weekCount && this.weekAt(week).some(day => this.hasContent(day));
  }

  /** The week shown is empty to come and the one before has something: « Copier la semaine N ici ». */
  get previousWeekToCopy(): number | null {
    const before = this.shownWeekNumber - 1;
    return this.emptyComingDays.length && this.canRepeat(before) ? before : null;
  }

  private repeatTargets(source: number, mode: 'ALL' | 'NEXT'): number[] {
    const last = mode === 'NEXT' ? source + 1 : this.weekCount;
    const weeks: number[] = [];
    for (let w = source + 1; w <= Math.min(last, this.weekCount); w++) weeks.push(w);
    return weeks;
  }

  /** Each day of the week copied onto the same weekday of the target weeks (the server keeps only the empty ones). */
  private repeatCopies(source: number, mode: 'ALL' | 'NEXT'): { from: number; to: number }[] {
    const from = this.weekAt(source);
    const copies: { from: number; to: number }[] = [];
    for (const week of this.repeatTargets(source, mode)) {
      const to = this.weekAt(week);
      from.forEach((day, i) => {
        const target = to[i];
        if (this.hasContent(day) && target && target.dayNumber > 0 && target.state !== 'OUT') {
          copies.push({ from: day.dayNumber, to: target.dayNumber });
        }
      });
    }
    return copies;
  }

  /** Opens the window: every next week by default (the case of a coach who filled week 1), the next one when last. */
  openRepeat(source: number, mode?: 'ALL' | 'NEXT', event?: Event): void {
    event?.stopPropagation();
    this.closeMenus();
    if (!this.canRepeat(source)) return;
    const only = source + 1 >= this.weekCount;
    this.repeat = { source, mode: only ? 'NEXT' : mode || 'ALL', loading: true, failed: false, saving: false, preview: null };
    this.readRepeatPreview();
  }

  setRepeatMode(mode: 'ALL' | 'NEXT'): void {
    if (!this.repeat || this.repeat.mode === mode || this.repeat.saving) return;
    this.repeat = { ...this.repeat, mode, loading: true, failed: false, preview: null };
    this.readRepeatPreview();
  }

  retryRepeat(): void {
    if (!this.repeat) return;
    this.repeat = { ...this.repeat, loading: true, failed: false, preview: null };
    this.readRepeatPreview();
  }

  closeRepeat(): void {
    if (this.repeat?.saving) return;
    this.repeat = null;
  }

  private readRepeatPreview(): void {
    const r = this.repeat;
    const item = this.overview?.current?.program;
    if (!r || !item) return;
    const read = ++this.repeatRead;
    const copies = this.repeatCopies(r.source, r.mode);
    if (!copies.length) {
      this.repeat = { ...r, loading: false, preview: { copied: [], skipped: [], undoId: null } };
      return;
    }
    this.schedule.copyDays(item.id, copies, true).subscribe({
      next: preview => {
        if (read !== this.repeatRead || !this.repeat) return;
        this.repeat = { ...this.repeat, loading: false, preview };
      },
      error: () => {
        if (read !== this.repeatRead || !this.repeat) return;
        this.repeat = { ...this.repeat, loading: false, failed: true };
      },
    });
  }

  get repeatSourceDays(): OverviewDay[] {
    return this.repeat ? this.weekAt(this.repeat.source) : [];
  }

  /** What a day of the week copied shows in the window: its workout, « Repos », or nothing. */
  repeatDayLabel(day: OverviewDay): string {
    if (day.state === 'OUT' || day.state === 'EMPTY') return '—';
    if (day.state === 'REST') return this.isWorkout ? this.ht('Rest', 'Repos') : this.ht('Free', 'Libre');
    return this.dayHeadline(day);
  }

  get repeatTitle(): string {
    const r = this.repeat;
    if (!r) return '';
    const only = r.source + 1 >= this.weekCount;
    return only
      ? this.ht(`Repeat week ${r.source} on week ${r.source + 1}`, `Répéter la semaine ${r.source} sur la semaine ${r.source + 1}`)
      : this.ht(`Repeat week ${r.source}`, `Répéter la semaine ${r.source}`);
  }

  /** « Semaine 2 · 30 nov. – 6 déc. » / « Semaines 2 à 4 ». */
  repeatChoiceDetail(mode: 'ALL' | 'NEXT'): string {
    const r = this.repeat;
    if (!r) return '';
    const weeks = this.repeatTargets(r.source, mode);
    if (weeks.length === 1) {
      const days = this.weekAt(weeks[0]);
      const range = days.length ? ` · ${this.dayMonth(days[0].date)} – ${this.dayMonth(days[days.length - 1].date)}` : '';
      return this.ht(`Week ${weeks[0]}`, `Semaine ${weeks[0]}`) + range;
    }
    return this.ht(`Weeks ${weeks[0]} to ${weeks[weeks.length - 1]}`, `Semaines ${weeks[0]} à ${weeks[weeks.length - 1]}`);
  }

  /** The preview, week by week: how many days each target week receives. */
  get repeatWeeks(): { week: number; count: number }[] {
    const r = this.repeat;
    if (!r?.preview) return [];
    return this.repeatTargets(r.source, r.mode).map(week => ({
      week,
      count: r.preview!.copied.filter(day => Math.ceil(day / 7) === week).length,
    }));
  }

  get repeatCount(): number {
    return this.repeat?.preview?.copied.length || 0;
  }

  /** « 3 jours déjà remplis ne changent pas. », « 2 jours passés ou faits ne changent pas. » */
  get repeatKept(): string[] {
    const skipped = this.repeat?.preview?.skipped || [];
    const taken = skipped.filter(s => s.reason === 'TAKEN').length;
    const locked = skipped.filter(s => s.reason === 'PAST' || s.reason === 'DONE').length;
    const lines: string[] = [];
    if (taken) lines.push(taken === 1
      ? this.ht('1 day already filled stays as it is.', '1 jour déjà rempli reste comme il est.')
      : this.ht(`${taken} days already filled stay as they are.`, `${taken} jours déjà remplis restent comme ils sont.`));
    if (locked) lines.push(locked === 1
      ? this.ht('1 day past or done stays as it is.', '1 jour passé ou fait reste comme il est.')
      : this.ht(`${locked} days past or done stay as they are.`, `${locked} jours passés ou faits restent comme ils sont.`));
    return lines;
  }

  get repeatButton(): string {
    const n = this.repeatCount;
    if (!n) return this.ht('Repeat', 'Répéter');
    return n === 1 ? this.ht('Fill 1 day', 'Remplir 1 jour') : this.ht(`Fill ${n} days`, `Remplir ${n} jours`);
  }

  /** Saved at once, with « Annuler » for 15 s; the week shown stays where it is. */
  confirmRepeat(): void {
    const r = this.repeat;
    const item = this.overview?.current?.program;
    if (!r || !item || r.loading || r.saving || !this.repeatCount) return;
    const copies = this.repeatCopies(r.source, r.mode);
    this.repeat = { ...r, saving: true };
    this.schedule.copyDays(item.id, copies).subscribe({
      next: result => {
        this.repeat = null;
        const n = result.copied.length;
        if (!n) {
          this.toast.error(this.ht('Nothing was filled: those days are no longer empty.', "Rien n'a été rempli : ces jours ne sont plus vides."));
          return;
        }
        const weeks = this.repeatTargets(r.source, r.mode);
        const days = n === 1 ? this.ht('1 day filled', '1 jour rempli') : this.ht(`${n} days filled`, `${n} jours remplis`);
        const title = weeks.length === 1
          ? this.ht(`Week ${r.source} repeated on week ${weeks[0]}`, `Semaine ${r.source} répétée sur la semaine ${weeks[0]}`)
          : this.ht(`Week ${r.source} repeated on weeks ${weeks[0]} to ${weeks[weeks.length - 1]}`,
            `Semaine ${r.source} répétée sur les semaines ${weeks[0]} à ${weeks[weeks.length - 1]}`);
        this.schedule.announceCalendarChange(result.undoId, title, [days]);
      },
      error: err => {
        this.repeat = this.repeat ? { ...this.repeat, saving: false } : null;
        this.toast.error(this.changeError(err));
      },
    });
  }

  /** The day chosen while picking: the move or the copy is saved at once (with « Annuler »). */
  private finishPick(target: OverviewDay): void {
    const pick = this.pick;
    const item = this.overview?.current?.program;
    if (!pick || !item || this.savingDay) return;
    this.pick = null;
    this.savingDay = true;
    const fail = (err: unknown) => {
      this.savingDay = false;
      this.toast.error(this.changeError(err));
    };
    if (pick.mode === 'MOVE') {
      if (!pick.day.dayId || !target.dayId) {
        this.savingDay = false;
        return;
      }
      this.schedule.swapDays(pick.programId, pick.day.dayId, target.dayId).subscribe({
        next: result => {
          this.savingDay = false;
          const title = target.state === 'EMPTY'
            ? this.translate.instant('CALENDAR_DAY_MOVED', { date: this.longDate(target.date) })
            : this.translate.instant('CALENDAR_DAYS_SWAPPED', { first: this.longDate(pick.day.date), second: this.longDate(target.date) });
          const details = result.restedDayId ? [this.translate.instant('CALENDAR_LEFT_REST', { date: this.longDate(pick.day.date) })] : [];
          this.schedule.announceCalendarChange(result.undoId, title, details);
        },
        error: fail,
      });
      return;
    }
    const copy = pick.mode === 'COPY_TO'
      ? { from: pick.day.dayNumber, to: target.dayNumber }
      : { from: target.dayNumber, to: pick.day.dayNumber };
    this.schedule.copyDays(pick.programId, [copy]).subscribe({
      next: result => {
        this.savingDay = false;
        if (!result.copied.length) {
          const line = this.skippedLines(result.skipped, item)[0];
          this.toast.error(line || this.translate.instant('CALENDAR_CHANGE_ERROR'));
          return;
        }
        this.schedule.announceCalendarChange(result.undoId,
          this.translate.instant('CLIENT_PROGRAMS.COPIED_TO', { date: this.longDate(this.dateOfDay(item, copy.to)) }));
      },
      error: fail,
    });
  }

  private skippedLines(skipped: { day: number; reason: string }[], item: OverviewItem): string[] {
    return skipped
      .filter(skip => skip.reason !== 'EMPTY_SOURCE')
      .map(skip => this.translate.instant(`CALENDAR_COPY_SKIPPED_${skip.reason}`, { date: this.longDate(this.dateOfDay(item, skip.day)) }));
  }

  /** Why the server refused a change of a day (the calendar's words). */
  private changeError(err: unknown): string {
    const code = (err as { error?: { code?: string } })?.error?.code;
    if (code === 'PROGRAM_LOCKED') return this.translate.instant('ASSIGN_FLOW.LOCKED_ERROR');
    if (code === 'DAY_DONE') return this.translate.instant('CALENDAR_DAY_DONE');
    if (code === 'DAY_PAST') return this.translate.instant('CALENDAR_DAY_PAST_MOVE');
    if (code === 'PROGRAM_GAP') return this.translate.instant('CALENDAR_CHANGE_GAP');
    return this.translate.instant('CALENDAR_CHANGE_ERROR');
  }

  /** The date of day {@code dayNumber} of the program (yyyy-MM-dd). */
  private dateOfDay(item: OverviewItem, dayNumber: number): string {
    const date = this.toDate(item.startDate || this.today);
    date.setDate(date.getDate() + dayNumber - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** "mercredi 25 novembre". */
  private longDate(iso: string): string {
    return this.toDate(iso).toLocaleDateString(this.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
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
    if (day.state === 'EMPTY') return this.isAddable(day) ? t('DAY_ADD') : t('STATUS_EMPTY');
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
    this.closeMenus();
    this.action.emit(action);
  }

  onDay(day: OverviewDay, item: OverviewItem, event: Event): void {
    if (this.pick) {
      event.stopPropagation();
      if (this.isPickTarget(day)) this.finishPick(day);
      return;
    }
    if (day.state === 'OUT') return;
    // A day to come (empty, planned or rest / free): its window opens at once, as in the editor's calendar; the ⋯
    // keeps the quick actions (copy here, rest, move, copy to).
    if (this.isOpenable(day)) {
      this.emit({ type: 'edit', item, programId: item.id, dayNumber: day.dayNumber, open: true }, event);
      return;
    }
    // An empty day to come: what to put in it (create, copy another day, rest).
    if (this.quickEdit && this.isAddable(day)) {
      this.openDayMenu(day, event);
      return;
    }
    // A workout (a nutrition day logged): shown here, planned / done, without leaving the page.
    if (this.canPreview(day)) {
      event.stopPropagation();
      this.openPreview(day, item);
      return;
    }
    if (day.date < this.today) this.emit({ type: 'calendar', date: day.date, item, programId: item.id }, event);
    else if (this.writable) this.emit({ type: 'edit', item, programId: item.id, dayNumber: day.dayNumber }, event);
  }

  /* ---------------- a day shown without leaving the page ---------------- */

  private previewRead = 0;

  /** A workout day (any), a nutrition day until today (the report shows what was logged, nothing ahead). */
  canPreview(day: OverviewDay): boolean {
    if (!this.hasContent(day) || day.state === 'REST') return false;
    return this.isWorkout || day.date <= this.today;
  }

  /** The day's window: the program is read (the tab has no exercise), then the day found in it. */
  openPreview(day: OverviewDay, item: OverviewItem): void {
    this.closeMenus();
    const editable = this.writable && this.isComing(day) && day.state !== 'DONE' && day.state !== 'PARTIAL';
    const edit: ClientProgramAction = { type: 'edit', item, programId: item.id, dayNumber: day.dayNumber };
    this.preview = { loading: true, notice: null, workout: null, nutrition: null, edit: editable ? edit : null };
    this.lockScroll(true);
    const read = ++this.previewRead;
    const week = Math.ceil(day.dayNumber / 7);
    const inWeek = ((day.dayNumber - 1) % 7) + 1;
    const find = <T extends { id: string; week: number; dayInWeek: number }>(items: T[]): T | null =>
      items.find(a => !!day.dayId && a.id === day.dayId) || items.find(a => a.week === week && a.dayInWeek === inWeek) || null;
    const plan$ = this.isWorkout ? this.workoutService.getWorkoutById(item.id, true) : this.nutritionService.getNutritionPlanById(item.id, true);
    plan$.subscribe({
      next: plan => {
        if (read !== this.previewRead || !this.preview) return; // closed, or another day asked meanwhile
        const workout = this.isWorkout ? find(buildWorkoutActivities([plan])) : null;
        const nutrition = this.isWorkout ? null : find(buildNutritionActivities([plan]));
        if (!workout && !nutrition) {
          // Nothing to show here (a day the builders skip): where the click went before.
          this.closePreview();
          if (day.date < this.today) this.emit({ type: 'calendar', date: day.date, item, programId: item.id });
          else if (this.writable) this.emit(edit);
          return;
        }
        this.preview = { ...this.preview, loading: false, workout, nutrition };
      },
      error: () => {
        if (read !== this.previewRead || !this.preview) return;
        this.preview = { ...this.preview, loading: false, notice: 'CLIENT_PROGRAMS.DAY_PREVIEW_FAILED' };
      },
    });
  }

  closePreview(): void {
    if (!this.preview) return;
    this.preview = null;
    this.previewRead++;
    this.lockScroll(false);
  }

  editPreviewDay(): void {
    const edit = this.preview?.edit;
    this.closePreview();
    if (edit) this.emit(edit);
  }

  /** « Envoyer un message »: the profile opens its chat. */
  messageFromPreview(): void {
    this.closePreview();
    this.emit({ type: 'message' });
  }

  /** While the window is open, the page behind does not scroll. */
  private lockScroll(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  /**
   * A click opens the day's window in the editor, as in its calendar: every workout day of the program (a past one shows
   * what the client did, exercise by exercise); a nutrition day to come not started (a past one: its report here).
   */
  isOpenable(day: OverviewDay): boolean {
    if (!this.writable || day.dayNumber <= 0 || day.state === 'OUT') return false;
    if (this.isWorkout) return true;
    return this.isComing(day) && day.state !== 'DONE' && day.state !== 'PARTIAL';
  }

  // ---------- The week shown, drawn by the calendar's own component (shared/program-calendar) ----------

  /** The columns: the weekdays of the week shown. */
  get calendarColumns(): string[] {
    return this.weekDays.map((day) => this.toDate(day.date).toLocaleDateString(this.locale(), { weekday: 'long' }));
  }

  get calendarTodayColumn(): number {
    return this.weekDays.findIndex((day) => day.date === this.today);
  }

  /** The week shown as one row of the calendar: the same cards, the same symbols, the same gestures. */
  get calendarWeek(): CalendarWeek<OverviewDay>[] {
    const kind = this.isWorkout ? 'WORKOUT' : 'NUTRITION';
    const t = (key: string) => this.translate.instant(`CLIENT_PROGRAMS.${key}`);
    const cells: CalendarCell<OverviewDay>[] = this.weekDays.map((day, index) => {
      const tone = this.calendarTone(day);
      const empty = tone === 'empty';
      const movable = this.canChange(day);
      const lines = empty || tone === 'rest' ? [] : this.dayLines(day);
      return {
        day,
        index,
        tone,
        title: tone === 'rest' ? t(`REST_TITLE_${kind}`) : empty ? t('STATUS_EMPTY') : this.dayHeadline(day),
        // The exercises say it: the count only for an older server (no list).
        meta: empty || tone === 'rest' || lines.length ? '' : this.dayMeta(day),
        status: empty || day.state === 'OUT' ? '' : tone === 'rest' ? t(`STATUS_REST_${kind}`) : this.dayStatus(day),
        icon: calendarIcon(tone),
        date: this.dayMonth(day.date),
        today: day.date === this.today,
        past: day.date < this.today,
        locked: !movable,
        movable,
        rest: tone === 'rest',
        hasContent: !empty,
        lines,
        out: day.state === 'OUT',
        note: day.note || null,
        pick: this.pick ? (this.isPickSource(day) ? 'source' : this.isPickTarget(day) ? 'target' : 'dim') : null,
      };
    });
    return [{ number: 1, title: '', range: '', filled: 0, days: this.weekDays, pad: [], cells, current: false, progress: 0, progressText: '' }];
  }

  /** At most this many exercises on a card, then « +N autres » (a long workout would make the whole week tall). */
  static readonly CARD_EXERCISES = 3;

  /**
   * A workout day's exercises on its card, as in the editor's calendar: « A », « B1 / B2 » for a superset, the sets
   * (« 4 × 8 », « 3 × 30 s »), the first ones only and « +2 autres ».
   */
  dayLines(day: OverviewDay): CalendarLine[] {
    const list = this.isWorkout ? day.exercises || [] : [];
    if (!list.length) return [];
    const fake = { workoutSessions: [{ exercises: list.map((ex) => ({ name: ex.name, supersetGroupId: ex.groupId, groupType: ex.groupType })) }] };
    const max = ClientProgramsComponent.CARD_EXERCISES;
    // One more than the limit is shown rather than « +1 autre ».
    const shown = list.length <= max + 1 ? list.length : max;
    const lines: CalendarLine[] = exerciseLines(fake).slice(0, shown).map((line, i) => ({
      label: line.label,
      name: line.name || this.ht('Exercise', 'Exercice'),
      detail: this.exerciseDetail(list[i]),
      link: line.link,
      groupKind: line.groupKind,
    }));
    const last = lines[lines.length - 1];
    // A superset cut by the limit: its line stops on the last exercise shown.
    if (shown < list.length && last && (last.link === 'start' || last.link === 'middle')) last.link = last.link === 'start' ? null : 'end';
    if (shown < list.length) {
      const more = list.length - shown;
      lines.push({ label: '', name: '', detail: this.ht(`+${more} more`, `+${more} autre${more > 1 ? 's' : ''}`) });
    }
    return lines;
  }

  /** « 4 × 8 », « 3 × 8–12 », « 3 × 30 s », « 20 min ». */
  private exerciseDetail(ex: OverviewExercise): string {
    const unit = ex.unit === 'MINUTES' ? ' min' : ex.unit === 'SECONDS' ? ' s' : '';
    const value = ex.value ? `${ex.value}${unit}` : '';
    if (ex.sets > 1 || (ex.sets === 1 && ex.unit !== 'MINUTES')) return `${ex.sets} × ${value || '—'}`;
    return value;
  }

  private calendarTone(day: OverviewDay): CalendarTone {
    switch (day.state) {
      case 'DONE': return 'done';
      case 'MISSED': return 'missed';
      case 'PARTIAL': return 'partial';
      case 'REST': return 'rest';
      case 'EMPTY': return 'empty';
      default: return day.date === this.today ? 'today' : 'planned';
    }
  }

  ht(en: string, fr: string): string {
    return this.translate.currentLang === 'en' ? en : fr;
  }

  /** « Mettre en repos » (workout) / « Mettre en jour libre » (nutrition: the free day is its rest day). */
  get restOneLabel(): string {
    return this.isWorkout ? this.translate.instant('CLIENT_PROGRAMS.DAY_SET_REST') : this.ht('Make it a free day', 'Mettre en jour libre');
  }

  get restAllLabel(): string {
    return this.isWorkout ? this.translate.instant('CLIENT_PROGRAMS.REST_ALL') : this.ht('All free days', 'Tout mettre en jour libre');
  }

  /** The ⋮ of a card here: the quick changes saved at once (with « Annuler »). */
  readonly calendarMenu = (cell: CalendarCell<OverviewDay>): CalendarMenuItem[] => {
    const t = (key: string) => this.translate.instant(`CLIENT_PROGRAMS.${key}`);
    if (cell.day.state === 'EMPTY') {
      return [
        { type: 'edit', label: this.isWorkout ? t('DAY_CREATE') : this.ht('Fill the day', 'Remplir le jour'), icon: 'edit-2' },
        { type: 'copyHere', label: t('DAY_COPY_HERE'), icon: 'copy' },
        { type: 'rest', label: this.restOneLabel, icon: this.isWorkout ? 'moon' : 'flag', disabled: this.savingDay },
      ];
    }
    return [
      { type: 'edit', label: this.isWorkout ? t('DAY_EDIT') : this.ht('Edit the day', 'Modifier le jour'), icon: 'edit-2' },
      { type: 'move', label: t('DAY_MOVE'), icon: 'move' },
      { type: 'copyTo', label: t('DAY_COPY_TO'), icon: 'copy' },
    ];
  };

  onCalendarOpen(day: OverviewDay, item: OverviewItem): void {
    this.onDay(day, item, new Event('click'));
  }

  onCalendarAction(event: { type: string; day: OverviewDay }, item: OverviewItem): void {
    switch (event.type) {
      case 'edit': this.editDay(event.day, item); break;
      case 'move': this.startPick('MOVE', event.day, item); break;
      case 'copyTo': this.startPick('COPY_TO', event.day, item); break;
      case 'copyHere': this.startPick('COPY_FROM', event.day, item); break;
      case 'rest': this.restDays([event.day], item); break;
    }
  }

  /** A card dropped on another day: the two days swap, saved at once (with « Annuler »). */
  onCalendarSwap(event: { from: OverviewDay; to: OverviewDay }, item: OverviewItem): void {
    this.pick = { mode: 'MOVE', day: event.from, programId: item.id };
    this.finishPick(event.to);
  }

  editDay(day: OverviewDay, item: OverviewItem, event?: Event): void {
    this.emit({ type: 'edit', item, programId: item.id, dayNumber: day.dayNumber, open: this.isOpenable(day) }, event);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.dayMenu = null;
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
