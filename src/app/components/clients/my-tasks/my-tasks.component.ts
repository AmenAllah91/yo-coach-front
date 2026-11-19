import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { ChatService } from 'app/service/chat.service';
import { ClientTasksService, TaskCalendarItem } from 'app/service/client-tasks.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { ClientTaskRowComponent } from '../shared/client-task-row.component';
import { WeekMark, WeekStripComponent, addDays, mondayOf } from '../shared/week-strip.component';
import { HistoryTimelineComponent } from '../shared/history-timeline.component';
import { capitalizeFirst, capitalizeSentences, dateKey, titleCase } from '../shared/client-plan-utils';
import { isHabit, isTaskDone, openClientTask, taskColors, taskIcon, taskTypeLabel } from '../shared/client-task-utils';

interface TaskDay { key: string; date: Date; isToday: boolean; selected: boolean; done: number; items: TaskCalendarItem[]; }

/** Tasks of each client and week seen in this session: a revisit shows them at once. */
const TASKS_SNAPSHOT = new Map<string, TaskCalendarItem[]>();
const COACH_NAMES = new Map<string, string>();
/** The server gives at most 63 days per call: the history asks for a few of these slices at once (about 6 months). */
const HISTORY_SLICE_DAYS = 63;
const HISTORY_SLICES = 3;

/**
 * Client Tasks, laid out like the client Workouts page: week strip (Monday to Sunday), the picked day in full,
 * then the other days of the week. Habit check circles, and the detail of a general task with "Mark as done".
 * Also shown read only in the coach "client view" (previewMode).
 */
