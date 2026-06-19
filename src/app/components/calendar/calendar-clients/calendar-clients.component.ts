import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ClientService } from 'app/service/client.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoachSettingsService } from 'app/service/coach-settings.service';

interface ExerciseSet {
  id: string;
  number: number;
  reps: string;
  rest: string;
}

interface Exercise {
  id: string;
  name: string;
  type: 'strength' | 'cardio';
  sets: ExerciseSet[];
  duration?: number;
  notes?: string;
  thumbnail?: string;
  youtubeUrl?: string;
  showVideo?: boolean;
  videoUrl?: SafeResourceUrl;
  rawVideoUrl?: string;
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
  status?: 'COMPLETED' | 'MISSED' | 'PENDING';

  // Optional metadata for imported PDF / Excel workout programs.
  // Existing workout-day behavior stays untouched.
  fileProgram?: boolean;
  resourceType?: 'PDF' | 'EXCEL';
  startDate?: string;
  endDate?: string;
}

interface WorkoutPlanRef {
  programId: string;
  programName: string;
}

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
  programName?: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: NutritionMeal[];
}

type CalendarViewMode = 'month' | 'week' | 'day';
type CalendarType = 'workout' | 'nutrition';

@Component({
  selector: 'app-calendar-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './calendar-clients.component.html',
  styleUrl: './calendar-clients.component.scss',
})
export class CalendarClientsComponent implements OnInit, OnChanges, OnDestroy {

  workoutFileEnabled = true;
currentDate = new Date();
  currentView: CalendarViewMode = 'month';
  calendarType: CalendarType = 'workout';
  selectedClient: string = 'all';
  copiedDate: string | null = null;

  coachId: string | null = sessionStorage.getItem('userId');

  selectedWorkout: WorkoutProgram | null = null;
  selectedNutritionDay: NutritionProgram | null = null;
  showWorkoutDetails = false;
  showNutritionDetails = false;

  showAddWorkoutModal = false;
  isRestDay = false;
  selectedDateString: string | null = null;

  newWorkoutTitle = '';
  newWorkoutExercises: Exercise[] = [];

  showExerciseSelector = false;
  exerciseSearchTerm = '';

  showDeleteModal = false;
  workoutToDelete: WorkoutProgram | null = null;
  editingWorkout: WorkoutProgram | null = null;

  // Fix: Add connected lists for drag and drop
  connectedLists: string[] = [];

  private beforeToggleHandler: ((e: Event) => void) | null = null;

  availableExercises: Exercise[] = [
    {
      id: 'lib-squat',
      name: 'Squat (Barbell)',
      type: 'strength',
      youtubeUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
      sets: [
        { id: 'lib-squat-set-1', number: 1, reps: '8-12', rest: '90' },
        { id: 'lib-squat-set-2', number: 2, reps: '8-12', rest: '90' },
        { id: 'lib-squat-set-3', number: 3, reps: '8-12', rest: '90' },
      ],
    },
    {
      id: 'lib-bench',
      name: 'Bench Press (Barbell)',
      type: 'strength',
      youtubeUrl: 'https://www.youtube.com/watch?v=SCVCLChPQFY',
      sets: [
        { id: 'lib-bench-set-1', number: 1, reps: '8-12', rest: '90' },
        { id: 'lib-bench-set-2', number: 2, reps: '8-12', rest: '90' },
        { id: 'lib-bench-set-3', number: 3, reps: '8-12', rest: '90' },
      ],
    },
    {
      id: 'lib-cardio',
      name: 'Treadmill Run',
      type: 'cardio',
      youtubeUrl: 'https://www.youtube.com/watch?v=kZDvg92tTMc',
      sets: [],
      duration: 30,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workoutPrograms: any[] = [];
  nutritionPrograms: NutritionProgram[] = [];
  clients: Client[] = [];

  monthEmptyCells: number[] = [];
  monthDates: Date[] = [];
  client: any;

  @Input() embeddedClientId: string | null = null;
  @Input() embeddedCoachId: string | null = null;
  @Input() hideClientFilter = false;

  constructor(
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private clientService: ClientService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit(): void {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.updateMonthGrid();
      },
      error: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
      },
    });
    if (this.embeddedCoachId) {
      this.coachId = this.embeddedCoachId;
    }

    if (this.embeddedClientId) {
      this.selectedClient = this.embeddedClientId;
    }

    this.updateMonthGrid();
    this.getAllLibrary();

