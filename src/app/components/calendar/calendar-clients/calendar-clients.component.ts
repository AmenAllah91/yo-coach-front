import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ClientService } from 'app/service/client.service';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ExerciseService, PageResponse } from 'app/service/exercise.service';
import { Exercise as LibraryExercise } from '@shared/models/exercice.models';
import { WorkoutPlan } from '@shared/models/workout.models';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
  showVideo?: boolean;
  videoUrl?: SafeResourceUrl;
  rawVideoUrl?: string;
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
  dayNumber?: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: NutritionMeal[];
  emptyDay?: boolean;
}

type CalendarViewMode = 'month' | 'week' | 'day';
type CalendarType = 'workout' | 'nutrition';

@Component({
  selector: 'app-calendar-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TranslateModule],
  templateUrl: './calendar-clients.component.html',
  styleUrl: './calendar-clients.component.scss',
})
export class CalendarClientsComponent implements OnInit, OnChanges, OnDestroy {

  workoutFileEnabled = true;
  nutritionFileEnabled = true;
currentDate = new Date();
  currentView: CalendarViewMode = 'month';
  calendarType: CalendarType = 'workout';
  selectedClient: string = '';
  copiedDate: string | null = null;

  coachId: string | null = sessionStorage.getItem('userId');

  selectedWorkout: WorkoutProgram | null = null;
  selectedNutritionDay: NutritionProgram | null = null;
  showWorkoutDetails = false;
  showNutritionDetails = false;

  showAddWorkoutModal = false;
  showCreateProgramModal = false;
  createProgramName = '';
  createProgramDurationWeeks = 4;
  createProgramStartDate = '';
  readonly createProgramDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  createProgramSaving = false;
  isRestDay = false;
  selectedDateString: string | null = null;

  newWorkoutTitle = '';
  newWorkoutExercises: Exercise[] = [];

  showExerciseSelector = false;
  exerciseSearchTerm = '';
  exerciseMuscleFilter = '';
  exerciseEquipmentFilter = '';
  exerciseTypeFilter = '';
  exerciseSelectorLoading = false;
  openSetTypeKey: string | null = null;

  muscleOptions = [
    { value: 'CHEST', label: 'Chest' },
    { value: 'BACK', label: 'Back' },
    { value: 'SHOULDERS', label: 'Shoulders' },
    { value: 'ARMS', label: 'Arms' },
    { value: 'LEGS', label: 'Legs' },
    { value: 'CORE', label: 'Core' },
  ];

  equipmentOptions = [
    { value: 'BARBELL', label: 'Barbell' },
    { value: 'DUMBBELL', label: 'Dumbbell' },
    { value: 'CABLE', label: 'Cable' },
    { value: 'MACHINE', label: 'Machine' },
    { value: 'BODYWEIGHT', label: 'Bodyweight' },
  ];

  typeOptions = [
    { value: 'CARDIO', label: 'Cardio' },
    { value: 'MUSCULATION', label: 'Musculation' },
    { value: 'STRENGTH', label: 'Strength' },
  ];

  showDeleteModal = false;
  workoutToDelete: WorkoutProgram | null = null;
  editingWorkout: WorkoutProgram | null = null;

  // Fix: Add connected lists for drag and drop
  connectedLists: string[] = [];

  private beforeToggleHandler: ((e: Event) => void) | null = null;

