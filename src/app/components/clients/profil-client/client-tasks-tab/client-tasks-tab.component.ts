import { ToastService } from 'app/service/toast.service';
import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { ClientTaskPayload, ClientTasksService, ClientTaskType, HabitPayload, HabitUnit, TaskCalendarItem, TaskCalendarResponse } from 'app/service/client-tasks.service';
import { ProgressPose } from 'app/components/progress-pictures-module/add-progress-picture-modal/add-progress-picture-modal.component';
import { MANUAL_MEASUREMENT_TYPES, MeasurementTypeItem } from 'app/models/measurement-type.model';
import { Form, FormsApiService } from 'app/components/forms/services/forms-api.service';

type TaskKind = 'general' | 'progress' | 'metrics' | 'form' | 'habit';
type TaskStatus = 'done' | 'missed' | 'upcoming';
type ModalStep = 'type' | 'habits' | 'custom' | 'general' | 'progress' | 'metrics' | 'form';
type WeeksShown = 1 | 2 | 4;
interface CalendarTask {
  id: string; occurrence: string; title: string; subtitle: string; kind: TaskKind; icon: string; status: TaskStatus; goalValue?: number; unit?: string; source: TaskCalendarItem;
  /** Client progress task: poses the client must upload in Progress Pictures. */
  poses?: ProgressPose[];
  /** Body metrics task: Measurements module types the client must record. */
  measurements?: string[];
}
interface CalendarDay { date: Date; key: string; isToday: boolean; isPast: boolean; tasks: CalendarTask[]; }
interface TaskMenu { day: CalendarDay; task: CalendarTask; top: number; left: number; }
interface TaskTypeOption { kind: TaskKind; icon: string; titleKey: string; descriptionKey: string; examplesKey: string; }
interface HabitPreset { name: string; goal: string; icon: string; tone: string; value?: number; unit?: string; }
interface HabitCategory { titleKey: string; habits: HabitPreset[]; }
/** Fields shared by the client progress and body metrics forms, the ones the Tasks backend stores. */
interface TaskRequestForm { title: string; note: string; date: string; reminder: boolean; reminderTime: string; allowComments: boolean; }
/** Existing coach form offered in the "Form" task step. `frequency` is set when the form already has a Schedule. */
interface FormOption { id: string; name: string; questionCount: number | null; frequency: string | null; }

const KIND_ICON: Record<TaskKind, string> = { general: 'list-checks', progress: 'camera', metrics: 'activity', form: 'clipboard-list', habit: 'repeat' };
const TYPE_TO_KIND: Record<ClientTaskType, TaskKind> = { GENERAL: 'general', CLIENT_PROGRESS: 'progress', BODY_METRICS: 'metrics', FORM: 'form' };
const KIND_TO_TYPE: Partial<Record<TaskKind, ClientTaskType>> = { general: 'GENERAL', progress: 'CLIENT_PROGRESS', metrics: 'BODY_METRICS', form: 'FORM' };
const WEEK_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

