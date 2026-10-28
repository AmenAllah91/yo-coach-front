import { ClientProfileCacheService } from 'app/service/client-profile-cache.service';
import { NutritionPlanKind, nutritionPlanKind } from '@shared/models/nutrition-plan-kind';
import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { DestroyRef, inject as injectService } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import { CalendarCheckIn, ProgramScheduleService } from 'app/service/program-schedule.service';
import { ClientTasksService, TaskCalendarItem } from 'app/service/client-tasks.service';
import { ProgramShiftModalComponent } from '@shared/components/program-shift-modal/program-shift-modal.component';
import {
  ExerciseLine, MealLine, NutritionReport, WorkoutReport, checkInTone, exerciseLines, mealLines, nutritionReport, tasksTone,
  workoutReport,
} from '@shared/models/calendar-day';
import { CopyDaysModalComponent } from '@shared/program-copy/copy-days-modal.component';
import { DayCopy } from '@shared/program-copy/program-day-copy';
import { ClientPauseModalComponent } from '@shared/components/client-pause-modal/client-pause-modal.component';
import { RemoveProgramConfirmComponent } from '@shared/components/remove-program-confirm/remove-program-confirm.component';
import { ToastService } from 'app/service/toast.service';
import { ClientSchedulePreview, OverviewItem, changeSentence, isPlanLocked, todayIso } from '@shared/models/program-schedule';
import { mealDayActive, workoutDayActive } from '@shared/models/client-day-activity';
import { CalendarFile, FileBand, arrangeFiles, weekBands } from '@shared/models/calendar-files';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService } from 'app/service/client.service';
import { Router } from '@angular/router';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { lineMacros } from '@shared/models/nutrition-math';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';

interface ExerciseSet {
  id: string;
  number: number;
  reps: string;
  rest: string;
  weight?: number | null;
  duration?: number;
  type?: 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE';
}

interface Exercise {
  id: string;
  name: string;
  type: 'strength' | 'cardio';
  sets: ExerciseSet[];
  duration?: number;
  notes?: string;
  thumbnail?: string;
  imageUrl?: string;
  youtubeUrl?: string;
  videoLink?: string;
  supersetGroupId?: string | null;
}

interface WorkoutSession {
  id: string;
  exercises: Exercise[];
  notes?: string;
}

interface WorkoutProgram {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  clientId?: string;
  color?: string;
  sessions: WorkoutSession[];
  programId?: string;
  programName?: string;
  dayNumber?: number;
  status?: 'COMPLETED' | 'MISSED' | 'PENDING';
  restDay?: boolean;
  emptyDay?: boolean;
  /** The client already did something on that day (backlog-programmes.md K1): it opens read-only. */
  done?: boolean;
  /** The day as the server sent it: what the client logged (lot C, L2). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

/** A client program with days, to add a day in the program of that date (K2). */
interface PlanRange {
  programId: string;
  start: string;
  end: string;
  /** Stopped or finished (A9): it is read, not changed. */
  locked: boolean;
  /** Nutrition: the editor that opens it. */
  planKind?: NutritionPlanKind;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  dayNumber: number;
  isToday: boolean;
  weekdayLabel: string;
  items: (WorkoutProgram | NutritionProgram)[];
  /** A file band covers the day: « nothing planned » is not shown under it. */
  covered: boolean;
  /** The month (C3): one mark per subject of the day, its state said by a symbol (the week's follow-up rate). */
  marks?: MonthMark[];
  /** The month: the day's cards, the same as in the week (workout, nutrition, tasks, check-ins). */
  plan?: WeekRowDay;
}

/** A subject of a day: its row in the week, a choice of the month, what the day panel can show alone. */
type DaySubject = 'workout' | 'nutrition' | 'tasks' | 'checkins';

/** A subject of a day in the month (C3): its icon, its state (✓ done, ✗ missed...), a short text. */
interface MonthMark {
  subject: DaySubject;
  icon: string;
  tone: string;
  text: string;
  /** The mouse's hint: the text and the state in words (the symbol alone says it by its color). */
  hint: string;
}

/** One row of the month (or the week view): its days (null outside the month), the file bands drawn over it. */
interface CalendarWeek {
  key: string;
  days: (CalendarDay | null)[];
  bands: FileBand[];
  /** Grid rows: the day numbers, one row per file band, then the day cards. */
  rows: string;
  /** The month (C3): how much of what was due that week the client did, in %; null when nothing was due. */
  rate?: number | null;
}

/** Where the calendar was before opening an editor, to come back to the same month (sessionStorage). */
const CALENDAR_PLACE_KEY = 'yo-coach.calendar-place';

interface Client {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface NutritionMeal {
  id: string;
  name: string;
  foods: {
    name: string;
    quantity: string;
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  }[];
}

interface NutritionProgram {
  id: string;
  title: string;
  date: string;
  clientId?: string;
  programId?: string;
  dayId?: string;
  trackingMode?: string;
  /** Kind of the whole plan (editor to open): a plan with foods made on mobile is EACH_MEAL too. */
  planKind?: NutritionPlanKind;
  programName?: string;
  dayNumber?: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: NutritionMeal[];
  emptyDay?: boolean;
  /** Free day (no targets). */
  cheatMeal?: boolean;
  status?: string;
  /** The client already did something on that day (K1). */
  done?: boolean;
  /** The day as the server sent it: the client's meal reports and feelings (lot C, L2). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

/** A cell of the week in rows (lot C, L1): its title, one line under it, its status. */
interface WeekCell<T> {
  item: T;
  title: string;
  meta: string;
  status: { tone: string; text: string };
  /** The detail of the day (as a coach's program sheet): its exercises, or its meals. */
  exercises?: ExerciseLine[];
  meals?: MealLine[];
  /** A workout that can be dragged onto another day (not done, not past, program not stopped: K1, C4). */
  movable?: boolean;
}

/** A day of the week in rows: one cell per program day of each type, its tasks and check-ins. */
interface WeekRowDay {
  date: Date;
  dateString: string;
  dayNumber: number;
  isToday: boolean;
  weekdayLabel: string;
  workout: WeekCell<WorkoutProgram>[];
  nutrition: WeekCell<NutritionProgram>[];
  tasks: TaskCalendarItem[];
  tasksDone: number;
  tasksTone: string | null;
  checkIns: CalendarCheckIn[];
  /** A file band covers the day (nothing else to add under it). */
  workoutCovered: boolean;
  nutritionCovered: boolean;
  /** The files of the day (a narrow window lists them, it has no bands). */
  files: CalendarFile[];
}

/** The week in rows: Entraînement, Nutrition, Tâches, Check-ins; the files over the row of their type. */
interface WeekPlan {
  days: WeekRowDay[];
  workoutBands: FileBand[];
  nutritionBands: FileBand[];
  /** Grid rows of a type: one per file band, then the cells. */
  workoutRows: string;
  nutritionRows: string;
}

/** « Ce jour-là » (lot C, L2-L3): what was planned that day face to what the client did. */
interface DayDetail {
  date: string;
  label: string;
  workouts: {
    item: WorkoutProgram; report: WorkoutReport; status: { tone: string; text: string }; locked: boolean;
    /** The planned exercises with their block (A1, B...) and rest, in the order of the report. */
    lines: ExerciseLine[];
  }[];
  nutrition: {
    item: NutritionProgram; report: NutritionReport; status: { tone: string; text: string };
    /** The meals with their foods, in the order of the report. */
    meals: MealLine[];
  }[];
  files: { file: CalendarFile; kind: CalendarType; day: number; total: number }[];
  tasks: TaskCalendarItem[];
  checkIns: CalendarCheckIn[];
  /** Nothing of that type that day, no file of it, not past: the panel offers to add one. */
  addWorkout: boolean;
  addNutrition: boolean;
  /** The week's row clicked (only that subject is shown), or null: the whole day. */
  focus: DaySubject | null;
}

type CalendarViewMode = 'month' | 'week' | 'day';
type CalendarType = 'workout' | 'nutrition';

@Component({
  selector: 'app-calendar-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SectionLoaderComponent, AssignScheduleComponent, AssignConfirmComponent,
    ProgramShiftModalComponent, CopyDaysModalComponent, ClientPauseModalComponent, RemoveProgramConfirmComponent],
  templateUrl: './calendar-clients.component.html',
  styleUrl: './calendar-clients.component.scss',
})
export class CalendarClientsComponent implements OnInit, OnChanges {

  /** The client's programs arrived once: the section loader shows before (the client profile tab). */
  private workoutsLoaded = false;
  private nutritionLoaded = false;
  get programsLoaded(): boolean {
    return this.workoutsLoaded && this.nutritionLoaded;
  }

  /** Inside the client profile, the calendar loads in place, without the full-screen loader. */
  private get embedded(): boolean {
    return !!this.embeddedClientId;
  }

  /** The coach's settings (K4): PDF / Excel programs are shown for a type only when files are used for it. */
  workoutFileEnabled = true;
  nutritionFileEnabled = true;
  private settingsKnown = false;
  currentDate = new Date();
  /** The week by default (lot C): what the client did shows best day by day. */
  currentView: CalendarViewMode = 'week';
  calendarType: CalendarType = 'workout';
  selectedClient: string = '';
  /* Affectation (backlog-programmes.md A5/A6): what changes on the client's calendar before a program is created. */
  programSchedule = injectService(ProgramScheduleService);
  createProgramPreviews: Record<string, ClientSchedulePreview> = {};
  createProgramChecking = false;
  createProgramConfirmRows: AssignConfirmRow[] | null = null;
  private createProgramConfirmed = false;
  private cachedCalendarClientIds: string[] = [];

  /** The selected client as a stable list for the schedule (a new array at each check would ask the server again). */
  get calendarClientIds(): string[] {
    const id = this.selectedClient ? String(this.selectedClient) : '';
    if ((this.cachedCalendarClientIds[0] || '') !== id) this.cachedCalendarClientIds = id ? [id] : [];
    return this.cachedCalendarClientIds;
  }

  coachId: string | null = sessionStorage.getItem('userId');
  private toast = injectService(ToastService);
  private destroyRef = injectService(DestroyRef);
  private tasksApi = injectService(ClientTasksService);

  showCreateProgramModal = false;
  createProgramName = '';
  createProgramDurationWeeks = 4;
  createProgramStartDate = '';
  readonly createProgramDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  createProgramSaving = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workoutPrograms: any[] = [];
  nutritionPrograms: NutritionProgram[] = [];
  clients: Client[] = [];
  /** PDF / Excel programs of the client, by type (K4). */
  workoutFiles: CalendarFile[] = [];
  nutritionFiles: CalendarFile[] = [];
  private workoutRanges: PlanRange[] = [];
  private nutritionRanges: PlanRange[] = [];