  availableExercises: Exercise[] = [];

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
    private coachSettingsService: CoachSettingsService,
    private exerciseService: ExerciseService,
    private translate: TranslateService
  ) {}

  @HostListener('document:click')
  closeSetTypeMenuOnDocumentClick(): void {
    this.openSetTypeKey = null;
  }

  ngOnInit(): void {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
        this.updateMonthGrid();
      },
      error: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
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
      this.selectedClient = this.embeddedClientId || '';
      this.getWorkout();
      this.getNutrition();
    }
  }

  onClientChange(clientId: string): void {
    this.selectedClient = clientId;
    this.getWorkout();
    this.getNutrition();
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
    this.getNutrition();
  }

  getNutrition(): void {
    if (!this.coachId || !this.selectedClient || this.selectedClient === 'all') {
      this.nutritionPrograms = [];
      this.updateMonthGrid();
      return;
    }

    this.nutritionService
      .getNutritionPlanByCoachIdAndClient(this.coachId, this.selectedClient, 0, 500, 'ALL')
      .subscribe({
        next: (res) => {
          this.nutritionPrograms = this.mapBackendToNutritionPrograms(res.content || []);
          console.log('CLIENT ASSIGNED NUTRITION PROGRAMS', this.nutritionPrograms);
          this.updateMonthGrid();
        },
        error: (err) => {
          console.error('Error loading client assigned nutrition plans', err);
          this.nutritionPrograms = [];
          this.updateMonthGrid();
        },
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
        .getWorkoutByCoachIdAndClient(this.coachId, this.selectedClient, 0, 500, 'ALL')
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

    this.workoutPrograms = [];
    this.updateMonthGrid();
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isBackendFileWorkoutPlan(plan: any): boolean {
    if (!this.workoutFileEnabled) {
      return false;
    }

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

  hasFileWorkoutItems(items: (WorkoutProgram | NutritionProgram)[]): boolean {
    return this.calendarType === 'workout' && items.some((item) => this.isFileWorkoutItem(item));
  }

  hasInteractiveWorkoutItems(items: (WorkoutProgram | NutritionProgram)[]): boolean {
    return (
      this.calendarType === 'workout' &&
      items.some((item) => !this.isFileWorkoutItem(item))
    );
  }

  hasFileRangeStarting(
    items: (WorkoutProgram | NutritionProgram)[],
    dateStr: string
  ): boolean {
    return items.some(
      (item) =>
        this.isFileWorkoutItem(item) && this.isFileRangeStart(item, dateStr)
    );
  }

  getFileResourceType(item: WorkoutProgram | NutritionProgram): 'PDF' | 'EXCEL' {
    return ((item as WorkoutProgram).resourceType || 'PDF') as 'PDF' | 'EXCEL';
  }

  getFileProgramSubtitle(item: WorkoutProgram | NutritionProgram): string {
    return this.translate.instant(this.getFileResourceType(item) === 'EXCEL' ? 'EXCEL_PROGRAM' : 'PDF_PROGRAM');
  }

  getCalendarCardProgramName(item: WorkoutProgram | NutritionProgram): string {
    return item.programName || item.title || this.translate.instant('PROGRAM');
  }

  getCalendarCardDayLabel(item: WorkoutProgram | NutritionProgram): string {
    const dayNumber = Number((item as WorkoutProgram | NutritionProgram).dayNumber || this.extractDayNumber(item.title) || 1);
    const weekNumber = Math.max(1, Math.ceil(dayNumber / 7));
    return this.translate.instant('WEEK_DAY_LABEL', { week: weekNumber, day: dayNumber });
  }

  private extractDayNumber(value: string | undefined): number | null {
    const match = String(value || '').match(/day\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deduplicateBackendWorkoutPlans(plans: any[]): any[] {
    const map = new Map<string, any>();

    (plans || []).forEach((plan) => {
      const isFile = this.isBackendFileWorkoutPlan(plan);
      const startDate = this.toCalendarDateOnly(plan?.startDate) || this.toCalendarDateOnly(plan?.workoutDays?.[0]?.date) || '';
      const endDate = this.getNormalizedWorkoutEndDate(plan, startDate, isFile) || startDate;
      const clientId = plan?.client?.id || plan?.client?._id || '';
      const source = plan?.sourceWorkoutPlanId || String(plan?.name || '').trim().toLowerCase();
      const fileKey = isFile
        ? String(plan?.fileName || plan?.originalFileName || plan?.fileUrl || '').trim().toLowerCase()
        : 'APP';

      const key = `${clientId}|${source}|${fileKey}|${startDate}|${endDate}`;

      if (!map.has(key)) {
        map.set(key, plan);
      }
    });

    return Array.from(map.values());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBackendToWorkoutPrograms(plans: any[]): WorkoutProgram[] {
    const result: WorkoutProgram[] = [];

    plans = this.deduplicateBackendWorkoutPlans(plans);

    plans.forEach((plan) => {
      const isFilePlan = this.isBackendFileWorkoutPlan(plan);
      const startDate = this.toCalendarDateOnly(plan.startDate) || this.toCalendarDateOnly(plan.workoutDays?.[0]?.date);
      const endDate = this.getNormalizedWorkoutEndDate(plan, startDate, isFilePlan) || startDate;

      // Imported PDF / Excel workout programs do not have workoutDays.
      // We display them in the calendar during their assigned period.
      // Existing in-app workout day logic below is untouched.
      if (isFilePlan) {
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
                showVideo: false,
                videoUrl: undefined,
                rawVideoUrl: undefined,
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
          restDay: day.restDay,
          emptyDay: !day.restDay && sessions.length === 0,
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
      if (this.nutritionFileEnabled === false && this.isFileNutritionPlan(plan)) {
        return;
      }
      this.expandNutritionDaysForRange(plan).forEach((day: any) => {
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
            programName: plan.name,
            dayNumber: day.dayNumber ?? 1,
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            meals: [],
            emptyDay: true,
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
          dayNumber: day.dayNumber ?? 1,
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

  private expandNutritionDaysForRange(plan: any): any[] {
    const days = [...(plan?.mealDays || [])];
    const startDate = this.toCalendarDateOnly(plan?.startDate);
    const endDate = this.toCalendarDateOnly(plan?.endDate);

    if (!startDate) {
      return days;
    }

    const expectedDays = endDate
      ? this.daysBetween(startDate, endDate) + 1
      : days.length;

    const normalizedDays = days.map((day, index) => ({
      ...day,
      date: this.toCalendarDateOnly(day?.date) || this.addDays(startDate, index),
      dayNumber: day?.dayNumber || index + 1,
    }));

    while (normalizedDays.length < expectedDays) {
      const index = normalizedDays.length;
      const template = normalizedDays[normalizedDays.length - 1] || {};

      normalizedDays.push({
        ...template,
        id: undefined,
        date: this.addDays(startDate, index),
        dayNumber: index + 1,
      });
    }

    return normalizedDays;
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
    if (!this.selectedClient) {
      return [];
    }

    if (this.calendarType === 'workout') {
      return this.workoutPrograms
        .filter((p: WorkoutProgram) => {
          const matchesClient =
            p.clientId === this.selectedClient;

          if (!matchesClient) {
            return false;
          }

          if (p.fileProgram) {
            return this.shouldRenderFileRangeOnDate(p, dateStr);
          }

          return p.date === dateStr;
        })
        .sort((a, b) => {
          // File ranges must always reserve the first rows of every day cell.
          // Interactive workout cards are then rendered underneath them.
          const fileOrder = Number(!!b.fileProgram) - Number(!!a.fileProgram);

          if (fileOrder !== 0) {
            return fileOrder;
          }

          if (a.fileProgram && b.fileProgram) {
            const startOrder = String(a.startDate || a.date).localeCompare(
              String(b.startDate || b.date)
            );

            if (startOrder !== 0) {
              return startOrder;
            }

            return a.title.localeCompare(b.title);
          }

          return 0;
        });
    } else {
      return this.nutritionPrograms.filter(
        (p) =>
          p.date === dateStr &&
          p.clientId === this.selectedClient
      );
    }
  }

  hasSelectedClient(): boolean {
    return this.hideClientFilter || !!this.selectedClient;
  }

  getExerciseSummary(exercise: Exercise): string {
    const sets = exercise.sets || [];
    const setCount = sets.length;
    const firstSet = sets[0];
    const reps = firstSet?.reps ? this.translate.instant('REPS_COUNT', { count: firstSet.reps }) : '';
    const rest = firstSet?.rest ? this.translate.instant('REST_DURATION', { duration: this.formatRestTime(firstSet.rest) }) : '';

    if (exercise.type === 'cardio') {
      const setDuration = Number(firstSet?.duration) || 0;
      const durationValue =
        setDuration ||
        (setCount && exercise.duration
          ? Math.round(Number(exercise.duration) / setCount)
          : Number(exercise.duration) || 0);
      const duration = durationValue ? this.translate.instant('MINUTES_COUNT', { count: durationValue }) : '';
      return [setCount ? this.translate.instant(setCount > 1 ? 'SETS_COUNT' : 'SET_COUNT', { count: setCount }) : '', duration]
        .filter(Boolean)
        .join(' x ');
    }

    return [
      setCount ? `${setCount} x` : '',
      reps,
      rest,
    ]
      .filter(Boolean)
      .join(' ');
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
    // Keep the item in each covered month cell so its row is reserved and
    // interactive workouts are placed below the spanning file bar.
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

    if (this.currentView === 'month') {
      return this.isFileRangeStart(workoutItem, dateStr);
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
    return ['WEEKDAY_MON', 'WEEKDAY_TUE', 'WEEKDAY_WED', 'WEEKDAY_THU', 'WEEKDAY_FRI', 'WEEKDAY_SAT', 'WEEKDAY_SUN'];
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
          .toLocaleDateString(this.calendarLocale, { weekday: 'short' })
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
        type: set.type || 'REGULAR',
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
        p.clientId === this.selectedClient
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

    this.openEditWorkoutModal(workout, event);
  }

  startWorkoutPointerDrag(
    event: MouseEvent | TouchEvent,
    workout: WorkoutProgram,
    sourceDate: string
  ): void {
    if (this.calendarType !== 'workout') return;

    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_ONE_CLIENT_DRAG_WORKOUT'));
      return;
    }

    if (!workout?.programId) {
      alert(this.translate.instant('WORKOUT_DAY_NO_PROGRAM'));
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
    const rect = card.getBoundingClientRect();
    const ghostWidth = Math.max(rect.width, 190);

    ghost.classList.add('calendar-pointer-drag-ghost');
    ghost.style.width = `${ghostWidth}px`;
    ghost.style.minWidth = `${ghostWidth}px`;
    ghost.style.maxWidth = `${ghostWidth}px`;
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
    const ghost = this.pointerDragState?.ghost;
    const previousDisplay = ghost?.style.display;

    if (ghost) {
      ghost.style.display = 'none';
    }

    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;

    if (ghost) {
      ghost.style.display = previousDisplay || '';
    }

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
      alert(this.translate.instant('SELECT_ONE_CLIENT_DRAG_WORKOUT'));
      this.getWorkout();
      return;
    }

    const programId = workout.programId;
    if (!programId) {
      alert(this.translate.instant('WORKOUT_DAY_NO_PROGRAM'));
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
      alert(this.translate.instant('TARGET_DATE_HAS_WORKOUT'));
      return;
    }

    const previousPrograms = [...this.workoutPrograms];

    this.workoutPrograms = this.workoutPrograms.map((p: WorkoutProgram) =>
      p.id === workout.id ? { ...p, date: targetDate } : p
    );
    this.updateMonthGrid();

    this.workoutService.updateWorkoutDay(
      programId,
      workout.id,
      this.buildWorkoutDayRequestFromCalendarProgram(workout, targetDate)
    ).subscribe({
      next: () => this.getWorkout(),
      error: (err) => {
        console.error('Error moving workout day', err);
        alert(this.translate.instant('MOVE_WORKOUT_DAY_ERROR'));
        this.workoutPrograms = previousPrograms;
        this.updateMonthGrid();
      },
    });
  }

  pasteDay(targetDate: string): void {
    if (!this.copiedDate) return;

    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    const sourcePrograms = this.workoutPrograms.filter(
      (p: WorkoutProgram) =>
        p.date === this.copiedDate && p.clientId === this.selectedClient
    );

    if (!sourcePrograms.length) return;

    const sourceProgram = sourcePrograms[0] as WorkoutProgram;

    if (!sourceProgram?.programId) {
      alert(this.translate.instant('NO_ASSIGNED_WORKOUT_DAY'));
      return;
    }

    const exists = this.workoutPrograms.some(
      (p: WorkoutProgram) =>
        p.date === targetDate && p.clientId === this.selectedClient
    );

    if (exists) {
      alert(this.translate.instant('WORKOUT_DAY_ALREADY_EXISTS'));
      return;
    }

    this.workoutService.addWorkoutDay(
      sourceProgram.programId,
      this.buildWorkoutDayRequestFromCalendarProgram(sourceProgram, targetDate)
    ).subscribe({
      next: () => {
        this.cancelCopy();
        this.getWorkout();
      },
      error: (err) => {
        console.error('Error pasting workout day', err);
        alert(this.translate.instant('PASTE_WORKOUT_DAY_ERROR'));
      },
    });
  }

  addItem(dateStr: string): void {
    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    const existingItems = this.getItemsForDay(dateStr);

    if (existingItems.length === 0) {
      this.openCreateProgramModal(dateStr);
      return;
    }

    const emptyItem = existingItems.find((item: any) => item.emptyDay);
    if (emptyItem) {
      if (this.calendarType === 'nutrition') {
        this.viewNutrition(emptyItem as NutritionProgram);
        return;
      }

      this.openEditWorkoutModal(emptyItem as WorkoutProgram);
      return;
    }

    if (this.calendarType !== 'workout') {
      return;
    }

    const lastPlan = this.getLastWorkoutPlanForClient(this.selectedClient);
    if (!lastPlan) {
      this.openCreateProgramModal(dateStr);
      return;
    }

    this.selectedDateString = dateStr;
    this.resetWorkoutForm();
    this.showAddWorkoutModal = true;
  }

  openCreateProgramModal(dateStr: string): void {
    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    this.createProgramName = '';
    this.createProgramDurationWeeks = 4;
    this.createProgramStartDate = dateStr;
    this.createProgramSaving = false;
    this.showCreateProgramModal = true;
  }

  closeCreateProgramModal(): void {
    if (this.createProgramSaving) return;

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
      && !this.createProgramSaving;
  }

  submitCreateProgramModal(): void {
    if (!this.canCreateCalendarProgram) return;

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
    if (!client) return 'selected client';

    return `${client.firstName || ''} ${client.lastName || ''}`.trim()
      || client.name
      || 'selected client';
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
      next: () => {
        this.createProgramSaving = false;
        this.closeCreateProgramModal();
        this.getWorkout();
      },
      error: (err) => {
        console.error('Error creating calendar workout program', err);
        this.createProgramSaving = false;
        alert(this.translate.instant('CREATE_WORKOUT_PROGRAM_ERROR'));
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
      next: () => {
        this.createProgramSaving = false;
        this.closeCreateProgramModal();
        this.getNutrition();
      },
      error: (err) => {
        console.error('Error creating calendar nutrition program', err);
        this.createProgramSaving = false;
        alert(this.translate.instant('CREATE_NUTRITION_PROGRAM_ERROR'));
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

  openEditWorkoutModal(workout: WorkoutProgram, event?: Event): void {
    event?.stopPropagation();

    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    this.editingWorkout = workout;
    this.selectedDateString = workout.date;
    this.isRestDay = workout.restDay ?? workout.sessions.length === 0;
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
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    this.showExerciseSelector = true;
    this.loadAvailableExercises();
  }

  closeExerciseSelector(): void {
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
    this.exerciseMuscleFilter = '';
    this.exerciseEquipmentFilter = '';
    this.exerciseTypeFilter = '';
  }

  getFilteredExercises(): Exercise[] {
    return this.availableExercises;
  }

  onExerciseSearchChange(): void {
    this.loadAvailableExercises();
  }

  shouldShowCalendarWeightField(): boolean {
    return this.coachSettingsService.shouldShowExerciseWeight();
  }

  get weightUnitLabel(): string {
    return this.coachSettingsService.getWeightUnit();
  }

  private getDefaultWeightForExercise(type: Exercise['type']): number | null {
    return type === 'cardio' || !this.shouldShowCalendarWeightField() ? null : 0;
  }

  private loadAvailableExercises(): void {
    this.exerciseSelectorLoading = true;

    this.exerciseService
      .getExercises(0, 50, {
        name: this.exerciseSearchTerm.trim(),
        muscle: this.exerciseMuscleFilter,
        equipment: this.exerciseEquipmentFilter,
        type: this.exerciseTypeFilter,
      })
      .subscribe({
        next: (res: PageResponse<LibraryExercise>) => {
          this.availableExercises = (res.content || []).map((exercise) =>
            this.normalizeLibraryExercise(exercise)
          );
          this.exerciseSelectorLoading = false;
        },
        error: (err) => {
          console.error('Error loading exercises for calendar modal', err);
          this.availableExercises = [];
          this.exerciseSelectorLoading = false;
        },
      });
  }

  private normalizeLibraryExercise(exercise: LibraryExercise): Exercise {
    const type = String(exercise.type || '').toUpperCase() === 'CARDIO'
      ? 'cardio'
      : 'strength';
    const videoLink = this.getExerciseVideoLink(exercise);
    const thumbnail = this.getExerciseThumbnail(exercise);

    return {
      id: exercise.id || `library-ex-${Date.now()}-${Math.random()}`,
      name: exercise.name || 'Untitled Exercise',
      type,
      youtubeUrl: videoLink || undefined,
      videoLink: videoLink || undefined,
      thumbnail: thumbnail || undefined,
      imageUrl: thumbnail || undefined,
      duration: type === 'cardio' ? Number(exercise.duration || 30) : undefined,
      sets: this.buildInitialExerciseSets(type),
    };
  }

  private buildInitialExerciseSets(type: Exercise['type']): ExerciseSet[] {
    const autoFill = this.coachSettingsService.shouldAutoFillWorkoutDefaults();

    if (type === 'cardio') {
      const count = autoFill ? this.coachSettingsService.getCardioSets() : 1;
      const minutes = autoFill ? this.coachSettingsService.getCardioMinutes() : 30;

      return Array.from({ length: count }, (_, index) => ({
          id: `library-cardio-set-${Date.now()}-${index}`,
          number: index + 1,
          reps: '',
          rest: '60',
          weight: null,
          duration: minutes,
          type: 'REGULAR',
        }));
    }

    const count = autoFill ? this.coachSettingsService.getWorkoutSets() : 1;
    const reps = autoFill ? this.coachSettingsService.getWorkoutReps() : '8';

    return Array.from({ length: count }, (_, index) => ({
        id: `library-set-${Date.now()}-${index}`,
        number: index + 1,
        reps,
        rest: '60',
        weight: this.getDefaultWeightForExercise('strength'),
        type: 'REGULAR',
      }));
  }

  private cleanExerciseValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') {
      return '';
    }
    return text;
  }

  private getExerciseRef(exercise: any): any {
    return exercise?.exerciseRef || exercise?.ref || exercise?.exercise || null;
  }

  private getExerciseRefId(exercise: any): string {
    const ref = this.getExerciseRef(exercise);
    const rawId =
      exercise?.exerciseRefId ||
      exercise?.refId ||
      ref?.id ||
      ref?._id ||
      ref?.['$oid'];

    if (rawId && typeof rawId === 'object') {
      return this.cleanExerciseValue(rawId.id || rawId._id || rawId['$oid']);
    }

    return this.cleanExerciseValue(rawId);
  }

  private getExerciseVideoLink(exercise: any): string {
    const ref = this.getExerciseRef(exercise);

    return (
      this.cleanExerciseValue(exercise?.videoLink) ||
      this.cleanExerciseValue(exercise?.videoUrl) ||
      this.cleanExerciseValue(exercise?.youtubeUrl) ||
      this.cleanExerciseValue(exercise?.video) ||
      this.cleanExerciseValue(exercise?.url) ||
      this.cleanExerciseValue(ref?.videoLink) ||
      this.cleanExerciseValue(ref?.videoUrl) ||
      this.cleanExerciseValue(ref?.youtubeUrl) ||
      this.cleanExerciseValue(ref?.video) ||
      this.cleanExerciseValue(ref?.url)
    );
  }

  private getExerciseImageUrl(exercise: any): string {
    const ref = this.getExerciseRef(exercise);

    return (
      this.cleanExerciseValue(exercise?.imageUrl) ||
      this.cleanExerciseValue(exercise?.image) ||
      this.cleanExerciseValue(exercise?.thumbnailUrl) ||
      this.cleanExerciseValue(exercise?.thumbnail) ||
      this.cleanExerciseValue(exercise?.photoUrl) ||
      this.cleanExerciseValue(exercise?.pictureUrl) ||
      this.cleanExerciseValue(ref?.imageUrl) ||
      this.cleanExerciseValue(ref?.image) ||
      this.cleanExerciseValue(ref?.thumbnailUrl) ||
      this.cleanExerciseValue(ref?.thumbnail) ||
      this.cleanExerciseValue(ref?.photoUrl) ||
      this.cleanExerciseValue(ref?.pictureUrl)
    );
  }

  getExerciseThumbnail(exercise: any): string {
    const imageUrl = this.getExerciseImageUrl(exercise);
    if (imageUrl) return imageUrl;

    const videoUrl =
      this.getExerciseVideoLink(exercise) ||
      this.cleanExerciseValue(exercise?.youtubeUrl);
    const videoId = this.extractYoutubeId(videoUrl);

    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  handleAddExerciseToWorkout(exercise: Exercise): void {
    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    const copy: Exercise = {
      ...exercise,
      id: `new-ex-${Date.now()}-${Math.random()}`,
      thumbnail: exercise.thumbnail || this.getExerciseThumbnail(exercise),
      imageUrl: exercise.imageUrl || exercise.thumbnail || this.getExerciseThumbnail(exercise),
      showVideo: false,
      videoUrl: undefined,
      rawVideoUrl: undefined,
      sets: exercise.sets && exercise.sets.length
        ? exercise.sets.map((s, index) => ({
          ...s,
          id: `new-set-${Date.now()}-${index}`,
          duration: s.duration ?? exercise.duration,
          weight: s.weight ?? this.getDefaultWeightForExercise(exercise.type),
          type: s.type || 'REGULAR',
        }))
        : exercise.type === 'cardio'
          ? [
            {
              id: `new-set-${Date.now()}-0`,
              number: 1,
              reps: '',
              rest: '60',
              weight: null,
              duration: exercise.duration || 30,
              type: 'REGULAR',
            },
          ]
          : [],
    };
    this.newWorkoutExercises.push(copy);
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  handleRemoveExerciseFromWorkout(exerciseId: string): void {
    const exercise = this.newWorkoutExercises.find((e) => e.id === exerciseId);
    const groupId = exercise?.supersetGroupId || null;

    this.newWorkoutExercises = this.newWorkoutExercises.filter(
      (e) => e.id !== exerciseId
    );

    this.clearInvalidCalendarSupersetGroup(groupId);
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
      reps: lastSet ? lastSet.reps : this.coachSettingsService.getWorkoutReps(),
      rest: lastSet ? lastSet.rest : '60',
      weight: lastSet?.weight ?? this.getDefaultWeightForExercise(exercise.type),
      duration: exercise.type === 'cardio'
        ? Number(lastSet?.duration || exercise.duration || this.coachSettingsService.getCardioMinutes())
        : undefined,
      type: lastSet?.type || 'REGULAR',
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

  updateSetMainValue(exercise: Exercise, set: ExerciseSet, value: string | number): void {
    if (exercise.type === 'cardio') {
      set.duration = Number(value) || 0;
      exercise.duration = (exercise.sets || []).reduce(
        (sum, currentSet) => sum + (Number(currentSet.duration) || 0),
        0
      );
      return;
    }

    set.reps = String(value ?? '');
  }

  getSetDisplayLabel(set: ExerciseSet, index: number): string {
    switch (set.type || 'REGULAR') {
      case 'WARM_UP':
        return 'W';
      case 'DROP_SET':
        return 'D';
      case 'FAILURE':
        return 'F';
      default:
        return String(set.number || index + 1);
    }
  }

  getSetTypeClass(type?: ExerciseSet['type']): string {
    switch (type || 'REGULAR') {
      case 'WARM_UP':
        return 'set-type-warmup';
      case 'DROP_SET':
        return 'set-type-dropset';
      case 'FAILURE':
        return 'set-type-failure';
      default:
        return 'set-type-regular';
    }
  }

  toggleSetTypeMenu(exerciseId: string, setIndex: number, event?: MouseEvent): void {
    event?.stopPropagation();
    const key = `${exerciseId}-${setIndex}`;
    this.openSetTypeKey = this.openSetTypeKey === key ? null : key;
  }

  isSetTypeMenuOpen(exerciseId: string, setIndex: number): boolean {
    return this.openSetTypeKey === `${exerciseId}-${setIndex}`;
  }

  selectSetType(
    exercise: Exercise,
    setIndex: number,
    type: ExerciseSet['type'],
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    const set = exercise.sets?.[setIndex];
    if (!set) return;

    set.type = type;
    set.number = setIndex + 1;
    this.openSetTypeKey = null;
  }

  canToggleCalendarSuperset(index: number): boolean {
    return index >= 0 && index < this.newWorkoutExercises.length - 1;
  }

  isCalendarSupersetPair(index: number): boolean {
    const current = this.newWorkoutExercises[index];
    const next = this.newWorkoutExercises[index + 1];
    return !!current?.supersetGroupId && current.supersetGroupId === next?.supersetGroupId;
  }

  private getCalendarSupersetRun(groupId: string | null | undefined): Exercise[] {
    if (!groupId) return [];

    return this.newWorkoutExercises.filter(
      (exercise) => exercise.supersetGroupId === groupId
    );
  }

  private getContiguousCalendarSupersetRun(index: number): {
    start: number;
    end: number;
    groupId: string | null;
  } {
    const list = this.newWorkoutExercises;
    const groupId = list[index]?.supersetGroupId || null;

    if (!groupId) {
      return { start: index, end: index, groupId: null };
    }

    let start = index;
    let end = index;

    while (start > 0 && list[start - 1]?.supersetGroupId === groupId) {
      start -= 1;
    }

    while (end < list.length - 1 && list[end + 1]?.supersetGroupId === groupId) {
      end += 1;
    }

    return { start, end, groupId };
  }

  private clearInvalidCalendarSupersetGroup(groupId: string | null | undefined): void {
    if (!groupId) return;

    const group = this.getCalendarSupersetRun(groupId);

    if (group.length < 2) {
      group.forEach((exercise) => (exercise.supersetGroupId = null));
    }
  }

  private getNewCalendarSupersetGroupId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `calendar-superset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  toggleCalendarSuperset(index: number): void {
    if (!this.canToggleCalendarSuperset(index)) return;

    const list = this.newWorkoutExercises;
    const current = list[index];
    const next = list[index + 1];

    if (this.isCalendarSupersetPair(index)) {
      const groupId = current.supersetGroupId;

      const rightRun = this.getContiguousCalendarSupersetRun(index + 1);

      for (let idx = index + 1; idx <= rightRun.end; idx += 1) {
        if (list[idx]?.supersetGroupId === groupId) {
          list[idx].supersetGroupId = null;
        }
      }

      this.clearInvalidCalendarSupersetGroup(groupId);
      return;
    }

    const groupId =
      current.supersetGroupId ||
      next.supersetGroupId ||
      this.getNewCalendarSupersetGroupId();
    const currentGroupId = current.supersetGroupId;
    const nextGroupId = next.supersetGroupId;

    list.forEach((exercise) => {
      if (
        exercise === current ||
        exercise === next ||
        (currentGroupId && exercise.supersetGroupId === currentGroupId) ||
        (nextGroupId && exercise.supersetGroupId === nextGroupId)
      ) {
        exercise.supersetGroupId = groupId;
      }
    });
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
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
    );
    return match ? match[1] : null;
  }

  handleSaveWorkout(): void {
    if (!this.selectedDateString) {
      return;
    }

    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    const targetDate = this.selectedDateString!;

    if (this.editingWorkout) {
      if (!this.editingWorkout.programId) {
        alert(this.translate.instant('WORKOUT_DAY_NOT_LINKED'));
        return;
      }

      if (!this.editingWorkout.id) {
        alert(this.translate.instant('WORKOUT_DAY_ID_MISSING'));
        return;
      }

      const duplicate = this.workoutPrograms.some(
        (p: WorkoutProgram) =>
          p.id !== this.editingWorkout?.id &&
          p.clientId === this.selectedClient &&
          p.date === targetDate
      );

      if (duplicate) {
        alert(this.translate.instant('ANOTHER_WORKOUT_DAY_EXISTS'));
        return;
      }

      this.workoutService
        .updateWorkoutDay(
          this.editingWorkout.programId,
          this.editingWorkout.id,
          this.buildWorkoutDayRequestFromForm(targetDate)
        )
        .subscribe({
          next: () => {
            this.closeAddWorkoutModal();
            this.getWorkout();
          },
          error: (err) => {
            console.error('Error updating workout day', err);
            alert(this.translate.instant('UPDATE_WORKOUT_DAY_ERROR'));
          },
        });
      return;
    }

    const lastPlan = this.getLastWorkoutPlanForClient(this.selectedClient);

    if (!lastPlan) {
      alert(this.translate.instant('NO_ASSIGNED_WORKOUT_PLAN'));
      return;
    }

    const exists = this.workoutPrograms.some(
      (p: WorkoutProgram) =>
        p.clientId === this.selectedClient && p.date === targetDate
    );

    if (exists) {
      alert(this.translate.instant('WORKOUT_DAY_ALREADY_EXISTS'));
      return;
    }

    this.workoutService
      .addWorkoutDay(lastPlan.programId, this.buildWorkoutDayRequestFromForm(targetDate))
      .subscribe({
        next: () => {
          this.closeAddWorkoutModal();
          this.getWorkout();
        },
        error: (err) => {
          console.error('Error saving workout day', err);
          alert(this.translate.instant('SAVE_WORKOUT_DAY_ERROR'));
        },
      });
  }

  openDeleteModal(workout: WorkoutProgram, event?: Event): void {
    event?.stopPropagation();

    if (!this.canManageWorkoutDays()) {
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
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
      alert(this.translate.instant('SELECT_CLIENT_FIRST'));
      return;
    }

    if (!this.workoutToDelete.programId) {
      alert(this.translate.instant('WORKOUT_DAY_NOT_LINKED'));
      return;
    }

    this.workoutService
      .deleteWorkoutDay(this.workoutToDelete.programId, this.workoutToDelete.id)
      .subscribe({
        next: () => {
          this.closeDeleteModal();
          this.getWorkout();
        },
        error: (err) => {
          console.error('Error deleting workout day', err);
          alert(this.translate.instant('DELETE_WORKOUT_DAY_ERROR'));
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
            supersetGroupId: ex.supersetGroupId || null,
            youtubeUrl: ex.youtubeUrl || null,
            sets:
              ex.type === 'strength'
                ? (ex.sets || []).map((set, index) => {
                  const total = parseInt(set.rest, 10) || 0;
                  return {
                    setNumber: set.number ?? index + 1,
                    reps: this.toNullableNumber(set.reps),
                    weight: this.shouldShowCalendarWeightField()
                      ? set.weight ?? 0
                      : null,
                    restMin: Math.floor(total / 60),
                    restSec: total % 60,
                    type: set.type || 'REGULAR',
                  };
                })
                : this.buildCardioSets(ex),
          })),
        },
      ],
      status: 'PENDING',
    };
  }

  private buildWorkoutDayRequestFromForm(date: string): any {
    return {
      title: this.isRestDay ? 'Rest Day' : this.newWorkoutTitle.trim(),
      date,
      restDay: this.isRestDay,
      workoutSessions: this.isRestDay
        ? []
        : [
          {
            name: this.newWorkoutTitle.trim() || 'Main Session',
            exercises: this.newWorkoutExercises.map((ex) =>
              this.buildSaveWorkoutExerciseRequest(ex)
            ),
          },
        ],
    };
  }

  private buildWorkoutDayRequestFromCalendarProgram(
    program: WorkoutProgram,
    date: string
  ): any {
    return {
      title: program.title,
      date,
      restDay: false,
      workoutSessions: (program.sessions || []).map((session) => ({
        name: session.notes || program.title || 'Main Session',
        exercises: (session.exercises || []).map((ex) =>
          this.buildSaveWorkoutExerciseRequest(ex)
        ),
      })),
    };
  }

  private buildSaveWorkoutExerciseRequest(ex: Exercise): any {
    const type = String(ex.type || '').toUpperCase() === 'CARDIO'
      ? 'CARDIO'
      : ex.type === 'cardio'
        ? 'CARDIO'
        : 'STRENGTH';

    return {
      name: ex.name,
      type,
      duration: type === 'CARDIO' ? Number(ex.duration || 0) : undefined,
      description: ex.notes || undefined,
      videoLink: ex.videoLink || ex.youtubeUrl || undefined,
      exerciseRef: this.getExerciseRefId(ex) || undefined,
      supersetGroupId: ex.supersetGroupId || null,
      sets:
        type === 'CARDIO'
          ? this.buildCardioSets(ex)
          : (ex.sets || []).map((set, index) => {
            const total = parseInt(set.rest, 10) || 0;
            return {
              setNumber: set.number ?? index + 1,
              reps: this.toNullableNumber(set.reps),
              weight: this.shouldShowCalendarWeightField()
                ? set.weight ?? 0
                : null,
              restMin: Math.floor(total / 60),
              restSec: total % 60,
              type: set.type || 'REGULAR',
            };
          }),
    };
  }

  private buildCardioSets(ex: Exercise): any[] {
    const sets = ex.sets || [];

    if (sets.length) {
      return sets.map((set, index) => {
        const total = parseInt(set.rest, 10) || 0;

        return {
          setNumber: set.number ?? index + 1,
          reps: null,
          weight: null,
          duration:
            Number(set.duration) ||
            (ex.duration ? Math.round(Number(ex.duration) / sets.length) : 0),
          restMin: Math.floor(total / 60),
          restSec: total % 60,
          type: set.type || 'REGULAR',
        };
      });
    }

    return [
      {
        setNumber: 1,
        reps: null,
        weight: null,
        duration: Number(ex.duration || 0),
        restMin: 0,
        restSec: 0,
        type: 'REGULAR',
      },
    ];
  }

  private toNullableNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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
              supersetGroupId: ex.supersetGroupId || null,
              youtubeUrl: ex.youtubeUrl || null,
              sets:
                ex.type === 'strength'
                  ? (ex.sets || []).map((set, index) => {
                    const total = parseInt(set.rest, 10) || 0;
                    return {
                      setNumber: set.number ?? index + 1,
                      reps: this.toNullableNumber(set.reps),
                      weight: this.shouldShowCalendarWeightField()
                        ? set.weight ?? 0
                        : null,
                      restMin: Math.floor(total / 60),
                      restSec: total % 60,
                      type: set.type || 'REGULAR',
                    };
                  })
                  : this.buildCardioSets(ex),
            })),
          })),
      status: 'PENDING',
    };
  }
}