@Component({
  selector: 'app-my-tasks', standalone: true,
  imports: [CommonModule, FeatherModule, ClientTaskRowComponent, WeekStripComponent, HistoryTimelineComponent],
  templateUrl: './my-tasks.component.html', styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit, OnDestroy {
  /** Coach "client view" preview: the tasks of this client, read only (nothing opens outside the preview). */
  @Input() previewClientId = '';
  @Input() previewMode = false;
  @Input() previewCoachName = '';
  items: TaskCalendarItem[] = [];
  weekStart = mondayOf(new Date());
  selectedDate = this.todayDate();
  selected: TaskCalendarItem | null = null;
  coachName = '';
  loading = false;
  error = '';
  saving = false;
  toast = '';
  toggling = new Set<string>();
  /** 'history': past days on a timeline, under the week strip (same as Workouts and Nutrition). */
  view: 'list' | 'history' = 'list';
  historyItems: TaskCalendarItem[] = [];
  historyLoading = false;
  historyError = '';
  historyFirst: Date = this.todayDate();
  /** Day the client last opened from the history: the timeline comes back on it. */
  historyDay: Date | null = null;
  private historyRequest?: Subscription;
  private clientId = '';
  private pendingItemId = '';
  private pendingDate = '';
  private pendingType = '';
  private destroyed = false;
  private subscriptions = new Subscription();
  private request?: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(private api: ClientTasksService, private auth: AuthService,
              private route: ActivatedRoute, private router: Router,
              private translate: TranslateService, private chat: ChatService, private theme: ClientThemeService) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  get displayCoachName(): string { return this.coachName ? titleCase(this.coachName) : (this.fr ? 'Votre coach' : 'Your Coach'); }
  /** Monday to Sunday of the week shown, each with its tasks. */
  get days(): TaskDay[] {
    const today = dateKey(new Date());
    const selected = dateKey(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(this.weekStart, index);
      const key = dateKey(date);
      const items = this.items.filter(item => item.date === key);
      return { key, date, items, isToday: key === today, selected: key === selected, done: items.filter(item => isTaskDone(item)).length };
    });
  }

  /** The day shown in full under the strip (today at first, or the day picked in the strip). */
  focusDay(days: TaskDay[]): TaskDay { return days.find(day => day.selected) ?? days.find(day => day.isToday) ?? days[0]; }
  /** The other days of the week that have tasks. */
  otherDays(days: TaskDay[]): TaskDay[] { return days.filter(day => !day.selected && day.items.length); }
  weekIsEmpty(days: TaskDay[]): boolean { return days.every(day => !day.items.length); }

  /** Mark under each day of the strip: ✓ all done, ✗ a past day with something left, a dot when tasks are planned. */
  get weekMarks(): Record<string, WeekMark> {
    const today = dateKey(new Date());
    const marks: Record<string, WeekMark> = {};
    for (const day of this.days) {
      if (!day.items.length) continue;
      marks[day.key] = day.done === day.items.length ? 'done' : day.key < today ? 'missed' : 'planned';
    }
    return marks;
  }

  /** « Today · Tue, Nov 17 » / « Aujourd’hui · mar. 17 nov. », or the date alone for another day. */
  focusLabel(day: TaskDay): string {
    const date = new Intl.DateTimeFormat(this.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(day.date);
    return day.isToday ? `${this.fr ? 'Aujourd’hui' : 'Today'} · ${date}` : capitalizeFirst(date);
  }

  /** « 3 tasks » for a short line, then the titles. */
  dayTitle(day: TaskDay): string {
    const n = day.items.length;
    return this.fr ? `${n} tâche${n > 1 ? 's' : ''}` : `${n} task${n > 1 ? 's' : ''}`;
  }
  dayMeta(day: TaskDay): string { return day.items.map(item => capitalizeFirst(item.title)).join(' · '); }
  /** « 2/3 done » chip: green when all done, red for a past day with something left. */
  dayChip(day: TaskDay): { label: string; color: string; icon?: string } {
    const all = day.done === day.items.length;
    const late = !all && day.key < dateKey(new Date());
    return {
      label: `${day.done}/${day.items.length} ${this.fr ? 'faites' : 'done'}`,
      color: all ? '#1E8E4E' : late ? 'var(--yc-error)' : 'var(--yc-text-secondary)',
      icon: all ? 'check' : undefined,
    };
  }
  weekdayLabel(date: Date): string { return new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(date).toUpperCase(); }

  dayLabel(day: TaskDay): string {
    return capitalizeFirst(new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(day.date));
  }

  shiftWeek(delta: number): void { this.showWeekOf(addDays(this.weekStart, delta * 7), false); }
  goToday(): void { this.showWeekOf(this.todayDate()); }

  selectDate(date: Date): void {
    this.selectedDate = date;
    setTimeout(() => document.querySelector(`.client-tasks [data-day="${dateKey(date)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  }

  // -------------------------------------------------------------------------
  // History: about 6 months of past days, on the timeline of Workouts and Nutrition
  // -------------------------------------------------------------------------
  openHistory(): void {
    this.view = 'history';
    this.historyDay = null;
    window.scrollTo({ top: 0 });
    this.loadHistory();
  }

  closeHistory(): void { this.view = 'list'; window.scrollTo({ top: 0 }); }

  loadHistory(): void {
    if (!this.clientId) return;
    this.historyRequest?.unsubscribe();
    this.historyError = '';
    this.historyLoading = !this.historyItems.length;
    const today = this.todayDate();
    const slices = Array.from({ length: HISTORY_SLICES }, (_, index) => {
      const to = addDays(today, -index * HISTORY_SLICE_DAYS);
      const from = addDays(to, -(HISTORY_SLICE_DAYS - 1));
      return this.api.calendar(this.clientId, dateKey(from), dateKey(to), true).pipe(
        map(response => response.items || []),
        // An older slice that fails only shortens the history; the recent one is required.
        catchError(error => index === 0 ? throwError(() => error) : of([] as TaskCalendarItem[])),
      );
    });
    this.historyFirst = addDays(today, -(HISTORY_SLICES * HISTORY_SLICE_DAYS - 1));
    this.historyRequest = forkJoin(slices).subscribe({
      next: lists => { this.historyItems = lists.flat(); this.historyLoading = false; },
      error: () => { this.historyLoading = false; this.historyError = this.fr ? 'Impossible de charger l’historique.' : 'Unable to load the history.'; },
    });
  }

  /** Past days and today, by day ("2026-11-16"). */
  get historyByDay(): Record<string, TaskCalendarItem[]> {
    const today = dateKey(new Date());
    const byDay: Record<string, TaskCalendarItem[]> = {};
    for (const item of this.historyItems) if (item.date <= today) (byDay[item.date] ||= []).push(item);
    return byDay;
  }

  /** The history starts at the oldest day that has a task (never before the loaded range). */
  historyFirstDay(byDay: Record<string, TaskCalendarItem[]>): Date {
    const first = Object.keys(byDay).sort()[0];
    if (!first) return this.todayDate();
    const date = new Date(first + 'T12:00:00');
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return day < this.historyFirst ? this.historyFirst : day;
  }

  /** Same marks as the week strip: ✓ all done, ✗ something left on a past day. */
  historyMarks(byDay: Record<string, TaskCalendarItem[]>): Record<string, WeekMark> {
    const today = dateKey(new Date());
    const marks: Record<string, WeekMark> = {};
    for (const [key, items] of Object.entries(byDay)) {
      const done = items.filter(item => isTaskDone(item)).length;
      marks[key] = done === items.length ? 'done' : key < today ? 'missed' : 'planned';
    }
    return marks;
  }

  historyDone(items: TaskCalendarItem[]): number { return items.filter(item => isTaskDone(item)).length; }

  openFromHistory(item: TaskCalendarItem): void {
    this.historyDay = new Date(item.date + 'T12:00:00');
    this.open(item);
  }

  /** Shows the week of `date`. The day opened in it: `date` itself, or today / the first day with tasks when browsing. */
  private showWeekOf(date: Date, select = true): void {
    const monday = mondayOf(date);
    const changed = monday.getTime() !== this.weekStart.getTime();
    this.weekStart = monday;
    this.selected = null; this.pendingItemId = '';
    if (select) this.selectedDate = date;
    if (changed) this.load();
    if (!select) {
      const days = this.days;
      this.selectedDate = (days.find(day => day.isToday) ?? days.find(day => day.items.length) ?? days[0]).date;
    }
  }

  private todayDate(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }

  async ngOnInit(): Promise<void> {
    this.theme.ensureLoaded();
    if (this.previewMode) {
      this.clientId = this.previewClientId;
      this.coachName = this.previewCoachName;
      if (this.clientId) this.load();
      return;
    }
    this.clientId = await this.auth.getId() || '';
    if (this.destroyed) return;
    if (!this.clientId) { this.error = this.fr ? 'Client introuvable.' : 'Client not found.'; return; }
    // The coach name only needs the conversations once per session.
    const knownCoach = COACH_NAMES.get(this.clientId);
    if (knownCoach !== undefined) this.coachName = knownCoach;
    else this.subscriptions.add(this.chat.getConversations(0, 10).subscribe({
      next: page => { this.coachName = (page.content.find(conv => !conv.isGroup) || page.content[0])?.name?.trim() || ''; COACH_NAMES.set(this.clientId, this.coachName); }, error: () => {},
    }));
    this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
      const date = params.get('date');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parsed = new Date(date + 'T12:00:00');
        if (!Number.isNaN(parsed.getTime())) {
          this.weekStart = mondayOf(parsed);
          this.selectedDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
      }
      this.pendingItemId = params.get('itemId') || '';
      this.pendingDate = date || '';
      this.pendingType = params.get('itemType') || '';
      this.selected = null;
      this.load();
    }));
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.subscriptions.unsubscribe(); this.request?.unsubscribe(); this.historyRequest?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  load(): void {
    this.request?.unsubscribe(); this.error = '';
    const last = addDays(this.weekStart, 6);
    // Week seen before in this session: shown at once, the fresh answer replaces it.
    const key = this.snapshotKey;
    const known = TASKS_SNAPSHOT.get(key);
    if (known) this.items = known;
    this.loading = !known;
    this.request = this.api.calendar(this.clientId, dateKey(this.weekStart), dateKey(last), true).subscribe({
      next: response => {
        if (key !== this.snapshotKey) return; // an older week answered late
        this.items = response.items; this.loading = false;
        TASKS_SNAPSHOT.set(key, response.items);
        const target = this.pendingItemId ? this.items.find(item => item.id === this.pendingItemId
          && (!this.pendingDate || item.date === this.pendingDate)
          && (!this.pendingType || item.itemType === this.pendingType)) : null;
        this.pendingItemId = '';
        if (target) this.openDetailOrTask(target);
      },
      error: () => { if (key !== this.snapshotKey) return; this.loading = false; this.error = this.fr ? 'Impossible de charger les tâches.' : 'Unable to load tasks.'; },
    });
  }

  /** Habits can be ticked up to today, never in the future (mobile _canToggle). */
  canToggle(task: TaskCalendarItem): boolean {
    return !this.previewMode && isHabit(task) && task.date <= dateKey(new Date());
  }

  /** Optimistic: flipped at once, persisted in the background, rolled back on failure. */
  toggleHabit(habit: TaskCalendarItem): void {
    if (this.toggling.has(habit.occurrenceId)) return;
    this.toggling.add(habit.occurrenceId);
    const previous = this.items;
    const previousHistory = this.historyItems;
    const done = isTaskDone(habit);
    const flip = (list: TaskCalendarItem[]): TaskCalendarItem[] => list.map((item): TaskCalendarItem => item.occurrenceId === habit.occurrenceId
      ? { ...item, status: done ? 'UPCOMING' : 'DONE', completedValue: done ? undefined : item.goalValue } : item);
    this.items = flip(this.items);
    this.historyItems = flip(this.historyItems);
    this.subscriptions.add(this.api.setHabitCompletion(habit.id, habit.date, !done, done ? undefined : habit.goalValue).subscribe({
      next: () => { this.toggling.delete(habit.occurrenceId); this.rememberWeek(); },
      error: () => {
        this.toggling.delete(habit.occurrenceId);
        this.items = previous;
        this.historyItems = previousHistory;
        this.showToast(this.fr ? "Impossible de mettre à jour l'habitude." : 'Could not update the habit.');
      },
    }));
  }

  open(item: TaskCalendarItem): void {
    if (this.previewMode) { this.selected = item; return; } // the preview never leaves the client view
    this.openDetailOrTask(item);
  }

  /** Mobile openClientTask: forms, photos and measurements open their page, the other tasks their detail. */
  private openDetailOrTask(item: TaskCalendarItem): void {
    if (this.previewMode) { this.selected = item; return; }
    const ownPage = (item.taskType === 'FORM' && !!item.formAssignmentId?.trim())
      || item.taskType === 'CLIENT_PROGRESS' || item.taskType === 'BODY_METRICS';
    if (ownPage) { void openClientTask(this.router, item); return; }
    this.selected = item;
    this.error = '';
  }

  closeDetail(): void { this.selected = null; this.error = ''; this.saving = false; }

  // Detail (mobile ClientTaskDetailScreen)
  title(item: TaskCalendarItem): string { return capitalizeFirst(item.title); }
  detailSubtitle(item: TaskCalendarItem): string {
    return [taskTypeLabel(item, this.fr), this.dueLabel(item)].filter(Boolean).join(' · ');
  }
  instructions(item: TaskCalendarItem): string {
    return item.instructions?.trim() ? capitalizeSentences(item.instructions)
      : (this.fr ? 'Aucune instruction supplémentaire.' : 'No additional instructions.');
  }
  icon(item: TaskCalendarItem): string { return taskIcon(item); }
  colors(item: TaskCalendarItem): [string, string] { return taskColors(item); }
  isDone(item: TaskCalendarItem): boolean { return isTaskDone(item); }
  canComplete(item: TaskCalendarItem): boolean {
    return !this.previewMode && !isHabit(item) && (!item.taskType || item.taskType === 'GENERAL');
  }

  dueLabel(item: TaskCalendarItem): string {
    return item.date === dateKey(new Date()) ? (this.fr ? 'Aujourd’hui' : 'Due today')
      : new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(item.date + 'T12:00:00'));
  }

  markAsDone(item: TaskCalendarItem): void {
    if (this.saving || this.isDone(item)) return;
    this.saving = true;
    this.subscriptions.add(this.api.setTaskCompletion(item.id, true).subscribe({
      next: () => {
        const markDone = (list: TaskCalendarItem[]): TaskCalendarItem[] => list.map((value): TaskCalendarItem => value.occurrenceId === item.occurrenceId ? { ...value, status: 'DONE' } : value);
        this.items = markDone(this.items);
        this.historyItems = markDone(this.historyItems);
        this.rememberWeek();
        this.closeDetail();
      },
      error: () => {
        this.saving = false;
        this.showToast(this.fr ? 'Impossible de terminer cette tâche. Réessayez.' : 'Unable to complete this task. Please try again.');
      },
    }));
  }

  private get snapshotKey(): string { return `${this.clientId}|${dateKey(this.weekStart)}`; }
  private rememberWeek(): void { TASKS_SNAPSHOT.set(this.snapshotKey, this.items); }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }

  trackByDay = (_: number, day: TaskDay) => day.key;
  trackByOccurrence = (_: number, item: TaskCalendarItem) => item.occurrenceId;
}
