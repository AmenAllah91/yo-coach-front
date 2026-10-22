import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { ChatService } from 'app/service/chat.service';
import { ClientTasksService, TaskCalendarItem } from 'app/service/client-tasks.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { ClientTaskRowComponent } from '../shared/client-task-row.component';
import { capitalizeFirst, capitalizeSentences, dateKey, titleCase } from '../shared/client-plan-utils';
import { isHabit, isTaskDone, openClientTask, taskColors, taskIcon, taskTypeLabel } from '../shared/client-task-utils';

interface TaskDay { date: string; weekday: string; label: string; isToday: boolean; done: number; items: TaskCalendarItem[]; }

/** Tasks of each client and month seen in this session: a revisit shows them at once. */
const TASKS_SNAPSHOT = new Map<string, TaskCalendarItem[]>();
const COACH_NAMES = new Map<string, string>();

/**
 * Client Tasks, same content and logic as the mobile ClientTasksScreen and ClientTaskDetailScreen:
 * upcoming / past month list grouped by day, habit check circles, and the detail of a general task with
 * "Mark as done". Also shown read only in the coach "client view" (previewMode).
 */
@Component({
  selector: 'app-my-tasks', standalone: true,
  imports: [CommonModule, FeatherModule, ClientTaskRowComponent],
  templateUrl: './my-tasks.component.html', styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit, OnDestroy {
  /** Coach "client view" preview: the tasks of this client, read only (nothing opens outside the preview). */
  @Input() previewClientId = '';
  @Input() previewMode = false;
  @Input() previewCoachName = '';
  items: TaskCalendarItem[] = [];
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  upcoming = true;
  selected: TaskCalendarItem | null = null;
  coachName = '';
  loading = false;
  error = '';
  saving = false;
  toast = '';
  toggling = new Set<string>();
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
  get monthLabel(): string {
    const label = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(this.month);
    return label ? label[0].toUpperCase() + label.slice(1) : label;
  }

  /** Visible items of the tab, grouped by day (mobile _visibleItems + _buildGroups). */
  get days(): TaskDay[] {
    const today = dateKey(new Date());
    const visible = this.items.filter(item => this.upcoming ? item.date >= today : item.date < today)
      .sort((a, b) => this.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    const groups = new Map<string, TaskCalendarItem[]>();
    for (const item of visible) {
      const values = groups.get(item.date) || []; values.push(item); groups.set(item.date, values);
    }
    return Array.from(groups, ([date, items]) => {
      const day = new Date(date + 'T12:00:00');
      return {
        date, items, isToday: date === today, done: items.filter(item => isTaskDone(item)).length,
        weekday: new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(day).toUpperCase().replace('.', ''),
        label: new Intl.DateTimeFormat(this.locale, { month: 'short', day: 'numeric' }).format(day),
      };
    });
  }

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
          this.month = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
          this.upcoming = date >= dateKey(new Date());
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
    this.destroyed = true; this.subscriptions.unsubscribe(); this.request?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  load(): void {
    this.request?.unsubscribe(); this.error = '';
    const last = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0);
    // Month seen before in this session: shown at once, the fresh answer replaces it.
    const key = `${this.clientId}|${dateKey(this.month)}`;
    const known = TASKS_SNAPSHOT.get(key);
    if (known) this.items = known;
    this.loading = !known;
    this.request = this.api.calendar(this.clientId, dateKey(this.month), dateKey(last), true).subscribe({
      next: response => {
        this.items = response.items; this.loading = false;
        TASKS_SNAPSHOT.set(key, response.items);
        const target = this.pendingItemId ? this.items.find(item => item.id === this.pendingItemId
          && (!this.pendingDate || item.date === this.pendingDate)
          && (!this.pendingType || item.itemType === this.pendingType)) : null;
        this.pendingItemId = '';
        if (target) this.openDetailOrTask(target);
      },
      error: () => { this.loading = false; this.error = this.fr ? 'Impossible de charger les tâches.' : 'Unable to load tasks.'; },
    });
  }

  shiftMonth(delta: number): void {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
    this.selected = null; this.pendingItemId = ''; this.load();
  }

  setTab(upcoming: boolean): void { this.upcoming = upcoming; }

  /** Habits can be ticked up to today, never in the future (mobile _canToggle). */
  canToggle(task: TaskCalendarItem): boolean {
    return !this.previewMode && isHabit(task) && task.date <= dateKey(new Date());
  }

  /** Optimistic: flipped at once, persisted in the background, rolled back on failure. */
  toggleHabit(habit: TaskCalendarItem): void {
    if (this.toggling.has(habit.occurrenceId)) return;
    this.toggling.add(habit.occurrenceId);
    const previous = this.items;
    const done = isTaskDone(habit);
    this.items = this.items.map(item => item.occurrenceId === habit.occurrenceId
      ? { ...item, status: done ? 'UPCOMING' : 'DONE', completedValue: done ? undefined : item.goalValue } : item);
    this.subscriptions.add(this.api.setHabitCompletion(habit.id, habit.date, !done, done ? undefined : habit.goalValue).subscribe({
      next: () => { this.toggling.delete(habit.occurrenceId); this.rememberMonth(); },
      error: () => {
        this.toggling.delete(habit.occurrenceId);
        this.items = previous;
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
        this.items = this.items.map(value => value.occurrenceId === item.occurrenceId ? { ...value, status: 'DONE' } : value);
        this.rememberMonth();
        this.closeDetail();
      },
      error: () => {
        this.saving = false;
        this.showToast(this.fr ? 'Impossible de terminer cette tâche. Réessayez.' : 'Unable to complete this task. Please try again.');
      },
    }));
  }

  private rememberMonth(): void { TASKS_SNAPSHOT.set(`${this.clientId}|${dateKey(this.month)}`, this.items); }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }

  trackByDay = (_: number, day: TaskDay) => day.date;
  trackByOccurrence = (_: number, item: TaskCalendarItem) => item.occurrenceId;
}