@Component({ selector: 'app-client-tasks-tab', standalone: true, imports: [CommonModule, FormsModule, TranslateModule, FeatherModule], templateUrl: './client-tasks-tab.component.html', styleUrls: ['./client-tasks-tab.component.scss'] })
export class ClientTasksTabComponent implements OnChanges {
  @Input() clientId = '';
  @Input() archived = false;
  private canCoach(): boolean {
    if (!this.archived) return true;
    this.toast.error('This client is archived. Reactivate the client to continue coaching.');
    return false;
  }
  @Input() clientName = '';
  readonly today = startOfDay(new Date());
  weeksShown: WeeksShown = 2;
  rangeStart = mondayOf(this.today);
  days: CalendarDay[] = [];
  summary = { completionPercent: 0, done: 0, missed: 0, upcoming: 0 };
  loading = false;
  private expandedDays = new Set<string>();
  taskMenu: TaskMenu | null = null;
  editing = false;
  private editingId: string | null = null;
  private readonly menuWidth = 184;
  modalStep: ModalStep | null = null;
  modalDate: Date = this.today;
  selectedTaskType: ClientTaskType = 'GENERAL';
  habitSearch = '';
  habit = this.emptyHabitForm();
  advancedOpen = false;
  generalTask = this.emptyGeneralTaskForm();
  progressTask = this.emptyProgressTaskForm();
  readonly progressPoses: ProgressPose[] = ['FRONT', 'SIDE', 'BACK'];
  metricsTask = this.emptyMetricsTaskForm();
  /** Types added through "Add measurement": they stay listed next to the first ones once added. */
  private addedMeasurements = new Set<string>();
  measurementPickerOpen = false;
  private readonly shownMeasurementCount = 5;
  forms: FormOption[] = [];
  formSearch = '';
  formsLoading = false;
  formsError = false;
  formAssignError = false;
  taskSaving = false;
  taskSaveError = '';
  readonly weekOptions: WeeksShown[] = [1, 2, 4];
  readonly weekdayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly units = ['TIMES', 'MINUTES', 'HOURS', 'LITERS', 'SERVINGS', 'STEPS', 'CUSTOM'];
  readonly nameMax = 90;
  readonly taskTypes: TaskTypeOption[] = [
    { kind: 'general', icon: KIND_ICON.general, titleKey: 'TASKS_TYPE_GENERAL', descriptionKey: 'TASKS_TYPE_GENERAL_DESC', examplesKey: 'TASKS_TYPE_GENERAL_EXAMPLES' },
    { kind: 'progress', icon: KIND_ICON.progress, titleKey: 'TASKS_TYPE_PROGRESS', descriptionKey: 'TASKS_TYPE_PROGRESS_DESC', examplesKey: 'TASKS_TYPE_PROGRESS_EXAMPLES' },
    { kind: 'metrics', icon: KIND_ICON.metrics, titleKey: 'TASKS_TYPE_METRICS', descriptionKey: 'TASKS_TYPE_METRICS_DESC', examplesKey: 'TASKS_TYPE_METRICS_EXAMPLES' },
    { kind: 'form', icon: KIND_ICON.form, titleKey: 'TASKS_TYPE_FORM', descriptionKey: 'TASKS_TYPE_FORM_DESC', examplesKey: 'TASKS_TYPE_FORM_EXAMPLES' },
    { kind: 'habit', icon: KIND_ICON.habit, titleKey: 'TASKS_TYPE_HABIT', descriptionKey: 'TASKS_TYPE_HABIT_DESC', examplesKey: 'TASKS_TYPE_HABIT_EXAMPLES' },
  ];
  readonly habitCategories: HabitCategory[] = [
    { titleKey: 'TASKS_HABITS_POPULAR', habits: [
      { name: 'Drink water', goal: '8 cups a day', icon: 'droplets', tone: 'sky', value: 8, unit: 'TIMES' }, { name: 'Log meals', goal: '1 time a day', icon: 'utensils', tone: 'amber', value: 1, unit: 'TIMES' },
      { name: 'Walk outdoors', goal: '30 minutes a day', icon: 'footprints', tone: 'green', value: 30, unit: 'MINUTES' }, { name: 'Sleep 8+ hours', goal: '5 times a week', icon: 'moon', tone: 'violet', value: 8, unit: 'HOURS' },
      { name: 'Cardio workout', goal: '3 times a week', icon: 'heart-pulse', tone: 'rose', value: 1, unit: 'TIMES' }, { name: 'Eat vegetables', goal: '3 servings a day', icon: 'salad', tone: 'green', value: 3, unit: 'SERVINGS' },
    ] },
    { titleKey: 'TASKS_HABITS_EXERCISE', habits: [
      { name: 'Morning run', goal: '15 minutes a day', icon: 'person-standing', tone: 'orange', value: 15, unit: 'MINUTES' }, { name: 'Walk outdoors', goal: '30 minutes a day', icon: 'footprints', tone: 'green', value: 30, unit: 'MINUTES' },
      { name: 'Daily stretching', goal: '1 time a day', icon: 'accessibility', tone: 'sky', value: 1, unit: 'TIMES' }, { name: 'Cardio workout', goal: '3 times a week', icon: 'heart-pulse', tone: 'rose', value: 1, unit: 'TIMES' },
      { name: 'Try new yoga pose', goal: '2 times a week', icon: 'flower-2', tone: 'violet', value: 1, unit: 'TIMES' },
    ] },
    { titleKey: 'TASKS_HABITS_NUTRITION', habits: [
      { name: 'Drink water', goal: '8 cups a day', icon: 'droplets', tone: 'sky', value: 8, unit: 'TIMES' }, { name: 'Eat vegetables', goal: '3 servings a day', icon: 'salad', tone: 'green', value: 3, unit: 'SERVINGS' },
      { name: 'Eat fruits', goal: '2 servings a day', icon: 'apple', tone: 'rose', value: 2, unit: 'SERVINGS' }, { name: 'Eat low-fat protein', goal: '5 servings a week', icon: 'fish', tone: 'sky', value: 1, unit: 'SERVINGS' },
      { name: 'Take daily vitamins', goal: '1 time a day', icon: 'pill', tone: 'amber', value: 1, unit: 'TIMES' }, { name: 'Log meals', goal: '1 time a day', icon: 'utensils', tone: 'amber', value: 1, unit: 'TIMES' },
    ] },
  ];

