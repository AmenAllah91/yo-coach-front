import { Component, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

/*
 * STATIC PROTOTYPE of the client "Tasks" tab (UX validation only).
 * Everything below is in-memory mock data: nothing is loaded from or saved to
 * the backend yet. Replace the mock generators with API data when it exists.
 */

type TaskKind = 'general' | 'progress' | 'metrics' | 'form' | 'habit';
type TaskStatus = 'done' | 'missed' | 'upcoming';
type ModalStep = 'type' | 'habits' | 'custom' | 'general';
type WeeksShown = 1 | 2 | 4;

interface MockTask {
  title: string;
  subtitle: string;
  kind: TaskKind;
  icon: string;
  goalValue?: number;
  unit?: string;
}

interface CalendarTask extends MockTask {
  status: TaskStatus;
  /** Stable id for this occurrence (day + title), used by the in-memory edits. */
  occurrence: string;
}

interface TaskMenu {
  day: CalendarDay;
  task: CalendarTask;
  top: number;
  left: number;
}

interface CalendarDay {
  date: Date;
  key: string;
  isToday: boolean;
  isPast: boolean;
  tasks: CalendarTask[];
}

interface TaskTypeOption {
  kind: TaskKind;
  icon: string;
  titleKey: string;
  descriptionKey: string;
  examplesKey: string;
}

interface HabitPreset {
  name: string;
  goal: string;
  icon: string;
  tone: string;
  value?: number;
  unit?: string;
}

interface HabitCategory {
  titleKey: string;
  habits: HabitPreset[];
}

const KIND_ICON: Record<TaskKind, string> = {
  general: 'list-checks',
  progress: 'camera',
  metrics: 'activity',
  form: 'clipboard-list',
  habit: 'repeat',
};

const DRINK_WATER: MockTask = { title: 'Drink water', subtitle: '2.5 Liters per day', kind: 'habit', icon: 'droplets', goalValue: 2.5, unit: 'LITERS' };
const PROGRESS_PHOTOS: MockTask = { title: 'Take progress photos', subtitle: 'Progress photo · Front, Side', kind: 'progress', icon: KIND_ICON.progress };
const BODY_METRICS: MockTask = { title: 'Track body metrics', subtitle: 'Weight · Waist · Body fat', kind: 'metrics', icon: KIND_ICON.metrics };
const WEEKLY_CHECKIN: MockTask = { title: 'Weekly Check-in', subtitle: 'Form · 12 questions', kind: 'form', icon: KIND_ICON.form };
const general = (title: string): MockTask => ({ title, subtitle: 'General task', kind: 'general', icon: KIND_ICON.general });

// One-off tasks, keyed by "weeks from the current week : weekday (0 = Monday)".
const ONE_OFF_TASKS: Record<string, MockTask[]> = {
  '0:2': [general('Watch mobility video')],
  '0:3': [general('Watch mobility video')],
  '1:1': [general('Book physio appointment')],
  '1:6': [general('Prepare meals for the week')],
};

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-client-tasks-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FeatherModule],
  templateUrl: './client-tasks-tab.component.html',
  styleUrls: ['./client-tasks-tab.component.scss'],
})
export class ClientTasksTabComponent {
  @Input() clientName = '';

  readonly today = startOfDay(new Date());
  weeksShown: WeeksShown = 2;
  rangeStart = mondayOf(this.today);
  days: CalendarDay[] = [];
  private expandedDays = new Set<string>();

  // Prototype edits, kept in memory for the session only (no backend yet).
  private statusOverrides = new Map<string, TaskStatus>();
  private deletedHabits = new Set<string>();
  private deletedOccurrences = new Set<string>();

  // "..." actions menu of a habit card (fixed position, so the scrolling calendar cannot clip it).
  taskMenu: TaskMenu | null = null;
  editing = false;
  private readonly menuWidth = 184;
  private readonly menuHeight = 132;