  /** What the screen shows, computed when the data, the period or the type change (not at each check). */
  monthWeeks: CalendarWeek[] = [];
  weekPlan: WeekPlan | null = null;
  /** The day open under the week (« Ce jour-là »), and what it shows; in the day view, that day. */
  selectedDate: string | null = null;
  dayDetail: DayDetail | null = null;
  /** The panel shows only the subject of the row clicked in the week (its card, its chip); null: the whole day. */
  dayFocus: DaySubject | null = null;
  /** The month shows the subjects the coach chose (everything at once is too much to read); kept on this browser. */
  monthShow: DaySubject[] = this.readMonthShow();
  readonly monthSubjects: { key: DaySubject; icon: string; label: string }[] = [
    { key: 'workout', icon: 'fitness_center', label: 'CALENDAR_ROW_WORKOUT' },
    { key: 'nutrition', icon: 'restaurant', label: 'CALENDAR_ROW_NUTRITION' },
    { key: 'tasks', icon: 'checklist', label: 'CALENDAR_ROW_TASKS' },
    { key: 'checkins', icon: 'assignment', label: 'CALENDAR_ROW_CHECKINS' },
  ];
  /** A phone-sized window (under 768 px): the month is compact, the day touched shows under it; the week is a list. */
  narrow = false;
  /** The month on a narrow window: the day touched, its cards under the month. */
  monthDay: CalendarDay | null = null;
  /** « Décaler la suite » of a program, from the day panel (the window of the client's tabs). */
  shiftTarget: { kind: 'WORKOUT' | 'NUTRITION'; item: OverviewItem } | null = null;
  /** « Retirer ce programme » from the day panel: the client tab's window, then the same removal (CC-25). */
  removeTarget: { kind: CalendarType; item: OverviewItem } | null = null;
  removing = false;
  /** The file under the mouse: all its pieces light up, it reads as one program. */
  hoveredFileId: string | null = null;
  private itemsByDate = new Map<string, (WorkoutProgram | NutritionProgram)[]>();
  private workoutByDate = new Map<string, WorkoutProgram[]>();
  private nutritionByDate = new Map<string, NutritionProgram[]>();
  private tasksByDate = new Map<string, TaskCalendarItem[]>();
  private checkInsByDate = new Map<string, CalendarCheckIn[]>();
  private placeRestored = false;

  @Input() embeddedClientId: string | null = null;
  @Input() embeddedCoachId: string | null = null;
  /** The client's name inside their profile (the calendar has no list of clients there). */
  @Input() embeddedClientName = '';
  @Input() hideClientFilter = false;
  /** A file band clicked: the client profile opens it as its tab does. Alone, the calendar opens it itself. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() openFile = new EventEmitter<{ type: CalendarType; programId: string; plan: any }>();
  /** From the day panel, inside the client profile: its Discussion tab, or the window of a check-in's answers. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() profileAction = new EventEmitter<{ type: 'chat' } | { type: 'checkin'; assignment: any }>();

  /** Opened from a client's tab (« Voir le suivi »): that calendar (workout or nutrition), on the month of that day. */
  @Input() set focus(value: { type: CalendarType; date?: string | null } | null) {
    if (!value) return;
    this.placeRestored = true;
    if (value.type !== this.calendarType) this.setCalendarType(value.type);
    if (value.date) {
      const [year, month, day] = value.date.slice(0, 10).split('-').map(Number);
      if (year && month && day) {
        this.currentDate = new Date(year, month - 1, day);
        this.showPeriod();
      }
    }
  }

  constructor(
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private clientService: ClientService,
    private router: Router,
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    private profileCache: ClientProfileCacheService,
  ) {}

  ngOnInit(): void {
    // Files are drawn once the settings are known: a coach without files never sees them flash (K4).
    const applySettings = () => {
      this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
      this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      this.settingsKnown = true;
      this.updateMonthGrid();
    };
    this.coachSettingsService.loadConfig(this.embedded).subscribe({ next: applySettings, error: applySettings });
    if (this.embeddedCoachId) {
      this.coachId = this.embeddedCoachId;
    }

    if (this.embeddedClientId) {
      this.selectedClient = this.embeddedClientId;
    }

    this.restorePlace();
    this.loadCalendar();
    if (!this.hideClientFilter) {
      this.getClients();
    }
    // A program assigned, moved, shifted or paused from a tab: the calendar reads its months again.
    this.programSchedule.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadCalendar());
    // A phone-sized window: the compact month and the week as a list (CC-24).
    const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;
    if (media) {
      this.narrow = media.matches;
      const onChange = (event: MediaQueryListEvent) => {
        this.narrow = event.matches;
        this.updateMonthGrid();
      };
      media.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
    }
  }

  goBack(): void { window.history.back(); }

  /** Before an editor opens: its « Retour » comes back to this month, type and view. */
  private rememberPlace(): void {
    try {
      sessionStorage.setItem(CALENDAR_PLACE_KEY, JSON.stringify({
        client: this.selectedClient,
        type: this.calendarType,
        view: this.currentView,
        date: this.formatDateToYYYYMMDD(this.currentDate),
        at: Date.now(),
      }));
    } catch {
      // No storage: the calendar opens on today.
    }
  }

  /** Back from an editor (within 30 minutes): the same place. A tab's « Voir le suivi » wins (focus). */
  private restorePlace(): void {
    let place: { client?: string; type?: CalendarType; view?: CalendarViewMode; date?: string; at?: number } | null = null;
    try {
      place = JSON.parse(sessionStorage.getItem(CALENDAR_PLACE_KEY) || 'null');
      sessionStorage.removeItem(CALENDAR_PLACE_KEY);
    } catch {
      return;
    }
    if (this.placeRestored || !place?.client || !place.at || Date.now() - place.at > 30 * 60000) return;
    if (this.embeddedClientId ? place.client !== this.embeddedClientId : !!this.selectedClient) return;
    this.placeRestored = true;
    this.selectedClient = place.client;
    if (place.type === 'workout' || place.type === 'nutrition') this.calendarType = place.type;
    if (place.view === 'month' || place.view === 'week' || place.view === 'day') this.currentView = place.view;
    const [year, month, day] = String(place.date || '').split('-').map(Number);
    if (year && month && day) this.currentDate = new Date(year, month - 1, day);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['embeddedCoachId'] && this.embeddedCoachId) {
      this.coachId = this.embeddedCoachId;
    }

    // The first value is loaded by ngOnInit: loading it here too read every month twice.
    if (changes['embeddedClientId'] && !changes['embeddedClientId'].firstChange) {
      this.selectedClient = this.embeddedClientId || '';
      this.loadCalendar();
    }
  }

  onClientChange(clientId: string): void {
    this.selectedClient = clientId;
    this.loadCalendar();
  }

  getClients(): void {
    this.clientService
      .getListClientsByCoachWithoutPagination(this.coachId)
      .subscribe({
        next: (res) => {
          // Active clients only (backlog-programmes.md A1): the calendar creates programs for the one selected.
          this.clients = (res || []).filter((client: any) => (client?.clientStatus ?? 'ACTIVE') === 'ACTIVE');
        },
        error: (err) => {
          console.error('Error loading clients', err);
        },
      });
  }

  /* ---- Reading by month (backlog-programmes.md, calendar lot B): the months on the screen, then the month before and
          the month after in the background (the next click shows at once). Both types come in one read. ---- */

  /** The months read, the ones being read, the plans read by id; `readGeneration` drops the answers of an old client. */
  private monthsRead = new Set<string>();
  private monthsReading = new Set<string>();
  /** Months whose read failed: not read again in the background (no loop), only when shown again or « Réessayer ». */
  private monthsFailed = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private workoutPlansById = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mealPlansById = new Map<string, any>();
  /** The tasks and habits, and the check-ins, of each month read (lot C). */
  private tasksByMonth = new Map<string, TaskCalendarItem[]>();
  private checkInsByMonth = new Map<string, CalendarCheckIn[]>();
  private readGeneration = 0;
  /** A month on the screen is being read (after the first one): a thin bar says it, the grid stays. */
  periodLoading = false;

  /** Everything again from the server: another client, or after a change made here or elsewhere. */
  loadCalendar(): void {
    this.readGeneration++;
    this.monthsRead.clear();
    this.monthsReading.clear();
    this.monthsFailed.clear();
    this.workoutPlansById.clear();
    this.mealPlansById.clear();
    this.tasksByMonth.clear();
    this.checkInsByMonth.clear();
    const hasClient = !!this.selectedClient && this.selectedClient !== 'all';
    this.workoutsLoaded = this.nutritionLoaded = !hasClient;
    this.applyPlans();
    this.readPeriod();
  }

  /** The screen changed (period or view): the months it shows are read if they are not yet. */
  private showPeriod(): void {
    this.updateMonthGrid();
    this.readPeriod();
  }

  private readPeriod(): void {
    if (!this.selectedClient || this.selectedClient === 'all') {
      this.periodLoading = false;
      return;
    }
    const missing = this.monthsOnScreen().filter((month) => !this.monthsRead.has(month));
    this.periodLoading = missing.length > 0;
    if (missing.length) missing.forEach((month) => this.readMonth(month));
    else this.readNeighbours();
  }