  constructor(private toast: ToastService, private api: ClientTasksService, private translate: TranslateService, private formsApi: FormsApiService, private router: Router) { this.buildEmptyDays(); }
  ngOnChanges(changes: SimpleChanges): void { if (changes['clientId'] && this.clientId) this.refresh(); }
  get rangeEnd(): Date { return addDays(this.rangeStart, this.weeksShown * 7 - 1); }
  get weeks(): CalendarDay[][] { const result: CalendarDay[][] = []; for (let i = 0; i < this.days.length; i += 7) result.push(this.days.slice(i, i + 7)); return result; }
  get maxVisible(): number { return this.weeksShown === 1 ? 6 : this.weeksShown === 2 ? 3 : 2; }
  get compactCards(): boolean { return this.weeksShown === 4; }
  get isCurrentRange(): boolean { return this.rangeStart.getTime() === mondayOf(this.today).getTime(); }
  setWeeks(weeks: WeeksShown): void { this.weeksShown = weeks; this.refresh(); }
  shiftRange(direction: 1 | -1): void { this.rangeStart = addDays(this.rangeStart, direction * this.weeksShown * 7); this.refresh(); }
  goToToday(): void { this.rangeStart = mondayOf(this.today); this.refresh(); }
  visibleTasks(day: CalendarDay): CalendarTask[] { return this.expandedDays.has(day.key) ? day.tasks : day.tasks.slice(0, this.maxVisible); }
  hiddenCount(day: CalendarDay): number { return this.expandedDays.has(day.key) ? 0 : Math.max(0, day.tasks.length - this.maxVisible); }
  expandDay(day: CalendarDay): void { this.expandedDays.add(day.key); }
  trackByKey(_: number, day: CalendarDay): string { return day.key; }