    if (!this.hideClientFilter) {
      this.getClients();
    } else {
      this.getWorkout();
    }

  }

  ngOnDestroy(): void {
    this.cleanupWorkoutPointerDrag();
    this.teardownPopoverIntercept();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['embeddedCoachId'] && this.embeddedCoachId) {
      this.coachId = this.embeddedCoachId;
    }

    if (changes['embeddedClientId']) {
      this.selectedClient = this.embeddedClientId || 'all';
      this.getWorkout();
    }
  }

  onClientChange(clientId: string): void {
    this.selectedClient = clientId;
    this.getWorkout();
  }

  getClients(): void {
    this.clientService
      .getListClientsByCoachWithoutPagination(this.coachId)
      .subscribe({
        next: (res) => {
          this.clients = res;
          console.log('CLIENTS', this.clients);
          this.getWorkout();
        },
        error: (err) => {
          console.error('Error loading clients', err);
        },
      });
  }

  getAllLibrary(): void {
    this.nutritionService.getNutritionPlans().subscribe((res) => {
      this.nutritionPrograms = this.mapBackendToNutritionPrograms(res.content);
      console.log('NUTRITION PROGRAMS', this.nutritionPrograms);
    });
  }

  getWorkout(): void {
    if (!this.coachId) {
      console.error('No coach id found in sessionStorage');
      this.workoutPrograms = [];
      return;
    }

    if (this.selectedClient && this.selectedClient !== 'all') {
      this.workoutService
        .getWorkoutByCoachIdAndClient(this.coachId, this.selectedClient, 0, 100)
        .subscribe({
          next: (res) => {
            this.workoutPrograms = this.mapBackendToWorkoutPrograms(
              res.content || []
            );
            console.log(
              'CLIENT ASSIGNED WORKOUT PROGRAMS',
              this.workoutPrograms
            );
            this.updateMonthGrid();
          },
          error: (err) => {
            console.error('Error loading client assigned workout plans', err);
            this.workoutPrograms = [];
          },
        });

      return;
    }

    if (!this.clients || this.clients.length === 0) {
      this.workoutPrograms = [];
      return;
    }

    const requests = this.clients.map((client) =>
      this.workoutService
        .getWorkoutByCoachIdAndClient(this.coachId!, client.id, 0, 100)
        .pipe(
          catchError((err) => {
            console.error(
              `Error loading assigned workout plans for client ${client.id}`,
              err
            );
            return of({
              content: [],
              totalPages: 0,
              totalElements: 0,
              number: 0,
              size: 0,
            });
          })
        )
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const allPlans = responses.flatMap((res) => res.content || []);
        this.workoutPrograms = this.mapBackendToWorkoutPrograms(allPlans);
        console.log(
          'ALL CLIENTS ASSIGNED WORKOUT PROGRAMS',
          this.workoutPrograms
        );
        this.updateMonthGrid();
      },
      error: (err) => {
        console.error('Error loading all assigned workout plans', err);
        this.workoutPrograms = [];
      },
    });
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isBackendFileWorkoutPlan(plan: any): boolean {
    if (!this.workoutFileEnabled) {
      return false;
    }

    const mode = String(plan?.workoutPlanMode || '').toUpperCase();
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getBackendFileWorkoutResourceType(plan: any): 'PDF' | 'EXCEL' {
    const type = String(plan?.resourceType || '').toUpperCase();
    const fileName = String(plan?.originalFileName || plan?.fileName || '').toLowerCase();

    if (type === 'PDF' || fileName.endsWith('.pdf')) {
      return 'PDF';
    }

    return 'EXCEL';
  }

  private enumerateDateRange(startDate: string, endDate: string): string[] {
    if (!startDate) {
      return [];
    }

    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);

    if (isNaN(start.getTime())) {
      return [];
    }

    if (isNaN(end.getTime()) || end < start) {
      dates.push(this.formatDateToYYYYMMDD(start));
      return dates;
    }

    const cursor = new Date(start);

    while (cursor <= end) {
      dates.push(this.formatDateToYYYYMMDD(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  isFileWorkoutItem(item: WorkoutProgram | NutritionProgram): boolean {
    return this.calendarType === 'workout' && !!(item as WorkoutProgram).fileProgram;
  }

  getFileResourceType(item: WorkoutProgram | NutritionProgram): 'PDF' | 'EXCEL' {
    return ((item as WorkoutProgram).resourceType || 'PDF') as 'PDF' | 'EXCEL';
  }

  getFileProgramSubtitle(item: WorkoutProgram | NutritionProgram): string {
    return this.getFileResourceType(item) === 'EXCEL' ? 'Programme Excel' : 'Programme PDF';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBackendToWorkoutPrograms(plans: any[]): WorkoutProgram[] {
    const result: WorkoutProgram[] = [];

    plans.forEach((plan) => {
      const startDate = plan.startDate;
      const endDate = plan.endDate || plan.startDate;

      // Imported PDF / Excel workout programs do not have workoutDays.
      // We display them in the calendar during their assigned period.
      // Existing in-app workout day logic below is untouched.
      if (this.isBackendFileWorkoutPlan(plan)) {
        const resourceType = this.getBackendFileWorkoutResourceType(plan);

        // One item only. The calendar decides where to render connected weekly bars.
        result.push({
          id: `${plan.id}-file-range`,
          title: plan.name || (resourceType === 'EXCEL' ? 'Programme Excel' : 'Programme PDF'),
          date: startDate,
          clientId: plan.client?.id,
          programId: plan.id,
          programName: resourceType === 'EXCEL' ? 'Programme Excel' : 'Programme PDF',
          sessions: [],
          status: 'PENDING',
          fileProgram: true,
          resourceType,
          startDate,
          endDate,
        });

        return;
      }

      (plan.workoutDays || []).forEach((day: any) => {
        const date = day.date
          ? day.date
          : this.addDays(startDate, (day.dayNumber ?? 1) - 1);

        if (day.restDay) {
          result.push({
            id: day.id,
            title: day.title || `Day ${day.dayNumber || ''}`.trim(),
            date,
            clientId: plan.client?.id,
            programId: plan.id,
            programName: plan.name,
            sessions: [],
            status: day.status || 'PENDING',
          });
          return;
        }

        const sessions: WorkoutSession[] = (day.workoutSessions || []).map(
          (session: any, sIndex: number) => ({
            id: session.id || `${plan.id}-session-${sIndex}`,
            notes: session.name,
            exercises: (session.exercises || []).map(
              (ex: any, exIndex: number) => ({
                id: ex.id || `${plan.id}-ex-${exIndex}`,
                name: ex.name,
                type: ex.type === 'CARDIO' ? 'cardio' : 'strength',
                youtubeUrl: ex.youtubeUrl || ex.videoUrl || undefined,
                showVideo: false,
                videoUrl: undefined,
                rawVideoUrl: undefined,
                sets: (ex.sets || []).map((set: any, setIndex: number) => ({
                  id: `${ex.id || plan.id}-set-${setIndex}`,
                  number: set.setNumber ?? setIndex + 1,
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
          id: day.id,
          title: day.title || `Day ${day.dayNumber || ''}`.trim(),
          date,
          clientId: plan.client?.id,
          programId: plan.id,
          programName: plan.name,
          sessions,
          status: day.status || 'PENDING',
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
  mapBackendToNutritionPrograms(plans: any[]): NutritionProgram[] {
    const result: NutritionProgram[] = [];

    plans.forEach((plan) => {
      (plan.mealDays || []).forEach((day: any) => {
        const hasMeals = !!day.meals && day.meals.length > 0;

        const hasTargets =
          !!day.dayTargets &&
          ((day.dayTargets.calories ?? 0) > 0 ||
            (day.dayTargets.proteinG ?? 0) > 0 ||
            (day.dayTargets.carbsG ?? 0) > 0 ||
            (day.dayTargets.fatG ?? 0) > 0);

        const isRestDay =
          !hasMeals && !hasTargets && !day.cheatMeal && !day.refeedDay;

        if (isRestDay) {
          result.push({
            id: `${plan.id}-rest-${day.date}`,
            title: 'Rest Day',
            date: day.date,
            clientId: plan.client?.id,
            programId: plan.id,
            dayId: day.id,
            trackingMode: plan.trackingMode,
            programName: plan.name,
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            meals: [],
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
              protein: food.protein ?? 0,
              carbs: food.carbs ?? 0,
              fat: food.fat ?? 0,
              calories: food.calories ?? 0,
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
          programName: plan.name,
          totalCalories: day.dayTargets?.calories ?? 0,
          totalProtein: day.dayTargets?.proteinG ?? 0,
          totalCarbs: day.dayTargets?.carbsG ?? 0,
          totalFat: day.dayTargets?.fatG ?? 0,
          meals,
        });
      });
    });

    return result;
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

  getBadgeText(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return '✓';
      case 'MISSED':
        return '✕';
      default:
        return 'P';
    }
  }

  getMonthLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  getWeekLabel(): string {
    const days = this.getWeekDates();
    const first = days[0];
    const last = days[6];

    const startStr = first.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
    const endStr = last.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric',
    });

    return `Semaine du ${startStr} au ${endStr}`;
  }

  getDayLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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
    this.updateMonthGrid();
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
    this.updateMonthGrid();
  }

  /**
   * Two monkey-patches to keep CDK drag previews completely out of the
   * Popover API, because CDK v17 insists on making them popovers:
   *
   * 1. Block `setAttribute('popover', …)` — prevents the UA stylesheet
   *    `[popover]:not(:popover-open) { display: none; }` from matching.
   * 2. Block `showPopover()` — prevents the `NotSupportedError` that
   *    occurs when calling `showPopover()` without the `popover` attribute.
   *
   * The order in `_createPreview` (drag-drop.mjs) ensures the class
   * `cdk-drag-preview` is added BEFORE the popover attribute is set
   * (line 408 vs 409), so the class check in the patches works.
   */
  private static _popoverPatchApplied = false;

  private setupPopoverIntercept(): void {
    if (CalendarClientsComponent._popoverPatchApplied) return;
    CalendarClientsComponent._popoverPatchApplied = true;

    const origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (name === 'popover' && this.classList?.contains('cdk-drag-preview')) {
        return;
      }
      origSetAttr.call(this, name, value);
    };

    const origShowPopover = HTMLElement.prototype.showPopover;
    HTMLElement.prototype.showPopover = function () {
      if (this.classList?.contains('cdk-drag-preview')) {
        return;
      }
      return origShowPopover.call(this);
    };
  }

  private teardownPopoverIntercept(): void {
    // No-op: the patch is global and harmless, applied once.
  }

  onDragStarted(event: any): void {
    console.log('CDK Drag Started!', event);
    const preview = document.querySelector('.cdk-drag-preview') as HTMLElement;
    if (preview) {
      const cs = getComputedStyle(preview);
      const rect = preview.getBoundingClientRect();
      console.log('[onDragStarted] preview', {
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        position: cs.position,
        zIndex: cs.zIndex,
        hasPopoverAttr: preview.hasAttribute('popover'),
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        transform: preview.style.transform,
      });

      preview.style.setProperty('display', 'block', 'important');
      preview.style.setProperty('visibility', 'visible', 'important');
      preview.style.setProperty('opacity', '0.95', 'important');

      const card = preview.querySelector('.card') as HTMLElement;
      if (card) {
        card.style.setProperty('visibility', 'visible', 'important');
        card.style.setProperty('opacity', '1', 'important');
      }
    } else {
      console.log('[onDragStarted] NO PREVIEW FOUND IN DOM');
    }
  }

  updateMonthGrid(): void {
    // Update connected lists for drag and drop — only current view
    if (this.currentView === 'month') {
      this.connectedLists = this.monthDays.map(day => 'drop-list-' + day.dateString);
    } else if (this.currentView === 'week') {
      this.connectedLists = this.weekDaysData.map(day => 'drop-list-week-' + day.dateString);
    } else {
      this.connectedLists = ['drop-list-day-' + this.currentDayString];
    }
  }

  getItemsForDay(dateStr: string): (WorkoutProgram | NutritionProgram)[] {
    if (this.calendarType === 'workout') {
      return this.workoutPrograms.filter((p: WorkoutProgram) => {
        const matchesClient =
          this.selectedClient === 'all' || p.clientId === this.selectedClient;

        if (!matchesClient) {
          return false;
        }

        if (p.fileProgram) {
          return this.shouldRenderFileRangeOnDate(p, dateStr);
        }

        return p.date === dateStr;
      });
    } else {
      return this.nutritionPrograms.filter(
        (p) =>
          p.date === dateStr &&
          (this.selectedClient === 'all' || p.clientId === this.selectedClient)
      );
    }
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

  private isDateWithinFileRange(item: WorkoutProgram, dateStr: string): boolean {
    const date = this.parseCalendarDate(dateStr);
    const start = this.parseCalendarDate(item.startDate || item.date);
    const end = this.parseCalendarDate(item.endDate || item.startDate || item.date);

    if (!date || !start || !end) {
      return false;
    }

    return date >= start && date <= end;
  }

  private isMonday(date: Date): boolean {
    return date.getDay() === 1;
  }

  private isFirstVisibleMonthDay(date: Date): boolean {
    return (
      this.currentView === 'month' &&
      date.getDate() === 1 &&
      date.getMonth() === this.currentDate.getMonth() &&
      date.getFullYear() === this.currentDate.getFullYear()
    );
  }

  shouldRenderFileRangeOnDate(item: WorkoutProgram, dateStr: string): boolean {
    // Render a segment inside every day of the file period.
    // CSS makes adjacent segments look connected, without using a huge width
    // that overlays normal workout cards on middle days.
    return !!item.fileProgram && this.isDateWithinFileRange(item, dateStr);
  }

  shouldShowFileRangeText(item: WorkoutProgram | NutritionProgram, dateStr: string): boolean {
    const workoutItem = item as WorkoutProgram;

    if (!workoutItem.fileProgram) {
      return true;
    }

    const date = this.parseCalendarDate(dateStr);
    const start = this.parseCalendarDate(workoutItem.startDate || workoutItem.date);

    if (!date || !start) {
      return true;
    }

    if (this.currentView === 'day') {
      return true;
    }

    return (
      this.formatDateToYYYYMMDD(date) === this.formatDateToYYYYMMDD(start) ||
      this.isMonday(date) ||
      this.isFirstVisibleMonthDay(date)
    );
  }

  shouldShowFileRangeEndDate(item: WorkoutProgram | NutritionProgram, dateStr: string): boolean {
    const workoutItem = item as WorkoutProgram;

    if (!workoutItem.fileProgram) {
      return false;
    }

    const date = this.parseCalendarDate(dateStr);
    const end = this.parseCalendarDate(workoutItem.endDate || workoutItem.startDate || workoutItem.date);

    if (!date || !end) {
      return false;
    }

    if (this.currentView === 'day') {
      return true;
    }

    return (
      this.formatDateToYYYYMMDD(date) === this.formatDateToYYYYMMDD(end) ||
      date.getDay() === 0
    );
  }

  isFileRangeStart(item: WorkoutProgram | NutritionProgram, dateStr: string): boolean {
    const workoutItem = item as WorkoutProgram;
    const date = this.parseCalendarDate(dateStr);
    const start = this.parseCalendarDate(workoutItem.startDate || workoutItem.date);

    if (!date || !start) {
      return false;
    }

    return (
      this.formatDateToYYYYMMDD(date) === this.formatDateToYYYYMMDD(start) ||
      this.isMonday(date) ||
      this.isFirstVisibleMonthDay(date) ||
      this.currentView === 'day'
    );
  }

  isFileRangeEnd(item: WorkoutProgram | NutritionProgram, dateStr: string): boolean {
    const workoutItem = item as WorkoutProgram;
    const date = this.parseCalendarDate(dateStr);
    const end = this.parseCalendarDate(workoutItem.endDate || workoutItem.startDate || workoutItem.date);

    if (!date || !end) {
      return false;
    }

    return (
      this.formatDateToYYYYMMDD(date) === this.formatDateToYYYYMMDD(end) ||
      date.getDay() === 0 ||
      this.currentView === 'day'
    );
  }

  getFileRangePositionClass(item: WorkoutProgram | NutritionProgram, dateStr: string): string {
    if (!this.isFileWorkoutItem(item)) {
      return '';
    }

    const isStart = this.isFileRangeStart(item, dateStr);
    const isEnd = this.isFileRangeEnd(item, dateStr);

    if (isStart && isEnd) {
      return 'file-range-single';
    }

    if (isStart) {
      return 'file-range-start';
    }

    if (isEnd) {
      return 'file-range-end';
    }

    return 'file-range-middle';
  }

  getFileRangeEndLabel(item: WorkoutProgram | NutritionProgram): string {
    const workoutItem = item as WorkoutProgram;
    return workoutItem.endDate || workoutItem.startDate || workoutItem.date || '';
  }

  getFileRangeSpan(item: WorkoutProgram | NutritionProgram, dateStr: string): number {
    const workoutItem = item as WorkoutProgram;

    if (!workoutItem.fileProgram) {
      return 1;
    }

    const start = this.parseCalendarDate(dateStr);
    const end = this.parseCalendarDate(
      workoutItem.endDate || workoutItem.startDate || workoutItem.date
    );

    if (!start || !end) {
      return 1;
    }

    if (this.currentView === 'day') {
      return 1;
    }

    const limit = new Date(start);
    const day = limit.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    limit.setDate(limit.getDate() + diffToSunday);

    if (this.currentView === 'month') {
      const endOfMonth = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
        0
      );

      if (limit > endOfMonth) {
        limit.setTime(endOfMonth.getTime());
      }
    }

    const finalEnd = end < limit ? end : limit;
    const diffMs = finalEnd.getTime() - start.getTime();
    const days = Math.floor(diffMs / 86400000) + 1;

    return Math.max(1, Math.min(7, days));
  }

  viewWorkout(w: WorkoutProgram): void {
    if (w.fileProgram) {
      return;
    }

    this.selectedWorkout = w;
    this.showWorkoutDetails = true;
  }

  closeWorkoutDetails(): void {
    this.showWorkoutDetails = false;
    this.selectedWorkout = null;
  }

  viewNutrition(n: NutritionProgram): void {
    if (!n.programId) {
      this.selectedNutritionDay = n;
      this.showNutritionDetails = true;
      return;
    }

    const baseRoute =
      n.trackingMode === 'EACH_MEAL'
        ? `/nutrition/create-macro-plan/${n.programId}`
        : n.trackingMode === 'TOTAL_FOR_DAY'
          ? `/nutrition/create-macro-plan-total-day/${n.programId}`
          : `/nutrition/create-full-plan/${n.programId}`;

    this.router.navigateByUrl(
      `${baseRoute}?dayId=${n.dayId || ''}&from=calendar`
    );
  }

  closeNutritionDetails(): void {
    this.showNutritionDetails = false;
    this.selectedNutritionDay = null;
  }

  formatRestTime(seconds: string): string {
    const total = parseInt(seconds, 10);
    if (isNaN(total)) return seconds;
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    if (minutes > 0 && secs > 0) return `${minutes}min ${secs}sec`;
    if (minutes > 0) return `${minutes}min`;
    return `${secs}sec`;
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
    this.updateMonthGrid();
  }

  get weekDays(): string[] {
    return ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  }

  get monthLeadingEmptyCells(): any[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = this.getFirstDayOfMonth(year, month);
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    return Array(adjustedFirstDay).fill(0);
  }

  get monthDays(): {
    date: Date;
    dateString: string;
    dayNumber: number;
    isToday: boolean;
    items: (WorkoutProgram | NutritionProgram)[];
  }[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);
    const result: any[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateString = this.formatDateToYYYYMMDD(date);
      result.push({
        date,
        dateString,
        dayNumber: d,
        isToday: this.isToday(date),
        items: this.getItemsForDay(dateString),
      });
    }

    return result;
  }

  get weekDaysData(): {
    date: Date;
    dateString: string;
    dayNumber: number;
    isToday: boolean;
    weekdayLabel: string;
    items: (WorkoutProgram | NutritionProgram)[];
  }[] {
    const dates = this.getWeekDates();
    return dates.map((date) => {
      const dateString = this.formatDateToYYYYMMDD(date);
      return {
        date,
        dateString,
        dayNumber: date.getDate(),
        isToday: this.isToday(date),
        weekdayLabel: date
          .toLocaleDateString('fr-FR', { weekday: 'short' })
          .toUpperCase(),
        items: this.getItemsForDay(dateString),
      };
    });
  }

  get currentDayString(): string {
    return this.formatDateToYYYYMMDD(this.currentDate);
  }

  get dayItems(): (WorkoutProgram | NutritionProgram)[] {
    return this.getItemsForDay(this.currentDayString);
  }

  get dayLabelWeekday(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
    });
  }

  get dayLabelFull(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private cloneExercises(exercises: Exercise[]): Exercise[] {
    return (exercises || []).map((ex, exIndex) => ({
      ...ex,
      id: ex.id || `cloned-ex-${Date.now()}-${exIndex}`,
      showVideo: false,
      videoUrl: undefined,
      rawVideoUrl: undefined,
      sets: (ex.sets || []).map((set, setIndex) => ({
        ...set,
        id: set.id || `cloned-set-${Date.now()}-${exIndex}-${setIndex}`,
      })),
    }));
  }

  private resetWorkoutForm(): void {
    this.isRestDay = false;
    this.newWorkoutTitle = '';
    this.newWorkoutExercises = [];
    this.exerciseSearchTerm = '';
    this.showExerciseSelector = false;
    this.editingWorkout = null;
  }

  private canManageWorkoutDays(): boolean {
    return (
      !!this.coachId &&
      !!this.selectedClient &&
      this.selectedClient !== 'all'
    );
  }

  copyDay(dateStr: string): void {
    if (this.calendarType !== 'workout') {
      return;
    }

    const sourcePrograms = this.workoutPrograms.filter(
      (p: WorkoutProgram) =>
        p.date === dateStr &&
        (this.selectedClient === 'all' || p.clientId === this.selectedClient)
    );

    if (!sourcePrograms.length) {
      return;
    }

    this.copiedDate = dateStr;
  }

  cancelCopy(): void {
    this.copiedDate = null;
  }

  private pointerDragState: {
    workout: WorkoutProgram;
    sourceDate: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    moved: boolean;
    sourceElement: HTMLElement | null;
    ghost: HTMLElement | null;
    moveHandler: (event: MouseEvent | TouchEvent) => void;
    upHandler: (event: MouseEvent | TouchEvent) => void;
  } | null = null;

  private suppressWorkoutClickUntil = 0;

  openWorkoutCard(workout: WorkoutProgram, event?: Event): void {
    if (Date.now() < this.suppressWorkoutClickUntil) {
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }

    if (workout.fileProgram) {
      return;
    }

    this.viewWorkout(workout);
  }

  startWorkoutPointerDrag(
    event: MouseEvent | TouchEvent,
    workout: WorkoutProgram,
    sourceDate: string
  ): void {
    if (this.calendarType !== 'workout') return;

    if (!this.canManageWorkoutDays()) {
      alert('Please select one client first, then drag the workout day.');
      return;
    }

    if (!workout?.programId) {
      alert('This workout day is not associated with a program.');
      return;
    }

    const point = this.getPointerPoint(event);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement | null;
    const sourceElement = handle?.closest('.card-wrapper, .day-card-wrapper') as HTMLElement | null;

    const moveHandler = (moveEvent: MouseEvent | TouchEvent) =>
      this.onWorkoutPointerMove(moveEvent);
    const upHandler = (upEvent: MouseEvent | TouchEvent) =>
      this.onWorkoutPointerUp(upEvent);

    this.pointerDragState = {
      workout,
      sourceDate,
      startX: point.clientX,
      startY: point.clientY,
      currentX: point.clientX,
      currentY: point.clientY,
      moved: false,
      sourceElement,
      ghost: null,
      moveHandler,
      upHandler,
    };

    document.body.classList.add('calendar-pointer-drag-active');
    sourceElement?.classList.add('is-pointer-drag-source');

    window.addEventListener('mousemove', moveHandler, { passive: false });
    window.addEventListener('mouseup', upHandler, { passive: false });
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', upHandler, { passive: false });
    window.addEventListener('touchcancel', upHandler, { passive: false });
  }

  private onWorkoutPointerMove(event: MouseEvent | TouchEvent): void {
    const state = this.pointerDragState;
    if (!state) return;

    const point = this.getPointerPoint(event);
    if (!point) return;

    event.preventDefault();

    state.currentX = point.clientX;
    state.currentY = point.clientY;

    const distance = Math.hypot(
      state.currentX - state.startX,
      state.currentY - state.startY
    );

    if (!state.moved && distance > 4) {
      state.moved = true;
      this.suppressWorkoutClickUntil = Date.now() + 700;
      this.createWorkoutDragGhost(state);
    }

    if (state.ghost) {
      state.ghost.style.transform = `translate3d(${state.currentX + 12}px, ${state.currentY + 12}px, 0)`;
    }

    this.highlightWorkoutDropTarget(state.currentX, state.currentY);
  }

  private onWorkoutPointerUp(event: MouseEvent | TouchEvent): void {
    const state = this.pointerDragState;
    if (!state) return;

    const point = this.getPointerPoint(event) || {
      clientX: state.currentX,
      clientY: state.currentY,
    };

    event.preventDefault();
    event.stopPropagation();

    const targetDate = this.getDropDateFromPoint(point.clientX, point.clientY);
    const shouldMove = !!targetDate && targetDate !== state.sourceDate && state.moved;

    const workout = state.workout;
    const sourceDate = state.sourceDate;

    this.cleanupWorkoutPointerDrag();

    if (shouldMove && targetDate) {
      this.moveDay(workout, sourceDate, targetDate);
    }
  }

  private getPointerPoint(
    event: MouseEvent | TouchEvent
  ): { clientX: number; clientY: number } | null {
    if (event instanceof MouseEvent) {
      return { clientX: event.clientX, clientY: event.clientY };
    }

    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) return null;

    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  private createWorkoutDragGhost(state: NonNullable<typeof this.pointerDragState>): void {
    if (state.ghost || !state.sourceElement) return;

    const card = state.sourceElement.querySelector('.card') || state.sourceElement;
    const ghost = card.cloneNode(true) as HTMLElement;

    ghost.classList.add('calendar-pointer-drag-ghost');
    ghost.style.width = `${card.getBoundingClientRect().width}px`;
    ghost.style.transform = `translate3d(${state.currentX + 12}px, ${state.currentY + 12}px, 0)`;

    document.body.appendChild(ghost);
    state.ghost = ghost;
  }

  private highlightWorkoutDropTarget(clientX: number, clientY: number): void {
    document
      .querySelectorAll('.calendar-drop-target-active')
      .forEach((el) => el.classList.remove('calendar-drop-target-active'));

    const targetDate = this.getDropDateFromPoint(clientX, clientY);
    if (!targetDate) return;

    const target = document.querySelector(
      `[data-workout-drop-date="${targetDate}"]`
    );
    target?.classList.add('calendar-drop-target-active');
  }

  private getDropDateFromPoint(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const dropTarget = el?.closest('[data-workout-drop-date]') as HTMLElement | null;
    return dropTarget?.dataset?.['workoutDropDate'] || null;
  }

  private cleanupWorkoutPointerDrag(): void {
    const state = this.pointerDragState;
    if (!state) return;

    window.removeEventListener('mousemove', state.moveHandler as EventListener);
    window.removeEventListener('mouseup', state.upHandler as EventListener);
    window.removeEventListener('touchmove', state.moveHandler as EventListener);
    window.removeEventListener('touchend', state.upHandler as EventListener);
    window.removeEventListener('touchcancel', state.upHandler as EventListener);

    state.sourceElement?.classList.remove('is-pointer-drag-source');
    state.ghost?.remove();

    document.body.classList.remove('calendar-pointer-drag-active');
    document
      .querySelectorAll('.calendar-drop-target-active')
      .forEach((el) => el.classList.remove('calendar-drop-target-active'));

    this.pointerDragState = null;
  }

  onWorkoutDrop(event: CdkDragDrop<any>, targetDate: string): void {
    // Kept only so old templates do not break during hot reload.
    if (this.calendarType !== 'workout') return;

    const dragData = event.item.data;
    if (!dragData) return;
    if (dragData.sourceDate === targetDate) return;

    this.moveDay(dragData.item, dragData.sourceDate, targetDate);
  }

  private moveDay(
    workout: WorkoutProgram,
    sourceDate: string,
    targetDate: string
  ): void {
    if (this.calendarType !== 'workout') return;

    if (!this.canManageWorkoutDays()) {
      alert('Please select one client first, then drag the workout day.');
      this.getWorkout();
      return;
    }

    const programId = workout.programId;
    if (!programId) {
      alert('This workout day is not associated with a program.');
      return;
    }

    const clientId = workout.clientId || this.selectedClient;

    const exists = this.workoutPrograms.some(
      (p: WorkoutProgram) =>
        p.id !== workout.id &&
        p.date === targetDate &&
        p.clientId === clientId
    );

    if (exists) {
      alert('Target date already has a workout day.');
      return;
    }

    const previousPrograms = [...this.workoutPrograms];

    this.workoutPrograms = this.workoutPrograms.map((p: WorkoutProgram) =>
      p.id === workout.id ? { ...p, date: targetDate } : p
    );
    this.updateMonthGrid();

    this.workoutService.getWorkoutById(programId).subscribe({
      next: (plan: any) => {
        const workoutDays = [...(plan.workoutDays || [])];
        const dayIndex = workoutDays.findIndex((d: any) => d.id === workout.id);

        if (dayIndex === -1) {
          alert('Workout day not found in plan.');
          this.workoutPrograms = previousPrograms;
          this.updateMonthGrid();
          return;
        }

        workoutDays[dayIndex] = {
          ...workoutDays[dayIndex],
          date: targetDate,
        };

        const normalizedDays = this.normalizePlanDays(workoutDays);

        const updatedPlan = {
          ...plan,
          workoutDays: normalizedDays,
          endDate: normalizedDays.length
            ? normalizedDays[normalizedDays.length - 1].date
            : plan.endDate,
        };

        this.workoutService.updateWorkout(plan.id, updatedPlan).subscribe({
          next: () => this.getWorkout(),
          error: (err) => {
            console.error('Error moving workout day', err);
            alert('Failed to move workout day.');
            this.workoutPrograms = previousPrograms;
            this.updateMonthGrid();
          },
        });
      },
      error: (err) => {
        console.error('Error loading plan for move', err);
        alert('Failed to load workout plan.');
        this.workoutPrograms = previousPrograms;
        this.updateMonthGrid();
      },
    });
  }

  pasteDay(targetDate: string): void {
    if (!this.copiedDate) return;

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    const sourcePrograms = this.workoutPrograms.filter(
      (p: WorkoutProgram) =>
        p.date === this.copiedDate && p.clientId === this.selectedClient
    );

    if (!sourcePrograms.length) return;

    const lastPlan = this.getLastWorkoutPlanForClient(this.selectedClient);
    if (!lastPlan) {
      alert('No assigned workout plan found for this client.');
      return;
    }

    this.workoutService.getWorkoutById(lastPlan.programId).subscribe({
      next: (plan: any) => {
        const workoutDays = [...(plan.workoutDays || [])];

        sourcePrograms.forEach((program) => {
          const exists = workoutDays.some((d: any) => d.date === targetDate);
          if (exists) {
            return;
          }

          workoutDays.push(
            this.buildWorkoutDayFromCalendarProgram(
              program,
              targetDate,
              workoutDays.length + 1
            )
          );
        });

        const normalizedDays = this.normalizePlanDays(workoutDays);

        const updatedPlan = {
          ...plan,
          workoutDays: normalizedDays,
          endDate: normalizedDays.length
            ? normalizedDays[normalizedDays.length - 1].date
            : plan.endDate,
        };

        this.workoutService.updateWorkout(plan.id, updatedPlan).subscribe({
          next: () => {
            this.cancelCopy();
            this.getWorkout();
          },
          error: (err) => {
            console.error('Error pasting workout day', err);
            alert('Failed to paste workout day.');
          },
        });
      },
      error: (err) => {
        console.error('Error loading plan for paste', err);
        alert('Failed to load workout plan.');
      },
    });
  }

  addItem(dateStr: string): void {
    if (this.calendarType !== 'workout') {
      return;
    }

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    const lastPlan = this.getLastWorkoutPlanForClient(this.selectedClient);
    if (!lastPlan) {
      alert(
        'This client has no assigned workout plan yet. Please assign a workout plan first.'
      );
      return;
    }

    this.selectedDateString = dateStr;
    this.resetWorkoutForm();
    this.showAddWorkoutModal = true;
  }

  openEditWorkoutModal(workout: WorkoutProgram, event?: Event): void {
    event?.stopPropagation();

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    this.editingWorkout = workout;
    this.selectedDateString = workout.date;
    this.isRestDay = workout.sessions.length === 0;
    this.newWorkoutTitle = workout.title;
    this.newWorkoutExercises = this.cloneExercises(
      workout.sessions?.[0]?.exercises || []
    );
    this.exerciseSearchTerm = '';
    this.showExerciseSelector = false;
    this.showAddWorkoutModal = true;
  }

  closeAddWorkoutModal(): void {
    this.showAddWorkoutModal = false;
    this.resetWorkoutForm();
    this.selectedDateString = null;
  }

  toggleRestDay(): void {
    this.isRestDay = !this.isRestDay;
  }

  getSelectedDateLabel(): string {
    if (!this.selectedDateString) {
      return '';
    }
    const date = new Date(this.selectedDateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  openExerciseSelector(): void {
    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    this.showExerciseSelector = true;
  }

  closeExerciseSelector(): void {
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  getFilteredExercises(): Exercise[] {
    const term = this.exerciseSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    return this.availableExercises.filter((e) =>
      e.name.toLowerCase().includes(term)
    );
  }

  handleAddExerciseToWorkout(exercise: Exercise): void {
    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    const copy: Exercise = {
      ...exercise,
      id: `new-ex-${Date.now()}-${Math.random()}`,
      showVideo: false,
      videoUrl: undefined,
      rawVideoUrl: undefined,
      sets: exercise.sets
        ? exercise.sets.map((s, index) => ({
          ...s,
          id: `new-set-${Date.now()}-${index}`,
        }))
        : [],
    };
    this.newWorkoutExercises.push(copy);
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  handleRemoveExerciseFromWorkout(exerciseId: string): void {
    this.newWorkoutExercises = this.newWorkoutExercises.filter(
      (e) => e.id !== exerciseId
    );
  }

  addSetToExercise(exercise: Exercise): void {
    if (!exercise.sets) {
      exercise.sets = [];
    }
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const nextNumber = exercise.sets.length + 1;
    exercise.sets.push({
      id: `set-${Date.now()}`,
      number: nextNumber,
      reps: lastSet ? lastSet.reps : '8-12',
      rest: lastSet ? lastSet.rest : '60',
    });
  }

  removeSetFromExercise(exercise: Exercise, setIndex: number): void {
    if (!exercise.sets) {
      return;
    }
    exercise.sets.splice(setIndex, 1);
    exercise.sets.forEach((s, i) => (s.number = i + 1));
  }

  getRestMinutes(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    if (isNaN(total)) return 0;
    return Math.floor(total / 60);
  }

  getRestSeconds(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    if (isNaN(total)) return 0;
    return total % 60;
  }

  updateRestMinutes(set: ExerciseSet, minutes: number): void {
    const m = isNaN(minutes) ? 0 : minutes;
    const s = this.getRestSeconds(set);
    set.rest = String(m * 60 + s);
  }

  updateRestSeconds(set: ExerciseSet, seconds: number): void {
    const s = isNaN(seconds) ? 0 : seconds;
    const m = this.getRestMinutes(set);
    const sec = Math.min(Math.max(s, 0), 59);
    set.rest = String(m * 60 + sec);
  }

  toggleExerciseVideo(exercise: Exercise): void {
    exercise.showVideo = !exercise.showVideo;
    if (exercise.showVideo && !exercise.videoUrl) {
      const videoId = this.extractYoutubeId(exercise.youtubeUrl || '');
      if (videoId) {
        exercise.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${videoId}`
        );
        exercise.rawVideoUrl = exercise.youtubeUrl;
      }
    }
  }

  extractYoutubeId(url: string): string | null {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  }

  handleSaveWorkout(): void {
    if (!this.selectedDateString) {
      return;
    }

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    const lastPlan = this.getLastWorkoutPlanForClient(this.selectedClient);

    if (!lastPlan) {
      alert('No assigned workout plan found for this client.');
      return;
    }

    this.workoutService.getWorkoutById(lastPlan.programId).subscribe({
      next: (plan: any) => {
        const workoutDays = [...(plan.workoutDays || [])];
        const targetDate = this.selectedDateString!;
        const nextDayNumber = workoutDays.length + 1;

        if (this.editingWorkout) {
          const existingIndex = workoutDays.findIndex(
            (d: any) => d.id === this.editingWorkout?.id
          );

          if (existingIndex === -1) {
            alert('Workout day not found in plan.');
            return;
          }

          const duplicate = workoutDays.some(
            (d: any) =>
              d.id !== this.editingWorkout?.id && d.date === targetDate
          );

          if (duplicate) {
            alert('Another workout day already exists for this date.');
            return;
          }

          workoutDays[existingIndex] = this.buildWorkoutDayPayload(
            targetDate,
            nextDayNumber,
            this.editingWorkout.id
          );
        } else {
          const exists = workoutDays.some((d: any) => d.date === targetDate);

          if (exists) {
            alert('A workout day already exists for this date.');
            return;
          }

          workoutDays.push(
            this.buildWorkoutDayPayload(targetDate, nextDayNumber)
          );
        }

        const normalizedDays = this.normalizePlanDays(workoutDays);

        const updatedPlan = {
          ...plan,
          workoutDays: normalizedDays,
          endDate: normalizedDays.length
            ? normalizedDays[normalizedDays.length - 1].date
            : plan.endDate,
        };

        this.workoutService.updateWorkout(plan.id, updatedPlan).subscribe({
          next: () => {
            this.closeAddWorkoutModal();
            this.getWorkout();
          },
          error: (err) => {
            console.error('Error saving workout day', err);
            alert('Failed to save workout day.');
          },
        });
      },
      error: (err) => {
        console.error('Error loading plan before save', err);
        alert('Failed to load workout plan.');
      },
    });
  }

  openDeleteModal(workout: WorkoutProgram, event?: Event): void {
    event?.stopPropagation();

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    this.workoutToDelete = workout;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.workoutToDelete = null;
  }

  handleDeleteWorkout(): void {
    if (!this.workoutToDelete) return;

    if (!this.canManageWorkoutDays()) {
      alert('Please select a client first.');
      return;
    }

    if (!this.workoutToDelete.programId) {
      alert('This workout day is not linked to a plan.');
      return;
    }

    this.workoutService
      .getWorkoutById(this.workoutToDelete.programId)
      .subscribe({
        next: (plan: any) => {
          const workoutDays = [...(plan.workoutDays || [])].filter(
            (d: any) => d.id !== this.workoutToDelete?.id
          );

          const normalizedDays = this.normalizePlanDays(workoutDays);

          const updatedPlan = {
            ...plan,
            workoutDays: normalizedDays,
            endDate: normalizedDays.length
              ? normalizedDays[normalizedDays.length - 1].date
              : plan.startDate,
          };

          this.workoutService.updateWorkout(plan.id, updatedPlan).subscribe({
            next: () => {
              this.closeDeleteModal();
              this.getWorkout();
            },
            error: (err) => {
              console.error('Error deleting workout day', err);
              alert('Failed to delete workout day.');
            },
          });
        },
        error: (err) => {
          console.error('Error loading plan before delete', err);
          alert('Failed to load workout plan.');
        },
      });
  }

  private getLastWorkoutPlanForClient(
    clientId?: string
  ): WorkoutPlanRef | null {
    const clientWorkouts = this.workoutPrograms
      .filter((w: WorkoutProgram) => w.clientId === clientId && !!w.programId)
      .sort(
        (a: WorkoutProgram, b: WorkoutProgram) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

    if (!clientWorkouts.length) {
      return null;
    }

    const lastWorkout = clientWorkouts[clientWorkouts.length - 1];

    if (!lastWorkout.programId || !lastWorkout.programName) {
      return null;
    }

    return {
      programId: lastWorkout.programId,
      programName: lastWorkout.programName,
    };
  }

  private normalizePlanDays(workoutDays: any[]): any[] {
    return [...workoutDays]
      .map((day) => {
        const date = day.date;
        const dateObj = new Date(date);

        return {
          ...day,
          date,
          dayOfWeek: dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
          }),
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((day, index) => ({
        ...day,
        dayNumber: index + 1,
        title: day.restDay ? 'Rest Day' : `Day ${index + 1}`,
      }));
  }

  private buildWorkoutDayPayload(
    date: string,
    dayNumber: number,
    existingId?: string
  ): any {
    const dayDate = new Date(date);
    const dayOfWeek = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

    if (this.isRestDay) {
      return {
        id: existingId || crypto.randomUUID(),
        date,
        dayOfWeek,
        restDay: true,
        dayNumber,
        title: 'Rest Day',
        description: '',
        workoutSessions: [],
        status: 'PENDING',
      };
    }

    return {
      id: existingId || crypto.randomUUID(),
      date,
      dayOfWeek,
      restDay: false,
      dayNumber,
      title: this.newWorkoutTitle.trim(),
      description: '',
      workoutSessions: [
        {
          name: this.newWorkoutTitle.trim() || 'Main Session',
          exercises: this.newWorkoutExercises.map((ex) => ({
            id: ex.id || crypto.randomUUID(),
            name: ex.name,
            type: ex.type === 'cardio' ? 'CARDIO' : 'STRENGTH',
            youtubeUrl: ex.youtubeUrl || null,
            sets:
              ex.type === 'strength'
                ? (ex.sets || []).map((set, index) => {
                  const total = parseInt(set.rest, 10) || 0;
                  return {
                    setNumber: set.number ?? index + 1,
                    reps: set.reps ? Number(set.reps) : null,
                    restMin: Math.floor(total / 60),
                    restSec: total % 60,
                  };
                })
                : [],
          })),
        },
      ],
      status: 'PENDING',
    };
  }

  private buildWorkoutDayFromCalendarProgram(
    program: WorkoutProgram,
    date: string,
    dayNumber: number
  ): any {
    const dayDate = new Date(date);
    const dayOfWeek = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

    return {
      id: crypto.randomUUID(),
      date,
      dayOfWeek,
      restDay: program.sessions.length === 0,
      dayNumber,
      title: program.title,
      description: '',
      workoutSessions:
        program.sessions.length === 0
          ? []
          : program.sessions.map((session) => ({
            name: session.notes || program.title || 'Main Session',
            exercises: (session.exercises || []).map((ex) => ({
              id: crypto.randomUUID(),
              name: ex.name,
              type: ex.type === 'cardio' ? 'CARDIO' : 'STRENGTH',
              youtubeUrl: ex.youtubeUrl || null,
              sets:
                ex.type === 'strength'
                  ? (ex.sets || []).map((set, index) => {
                    const total = parseInt(set.rest, 10) || 0;
                    return {
                      setNumber: set.number ?? index + 1,
                      reps: set.reps ? Number(set.reps) : null,
                      restMin: Math.floor(total / 60),
                      restSec: total % 60,
                    };
                  })
                  : [],
            })),
          })),
      status: 'PENDING',
    };
  }
}