  /** The month of the view (month and day views), or the one or two months of the week. */
  private monthsOnScreen(): string[] {
    const dates = this.currentView === 'week' ? [this.getWeekDates()[0], this.getWeekDates()[6]] : [this.currentDate];
    return [...new Set(dates.map((date) => this.monthKey(date)))];
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private readNeighbours(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    [new Date(year, month - 1, 1), new Date(year, month + 1, 1)].forEach((date) => this.readMonth(this.monthKey(date), true));
  }

  private readMonth(month: string, neighbour = false): void {
    if (this.monthsRead.has(month) || this.monthsReading.has(month)) return;
    if (neighbour && this.monthsFailed.has(month)) return;
    this.monthsReading.add(month);
    const generation = this.readGeneration;
    const [year, monthNumber] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = this.formatDateToYYYYMMDD(new Date(year, monthNumber, 0));
    // The tasks and habits come by the tasks' own read, side by side: their row fills in when they arrive.
    this.tasksApi.calendar(this.selectedClient, from, to, true).subscribe({
      next: (tasks) => {
        if (generation !== this.readGeneration) return;
        this.tasksByMonth.set(month, tasks?.items || []);
        this.updateMonthGrid();
      },
      error: (err) => console.error('Error loading the client tasks', err),
    });
    this.programSchedule.calendar(this.selectedClient, from, to).subscribe({
      next: (period) => {
        if (generation !== this.readGeneration) return;
        this.monthsReading.delete(month);
        this.monthsFailed.delete(month);
        this.monthsRead.add(month);
        (period?.workoutPlans || []).forEach((plan) => plan?.id && this.workoutPlansById.set(plan.id, plan));
        (period?.mealPlans || []).forEach((plan) => plan?.id && this.mealPlansById.set(plan.id, plan));
        this.checkInsByMonth.set(month, period?.checkIns || []);
        this.applyPlans();
        this.afterRead();
      },
      error: (err) => {
        if (generation !== this.readGeneration) return;
        this.monthsReading.delete(month);
        this.monthsFailed.add(month);
        console.error('Error loading the client calendar', err);
        if (!neighbour) {
          this.toast.show({
            type: 'error',
            title: this.translate.instant('CALENDAR_LOAD_ERROR'),
            actions: [{ label: this.translate.instant('RETRY'), run: () => this.loadCalendar() }],
            duration: 10000,
          });
        }
        this.afterRead();
      },
    });
  }

  /** Once no month of the screen is being read: the screen is ready, the months around are read in the background. */
  private afterRead(): void {
    if (this.monthsOnScreen().some((month) => this.monthsReading.has(month))) return;
    this.workoutsLoaded = this.nutritionLoaded = true;
    this.periodLoading = false;
    this.readNeighbours();
  }

  /** The plans read so far, as the screen uses them. */
  private applyPlans(): void {
    this.applyWorkoutPlans([...this.workoutPlansById.values()]);
    this.applyNutritionPlans([...this.mealPlansById.values()]);
    this.updateMonthGrid();
  }

  /**
   * The client's workout plans as they are (K5, no merging): the days of the programs made in the app, the PDF / Excel
   * programs apart (one band each, K4), and the dates of each program (a new day goes into its own, K2).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyWorkoutPlans(plans: any[]): void {
    const withDays = (plans || []).filter((plan) => !this.isBackendFileWorkoutPlan(plan));
    this.workoutPrograms = this.mapBackendToWorkoutPrograms(withDays);
    this.workoutRanges = this.planRanges(withDays, (plan, start) => this.getNormalizedWorkoutEndDate(plan, start, false));
    this.workoutFiles = this.filePrograms(
      (plans || []).filter((plan) => this.isBackendFileWorkoutPlan(plan)),
      (plan) => this.getBackendFileWorkoutResourceType(plan),
      'workout',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyNutritionPlans(plans: any[]): void {
    const withDays = (plans || []).filter((plan) => !this.isFileNutritionPlan(plan));
    this.nutritionPrograms = this.mapBackendToNutritionPrograms(withDays);
    this.nutritionRanges = this.planRanges(withDays, (plan, start) => this.toCalendarDateOnly(plan?.endDate) || start);
    this.nutritionFiles = this.filePrograms(
      (plans || []).filter((plan) => this.isFileNutritionPlan(plan)),
      (plan) => this.getBackendFileWorkoutResourceType(plan),
      'nutrition',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private planRanges(plans: any[], endOf: (plan: any, start: string) => string | null): PlanRange[] {
    const today = todayIso();
    return plans.flatMap((plan) => {
      const start = this.toCalendarDateOnly(plan?.startDate);
      if (!plan?.id || !start) return [];
      const end = endOf(plan, start) || start;
      return [{
        programId: plan.id,
        start,
        end: end >= start ? end : start,
        locked: isPlanLocked(plan, today),
        planKind: nutritionPlanKind(plan),
      }];
    });
  }

  /** The program whose dates hold that day (the latest one if two do). */
  private planCovering(ranges: PlanRange[], date: string): PlanRange | null {
    return ranges
      .filter((range) => range.start <= date && date <= range.end)
      .sort((a, b) => b.start.localeCompare(a.start))[0] || null;
  }

  /** The PDF / Excel programs (K4), with their color and their row (`arrangeFiles`). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filePrograms(plans: any[], typeOf: (plan: any) => 'PDF' | 'EXCEL', kind: CalendarType): CalendarFile[] {
    return arrangeFiles(plans.flatMap((plan): CalendarFile[] => {
        const start = this.toCalendarDateOnly(plan?.startDate);
        if (!plan?.id || !start) return [];
        const end = this.toCalendarDateOnly(plan?.endDate);
        return [{
          programId: plan.id,
          name: String(plan.name || plan.originalFileName || plan.fileName || '').trim(),
          resourceType: typeOf(plan),
          start,
          end: end && end >= start ? end : start,
          tone: 0,
          lane: 0,
          kind,
          plan,
        }];
    }));
  }

  /** The files of the type shown, when the coach's settings use them for that type (K4). */
  private get visibleFiles(): CalendarFile[] {
    return this.visibleFilesOf(this.calendarType);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isBackendFileWorkoutPlan(plan: any): boolean {
    const mode = String(plan?.workoutPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    const hasInteractiveDays =
      Array.isArray(plan?.workoutDays) && plan.workoutDays.length > 0;

    // Interactive programs can carry stale file metadata after being copied or
    // assigned. Their workout days are the authoritative signal.
    if (mode === 'NORMAL' || hasInteractiveDays) {
      return false;
    }

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getBackendFileWorkoutResourceType(plan: any): 'PDF' | 'EXCEL' {
    const type = String(plan?.resourceType || '').toUpperCase();
    const fileName = String(plan?.originalFileName || plan?.fileName || '').toLowerCase();

    if (type === 'PDF' || fileName.endsWith('.pdf')) {
      return 'PDF';
    }

    return 'EXCEL';
  }


  private toCalendarDateOnly(value: any): string | null {
    if (!value) return null;

    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) return null;

    return this.formatDateToYYYYMMDD(date);
  }

  private getNormalizedWorkoutEndDate(plan: any, startDate: string | null, isFile: boolean): string | null {
    const endDate = this.toCalendarDateOnly(plan?.endDate);

    if (!startDate) {
      return endDate;
    }

    if (endDate && endDate >= startDate) {
      return endDate;
    }

    if (isFile) {
      return startDate;
    }

    const totalDays = (plan?.workoutDays || []).length || 1;
    return this.addDays(startDate, Math.max(totalDays - 1, 0));
  }


  private getUniqueWorkoutDaysByDayNumber(days: any[]): any[] {
    const map = new Map<number, any>();

    (days || []).forEach((day, index) => {
      const key = Number(day?.dayNumber || index + 1);

      if (!map.has(key)) {
        map.set(key, day);
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([, day]) => day);
  }

  getCalendarCardProgramName(item: WorkoutProgram | NutritionProgram): string {
    return item.programName || item.title || this.translate.instant('PROGRAM');
  }

  getCalendarCardDayLabel(item: WorkoutProgram | NutritionProgram): string {
    const dayNumber = Number((item as WorkoutProgram | NutritionProgram).dayNumber || this.extractDayNumber(item.title) || 1);
    const weekNumber = Math.max(1, Math.ceil(dayNumber / 7));
    return this.translate.instant('WEEK_DAY_LABEL', { week: weekNumber, day: dayNumber });
  }

  /* ---- Month and week cards: the workout's name, its number of exercises and its status, as in the client's
          « Programmes » tab (the exercises are listed in the day view). ---- */

  calendarExerciseCount(item: WorkoutProgram): number {
    return (item.sessions || []).reduce((count, session) => count + (session.exercises?.length || 0), 0);
  }

  /** The workout's name (its session), else its week and day. */
  calendarWorkoutName(item: WorkoutProgram): string {
    const name = (item.sessions || []).find(session => session.exercises?.length)?.notes?.trim();
    // "Main Session": the name the builders give a new workout, shown in the coach's language.
    if (name === 'Main Session') return this.translate.instant('CLIENT_PROGRAMS.DAY_SESSION');
    return name || this.getCalendarCardDayLabel(item);
  }

  /** "6 exercices" (nothing for a rest or empty day). */
  calendarWorkoutMeta(item: WorkoutProgram): string {
    const count = this.calendarExerciseCount(item);
    if (item.restDay || !count) return '';
    return this.translate.instant(count === 1 ? 'CLIENT_PROGRAMS.EXERCISES_ONE' : 'CLIENT_PROGRAMS.EXERCISES', { count });
  }

  /** The day's status and its color: done, missed, today, planned, rest, empty. */
  calendarDayStatus(item: WorkoutProgram | NutritionProgram, date: string, workout: boolean): { tone: string; text: string } {
    const kind = workout ? 'WORKOUT' : 'NUTRITION';
    const t = (key: string) => this.translate.instant(`CLIENT_PROGRAMS.${key}`);
    const rest = workout ? (item as WorkoutProgram).restDay : (item as NutritionProgram).cheatMeal;
    if (rest) return { tone: 'rest', text: t(`STATUS_REST_${kind}`) };
    const empty = workout ? !this.calendarExerciseCount(item as WorkoutProgram) : !!item.emptyDay;
    if (empty) return { tone: 'empty', text: t('STATUS_EMPTY') };
    const status = String((item as { status?: string }).status || 'PENDING').toUpperCase();
    if (status === 'COMPLETED' || status === 'OFF_PLAN') return { tone: 'done', text: t(`STATUS_DONE_${kind}`) };
    if (status === 'MISSED') return { tone: 'missed', text: t(`STATUS_MISSED_${kind}`) };
    // Started but not finished: never « Manquée ».
    if ((item as { done?: boolean }).done) return { tone: 'partial', text: t(`STATUS_PARTIAL_${kind}`) };
    const today = this.toCalendarDateOnly(new Date()) || '';
    if (date === today) return { tone: 'today', text: t('STATUS_TODAY') };
    if (date && today && date < today) return { tone: 'missed', text: t(`STATUS_MISSED_${kind}`) };
    return { tone: 'planned', text: t(`STATUS_PLANNED_${kind}`) };
  }

  /** "2 100 kcal", "Jour libre" or "Vide". */
  calendarNutritionTitle(item: NutritionProgram): string {
    if (item.cheatMeal) return this.translate.instant('CLIENT_PROGRAMS.REST_TITLE_NUTRITION');
    if (item.emptyDay) return this.translate.instant('CLIENT_PROGRAMS.DAY_EMPTY_TITLE');
    if (item.totalCalories > 0) {
      return this.translate.instant('CLIENT_PROGRAMS.KCAL', { count: Math.round(item.totalCalories).toLocaleString(this.calendarLocale) });
    }
    return this.getCalendarCardDayLabel(item);
  }

  /** "P 150 g · G 200 g · L 60 g". */
  calendarMacros(item: NutritionProgram): string {
    if (item.cheatMeal || item.emptyDay || !(item.totalProtein || item.totalCarbs || item.totalFat)) return '';
    return this.translate.instant('CALENDAR_MACROS_SHORT', {
      protein: Math.round(item.totalProtein || 0),
      carbs: Math.round(item.totalCarbs || 0),
      fat: Math.round(item.totalFat || 0),
    });
  }

  private extractDayNumber(value: string | undefined): number | null {
    const match = String(value || '').match(/day\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBackendToWorkoutPrograms(plans: any[]): WorkoutProgram[] {
    const result: WorkoutProgram[] = [];

    // Each program as it is (K5): two programs of the same name and dates are both shown.
    plans.forEach((plan) => {
      const startDate = this.toCalendarDateOnly(plan.startDate) || this.toCalendarDateOnly(plan.workoutDays?.[0]?.date);

      const uniqueWorkoutDays = this.getUniqueWorkoutDaysByDayNumber(plan.workoutDays || []);

      uniqueWorkoutDays.forEach((day: any) => {
        const date = startDate
          ? this.addDays(startDate, (day.dayNumber ?? 1) - 1)
          : this.toCalendarDateOnly(day.date) || day.date;

        const sessions: WorkoutSession[] = (day.workoutSessions || []).map(
          (session: any, sIndex: number) => ({
            id: session.id || `${plan.id}-session-${sIndex}`,
            notes: session.name,
            exercises: (session.exercises || []).map(
              (ex: any, exIndex: number) => ({
                id: ex.id || `${plan.id}-ex-${exIndex}`,
                name: ex.name,
                type: ex.type === 'CARDIO' ? 'cardio' : 'strength',
                youtubeUrl: ex.youtubeUrl || ex.videoUrl || ex.videoLink || undefined,
                supersetGroupId: ex.supersetGroupId || null,
                duration:
                  ex.duration ??
                  ex.durationMin ??
                  ex.durationMinutes ??
                  (ex.sets || []).reduce(
                    (sum: number, set: any) => sum + (Number(set.duration) || 0),
                    0
                  ),
                sets: (ex.sets || []).map((set: any, setIndex: number) => ({
                  id: `${ex.id || plan.id}-set-${setIndex}`,
                  number: set.setNumber ?? setIndex + 1,
                  duration: set.duration,
                  weight: set.weight ?? 0,
                  type: set.type || 'REGULAR',
                  reps:
                    set.reps !== undefined && set.reps !== null
                      ? String(set.reps)
                      : '',
                  rest: String((set.restMin ?? 0) * 60 + (set.restSec ?? 0)),
                })),
              })
            ),
          })
        );

        result.push({
          id: day.id || day._id,
          title: day.title || `Day ${day.dayNumber || ''}`.trim(),
          date,
          clientId: plan.client?.id,
          programId: plan.id,
          programName: plan.name,
          dayNumber: day.dayNumber ?? 1,
          sessions,
          status: day.status || 'PENDING',
          done: workoutDayActive(day),
          raw: day,
          restDay: day.restDay,
          // As the server reads a day (ProgramDays.workoutDay): a session without exercises is an empty day.
          emptyDay: !day.restDay && !sessions.some((session) => session.exercises.length > 0),
        });
      });
    });

    return result;
  }


  addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this.formatDateToYYYYMMDD(d);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isFileNutritionPlan(plan: any): boolean {
    const mode = String(plan?.nutritionPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl
    );
  }

  mapBackendToNutritionPrograms(plans: any[]): NutritionProgram[] {
    const result: NutritionProgram[] = [];

    plans.forEach((plan) => {
      this.nutritionDays(plan).forEach((day: any) => {
        const hasMeals = !!day.meals && day.meals.length > 0;

        const hasTargets =
          !!day.dayTargets &&
          ((day.dayTargets.calories ?? 0) > 0 ||
            (day.dayTargets.proteinG ?? 0) > 0 ||
            (day.dayTargets.carbsG ?? 0) > 0 ||
            (day.dayTargets.fatG ?? 0) > 0);

        const isEmptyDay =
          !hasMeals && !hasTargets && !day.cheatMeal && !day.refeedDay;

        if (isEmptyDay) {
          result.push({
            id: `${plan.id}-empty-${day.date}`,
            title: plan.name,
            date: day.date,
            clientId: plan.client?.id,
            programId: plan.id,
            dayId: day.id,
            trackingMode: plan.trackingMode,
            planKind: nutritionPlanKind(plan),
            programName: plan.name,
            dayNumber: day.dayNumber ?? 1,
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            meals: [],
            emptyDay: true,
            done: mealDayActive(day),
            raw: day,
          });
          return;
        }

        const meals: NutritionMeal[] = (day.meals || []).map(
          (meal: any, i: number) => ({
            id: meal.id || `${plan.id}-meal-${i}`,
            name: meal.name || `Meal ${i + 1}`,
            foods: (meal.foods || []).map((food: any) => ({
              name: food.name,
              quantity: food.quantity,
              ...lineMacros(food),
            })),
          })
        );

        result.push({
          id: `${plan.id}-${day.date}`,
          title: plan.name,
          date: day.date,
          clientId: plan.client?.id,
          programId: plan.id,
          dayId: day.id,
          trackingMode: plan.trackingMode,
          planKind: nutritionPlanKind(plan),
          programName: plan.name,
          dayNumber: day.dayNumber ?? 1,
          totalCalories: day.dayTargets?.calories ?? 0,
          totalProtein: day.dayTargets?.proteinG ?? 0,
          totalCarbs: day.dayTargets?.carbsG ?? 0,
          totalFat: day.dayTargets?.fatG ?? 0,
          meals,
          cheatMeal: !!day.cheatMeal,
          status: day.status || 'PENDING',
          done: mealDayActive(day),
          raw: day,
        });
      });
    });

    return result;
  }

  /**
   * The plan's days on their dates, as they are (K5): a plan shorter than its dates shows nothing after its last day
   * (no copies of it). The number is the day's place in the plan, the one the editor opens (`?day=N`).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nutritionDays(plan: any): any[] {
    const startDate = this.toCalendarDateOnly(plan?.startDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (plan?.mealDays || []).flatMap((day: any, index: number) => {
      const date = this.toCalendarDateOnly(day?.date) || (startDate ? this.addDays(startDate, index) : null);
      return date ? [{ ...day, date, dayNumber: index + 1 }] : [];
    });
  }

  private daysBetween(startDate: string, endDate: string): number {
    const start = this.parseCalendarDate(startDate);
    const end = this.parseCalendarDate(endDate);

    if (!start || !end || end < start) {
      return 0;
    }

    return Math.floor((end.getTime() - start.getTime()) / 86400000);
  }

  formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.formatDateToYYYYMMDD(today) === this.formatDateToYYYYMMDD(date);
  }

  getMonthLabel(): string {
    return this.currentDate.toLocaleDateString(this.calendarLocale, {
      month: 'long',
      year: 'numeric',
    });
  }

  getWeekLabel(): string {
    const days = this.getWeekDates();
    const first = days[0];
    const last = days[6];

    const startStr = first.toLocaleDateString(this.calendarLocale, {
      day: 'numeric',
      month: 'short',
    });
    const endStr = last.toLocaleDateString(this.calendarLocale, {
      day: 'numeric',
      month: 'short',
      year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric',
    });

    return this.translate.instant('CALENDAR_WEEK_RANGE', { start: startStr, end: endStr });
  }

  getDayLabel(): string {
    return this.currentDate.toLocaleDateString(this.calendarLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private get calendarLocale(): string {
    return this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US';
  }

  getWeekDates(): Date[] {
    const startOfWeek = new Date(this.currentDate);
    const day = this.currentDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(this.currentDate.getDate() + diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }

  goPrev(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() - 1,
        1
      );
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 1);
      this.currentDate = d;
    }
    this.showPeriod();
  }

  goNext(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
        1
      );
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 1);
      this.currentDate = d;
    }
    this.showPeriod();
  }

  /**
   * The screen of the current view, computed here once when the data, the period, the type or the settings change
   * (the template reads fields, not getters run at each check).
   */
  updateMonthGrid(): void {
    this.indexItems();
    this.monthWeeks = [];
    this.weekPlan = null;
    this.monthDay = null;
    if (this.currentView === 'month') {
      this.monthWeeks = this.buildMonthWeeks();
      this.monthDay = this.selectedDate ? this.monthDayOf(this.selectedDate) : null;
    } else if (this.currentView === 'week') {
      this.weekPlan = this.buildWeekPlan();
      // The day open under the week stays open while it is in the week shown.
      if (this.selectedDate && !this.weekPlan.days.some((day) => day.dateString === this.selectedDate)) {
        this.selectedDate = null;
        this.dayFocus = null;
      }
    }
    const detailDate = this.currentView === 'day' ? this.currentDayString : this.currentView === 'week' ? this.selectedDate : null;
    this.dayDetail = detailDate ? this.buildDayDetail(detailDate) : null;
  }

  /** The days of each type by date (one pass over the programs), the tasks and the check-ins by date. */
  private indexItems(): void {
    const byDate = <T extends { date: string; clientId?: string }>(items: T[]): Map<string, T[]> => {
      const index = new Map<string, T[]>();
      if (!this.selectedClient) return index;
      items
        .filter((item) => item.clientId === this.selectedClient)
        .forEach((item) => {
          const list = index.get(item.date);
          if (list) list.push(item);
          else index.set(item.date, [item]);
        });
      return index;
    };
    this.workoutByDate = byDate<WorkoutProgram>(this.workoutPrograms);
    this.nutritionByDate = byDate<NutritionProgram>(this.nutritionPrograms);
    this.itemsByDate = (this.calendarType === 'workout' ? this.workoutByDate : this.nutritionByDate) as Map<string, (WorkoutProgram | NutritionProgram)[]>;
    const tasks = new Map<string, TaskCalendarItem[]>();
    [...this.tasksByMonth.values()].flat().forEach((item) => {
      const date = String(item.date || '').slice(0, 10);
      tasks.set(date, [...(tasks.get(date) || []), item]);
    });
    this.tasksByDate = tasks;
    const checkIns = new Map<string, CalendarCheckIn[]>();
    [...this.checkInsByMonth.values()].flat().forEach((item) => {
      const date = String(item.date || '').slice(0, 10);
      checkIns.set(date, [...(checkIns.get(date) || []), item]);
    });
    this.checkInsByDate = checkIns;
  }

  getItemsForDay(dateStr: string): (WorkoutProgram | NutritionProgram)[] {
    return this.itemsByDate.get(dateStr) || [];
  }

  /**
   * The week in rows (lot C, L1): Entraînement, Nutrition, Tâches, Check-ins. A check-in task is shown once, in the
   * check-ins row (its assignment), never also as a task.
   */
  private buildWeekPlan(): WeekPlan {
    const days: WeekRowDay[] = this.getWeekDates().map((date) => this.rowDay(date));
    const dates = days.map((day) => day.dateString);
    const workout = weekBands(dates, this.visibleFilesOf('workout'), new Set<string>());
    const nutrition = weekBands(dates, this.visibleFilesOf('nutrition'), new Set<string>());
    days.forEach((day, col) => {
      day.workoutCovered = workout.covered[col];
      day.nutritionCovered = nutrition.covered[col];
    });
    const rows = (lanes: number) => [...Array.from({ length: lanes }, () => '30px'), 'minmax(64px, auto)'].join(' ');
    return {
      days,
      workoutBands: workout.bands,
      nutritionBands: nutrition.bands,
      workoutRows: rows(workout.lanes),
      nutritionRows: rows(nutrition.lanes),
    };
  }

  /** A day's cards (the week and the month show the same): its program days, its tasks and check-ins. */
  private rowDay(date: Date): WeekRowDay {
    const dateString = this.formatDateToYYYYMMDD(date);
    const checkIns = this.checkInsByDate.get(dateString) || [];
    const tasks = (this.tasksByDate.get(dateString) || [])
      .filter((task) => !(task.taskType === 'FORM' && checkIns.some((checkIn) => checkIn.id === task.formAssignmentId)));
    return {
      date,
      dateString,
      dayNumber: date.getDate(),
      isToday: this.isToday(date),
      weekdayLabel: date.toLocaleDateString(this.calendarLocale, { weekday: 'short' }),
      workout: (this.workoutByDate.get(dateString) || []).map((item) => this.workoutCell(item, dateString)),
      nutrition: (this.nutritionByDate.get(dateString) || []).map((item) => this.nutritionCell(item, dateString)),
      tasks,
      tasksDone: tasks.filter((task) => task.status === 'DONE').length,
      tasksTone: tasksTone(tasks),
      checkIns,
      workoutCovered: false,
      nutritionCovered: false,
      files: [...this.visibleFilesOf('workout'), ...this.visibleFilesOf('nutrition')]
        .filter((file) => file.start <= dateString && dateString <= file.end),
    };
  }

  /** A workout cell: the workout's name, how far the client went (or its exercises), its status. */
  private workoutCell(item: WorkoutProgram, date: string): WeekCell<WorkoutProgram> {
    const status = this.calendarDayStatus(item, date, true);
    let meta = this.calendarWorkoutMeta(item);
    if (item.done && !item.restDay) {
      const report = workoutReport(item.raw);
      // Nothing ticked (finished without checking the exercises): « 0/2 faits » next to « Terminée » would mislead.
      if (report.exercises.length && report.loggedExercises > 0) {
        meta = this.translate.instant('CALENDAR_EXERCISES_DONE', { done: report.doneExercises, total: report.exercises.length });
      }
    }
    return {
      item,
      title: item.restDay ? this.translate.instant('CLIENT_PROGRAMS.REST_TITLE_WORKOUT') : this.calendarWorkoutName(item),
      meta,
      status,
      exercises: item.restDay ? [] : exerciseLines(item.raw),
      // A workout or a rest day moves; an empty day has nothing to move (a workout is dropped onto it).
      movable: !!item.programId && !item.emptyDay && !this.isDayLocked(item),
    };
  }

  /** A nutrition cell: the day's target, the meals the client reported (or the macros), its status. */
  private nutritionCell(item: NutritionProgram, date: string): WeekCell<NutritionProgram> {
    const report = nutritionReport(item.raw);
    const meta = report.reported
      ? this.translate.instant('CALENDAR_MEALS_REPORTED', { done: report.reported, total: report.meals.length })
      : this.calendarMacros(item);
    return {
      item,
      title: this.calendarNutritionTitle(item),
      meta,
      status: this.calendarDayStatus(item, date, false),
      meals: item.cheatMeal ? [] : mealLines(item.raw),
    };
  }

  /** The files of one type, when the coach's settings use them for it (K4). */
  private visibleFilesOf(type: CalendarType): CalendarFile[] {
    if (!this.settingsKnown || !this.selectedClient) return [];
    if (type === 'workout') return this.workoutFileEnabled ? this.workoutFiles : [];
    return this.nutritionFileEnabled ? this.nutritionFiles : [];
  }

  /** « Ce jour-là » (lot C, L2-L3): every program day, file, task and check-in of that date, with what the client did. */
  private buildDayDetail(date: string): DayDetail {
    const checkIns = this.checkInsByDate.get(date) || [];
    const parsed = this.parseCalendarDate(date) || new Date();
    const files = (['workout', 'nutrition'] as CalendarType[]).flatMap((kind) => this.visibleFilesOf(kind)
      .filter((file) => file.start <= date && date <= file.end)
      .map((file) => ({ file, kind, day: this.daysBetween(file.start, date) + 1, total: this.daysBetween(file.start, file.end) + 1 })));
    const past = date < todayIso();
    // The row clicked in the week: only its subject (the day view and a click on the day itself: everything).
    const focus = this.currentView === 'week' ? this.dayFocus : null;
    const shows = (subject: DaySubject) => !focus || focus === subject;
    return {
      date,
      focus,
      label: parsed.toLocaleDateString(this.calendarLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      workouts: (shows('workout') ? this.workoutByDate.get(date) || [] : []).map((item) => ({
        item,
        report: workoutReport(item.raw),
        status: this.calendarDayStatus(item, date, true),
        locked: this.isDayLocked(item),
        lines: exerciseLines(item.raw),
      })),
      nutrition: (shows('nutrition') ? this.nutritionByDate.get(date) || [] : []).map((item) => ({
        item,
        report: nutritionReport(item.raw),
        status: this.calendarDayStatus(item, date, false),
        meals: mealLines(item.raw),
      })),
      files: files.filter((entry) => shows(entry.kind)),
      tasks: (shows('tasks') ? this.tasksByDate.get(date) || [] : [])
        .filter((task) => !(task.taskType === 'FORM' && checkIns.some((checkIn) => checkIn.id === task.formAssignmentId))),
      checkIns: shows('checkins') ? checkIns : [],
      addWorkout: shows('workout') && !past && !this.workoutByDate.get(date)?.length && !files.some((entry) => entry.kind === 'workout'),
      addNutrition: shows('nutrition') && !past && !this.nutritionByDate.get(date)?.length
        && !files.some((entry) => entry.kind === 'nutrition'),
    };
  }

  /* ---- The week in rows and the day panel: what the coach clicks (lot C). ---- */

  /* ---- The detail of the days (as a coach's program sheet) and the quick changes (lot C, C4). ---- */

  /** The week shows each day's exercises and meals; off, one line per day (the coach's choice, kept on this browser). */
  weekDetailed = this.readDetailChoice();

  private readDetailChoice(): boolean {
    try {
      return localStorage.getItem('yo-coach.calendar-detail') !== 'off';
    } catch {
      return true;
    }
  }

  toggleWeekDetail(): void {
    this.weekDetailed = !this.weekDetailed;
    try {
      localStorage.setItem('yo-coach.calendar-detail', this.weekDetailed ? 'on' : 'off');
    } catch {
      // No storage: the choice lasts until the page closes.
    }
  }

  /** « 3 × 10 · 60 kg · repos 2 min », « 20 min ». */
  exerciseText(line: ExerciseLine): string {
    const sets = this.setsText(line.sets, line.cardio);
    if (!line.restSeconds) return sets;
    const minutes = Math.floor(line.restSeconds / 60);
    const seconds = line.restSeconds % 60;
    const rest = minutes ? (seconds ? `${minutes} min ${seconds}` : `${minutes} min`) : `${seconds} s`;
    return [sets, this.translate.instant('CALENDAR_REST', { time: rest })].filter(Boolean).join(' · ');
  }

  /** « Avoine 80 g, Œufs 3, Banane 1 +2 ». */
  mealFoods(meal: MealLine): string {
    const shown = meal.foods.slice(0, 4).join(', ');
    return meal.foods.length > 4 ? `${shown} +${meal.foods.length - 4}` : shown;
  }

  /* Drag a workout onto another day of its program (C4): the two days change places; on an empty day it moves there. */
  dragging: WorkoutProgram | null = null;
  dropDate: string | null = null;
  movingDay = false;

  onDayDragStart(event: DragEvent, cell: WeekCell<WorkoutProgram>): void {
    if (!cell.movable || this.movingDay) {
      event.preventDefault();
      return;
    }
    this.dragging = cell.item;
    event.dataTransfer?.setData('text/plain', cell.item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDayDragEnd(): void {
    this.dragging = null;
    this.dropDate = null;
  }

  /** The day of the dragged workout's program on that date, when the workout can go there (K1-K3, C4). */
  private dropTargetOf(day: WeekRowDay): WorkoutProgram | null {
    const moving = this.dragging;
    if (!moving || day.dateString === moving.date || day.dateString < todayIso()) return null;
    const target = day.workout.find((cell) => cell.item.programId === moving.programId)?.item || null;
    return target && !this.isDayLocked(target) ? target : null;
  }

  onDayDragOver(event: DragEvent, day: WeekRowDay): void {
    if (!this.dropTargetOf(day)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropDate = day.dateString;
  }

  onDayDragLeave(day: WeekRowDay): void {
    if (this.dropDate === day.dateString) this.dropDate = null;
  }

  onDayDrop(event: DragEvent, day: WeekRowDay): void {
    event.preventDefault();
    const moving = this.dragging;
    const target = this.dropTargetOf(day);
    this.onDayDragEnd();
    if (!moving?.programId || !target) return;
    this.movingDay = true;
    this.programSchedule.swapDays(moving.programId, moving.id, target.id)
      .pipe(finalize(() => (this.movingDay = false)))
      .subscribe({
        next: (result) => {
          const date = (value: string) => (this.parseCalendarDate(value) || new Date())
            .toLocaleDateString(this.calendarLocale, { weekday: 'long', day: 'numeric', month: 'long' });
          const title = target.emptyDay
            ? this.translate.instant('CALENDAR_DAY_MOVED', { date: date(target.date) })
            : this.translate.instant('CALENDAR_DAYS_SWAPPED', { first: date(moving.date), second: date(target.date) });
          const details = result.restedDayId ? [this.translate.instant('CALENDAR_LEFT_REST', { date: date(moving.date) })] : [];
          // The toast reads the calendar again (and offers « Annuler »).
          this.programSchedule.announceCalendarChange(result.undoId, title, details);
        },
        error: (err) => this.toast.error(this.calendarChangeError(err)),
      });
  }

  /** Why the server refused a change of a day (K1-K3, A9). */
  private calendarChangeError(err: any): string {
    const code = err?.error?.code;
    if (code === 'PROGRAM_LOCKED') return this.translate.instant('ASSIGN_FLOW.LOCKED_ERROR');
    if (code === 'DAY_DONE') return this.translate.instant('CALENDAR_DAY_DONE');
    if (code === 'DAY_PAST') return this.translate.instant('CALENDAR_DAY_PAST_MOVE');
    if (code === 'PROGRAM_GAP') return this.translate.instant('CALENDAR_CHANGE_GAP');
    return this.translate.instant('CALENDAR_CHANGE_ERROR');
  }

  /* « Copier une semaine » (C4): the editor's « Dupliquer la semaine » window, onto empty days only (the user's choice). */
  copyWeek: { programId: string; dayCount: number; sourceWeek: number; filled: boolean[]; locked: boolean[] } | null = null;

  /** The workout program of the week shown (the one with the most days in it), with its days as the window reads them. */
  openCopyWeek(): void {
    const days = this.getWeekDates().map((date) => this.formatDateToYYYYMMDD(date));
    const today = todayIso();
    const program = this.workoutRanges
      .filter((range) => !range.locked && range.start <= days[6] && days[0] <= range.end)
      .sort((a, b) => days.filter((date) => b.start <= date && date <= b.end).length
        - days.filter((date) => a.start <= date && date <= a.end).length)[0];
    const plan = program ? this.workoutPlansById.get(program.programId) : null;
    if (!program || !plan) {
      this.toast.info(this.translate.instant('CALENDAR_COPY_NO_PROGRAM'));
      return;
    }
    const dayCount = Math.max((plan.workoutDays || []).length, this.daysBetween(program.start, program.end) + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dayAt = (index: number) => (plan.workoutDays || []).find((day: any) => Number(day?.dayNumber) === index + 1);
    const filled = Array.from({ length: dayCount }, (_, index) => {
      const day = dayAt(index);
      return !!day && (day.restDay === true || workoutReport(day).exercises.length > 0);
    });
    const locked = Array.from({ length: dayCount }, (_, index) =>
      this.addDays(program.start, index) < today || workoutDayActive(dayAt(index)));
    const first = days[0] < program.start ? program.start : days[0];
    this.copyWeek = {
      programId: program.programId,
      dayCount,
      sourceWeek: Math.floor(this.daysBetween(program.start, first) / 7) + 1,
      filled,
      locked,
    };
  }

  confirmCopyWeek(copies: DayCopy[]): void {
    const target = this.copyWeek;
    this.copyWeek = null;
    if (!target || !copies.length) return;
    this.programSchedule.copyDays(target.programId,
      copies.map((copy) => ({ from: (copy.from ?? 0) + 1, to: copy.to + 1 })))
      .subscribe({
        next: (result) => {
          const start = this.workoutRanges.find((range) => range.programId === target.programId)?.start || '';
          const date = (day: number) => (this.parseCalendarDate(this.addDays(start, day - 1)) || new Date())
            .toLocaleDateString(this.calendarLocale, { weekday: 'short', day: 'numeric', month: 'short' });
          const details = result.skipped
            .filter((skip) => skip.reason !== 'EMPTY_SOURCE')
            .map((skip) => this.translate.instant(`CALENDAR_COPY_SKIPPED_${skip.reason}`, { date: date(skip.day) }));
          this.programSchedule.announceCalendarChange(result.undoId,
            this.translate.instant(result.copied.length === 1 ? 'CALENDAR_DAYS_COPIED_ONE' : 'CALENDAR_DAYS_COPIED',
              { count: result.copied.length }), details);
        },
        error: (err) => this.toast.error(this.calendarChangeError(err)),
      });
  }

  /** « Mettre en pause » the client from the calendar (the window of the client's tabs, DS-11). */
  showPause = false;

  /** A day of the week clicked: its panel opens under the week (again: it closes). */
  /**
   * A day of the week clicked: its card or chip shows only that subject under the week (`focus`), the day itself
   * shows everything. The same click again closes it.
   */
  selectDay(date: string, focus: DaySubject | null = null): void {
    const same = this.selectedDate === date && this.dayFocus === focus;
    this.selectedDate = same ? null : date;
    this.dayFocus = same ? null : focus;
    this.dayDetail = this.selectedDate ? this.buildDayDetail(this.selectedDate) : null;
    if (this.selectedDate) {
      // Once drawn: the panel comes into view (it is under the week).
      setTimeout(() => document.querySelector('.day-panel')?.scrollIntoView({ behavior: 'smooth', block: this.narrow ? 'start' : 'nearest' }));
    }
  }

  /** « Voir toute la journée » in a panel showing one subject. */
  showWholeDay(): void {
    if (!this.selectedDate) return;
    this.dayFocus = null;
    this.dayDetail = this.buildDayDetail(this.selectedDate);
  }

  /** The subject shown alone in the panel, in words (« Nutrition »). */
  focusLabel(focus: DaySubject): string {
    const subject = this.monthSubjects.find((item) => item.key === focus);
    return subject ? this.translate.instant(subject.label) : '';
  }

  closeDay(): void {
    this.selectedDate = null;
    this.dayFocus = null;
    this.dayDetail = null;
  }

  /** The workout day in the program's editor (L4): changed there, or read there when done or past (K1). */
  openWorkoutEditor(item: WorkoutProgram): void {
    if (item.programId && this.selectedClient) {
      this.openEditor(['/clients/create-workout', this.selectedClient, 'edit', item.programId], item.dayNumber);
    }
  }

  /** « Décaler la suite » of the program of that day: the window of the client's tabs. */
  shiftFrom(kind: CalendarType, item: WorkoutProgram | NutritionProgram): void {
    if (!item.programId) return;
    this.shiftTarget = {
      kind: kind === 'workout' ? 'WORKOUT' : 'NUTRITION',
      item: { id: item.programId, name: item.programName || item.title } as OverviewItem,
    };
  }

  onShiftSaved(): void {
    this.shiftTarget = null;
    this.loadCalendar();
  }

  /** A program not stopped nor finished: its days can still move (A9). */
  /**
   * « Retirer ce programme »: the window opens at once with the days the client did as the calendar knows them, then
   * with the tab's own figures (the same request as the « Programmes » tab), so it says exactly what the tab says.
   */
  removeFrom(kind: CalendarType, item: WorkoutProgram | NutritionProgram): void {
    const id = item.programId;
    if (!id || !this.selectedClient) return;
    const plan = (kind === 'workout' ? this.workoutPlansById : this.mealPlansById).get(id);
    const days: unknown[] = (kind === 'workout' ? plan?.workoutDays : plan?.mealDays) || [];
    const doneDays = days.filter((day) => (kind === 'workout' ? workoutDayActive(day) : mealDayActive(day))).length;
    this.removeTarget = { kind, item: { id, name: item.programName || item.title, file: false, doneDays } as OverviewItem };
    this.programSchedule.overview(kind === 'workout' ? 'WORKOUT' : 'NUTRITION', this.selectedClient).subscribe({
      next: (overview) => {
        const found = [overview.current?.program, overview.next?.program, ...overview.upcoming, ...overview.finished]
          .find((program) => program?.id === id);
        if (found && this.removeTarget?.item.id === id && !this.removing) this.removeTarget = { kind, item: found };
      },
      error: () => {
        // The calendar's figures stay.
      },
    });
  }

  confirmRemove(): void {
    const target = this.removeTarget;
    if (!target || this.removing) return;
    this.removing = true;
    const removal = target.kind === 'workout'
      ? this.workoutService.deleteWorkout(target.item.id, true)
      : this.nutritionService.deleteNutritionPlan(target.item.id, true);
    removal.subscribe({
      next: () => {
        this.removing = false;
        this.removeTarget = null;
        this.toast.show({ type: 'success', title: this.translate.instant('CLIENT_PROGRAMS.REMOVED') });
        // The calendar reads its months again, the client's tabs too.
        this.programSchedule.changed$.next();
      },
      error: () => {
        this.removing = false;
        this.toast.show({ type: 'error', title: this.translate.instant('CLIENT_PROGRAMS.REMOVE_FAILED') });
      },
    });
  }

  canShift(item: WorkoutProgram | NutritionProgram): boolean {
    const ranges = this.workoutRanges.some((range) => range.programId === item.programId) ? this.workoutRanges : this.nutritionRanges;
    const range = ranges.find((candidate) => candidate.programId === item.programId);
    return !!range && !range.locked;
  }

  /** A check-in's answers: the window of the client profile (inside it), else the profile opens on it. */
  openCheckIn(checkIn: CalendarCheckIn): void {
    if (this.profileAction.observed) {
      // The window's title is the form's name (as in the check-ins tab, which adds it to its assignments).
      this.profileAction.emit({ type: 'checkin', assignment: { ...checkIn, formName: checkIn.title } });
      return;
    }
    this.rememberPlace();
    void this.router.navigate(['/clients/profil-client', this.selectedClient], { queryParams: { tab: 'checkins', assignmentId: checkIn.id } });
  }

  /** « Envoyer un message »: the client's Discussion tab. */
  sendMessage(): void {
    if (this.profileAction.observed) {
      this.profileAction.emit({ type: 'chat' });
      return;
    }
    this.rememberPlace();
    void this.router.navigate(['/clients/profil-client', this.selectedClient], { queryParams: { tab: 'chat' } });
  }

  /** « 4 × 8 · 60 kg », « 8, 8, 7 · 62 kg », « 20 min ». */
  setsText(lines: { reps: number | null; weight: number | null; duration: number | null }[], cardio: boolean): string {
    if (!lines.length) return '';
    if (cardio) {
      const minutes = lines.reduce((sum, line) => sum + (line.duration || 0), 0);
      return minutes ? `${lines.length > 1 ? `${lines.length} × ` : ''}${Math.round(minutes / lines.length)} min` : `${lines.length}`;
    }
    const reps = lines.map((line) => (line.reps == null ? '–' : String(line.reps)));
    const sameReps = reps.every((value) => value === reps[0]);
    const weights = lines.map((line) => line.weight).filter((weight): weight is number => weight != null && weight > 0);
    const weight = weights.length ? ` · ${Math.max(...weights)} ${this.weightUnitLabel}` : '';
    return (sameReps ? `${lines.length} × ${reps[0]}` : reps.join(', ')) + weight;
  }

  exerciseStateText(state: string): string {
    return this.translate.instant(`CALENDAR_EXERCISE_${state}`);
  }

  mealStateText(state: string): string {
    return this.translate.instant(state ? `CALENDAR_MEAL_${state}` : 'CALENDAR_MEAL_NONE');
  }

  taskStateText(status: string): string {
    return this.translate.instant(`CALENDAR_TASK_${status || 'UPCOMING'}`);
  }

  checkInTone(checkIn: CalendarCheckIn): string {
    return checkInTone(checkIn.state);
  }

  checkInStateText(checkIn: CalendarCheckIn): string {
    if (checkIn.state === 'RECEIVED') return this.translate.instant(checkIn.reviewed ? 'CALENDAR_CHECKIN_REVIEWED' : 'CALENDAR_CHECKIN_RECEIVED');
    return this.translate.instant(checkIn.state === 'LATE' ? 'CALENDAR_CHECKIN_LATE' : 'CALENDAR_CHECKIN_UPCOMING');
  }

  trackDay(_: number, day: { dateString: string }): string {
    return day.dateString;
  }

  /**
   * A feeling of the nutrition day in the coach's language. The web app saves LOW / GOOD / HIGH..., the mobile app
   * the label of the client's language (« Low », « Faible »...): both read the same; an unknown value shows as it is.
   */
  feelingText(kind: 'HUNGER' | 'ENERGY' | 'DIGESTION', value: string): string {
    const levels: Record<string, string> = {
      low: 'LOW', faible: 'LOW', basse: 'LOW',
      good: 'GOOD', balanced: 'GOOD', 'équilibrée': 'GOOD', steady: 'GOOD', stable: 'GOOD', bonne: 'GOOD',
      high: 'HIGH', 'élevée': 'HIGH', haute: 'HIGH',
      poor: 'POOR', mauvaise: 'POOR',
      great: 'GREAT', super: 'GREAT',
    };
    const level = levels[String(value || '').trim().toLowerCase()];
    const key = `CALENDAR_FEELING_${kind}_${level}`;
    const text = level ? this.translate.instant(key) : '';
    return text && text !== key ? text : value;
  }

  /** The day's tasks, one per line, with their state (hint of the tasks cell). */
  tasksHint(tasks: TaskCalendarItem[]): string {
    return tasks.map((task) => `${task.title} · ${this.taskStateText(task.status)}`).join('\n');
  }

  /** The weeks of the month, Monday first; the days of the months around are empty cells. */
  /**
   * The month as a follow-up map (lot C, C3): both types at once, each day with one mark per subject (workout,
   * nutrition, tasks, check-ins) whose symbol says its state, each week with its follow-up rate; the files of both
   * types as bands. A click on a day opens it (« Ce jour-là »).
   */
  private buildMonthWeeks(): CalendarWeek[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const count = this.getDaysInMonth(year, month);
    const lead = (this.getFirstDayOfMonth(year, month) + 6) % 7;
    const seen = new Set<string>();
    // The files of the types chosen, arranged again together (two files never share a row).
    const files = arrangeFiles([
      ...(this.monthShows('workout') ? this.visibleFilesOf('workout') : []),
      ...(this.monthShows('nutrition') ? this.visibleFilesOf('nutrition') : []),
    ].map((file) => ({ ...file })));
    const weeks: CalendarWeek[] = [];
    for (let cell = 0; cell < lead + count; cell += 7) {
      const days = Array.from({ length: 7 }, (_, col) => {
        const day = cell + col - lead + 1;
        if (day < 1 || day > count) return null;
        const calendarDay = this.calendarDay(new Date(year, month, day));
        calendarDay.marks = this.monthMarks(calendarDay.dateString).filter((mark) => this.monthShows(mark.subject));
        calendarDay.plan = this.monthPlan(calendarDay.date);
        return calendarDay;
      });
      const week = this.buildWeek(days, seen, files);
      week.rate = this.followUpRate(days);
      weeks.push(week);
    }
    return weeks;
  }

  /** The marks of a day in the month: what was planned for each subject and how it went (C3). */
  private monthMarks(date: string): MonthMark[] {
    const marks: MonthMark[] = [];
    (this.workoutByDate.get(date) || []).forEach((item) => {
      const status = this.calendarDayStatus(item, date, true);
      const text = item.restDay ? this.translate.instant('CLIENT_PROGRAMS.REST_TITLE_WORKOUT')
        : item.emptyDay ? status.text : this.calendarWorkoutName(item);
      marks.push({ subject: 'workout', icon: 'fitness_center', tone: status.tone, text, hint: item.emptyDay ? text : `${text} · ${status.text}` });
    });
    (this.nutritionByDate.get(date) || []).forEach((item) => {
      const status = this.calendarDayStatus(item, date, false);
      const text = item.emptyDay ? status.text : this.calendarNutritionTitle(item);
      marks.push({ subject: 'nutrition', icon: 'restaurant', tone: status.tone, text, hint: item.emptyDay ? text : `${text} · ${status.text}` });
    });
    const checkIns = this.checkInsByDate.get(date) || [];
    const tasks = (this.tasksByDate.get(date) || [])
      .filter((task) => !(task.taskType === 'FORM' && checkIns.some((checkIn) => checkIn.id === task.formAssignmentId)));
    if (tasks.length) {
      marks.push({
        subject: 'tasks',
        icon: 'checklist',
        tone: tasksTone(tasks) || 'planned',
        text: this.translate.instant('CALENDAR_TASKS_DONE', { done: tasks.filter((task) => task.status === 'DONE').length, total: tasks.length }),
        hint: this.tasksHint(tasks),
      });
    }
    if (checkIns.length) {
      const late = checkIns.some((checkIn) => checkIn.state === 'LATE');
      const received = checkIns.every((checkIn) => checkIn.state === 'RECEIVED');
      marks.push({
        subject: 'checkins',
        icon: 'assignment',
        tone: late ? 'missed' : received ? 'done' : 'planned',
        text: checkIns.length > 1 ? this.translate.instant('CALENDAR_CHECKINS_COUNT', { count: checkIns.length })
          : this.checkInStateText(checkIns[0]),
        hint: checkIns.map((checkIn) => `${checkIn.title || this.translate.instant('CALENDAR_ROW_CHECKINS')} · ${this.checkInStateText(checkIn)}`).join('\n'),
      });
    }
    return marks;
  }

  /** A day's cards in the month: the week's ones, of the subjects chosen only. */
  private monthPlan(date: Date): WeekRowDay {
    const plan = this.rowDay(date);
    if (!this.monthShows('workout')) plan.workout = [];
    if (!this.monthShows('nutrition')) plan.nutrition = [];
    if (!this.monthShows('tasks')) plan.tasks = [];
    if (!this.monthShows('checkins')) plan.checkIns = [];
    plan.files = plan.files.filter((file) => this.monthShows(file.kind || 'workout'));
    return plan;
  }

  monthShows(subject: DaySubject): boolean {
    return this.monthShow.includes(subject);
  }

  /** A subject of the month on or off (one at least stays), kept on this browser. */
  toggleMonthShow(subject: DaySubject): void {
    const on = this.monthShows(subject);
    if (on && this.monthShow.length === 1) return;
    this.monthShow = on ? this.monthShow.filter((item) => item !== subject)
      : this.monthSubjects.map((item) => item.key).filter((key) => key === subject || this.monthShows(key));
    try {
      localStorage.setItem('yo-coach.calendar-month-show', this.monthShow.join(','));
    } catch {
      // No storage: the choice lasts until the page closes.
    }
    this.updateMonthGrid();
  }

  /** The month shows the workouts at first: one subject reads well (CC-24). */
  private readMonthShow(): DaySubject[] {
    const all: DaySubject[] = ['workout', 'nutrition', 'tasks', 'checkins'];
    try {
      const kept = (localStorage.getItem('yo-coach.calendar-month-show') || '').split(',')
        .filter((key): key is DaySubject => all.includes(key as DaySubject));
      return kept.length ? kept : ['workout'];
    } catch {
      return ['workout'];
    }
  }

  private monthDayOf(date: string): CalendarDay | null {
    for (const week of this.monthWeeks) {
      const day = week.days.find((item) => item?.dateString === date);
      if (day) return day;
    }
    return null;
  }

  /** « mardi 20 octobre ». */
  longDate(date: Date): string {
    return date.toLocaleDateString(this.calendarLocale, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** What was due in the week and how much of it was done: done counts 1, started half, missed 0 (C3). */
  private followUpRate(days: (CalendarDay | null)[]): number | null {
    let due = 0;
    let done = 0;
    days.forEach((day) => (day?.marks || []).forEach((mark) => {
      if (mark.tone === 'done') { due++; done++; }
      else if (mark.tone === 'partial') { due++; done += 0.5; }
      else if (mark.tone === 'missed') due++;
    }));
    return due ? Math.round((done / due) * 100) : null;
  }

  /** A day of the month clicked: the day view opens on it (« Ce jour-là »). */
  openDay(date: string): void {
    if (this.narrow && this.currentView === 'month') {
      this.selectedDate = date;
      this.monthDay = this.monthDayOf(date);
      setTimeout(() => document.querySelector('.month-day')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
    this.openDayView(date);
  }

  openDayView(date: string): void {
    const parsed = this.parseCalendarDate(date);
    if (!parsed) return;
    this.currentDate = parsed;
    this.setView('day');
  }

  /** The symbol of a state, in the brand's sober UI: ✓ done, ✗ missed, ◐ started, today, to come, rest, to fill. */
  statusIcon(tone: string | null | undefined): string {
    switch (tone) {
      case 'done': return 'check_circle';
      case 'missed': return 'cancel';
      case 'partial': return 'timelapse';
      case 'today': return 'today';
      case 'rest': return 'bedtime';
      case 'empty': return 'add_circle_outline';
      default: return 'schedule';
    }
  }

  /** A meal's or a task's state as a tone (the same symbols as the days). */
  mealTone(state: string): string {
    return state === 'AS_PLANNED' ? 'done' : state === 'SKIPPED' ? 'missed' : state === 'MODIFIED' ? 'partial' : 'planned';
  }

  taskTone(status: string): string {
    return status === 'DONE' ? 'done' : status === 'MISSED' ? 'missed' : 'planned';
  }

  exerciseTone(state: string): string {
    return state === 'DONE' ? 'done' : state === 'MISSED' ? 'missed' : state === 'PARTIAL' ? 'partial' : 'planned';
  }

  /** « Voir le lundi 3 novembre » for a day of the month (its button). */
  dayLabel(date: Date): string {
    return this.translate.instant('CALENDAR_OPEN_DAY', {
      date: date.toLocaleDateString(this.calendarLocale, { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }

  private calendarDay(date: Date): CalendarDay {
    const dateString = this.formatDateToYYYYMMDD(date);
    return {
      date,
      dateString,
      dayNumber: date.getDate(),
      isToday: this.isToday(date),
      weekdayLabel: date.toLocaleDateString(this.calendarLocale, { weekday: 'short' }).toUpperCase(),
      items: this.getItemsForDay(dateString),
      covered: false,
    };
  }

  /**
   * One row of days and the files over it (K4, `weekBands`). `seen` holds the files already drawn on the screen:
   * only their first piece carries the dates.
   */
  private buildWeek(days: (CalendarDay | null)[], seen: Set<string>, files: CalendarFile[] = this.visibleFiles): CalendarWeek {
    const { bands, lanes, covered } = weekBands(days.map((day) => day?.dateString || null), files, seen);
    days.forEach((day, col) => {
      if (day) day.covered = covered[col];
    });
    return {
      key: days.find(Boolean)?.dateString || '',
      days,
      bands,
      rows: ['auto', ...Array.from({ length: lanes }, () => (this.narrow ? '8px' : '32px')), 'minmax(0, 1fr)'].join(' '),
    };
  }

  trackWeek(_: number, week: CalendarWeek): string {
    return week.key;
  }

  trackBand(_: number, band: FileBand): string {
    return band.file.programId;
  }

  /** « 3 nov. – 30 nov. 2026 ». */
  fileDates(file: CalendarFile): string {
    const date = (value: string, withYear: boolean) => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(this.calendarLocale, {
        day: 'numeric',
        month: 'short',
        year: withYear ? 'numeric' : undefined,
      });
    };
    const sameYear = file.start.slice(0, 4) === file.end.slice(0, 4);
    return `${date(file.start, !sameYear)} – ${date(file.end, true)}`;
  }

  fileKind(file: CalendarFile): string {
    return this.translate.instant(file.resourceType === 'EXCEL' ? 'EXCEL_PROGRAM' : 'PDF_PROGRAM');
  }

  /** The band's hint: what it is, its dates, what a click does. */
  fileHint(file: CalendarFile): string {
    return this.translate.instant('CALENDAR_FILE_HINT', { name: file.name, kind: this.fileKind(file), dates: this.fileDates(file) });
  }

  /**
   * A file band clicked: inside the client profile, its tab opens the file (same preview); the calendar alone opens
   * it in a new tab (a PDF shows, an Excel file downloads).
   */
  openFileProgram(file: CalendarFile, kind: CalendarType = this.calendarType): void {
    if (this.openFile.observed) {
      this.openFile.emit({ type: kind, programId: file.programId, plan: file.plan });
      return;
    }
    const popup = window.open('', '_blank');
    const blob$: Observable<Blob> = kind === 'workout'
      ? this.workoutService.getWorkoutFileBlob(file.plan)
      : this.nutritionService.downloadNutritionFile(file.plan);
    blob$.subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        if (popup) popup.location.href = url;
        else window.open(url, '_blank');
      },
      error: () => {
        popup?.close();
        this.toast.error(this.translate.instant('COULD_NOT_PREVIEW_FILE'));
      },
    });
  }

  hasSelectedClient(): boolean {
    return this.hideClientFilter || !!this.selectedClient;
  }


  private parseCalendarDate(dateStr?: string): Date | null {
    if (!dateStr) {
      return null;
    }

    const parts = dateStr.slice(0, 10).split('-').map((value) => Number(value));

    if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
      return null;
    }

    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  /**
   * A nutrition day opens in the client's editor on that day (CA-11), as « Remplir » of the client's tab does: the
   * editor keeps the client's rules (a day done or past is read-only) and its « Retour » comes back here.
   */
  viewNutrition(n: NutritionProgram): void {
    if (!n.programId || !this.selectedClient) return;
    const editor = n.planKind === 'MEAL_MACROS'
      ? 'create-macro-plan'
      : n.planKind === 'DAY_MACROS'
        ? 'create-macro-plan-total-day'
        : 'create-full-plan';
    this.openEditor(['/clients', editor, this.selectedClient, 'edit', n.programId], n.dayNumber);
  }

  /** The program's editor on that day; « Retour » comes back to this calendar, on the same month. */
  private openEditor(commands: string[], dayNumber?: number | null): void {
    this.rememberPlace();
    void this.router.navigate(commands, { queryParams: { day: dayNumber || null, returnUrl: this.router.url } });
  }

  /** A day the client already did something on, or a past day, is read in the editor (K1, as the editor does). */
  isDayLocked(item: WorkoutProgram): boolean {
    return !!item.done
      || (!!item.date && item.date < todayIso())
      || this.workoutRanges.some((range) => range.programId === item.programId && range.locked);
  }

  onPrev(): void {
    this.goPrev();
  }

  onNext(): void {
    this.goNext();
  }

  setCalendarType(type: CalendarType): void {
    this.calendarType = type;
    this.updateMonthGrid();
  }

  setView(view: CalendarViewMode): void {
    this.currentView = view;
    this.showPeriod();
  }

  get weekDays(): string[] {
    return ['WEEKDAY_MON', 'WEEKDAY_TUE', 'WEEKDAY_WED', 'WEEKDAY_THU', 'WEEKDAY_FRI', 'WEEKDAY_SAT', 'WEEKDAY_SUN'];
  }

  get currentDayString(): string {
    return this.formatDateToYYYYMMDD(this.currentDate);
  }

  get dayLabelWeekday(): string {
    return this.currentDate.toLocaleDateString(this.calendarLocale, {
      weekday: 'long',
    });
  }

  get dayLabelFull(): string {
    return this.currentDate.toLocaleDateString(this.calendarLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private canManageWorkoutDays(): boolean {
    return (
      !!this.coachId &&
      !!this.selectedClient &&
      this.selectedClient !== 'all'
    );
  }

  /** A workout day: opened in the program's editor on that day (L4, C5): changed there, or read there when done (K1). */
  openWorkoutCard(workout: WorkoutProgram, event?: Event): void {
    event?.stopPropagation();
    this.openWorkoutEditor(workout);
  }

  /**
   * « + » on a day (K2, K3, L4): the day already planned opens (one day per date: in the week, its panel); a date of a
   * program without its day opens that program's editor on it; a date outside every program creates a program from
   * that day. `type`: the row clicked in the week (else the type shown).
   */
  addItem(dateStr: string, type: CalendarType = this.calendarType): void {
    if (!this.canManageWorkoutDays()) {
      this.toast.warning(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }
    if (type !== this.calendarType) this.setCalendarType(type);

    const [day] = this.getItemsForDay(dateStr);
    if (day) {
      if (this.currentView === 'week') this.selectDay(dateStr);
      else if (this.calendarType === 'nutrition') this.viewNutrition(day as NutritionProgram);
      else this.openWorkoutCard(day as WorkoutProgram);
      return;
    }

    const program = this.planCovering(this.calendarType === 'workout' ? this.workoutRanges : this.nutritionRanges, dateStr);
    if (!program) {
      this.openCreateProgramModal(dateStr);
      return;
    }
    if (program.locked) {
      this.toast.info(this.translate.instant('ASSIGN_FLOW.LOCKED_ERROR'));
      return;
    }
    if (dateStr < todayIso()) {
      this.toast.info(this.translate.instant('CALENDAR_DAY_PAST'));
      return;
    }

    // The day is filled in the program's editor (L4), as every change of a day.
    const dayNumber = this.daysBetween(program.start, dateStr) + 1;
    if (this.calendarType === 'nutrition') {
      this.viewNutrition({ programId: program.programId, planKind: program.planKind, dayNumber } as NutritionProgram);
      return;
    }
    this.openEditor(['/clients/create-workout', this.selectedClient, 'edit', program.programId], dayNumber);
  }

  openCreateProgramModal(dateStr: string): void {
    if (!this.canManageWorkoutDays()) {
      this.toast.warning(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    this.createProgramName = '';
    this.createProgramDurationWeeks = 4;
    // A day in the past cannot start a program (A2): it starts today.
    this.createProgramStartDate = dateStr && dateStr >= todayIso() ? dateStr : todayIso();
    this.createProgramSaving = false;
    this.createProgramPreviews = {};
    this.createProgramConfirmRows = null;
    this.createProgramConfirmed = false;
    this.showCreateProgramModal = true;
  }

  /** The coach confirmed what changes on the client's calendar. */
  confirmCreateProgram(): void {
    this.createProgramConfirmed = true;
    this.submitCreateProgramModal();
  }

  closeCreateProgramModal(): void {
    if (this.createProgramSaving) return;
    this.createProgramConfirmRows = null;
    this.createProgramConfirmed = false;

    this.showCreateProgramModal = false;
    this.createProgramName = '';
    this.createProgramDurationWeeks = 4;
    this.createProgramStartDate = '';
  }

  get createProgramDurationDays(): number {
    return this.normalizedCreateProgramDurationWeeks * 7;
  }

  get createProgramEndDate(): string {
    if (!this.createProgramStartDate) return '';
    return this.addDays(this.createProgramStartDate, this.createProgramDurationDays - 1);
  }

  get normalizedCreateProgramDurationWeeks(): number {
    const weeks = Number(this.createProgramDurationWeeks) || 4;
    return Math.max(1, Math.min(weeks, 52));
  }

  get canCreateCalendarProgram(): boolean {
    return !!this.createProgramName.trim()
      && !!this.createProgramStartDate
      && !this.createProgramChecking
      && !this.createProgramSaving;
  }

  submitCreateProgramModal(): void {
    if (!this.canCreateCalendarProgram) return;
    if (!this.createProgramConfirmed) {
      const lines = (this.createProgramPreviews[String(this.selectedClient)]?.changes || [])
        .map(change => this.programSchedule.text(changeSentence(change, this.programSchedule.formatDate)));
      if (lines.length) {
        this.createProgramConfirmRows = [{ id: String(this.selectedClient), name: this.getSelectedClientName(), lines }];
        return;
      }
    }
    this.createProgramConfirmed = false;
    this.createProgramConfirmRows = null;

    if (this.calendarType === 'nutrition') {
      this.createEmptyNutritionProgram();
      return;
    }

    this.createEmptyWorkoutProgram();
  }

  private getSelectedClientRef(): any {
    const client = this.clients.find((item) => item.id === this.selectedClient);
    return client || { id: this.selectedClient };
  }

  getSelectedClientName(): string {
    const client = this.clients.find((item) => item.id === this.selectedClient);
    const name = client
      ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name
      : this.embeddedClientName.trim();
    return name || this.translate.instant('CLIENT');
  }

  private createEmptyWorkoutProgram(): void {
    const startDate = this.createProgramStartDate;
    const days = Array.from({ length: this.createProgramDurationDays }, (_, index) =>
      this.buildEmptyWorkoutDay(startDate, index)
    );

    const payload: WorkoutPlan = {
      name: this.createProgramName.trim(),
      details: '',
      startDate,
      endDate: this.createProgramEndDate,
      client: this.getSelectedClientRef(),
      workoutDays: days,
      isWorkoutPlanTemplate: false,
      workoutPlanMode: 'NORMAL',
    };

    this.createProgramSaving = true;
    this.workoutService.createWorkout(payload).subscribe({
      next: (created: any) => {
        this.createProgramSaving = false;
        this.programSchedule.announceChanges(created?.scheduleChanges, this.getSelectedClientName());
        this.closeCreateProgramModal();
        this.reloadWorkouts();
      },
      error: (err) => {
        console.error('Error creating calendar workout program', err);
        this.createProgramSaving = false;
        this.toast.error(this.translate.instant('CREATE_WORKOUT_PROGRAM_ERROR'));
      },
    });
  }

  private buildEmptyWorkoutDay(startDate: string, index: number): any {
    const date = this.addDays(startDate, index);
    const dateObject = new Date(`${date}T00:00:00`);

    return {
      id: crypto.randomUUID?.() || `${Date.now()}-${index}`,
      date,
      dayOfWeek: dateObject.toLocaleDateString('en-US', { weekday: 'long' }),
      restDay: false,
      dayNumber: index + 1,
      title: `Day ${index + 1}`,
      description: '',
      workoutSessions: [],
      status: 'PENDING',
    };
  }

  private createEmptyNutritionProgram(): void {
    const startDate = this.createProgramStartDate;
    const mealDays = Array.from({ length: this.createProgramDurationDays }, (_, index) =>
      this.buildEmptyNutritionDay(startDate, index)
    );

    const payload: MealPlan = {
      name: this.createProgramName.trim(),
      details: '',
      startDate,
      endDate: this.createProgramEndDate,
      date: null,
      trackingMode: null,
      mealDays,
      coach: null,
      client: this.getSelectedClientRef(),
    };

    this.createProgramSaving = true;
    this.nutritionService.createNutritionPlan(payload).subscribe({
      next: (created: any) => {
        this.createProgramSaving = false;
        this.programSchedule.announceChanges(created?.scheduleChanges, this.getSelectedClientName());
        this.closeCreateProgramModal();
        this.reloadNutrition();
      },
      error: (err) => {
        console.error('Error creating calendar nutrition program', err);
        this.createProgramSaving = false;
        this.toast.error(this.translate.instant('CREATE_NUTRITION_PROGRAM_ERROR'));
      },
    });
  }

  private buildEmptyNutritionDay(startDate: string, index: number): MealDay {
    const date = this.addDays(startDate, index);
    const dateObject = new Date(`${date}T00:00:00`);

    return {
      id: crypto.randomUUID?.() || `${Date.now()}-${index}`,
      date,
      dayOfWeek: dateObject.toLocaleDateString('en-US', { weekday: 'long' }),
      cheatMeal: false,
      refeedDay: false,
      description: '',
      title: `Day ${index + 1}`,
      showDescription: false,
      dayTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      meals: [],
    } as MealDay;
  }

  get weightUnitLabel(): string {
    return this.coachSettingsService.getWeightUnit();
  }

  /** After a change made here: the months are read again (and the profile's copy of the plans is out of date). */
  private reloadWorkouts(): void {
    if (this.selectedClient) this.profileCache.forget('workouts', this.selectedClient);
    this.loadCalendar();
  }

  private reloadNutrition(): void {
    if (this.selectedClient) this.profileCache.forget('nutrition', this.selectedClient);
    this.loadCalendar();
  }

}