  private refresh(): void {
    this.buildEmptyDays(); if (!this.clientId) return; this.loading = true;
    this.api.calendar(this.clientId, toInputDate(this.rangeStart), toInputDate(this.rangeEnd)).pipe(finalize(() => this.loading = false)).subscribe(response => this.applyCalendar(response));
  }
  private buildEmptyDays(): void {
    this.expandedDays.clear();
    this.days = Array.from({ length: this.weeksShown * 7 }, (_, index) => { const date = addDays(this.rangeStart, index); return { date, key: toInputDate(date), isToday: date.getTime() === this.today.getTime(), isPast: date < this.today, tasks: [] }; });
  }
  private applyCalendar(response: TaskCalendarResponse): void {
    const byDate = new Map(this.days.map(day => [day.key, day]));
    response.items.forEach(item => byDate.get(item.date)?.tasks.push(this.toCalendarTask(item))); this.summary = response.summary;
  }
  private toCalendarTask(item: TaskCalendarItem): CalendarTask {
    const kind: TaskKind = item.itemType === 'HABIT' ? 'habit' : TYPE_TO_KIND[item.taskType || 'GENERAL'];
    const unit = item.unit === 'CUSTOM' ? item.customUnit : item.unit;
    const subtitle = kind === 'habit' ? `${item.goalValue ?? ''} ${unit || ''}`.trim() : kind === 'progress' ? 'Progress Pictures' : kind === 'metrics' ? 'Body Metrics' : kind === 'form' ? 'Form' : 'General task';
    return { id: item.id, occurrence: item.occurrenceId, title: item.title, subtitle, kind, icon: KIND_ICON[kind], status: item.status.toLowerCase() as TaskStatus, goalValue: item.goalValue, unit: item.unit, source: item, poses: item.requestedPoses, measurements: item.requestedMeasurements };
  }
  toggleTaskMenu(event: MouseEvent, day: CalendarDay, task: CalendarTask): void {
    event.stopPropagation(); if (this.taskMenu?.task.occurrence === task.occurrence) { this.closeTaskMenu(); return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); const opensUp = rect.bottom + 138 > window.innerHeight;
    this.taskMenu = { day, task, top: opensUp ? rect.top - 138 : rect.bottom + 6, left: Math.max(8, Math.min(rect.right - this.menuWidth, window.innerWidth - this.menuWidth - 8)) };
  }
  isMenuOpenFor(task: CalendarTask): boolean { return this.taskMenu?.task.occurrence === task.occurrence; }
  closeTaskMenu(): void { this.taskMenu = null; }
  editTask(): void { if (!this.canCoach()) return;
    if (!this.taskMenu) return;
    const { task, day } = this.taskMenu;
    this.closeTaskMenu();
    this.editCalendarTask(day, task);
  }
  editCalendarTask(day: CalendarDay, task: CalendarTask): void { if (!this.canCoach()) return;
    this.closeTaskMenu(); this.modalDate = day.date; this.editing = true; this.editingId = task.id; const s = task.source;
    if (task.kind === 'habit') {
      this.habit = { name: s.title, icon: task.icon, tone: 'sky', goalValue: s.goalValue ?? null, unit: s.unit || 'TIMES', customUnit: s.customUnit || '', startDate: s.startDate || s.date, endDate: s.endDate || '', repeat: s.repeatType || 'DAILY', repeatDays: WEEK_DAYS.map(d => !!s.weekDays?.includes(d)), reminder: s.reminderEnabled, reminderTime: s.reminderTime || '08:00', allowComments: s.allowClientComment };
      this.modalStep = 'custom';
    } else if (task.kind === 'progress' || task.kind === 'metrics') {
      const saved = { note: s.instructions || '', date: s.date, reminder: s.reminderEnabled, reminderTime: s.reminderTime || '08:00', allowComments: s.allowClientComment };
      if (task.kind === 'progress') {
        this.progressTask = { ...this.emptyProgressTaskForm(), ...saved, title: s.title, poses: [...(task.poses || ['FRONT'])] };
        this.modalStep = 'progress';
      } else {
        this.openMetricsForm({ title: s.title, measurements: [...(task.measurements || ['BODYWEIGHT'])] });
        this.metricsTask = { ...this.metricsTask, ...saved };
      }
    } else {
      this.selectedTaskType = s.taskType || 'GENERAL'; this.generalTask = { title: s.title, instructions: s.instructions || '', date: s.date, reminder: s.reminderEnabled, reminderTime: s.reminderTime || '08:00', allowComments: s.allowClientComment, formId: s.formId || '' };
      if (task.kind === 'form') this.openFormStep(); else this.modalStep = 'general';
    }
    this.advancedOpen = false;
  }
  deleteTask(): void { if (!this.canCoach()) return;
    if (!this.taskMenu) return; const task = this.taskMenu.task; this.closeTaskMenu();
    if (task.kind === 'habit' && !window.confirm('Delete habit?\nThis will remove this habit and all of its scheduled occurrences.')) return;
    (task.kind === 'habit' ? this.api.deleteHabit(task.id) : this.api.deleteTask(task.id)).subscribe(() => this.refresh());
  }
  openCreateTask(date?: Date): void { if (!this.canCoach()) return; this.closeTaskMenu(); this.editing = false; this.editingId = null; this.modalDate = date || this.today; this.modalStep = 'type'; }
  chooseTaskType(option: TaskTypeOption): void {
    if (option.kind === 'habit') { this.habitSearch = ''; this.modalStep = 'habits'; return; }
    this.selectedTaskType = KIND_TO_TYPE[option.kind] || 'GENERAL'; this.advancedOpen = false;
    if (option.kind === 'progress') { this.progressTask = this.emptyProgressTaskForm(); this.modalStep = 'progress'; return; }
    if (option.kind === 'metrics') { this.openMetricsForm(); return; }
    this.generalTask = this.emptyGeneralTaskForm();
    if (option.kind === 'form') this.openFormStep(); else this.modalStep = 'general';
  }
  get filteredHabitCategories(): HabitCategory[] { const term = this.habitSearch.trim().toLowerCase(); if (!term) return this.habitCategories; return this.habitCategories.map(c => ({ ...c, habits: c.habits.filter(h => h.name.toLowerCase().includes(term)) })).filter(c => c.habits.length); }
  openCustomHabit(preset?: HabitPreset): void {
    this.habit = this.emptyHabitForm(); if (preset) { this.habit.name = preset.name; this.habit.icon = preset.icon; this.habit.tone = preset.tone; this.habit.goalValue = preset.value ?? null; this.habit.unit = preset.unit || 'TIMES'; }
    this.advancedOpen = false; this.editing = false; this.editingId = null; this.modalStep = 'custom';
  }
  toggleRepeatDay(index: number): void { this.habit.repeatDays[index] = !this.habit.repeatDays[index]; }
  back(): void { if (this.editing) { this.closeModal(); return; } this.modalStep = this.modalStep === 'custom' ? 'habits' : 'type'; }
  createGeneralTask(): void { if (!this.canCoach()) return;
    if (!this.generalTask.title.trim() || !this.clientId) return;
    const payload: ClientTaskPayload = { clientId: this.clientId, type: this.selectedTaskType, title: this.generalTask.title.trim(), instructions: this.generalTask.instructions.trim(), date: this.generalTask.date, reminderEnabled: this.generalTask.reminder, reminderTime: this.generalTask.reminder ? this.generalTask.reminderTime : undefined, allowClientComment: this.generalTask.allowComments, formId: this.generalTask.formId || undefined };
    (this.editingId ? this.api.updateTask(this.editingId, payload) : this.api.createTask(payload)).subscribe(() => { this.closeModal(); this.refresh(); });
  }