  // Modal flow: task type -> habit presets -> custom habit form.
  modalStep: ModalStep | null = null;
  modalDate: Date = this.today;
  habitSearch = '';
  habit = this.emptyHabitForm();
  advancedOpen = false;
  generalTask = this.emptyGeneralTaskForm();
  readonly generalSuggestions = ['Watch video', 'Book appointment', 'Take medication', 'Read article'];

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
    {
      titleKey: 'TASKS_HABITS_POPULAR',
      habits: [
        { name: 'Drink water', goal: '8 cups a day', icon: 'droplets', tone: 'sky', value: 8, unit: 'TIMES' },
        { name: 'Log meals', goal: '1 time a day', icon: 'utensils', tone: 'amber', value: 1, unit: 'TIMES' },
        { name: 'Walk outdoors', goal: '30 minutes a day', icon: 'footprints', tone: 'green', value: 30, unit: 'MINUTES' },
        { name: 'Sleep 8+ hours', goal: '5 times a week', icon: 'moon', tone: 'violet', value: 8, unit: 'HOURS' },
        { name: 'Cardio workout', goal: '3 times a week', icon: 'heart-pulse', tone: 'rose', value: 1, unit: 'TIMES' },
        { name: 'Eat vegetables', goal: '3 servings a day', icon: 'salad', tone: 'green', value: 3, unit: 'SERVINGS' },
      ],
    },
    {
      titleKey: 'TASKS_HABITS_EXERCISE',
      habits: [
        { name: 'Morning run', goal: '15 minutes a day', icon: 'person-standing', tone: 'orange', value: 15, unit: 'MINUTES' },
        { name: 'Walk outdoors', goal: '30 minutes a day', icon: 'footprints', tone: 'green', value: 30, unit: 'MINUTES' },
        { name: 'Daily stretching', goal: '1 time a day', icon: 'accessibility', tone: 'sky', value: 1, unit: 'TIMES' },
        { name: 'Cardio workout', goal: '3 times a week', icon: 'heart-pulse', tone: 'rose', value: 1, unit: 'TIMES' },
        { name: 'Try new yoga pose', goal: '2 times a week', icon: 'flower-2', tone: 'violet', value: 1, unit: 'TIMES' },
      ],
    },
    {
      titleKey: 'TASKS_HABITS_NUTRITION',
      habits: [
        { name: 'Drink water', goal: '8 cups a day', icon: 'droplets', tone: 'sky', value: 8, unit: 'TIMES' },
        { name: 'Eat vegetables', goal: '3 servings a day', icon: 'salad', tone: 'green', value: 3, unit: 'SERVINGS' },
        { name: 'Eat fruits', goal: '2 servings a day', icon: 'apple', tone: 'rose', value: 2, unit: 'SERVINGS' },
        { name: 'Eat low-fat protein', goal: '5 servings a week', icon: 'fish', tone: 'sky', value: 1, unit: 'SERVINGS' },
        { name: 'Take daily vitamins', goal: '1 time a day', icon: 'pill', tone: 'amber', value: 1, unit: 'TIMES' },
        { name: 'Log meals', goal: '1 time a day', icon: 'utensils', tone: 'amber', value: 1, unit: 'TIMES' },
      ],
    },
  ];

  constructor(private translate: TranslateService) {
    this.buildDays();
  }

  // ---------- Calendar ----------

  get rangeEnd(): Date {
    return addDays(this.rangeStart, this.weeksShown * 7 - 1);
  }

  get weeks(): CalendarDay[][] {
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < this.days.length; i += 7) weeks.push(this.days.slice(i, i + 7));
    return weeks;
  }

  /** How many cards fit in a day cell before "+N more" (denser grids show fewer). */
  get maxVisible(): number {
    return this.weeksShown === 1 ? 6 : this.weeksShown === 2 ? 3 : 2;
  }

  get compactCards(): boolean {
    return this.weeksShown === 4;
  }

  setWeeks(weeks: WeeksShown): void {
    this.weeksShown = weeks;
    this.buildDays();
  }

  shiftRange(direction: 1 | -1): void {
    this.rangeStart = addDays(this.rangeStart, direction * this.weeksShown * 7);
    this.buildDays();
  }

  goToToday(): void {
    this.rangeStart = mondayOf(this.today);
    this.buildDays();
  }

  get isCurrentRange(): boolean {
    return this.rangeStart.getTime() === mondayOf(this.today).getTime();
  }

  visibleTasks(day: CalendarDay): CalendarTask[] {
    return this.expandedDays.has(day.key) ? day.tasks : day.tasks.slice(0, this.maxVisible);
  }

  hiddenCount(day: CalendarDay): number {
    return this.expandedDays.has(day.key) ? 0 : Math.max(0, day.tasks.length - this.maxVisible);
  }

  expandDay(day: CalendarDay): void {
    this.expandedDays.add(day.key);
  }

  trackByKey(_: number, day: CalendarDay): string {
    return day.key;
  }

  private buildDays(): void {
    this.expandedDays.clear();
    const currentMonday = mondayOf(this.today);
    this.days = Array.from({ length: this.weeksShown * 7 }, (_, index) => {
      const date = addDays(this.rangeStart, index);
      return {
        date,
        key: date.toISOString(),
        isToday: date.getTime() === this.today.getTime(),
        isPast: date < this.today,
        tasks: this.mockTasksFor(date, currentMonday),
      };
    });
  }

  private mockTasksFor(date: Date, currentMonday: Date): CalendarTask[] {
    const weekday = (date.getDay() + 6) % 7; // 0 = Monday
    const weekOffset = Math.floor((date.getTime() - currentMonday.getTime()) / (7 * DAY_MS));
    const tasks: MockTask[] = [...(ONE_OFF_TASKS[`${weekOffset}:${weekday}`] || [])];
    const dateKey = toInputDate(date);

    if (weekday === 0) tasks.unshift(PROGRESS_PHOTOS);
    if (weekday === 3) tasks.push(BODY_METRICS);
    if (weekday === 6) tasks.push(WEEKLY_CHECKIN);
    tasks.push(DRINK_WATER);

    const daysAgo = Math.round((this.today.getTime() - date.getTime()) / DAY_MS);
    // Deterministic mock outcome: every 4th past day was missed, the rest done.
    const status: TaskStatus = daysAgo <= 0 ? 'upcoming' : daysAgo % 4 === 3 ? 'missed' : 'done';
    return tasks
      .map((task) => {
        const occurrence = `${dateKey}|${task.title}`;
        return { ...task, occurrence, status: this.statusOverrides.get(occurrence) || status };
      })
      .filter((task) =>
        !this.deletedOccurrences.has(task.occurrence) &&
        !(task.kind === 'habit' && this.deletedHabits.has(task.title)));
  }

  // ---------- Task actions menu (every calendar card) ----------

  toggleTaskMenu(event: MouseEvent, day: CalendarDay, task: CalendarTask): void {
    event.stopPropagation();
    if (this.taskMenu?.task.occurrence === task.occurrence) {
      this.closeTaskMenu();
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const opensUp = rect.bottom + 6 + this.menuHeight > window.innerHeight;
    this.taskMenu = {
      day,
      task,
      top: opensUp ? rect.top - 6 - this.menuHeight : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - this.menuWidth, window.innerWidth - this.menuWidth - 8)),
    };
  }

  isMenuOpenFor(task: CalendarTask): boolean {
    return this.taskMenu?.task.occurrence === task.occurrence;
  }

  closeTaskMenu(): void {
    this.taskMenu = null;
  }

  toggleTaskDone(): void {
    if (!this.taskMenu) return;
    const { day, task } = this.taskMenu;
    const next: TaskStatus = task.status === 'done' ? (day.isPast ? 'missed' : 'upcoming') : 'done';
    this.statusOverrides.set(task.occurrence, next);
    task.status = next;
    this.closeTaskMenu();
  }

  editTask(): void {
    if (!this.taskMenu) return;
    const { day, task } = this.taskMenu;
    this.closeTaskMenu();
    this.modalDate = day.date;

    if (task.kind !== 'habit') {
      // Only the general task form exists in the prototype: reuse it for every task type.
      this.generalTask = { ...this.emptyGeneralTaskForm(), title: task.title };
      this.advancedOpen = false;
      this.editing = true;
      this.modalStep = 'general';
      return;
    }

    this.openCustomHabit({
      name: task.title,
      goal: task.subtitle,
      icon: task.icon,
      tone: 'sky',
      value: task.goalValue,
      unit: task.unit,
    });
    this.editing = true;
  }

  deleteTask(): void {
    if (!this.taskMenu) return;
    const { task } = this.taskMenu;
    // A habit is deleted everywhere; any other task only on this day.
    if (task.kind === 'habit') this.deletedHabits.add(task.title);
    else this.deletedOccurrences.add(task.occurrence);
    this.closeTaskMenu();
    this.buildDays();
  }

  @HostListener('document:click')
  @HostListener('window:resize')
  onOutsideInteraction(): void {
    if (this.taskMenu) this.closeTaskMenu();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.taskMenu) this.closeTaskMenu();
  }

  // ---------- Modals ----------

  openCreateTask(date?: Date): void {
    this.closeTaskMenu();
    this.editing = false;
    this.modalDate = date || this.today;
    this.modalStep = 'type';
  }

  chooseTaskType(option: TaskTypeOption): void {
    // Only the general task and habit flows are prototyped for now.
    if (option.kind === 'general') {
      this.generalTask = this.emptyGeneralTaskForm();
      this.editing = false;
      this.advancedOpen = false;
      this.modalStep = 'general';
    } else if (option.kind === 'habit') {
      this.habitSearch = '';
      this.modalStep = 'habits';
    }
  }

  get filteredHabitCategories(): HabitCategory[] {
    const term = this.habitSearch.trim().toLowerCase();
    if (!term) return this.habitCategories;
    return this.habitCategories
      .map((category) => ({ ...category, habits: category.habits.filter((habit) => habit.name.toLowerCase().includes(term)) }))
      .filter((category) => category.habits.length);
  }

  openCustomHabit(preset?: HabitPreset): void {
    this.habit = this.emptyHabitForm();
    if (preset) {
      this.habit.name = preset.name;
      this.habit.icon = preset.icon;
      this.habit.tone = preset.tone;
      this.habit.goalValue = preset.value ?? null;
      this.habit.unit = preset.unit || 'TIMES';
    }
    this.advancedOpen = false;
    this.editing = false;
    this.modalStep = 'custom';
  }

  toggleRepeatDay(index: number): void {
    this.habit.repeatDays[index] = !this.habit.repeatDays[index];
  }

  back(): void {
    // Editing starts from the calendar: going back simply closes the form.
    if (this.editing) {
      this.closeModal();
      return;
    }
    this.modalStep = this.modalStep === 'custom' ? 'habits' : 'type';
  }

  /** Date picked in the general task form, used to label the weekly repeat option. */
  get generalTaskDate(): Date {
    const [year, month, day] = this.generalTask.date.split('-').map(Number);
    return year ? new Date(year, month - 1, day) : this.modalDate;
  }

  /** Weekday of the picked date in the UI language (e.g. "Monday" / "lundi"). */
  get generalTaskWeekday(): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return this.generalTaskDate.toLocaleDateString(lang, { weekday: 'long' });
  }

  createGeneralTask(): void {
    // Prototype: nothing is persisted yet.
    if (!this.generalTask.title.trim()) return;
    this.closeModal();
  }

  saveHabit(): void {
    // Prototype: nothing is persisted yet.
    this.closeModal();
  }

  closeModal(): void {
    this.modalStep = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.taskMenu) this.closeTaskMenu();
    else if (this.modalStep) this.closeModal();
  }

  private emptyGeneralTaskForm() {
    return {
      title: '',
      instructions: '',
      date: toInputDate(this.modalDate || new Date()),
      repeat: 'NONE' as 'NONE' | 'DAILY' | 'WEEKLY' | 'WEEKDAYS',
      reminder: false,
      reminderTime: '08:00',
      allowComments: true,
    };
  }

  private emptyHabitForm() {
    const weekday = (this.modalDate?.getDay?.() ?? new Date().getDay()) as number;
    const repeatDays = [false, false, false, false, false, false, false];
    repeatDays[(weekday + 6) % 7] = true;
    return {
      name: '',
      icon: 'dumbbell',
      tone: 'orange',
      goalValue: null as number | null,
      unit: 'TIMES',
      customUnit: '',
      startDate: toInputDate(this.modalDate || new Date()),
      endDate: '',
      repeat: 'DAILY' as 'DAILY' | 'WEEKLY',
      repeatDays,
      reminder: false,
      reminderTime: '08:00',
      allowComments: true,
    };
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date: Date): Date {
  return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

function toInputDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