  isPoseSelected(pose: ProgressPose): boolean {
    return this.progressTask.poses.includes(pose);
  }

  toggleProgressPose(pose: ProgressPose): void {
    const poses = this.progressTask.poses;
    // Kept in Front / Side / Back order, the order the client uploads them in.
    this.progressTask.poses = poses.includes(pose)
      ? poses.filter((selected) => selected !== pose)
      : this.progressPoses.filter((option) => option === pose || poses.includes(option));
  }

  get canCreateProgressTask(): boolean {
    return !!this.progressTask.title.trim() && this.progressTask.poses.length > 0 && !!this.progressTask.date;
  }

  createProgressTask(): void { if (!this.canCoach()) return;
    if (!this.canCreateProgressTask) return;
    this.saveTaskRequest('CLIENT_PROGRESS', this.progressTask);
  }

  private openMetricsForm(values: { title?: string; measurements?: string[] } = {}): void {
    this.metricsTask = { ...this.emptyMetricsTaskForm(), ...values };
    // Keep any requested type outside the first ones visible, e.g. when editing a task.
    this.addedMeasurements = new Set(this.metricsTask.measurements);
    this.measurementPickerOpen = false;
    this.taskSaving = false;
    this.taskSaveError = '';
    this.advancedOpen = false;
    this.modalStep = 'metrics';
  }

  /** First manual types of the Measurements module, plus the ones added with "Add measurement". */
  get shownMeasurements(): MeasurementTypeItem[] {
    return MANUAL_MEASUREMENT_TYPES.filter(
      (type, index) => index < this.shownMeasurementCount || this.addedMeasurements.has(type.key));
  }

  /** Remaining manual types, offered in the "Add measurement" picker. */
  get otherMeasurements(): MeasurementTypeItem[] {
    const shown = this.shownMeasurements;
    return MANUAL_MEASUREMENT_TYPES.filter((type) => !shown.includes(type));
  }

  isMeasurementSelected(key: string): boolean {
    return this.metricsTask.measurements.includes(key);
  }

  toggleMeasurement(key: string): void {
    const selected = this.metricsTask.measurements;
    // Kept in the Measurements module order.
    this.metricsTask.measurements = selected.includes(key)
      ? selected.filter((selectedKey) => selectedKey !== key)
      : MANUAL_MEASUREMENT_TYPES.map((type) => type.key).filter((typeKey) => typeKey === key || selected.includes(typeKey));
  }

  toggleMeasurementPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.measurementPickerOpen = !this.measurementPickerOpen;
  }

  addMeasurement(key: string): void {
    this.addedMeasurements.add(key);
    if (!this.isMeasurementSelected(key)) this.toggleMeasurement(key);
    this.measurementPickerOpen = false;
  }

  get canCreateMetricsTask(): boolean {
    return !!this.metricsTask.title.trim() && this.metricsTask.measurements.length > 0 && !!this.metricsTask.date;
  }

  createMetricsTask(): void { if (!this.canCoach()) return;
    if (!this.canCreateMetricsTask || this.taskSaving) return;
    this.saveTaskRequest('BODY_METRICS', this.metricsTask);
  }

  /** One-off form task: recurrence is not set here, it stays in the Schedule tab of the form. */
  private openFormStep(): void {
    this.formSearch = '';
    this.formAssignError = false;
    this.modalStep = 'form';
    this.loadForms();
  }

  private loadForms(): void {
    this.formsLoading = true;
    this.formsError = false;
    this.formsApi.getMyFormsPage(0, 50).pipe(finalize(() => this.formsLoading = false)).subscribe({
      next: (page) => this.forms = (page?.content ?? []).filter((form) => form.status !== 'ARCHIVED').map(toFormOption),
      error: () => this.formsError = true,
    });
  }

  get filteredForms(): FormOption[] {
    const term = this.formSearch.trim().toLowerCase();
    return term ? this.forms.filter((form) => form.name.toLowerCase().includes(term)) : this.forms;
  }

  isFormSelected(form: FormOption): boolean {
    return this.generalTask.formId === form.id;
  }

  selectForm(form: FormOption): void {
    this.generalTask.formId = form.id;
    // The task is shown with the form name in the calendar.
    this.generalTask.title = form.name;
    this.formAssignError = false;
  }

  get canAssignForm(): boolean {
    return !!this.generalTask.formId && !!this.generalTask.date;
  }

  assignFormTask(): void {
    if (!this.canAssignForm) return;
    this.formAssignError = false;
    // As when assigning from Check-ins: a draft form is published first so the client can fill it in.
    this.formsApi.ensurePublished(this.generalTask.formId).subscribe({
      next: () => this.createGeneralTask(),
      error: () => this.formAssignError = true,
    });
  }

  createNewForm(): void { if (!this.canCoach()) return;
    this.closeModal();
    this.router.navigate(['/forms/create-form']);
  }

  private saveTaskRequest(type: ClientTaskType, form: TaskRequestForm & { poses?: ProgressPose[]; measurements?: string[] }): void {
    if (!this.clientId) return;
    this.taskSaving = true;
    this.taskSaveError = '';
    const payload: ClientTaskPayload = { clientId: this.clientId, type, title: form.title.trim(), instructions: form.note.trim(), date: form.date, reminderEnabled: form.reminder, reminderTime: form.reminder ? form.reminderTime : undefined, allowClientComment: form.allowComments, requestedPoses: form.poses, requestedMeasurements: form.measurements };
    (this.editingId ? this.api.updateTask(this.editingId, payload) : this.api.createTask(payload))
      .pipe(finalize(() => this.taskSaving = false))
      .subscribe({
        next: () => { this.closeModal(); this.refresh(); },
        error: (error) => {
          const message = typeof error?.error === 'string' ? error.error.trim() : '';
          this.taskSaveError = message || 'Unable to create this task. Please try again.';
        },
      });
  }

  openNativePicker(event: Event): void {
    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
    if (typeof input.showPicker !== 'function') return;
    try { input.showPicker(); } catch { /* The browser can still use its normal date/time interaction. */ }
  }

  saveHabit(): void { if (!this.canCoach()) return;
    if (!this.clientId || !this.habit.name.trim() || !this.habit.goalValue) return;
    const payload: HabitPayload = { clientId: this.clientId, name: this.habit.name.trim(), goalValue: this.habit.goalValue, unit: this.habit.unit as HabitUnit, customUnit: this.habit.unit === 'CUSTOM' ? this.habit.customUnit.trim() : undefined, startDate: this.habit.startDate, endDate: this.habit.endDate || null, repeatType: this.habit.repeat, weekDays: this.habit.repeat === 'WEEKLY' ? WEEK_DAYS.filter((_, i) => this.habit.repeatDays[i]) : [], reminderEnabled: this.habit.reminder, reminderTime: this.habit.reminder ? this.habit.reminderTime : undefined, allowClientComment: this.habit.allowComments };
    (this.editingId ? this.api.updateHabit(this.editingId, payload) : this.api.createHabit(payload)).subscribe(() => { this.closeModal(); this.refresh(); });
  }
  closeModal(): void { this.modalStep = null; this.editingId = null; }
  @HostListener('document:click') @HostListener('window:resize') onOutsideInteraction(): void { if (this.taskMenu) this.closeTaskMenu(); this.measurementPickerOpen = false; }
  @HostListener('window:scroll') onWindowScroll(): void { if (this.taskMenu) this.closeTaskMenu(); }
  @HostListener('document:keydown.escape') onEscape(): void { if (this.taskMenu) this.closeTaskMenu(); else if (this.measurementPickerOpen) this.measurementPickerOpen = false; else if (this.modalStep) this.closeModal(); }
  private emptyGeneralTaskForm() { return { title: '', instructions: '', date: toInputDate(this.modalDate || new Date()), reminder: false, reminderTime: '08:00', allowComments: true, formId: '' }; }

  /** Client progress = a progress pictures request: no status and no recurrence (only habits repeat). */
  private emptyProgressTaskForm() {
    return {
      title: this.translate.instant('TASKS_PROGRESS_DEFAULT_TITLE') as string,
      poses: ['FRONT'] as ProgressPose[],
      note: '',
      date: toInputDate(this.modalDate || new Date()),
      reminder: false,
      reminderTime: '08:00',
      allowComments: true,
    };
  }

  /** Body metrics = a request to record Measurements types: the coach never enters values here. */
  private emptyMetricsTaskForm() {
    return {
      title: this.translate.instant('TASKS_METRICS_DEFAULT_TITLE') as string,
      measurements: ['BODYWEIGHT'],
      note: '',
      date: toInputDate(this.modalDate || new Date()),
      reminder: false,
      reminderTime: '08:00',
      allowComments: true,
    };
  }

  private emptyHabitForm() { const weekday = this.modalDate?.getDay?.() ?? new Date().getDay(); const repeatDays = [false, false, false, false, false, false, false]; repeatDays[(weekday + 6) % 7] = true; return { name: '', icon: 'dumbbell', tone: 'orange', goalValue: null as number | null, unit: 'TIMES', customUnit: '', startDate: toInputDate(this.modalDate || new Date()), endDate: '', repeat: 'DAILY' as 'DAILY' | 'WEEKLY', repeatDays, reminder: false, reminderTime: '08:00', allowComments: true }; }
}
function startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days); }
function mondayOf(date: Date): Date { return addDays(startOfDay(date), -((date.getDay() + 6) % 7)); }
/** Same question count fallback as the Check-ins form selection modal; null when the page gives neither. */
function toFormOption(form: Form & { questions?: unknown[]; questionsCount?: number }): FormOption {
  return { id: String(form.id), name: form.title || form.name || '(Untitled)', questionCount: Array.isArray(form.questions) ? form.questions.length : form.questionsCount ?? null, frequency: form.schedule?.frequency ?? null };
}
function toInputDate(date: Date): string { const pad = (v: number) => String(v).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
