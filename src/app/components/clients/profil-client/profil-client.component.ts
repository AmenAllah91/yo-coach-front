import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from 'app/service/client.service';

import { ChoosePlanTypeModalComponent, NutritionPlanChoice } from 'app/components/nutrition/choose-plan-type-modal/choose-plan-type-modal.component';
import { WorkoutsClientTabComponent } from './workouts-client-tab/workouts-client-tab.component';
import { NutritionClientTabComponent } from './nutrition-client-tab/nutrition-client-tab.component';
import { NutritionSelectionModalComponent } from './nutrition-selection-modal/nutrition-selection-modal.component';
import { WorkoutProgramSelectionModalComponent } from './workout-program-selection-modal/workout-program-selection-modal.component';
import { AssignSelectModalComponent } from './assign-select-modal/assign-select-modal.component';
import { FormSelectionModalComponent } from './form-selection-modal/form-selection-modal.component';
import { AssignmentsApiService, FormAssignment } from '../../forms/services/assignments-api.service';
import { Subject, takeUntil, from, of, Observable, forkJoin } from 'rxjs';
import { FormDetails, FormsApiService, Form } from '../../forms/services/forms-api.service';
import { Answer, QuestionType } from '../../../models/forms.model';
import { SubmissionsApiService } from '../../forms/services/submissions-api.service';
import { switchMap, finalize, map, catchError } from 'rxjs/operators';
import { ClientScheduleItemDto } from '../../../models/client-schedule.model';
import { CalendarClientsComponent } from '../../calendar/calendar-clients/calendar-clients.component';
import { ProgressPicturesComponent } from 'app/components/progress-pictures-module/progress-pictures/progress-pictures.component';
import { BodyMeasurementsComponent } from 'app/components/body-measurements/body-measurements.component';
import { BodyMeasurement, BodyMeasurementsService } from 'app/service/body-measurements.service';
import { ChatComponent } from '../../chat/chat/chat.component';
import { MealplanDayService } from 'app/service/mealplan-day.service';

type TabId =
  | 'dashboard'
  | 'workouts'
  | 'nutrition'
  | 'checkins'
  | 'chat'
  | 'measurements'
  | 'pictures'
  | 'calendar';

type WorkoutConflictResolution = 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH';

interface ClientWorkoutConflict {
  program: any;
  resolution?: WorkoutConflictResolution;
}



interface Exercise {
  name: string;
  sets: string;
  rest: string;
}

interface TodaysWorkout {
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  name: string;
  exercises: Exercise[];
}

type WorkoutActivityStatus =
  | 'COMPLETED'
  | 'COMPLETED_AFTER_WORKOUT'
  | 'IN_PROGRESS'
  | 'OVERDUE'
  | 'MISSED'
  | 'NOT_STARTED'
  | 'UPCOMING';

interface WorkoutActivity {
  id: string;
  planId: string;
  programName: string;
  programDescription: string;
  week: number;
  dayInWeek: number;
  workoutName: string;
  scheduledDate: Date;
  status: WorkoutActivityStatus;
  durationSeconds: number | null;
  completedCount: number;
  skippedCount: number;
  totalExercises: number;
  partialCount: number;
  completedSets: number;
  missedSets: number;
  pendingSets: number;
  totalSets: number;
  overallNote: string;
  missedReason: string;
  exercises: any[];
  exerciseLogs: any[];
}

interface ActiveNutritionPlan {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount?: number;
}

type NutritionActivityStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_LOGGED' | 'OFF_PLAN';

interface NutritionActivity {
  id: string;
  planId: string;
  programName: string;
  week: number;
  dayInWeek: number;
  dayName: string;
  scheduledDate: Date;
  status: NutritionActivityStatus;
  meals: any[];
  mealLogs: any[];
  plannedMeals: number;
  loggedMeals: number;
  asPlannedMeals: number;
  modifiedMeals: number;
  skippedMeals: number;
  hunger: string;
  energy: string;
  digestion: string;
  overallNote: string;
  loggedAt: any;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  photos: Array<{ url: string; label: string; time: string; mealId?: string }>;
}
export interface ScheduledCheckIn {
  id: string;
  formName: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'onetime';
  selectedDays: string[];
  sendTime: string;
  endDate: string;
  status: 'active';
  nextSendDate: string;
  createdDate: string;
  description?: string;
  questions?: Array<{ id: string; label: string; type: string; required: boolean }>;
}
@Component({
  selector: 'app-profil-client',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChoosePlanTypeModalComponent,
    WorkoutsClientTabComponent,
    NutritionClientTabComponent,
    NutritionSelectionModalComponent,
    WorkoutProgramSelectionModalComponent,
    AssignSelectModalComponent,
    FormSelectionModalComponent,
    CalendarClientsComponent,
    ProgressPicturesComponent,
    BodyMeasurementsComponent,
    ChatComponent
  ],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {
  mobileMoreOpen = false;

  backToClients(): void {
    this.router.navigate(['/clients']);
  }

  @ViewChild(WorkoutsClientTabComponent) workoutsTab: WorkoutsClientTabComponent;
  @ViewChild(NutritionClientTabComponent) nutritionTab: NutritionClientTabComponent;

  activeTab: TabId = 'dashboard';
  showClientStats = true;
  private checkinsLoaded = false;

  setTab(tab: TabId) {
    this.activeTab = tab;
    this.loadTabData(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleClientStats(): void {
    this.showClientStats = !this.showClientStats;
  }

  userid = sessionStorage.getItem('userId');
  clientId: string = '';
  client!: Client;

  get fullName(): string {
    return `${this.client?.firstName} ${this.client?.lastName}`;
  }

  get clientTargetWeight(): number | null {
    const value = (this.client as any)?.targetWeight;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isNaN(parsed) ? null : parsed;
  }


  get bodyweightMeasurements(): BodyMeasurement[] {
    return this.bodyMeasurements
      .filter((item) => item.measurementType === 'BODYWEIGHT')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get startWeight(): number | null {
    const items = this.bodyweightMeasurements;
    return items.length ? items[0].value : null;
  }

  get currentWeight(): number | null {
    const items = this.bodyweightMeasurements;
    return items.length ? items[items.length - 1].value : null;
  }

  get weightLost(): number | null {
    if (this.startWeight === null || this.currentWeight === null) {
      return null;
    }

    return Math.max(0, this.startWeight - this.currentWeight);
  }

  get weightToGoal(): number | null {
    if (this.currentWeight === null || this.clientTargetWeight === null) {
      return null;
    }

    return Math.max(0, this.currentWeight - this.clientTargetWeight);
  }

  get weightProgress(): number {
    if (
      this.startWeight === null ||
      this.currentWeight === null ||
      this.clientTargetWeight === null
    ) {
      return 0;
    }

    const total = this.startWeight - this.clientTargetWeight;
    if (total <= 0) {
      return 0;
    }

    const completed = this.startWeight - this.currentWeight;
    return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
  }

  get clientObjective(): string {
    return (
      (this.client as any)?.idealShapeDescription ||
      (this.client as any)?.objective ||
      (this.client as any)?.goal ||
      (this.clientTargetWeight ? `Goal weight ${this.formatWeight(this.clientTargetWeight)}` : '')
    );
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '--';
    }

    return Number(value).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    });
  }

  formatWeight(valueKg: number | null | undefined): string {
    return this.coachSettingsService.formatWeight(valueKg);
  }

  loadBodyMeasurements(): void {
    if (!this.clientId) {
      return;
    }

    this.bodyMeasurementsService.getByClient(this.clientId).subscribe({
      next: (items) => {
        this.bodyMeasurements = items || [];
      },
      error: (err) => {
        console.error('Failed to load body measurements:', err);
        this.bodyMeasurements = [];
      },
    });
  }

  showAssignSelectModal = false;
  assignType: 'WORKOUT' | 'NUTRITION' | 'CHECKIN' = 'WORKOUT';

  showProgramSelectionModal = false;
  showNutritionSelectionModal = false;
  showNutritionExistingTypeModal = false;
  nutritionSelectionMode: 'ALL' | 'APP' | 'FILES' = 'ALL';
  showChooseModal = false;
  showWorkoutTypeModal = false;
  workoutFileEnabled = true;
  nutritionFileEnabled = true;
  showFileWorkoutImportModal = false;
  showClientWorkoutCreateModal = false;
  clientWorkoutProgramName = '';
  clientWorkoutDurationWeeks = 4;
  clientWorkoutStartDate = new Date().toISOString().slice(0, 10);
  clientWorkoutConflict: ClientWorkoutConflict | null = null;
  readonly workoutDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  showClientNutritionCreateModal = false;
  clientNutritionProgramName = '';
  clientNutritionDurationWeeks = 4;
  clientNutritionStartDate = new Date().toISOString().slice(0, 10);
  clientNutritionConflict: ClientWorkoutConflict | null = null;
  selectedClientNutritionPlanType: NutritionPlanChoice | null = null;

  profileImportWorkoutFile: File | null = null;
  profileImportWorkoutName = '';
  profileImportWorkoutDetails = '';
  profileImportStartDate = '';
  profileImportEndDate = '';
  profileImportSaving = false;
  profileImportError = '';

  showNutritionFileImportModal = false;
  profileImportNutritionFile: File | null = null;
  profileImportNutritionName = '';
  profileImportNutritionDetails = '';
  profileImportNutritionStartDate = '';
  profileImportNutritionEndDate = '';
  profileImportNutritionSaving = false;
  profileImportNutritionError = '';

  nutritionSelectionList: any[] = [];
  assignments: FormAssignment[] = [];
  submissionAssignments: FormAssignment[] = [];
  assignedAssignments: FormAssignment[] = [];
  loadingAssignments = false;
  assignmentsError: string | null = null;
  private readonly PAGE_SIZE = 5;

  submissionsPage = 0;
  submissionsTotalPages = 0;
  submissionsPagesArray: number[] = [];

  assignedPage = 0;
  assignedTotalPages = 0;
  assignedPagesArray: Array<number | 'ellipsis'> = [];

  scheduledPage = 0;
  scheduledPageSize = 5;
  scheduledTotalPages = 0;
  scheduledPagesArray: number[] = [];
  selectedAssignment: FormAssignment | null = null;
  private readonly destroy$ = new Subject<void>();

  isModalOpen = false;
  isViewMode = false;
  modalMode: 'preview' | 'view' = 'preview';
  reviewLoading = false;
  reviewError: string | null = null;

  modalLoading = false;
  modalError: string | null = null;

  currentForm: FormDetails | null = null;
  submittedAnswers: Answer[] = [];

  QuestionType = QuestionType;
  preselectFormId: string | null = null;
  scheduledItems: ClientScheduleItemDto[] = [];
  loadingScheduled = false;
  scheduledError: string | null = null;
  selectedSchedule: ClientScheduleItemDto | null = null;
  confirmScheduledDeleteOpen = false;
  deletingScheduled = false;
  selectedScheduledToDelete: ClientScheduleItemDto | null = null;

  todaysWorkout: TodaysWorkout | null = null;
  activeNutritionPlan: ActiveNutritionPlan | null = null;
  assignedWorkoutPrograms: any[] = [];
  workoutActivities: WorkoutActivity[] = [];
  workoutActivityFilter: 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'MISSED' | 'UPCOMING' = 'ALL';
  workoutActivityVisibleCount = 10;
  showAllWorkoutActivity = false;
  selectedWorkoutActivity: WorkoutActivity | null = null;
  nutritionActivities: NutritionActivity[] = [];
  selectedNutritionActivity: NutritionActivity | null = null;
  showAllNutritionActivity = false;
  nutritionActivityFilter: 'ALL' | NutritionActivityStatus = 'ALL';
  nutritionActivityVisibleCount = 10;
  assignedNutritionPrograms: any[] = [];
  private pendingCreatedWorkoutToAssign: any | null = null;
  private pendingCreatedNutritionToAssign: any | null = null;
  loadingDashboardPrograms = false;
  dashboardProgramsError: string | null = null;

  get hasTodaysWorkout(): boolean {
    return !!this.todaysWorkout && this.todaysWorkout.exercises.length > 0;
  }

  get hasActiveNutritionPlan(): boolean {
    return !!this.activeNutritionPlan;
  }

  get latestWorkoutActivities(): WorkoutActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    return this.workoutActivities
      .filter(activity =>
        activity.scheduledDate.getTime() <= today &&
        activity.status !== 'UPCOMING' &&
        activity.status !== 'NOT_STARTED'
      )
      .slice(0, 5);
  }

  get filteredWorkoutActivities(): WorkoutActivity[] {
    return this.workoutActivities.filter(activity => {
      if (this.workoutActivityFilter === 'ALL') {
        return activity.status !== 'UPCOMING' && activity.status !== 'NOT_STARTED';
      }
      if (this.workoutActivityFilter === 'COMPLETED') {
        return activity.status === 'COMPLETED' || activity.status === 'COMPLETED_AFTER_WORKOUT';
      }
      if (this.workoutActivityFilter === 'UPCOMING') {
        return activity.status === 'UPCOMING' || activity.status === 'NOT_STARTED';
      }
      return activity.status === this.workoutActivityFilter;
    });
  }

  get visibleWorkoutActivities(): WorkoutActivity[] {
    return this.filteredWorkoutActivities.slice(0, this.workoutActivityVisibleCount);
  }

  get canViewMoreWorkoutActivities(): boolean {
    return this.workoutActivityVisibleCount < this.filteredWorkoutActivities.length;
  }

  get latestNutritionActivities(): NutritionActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    return this.nutritionActivities
      .filter(activity => activity.scheduledDate.getTime() <= today)
      .slice(0, 6);
  }

  get filteredNutritionActivities(): NutritionActivity[] {
    return this.nutritionActivities.filter(activity =>
      this.nutritionActivityFilter === 'ALL' || activity.status === this.nutritionActivityFilter
    );
  }

  get visibleNutritionActivities(): NutritionActivity[] {
    return this.filteredNutritionActivities.slice(0, this.nutritionActivityVisibleCount);
  }

  get canViewMoreNutritionActivities(): boolean {
    return this.nutritionActivityVisibleCount < this.filteredNutritionActivities.length;
  }

  activeSubTab: 'submissions' | 'assigned' | 'scheduled' = 'submissions';
  submissionSearch = '';
  private notificationAssignmentId: string | null = null;
  assignedSearch = '';

  showCheckinModal = false;
  showFormSelectionModal = false;

  scheduledCheckIns: ScheduledCheckIn[] = [];
  bodyMeasurements: BodyMeasurement[] = [];

  @Input() set clientIdInput(id: string) {
    if (id && id !== this.clientId) {
      this.clientId = id;
      this.loadClientData();
    }
  }

  constructor(
    private route: ActivatedRoute,
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private router: Router,
    private nutritionService: NutritionService,
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private bodyMeasurementsService: BodyMeasurementsService,
    private mealplanDayService: MealplanDayService,
    public coachSettingsService: CoachSettingsService
  ) {
    const routeId = this.route.snapshot.paramMap.get('id') || '';
    if (routeId) {
      this.clientId = routeId;
      this.loadClientData();
    }

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as TabId | undefined;
      if (tab) {
        this.activeTab = tab;
        this.loadTabData(tab);
      }
      this.notificationAssignmentId = params['assignmentId'] || null;

      const openAssign = params['openAssign'] === '1';
      const preselectFormId = params['preselectFormId'];

      if (openAssign) {
        this.assignType = 'CHECKIN';
        this.showAssignSelectModal = false;
        Promise.resolve().then(() => {
          this.showFormSelectionModal = true;
        });
      }

      if (typeof preselectFormId === 'string' && preselectFormId.trim() !== '') {
        this.preselectFormId = preselectFormId;
      }

      if (openAssign || preselectFormId) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { openAssign: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });

    const assignAfterCreate = history.state?.assignAfterCreate;
    if (assignAfterCreate?.type === 'workout' && assignAfterCreate?.item) {
      this.pendingCreatedWorkoutToAssign = assignAfterCreate.item;
    }
    if (assignAfterCreate?.type === 'nutrition' && assignAfterCreate?.item) {
      this.pendingCreatedNutritionToAssign = assignAfterCreate.item;
    }

    this.getAllNutrition();
    this.loadWorkoutFileSetting();
  }


  private loadWorkoutFileSetting(): void {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

        if (!this.workoutFileEnabled) {
          this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
        }

        if (!this.nutritionFileEnabled) {
          this.showNutritionFileImportModal = false;
          this.showNutritionExistingTypeModal = false;
          if (this.nutritionSelectionMode === 'FILES') {
            this.nutritionSelectionMode = 'APP';
          }
        }
      },
      error: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      },
    });
  }

  private loadClientData(): void {
    if (!this.clientId) return;
    this.checkinsLoaded = false;
    this.getClientById(this.clientId);
    this.loadBodyMeasurements();
    this.loadDashboardPrograms();
    this.loadTabData(this.activeTab);
  }

  private loadTabData(tab: TabId): void {
    if (tab === 'checkins' && !this.checkinsLoaded) {
      this.checkinsLoaded = true;
      this.loadClientAssignments();
    }
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
      this.assignPendingCreatedWorkoutIfNeeded();
      this.assignPendingCreatedNutritionIfNeeded();
    });
  }


  private loadDashboardPrograms(): void {
    if (!this.clientId || !this.userid) return;

    this.loadingDashboardPrograms = true;
    this.dashboardProgramsError = null;
    this.todaysWorkout = null;
    this.activeNutritionPlan = null;
    this.workoutActivities = [];
    this.nutritionActivities = [];

    this.workoutService
      .getWorkoutByCoachIdAndClient(this.userid, this.clientId, 0, 100)
      .pipe(
        switchMap((res: any) => {
          const summaries = res?.content || [];
          return this.hydrateWorkoutDashboardPlans(summaries);
        })
      )
      .subscribe({
        next: (plans: any[]) => {
          this.assignedWorkoutPrograms = this.sortPlansByStartDate(plans);
          this.todaysWorkout = this.extractTodaysWorkout(plans);
          this.workoutActivities = this.buildWorkoutActivities(plans);
        },
        error: (err) => {
          console.error('Failed to load today workout:', err);
          this.assignedWorkoutPrograms = [];
          this.todaysWorkout = null;
          this.workoutActivities = [];
          this.dashboardProgramsError = 'Failed to load today workout.';
        },
      });

    this.nutritionService
      .getNutritionPlanByCoachIdAndClient(this.userid, this.clientId, 0, 100)
      .pipe(
        switchMap((res: any) => {
          const summaries = res?.content || [];
          return this.hydrateNutritionDashboardPlans(summaries).pipe(
            map((plans) => ({ res, plans }))
          );
        })
      )
      .subscribe({
        next: ({ plans }) => {
          this.assignedNutritionPrograms = this.sortPlansByStartDate(plans);
          this.activeNutritionPlan = this.extractTodaysNutrition(plans);
          this.nutritionActivities = this.buildNutritionActivities(plans);
          this.loadingDashboardPrograms = false;
        },
        error: (err) => {
          console.error('Failed to load active nutrition plan:', err);
          this.assignedNutritionPrograms = [];
          this.activeNutritionPlan = null;
          this.nutritionActivities = [];
          this.loadingDashboardPrograms = false;
          this.dashboardProgramsError = 'Failed to load active nutrition plan.';
        },
      });
  }

  private hydrateWorkoutDashboardPlans(summaries: any[]): Observable<any[]> {
    if (!summaries.length) return of([]);

    return forkJoin(summaries.map((summary: any) => {
      if (!summary?.id || this.isFileWorkoutPlan(summary)) return of(summary);

      return this.workoutService.getWorkoutById(summary.id).pipe(
        map((detail: any) => ({
          ...summary,
          ...detail,
          workoutDays: this.mergeWorkoutDashboardDays(
            summary?.workoutDays || [],
            detail?.workoutDays || []
          ),
        })),
        catchError(() => of(summary))
      );
    }));
  }

  private mergeWorkoutDashboardDays(summaryDays: any[], detailDays: any[]): any[] {
    if (!detailDays.length) return summaryDays;

    return detailDays.map((detailDay: any, index: number) => {
      const summaryDay = summaryDays.find((candidate: any) =>
        (detailDay?.id && candidate?.id === detailDay.id) ||
        (detailDay?.dayNumber && candidate?.dayNumber === detailDay.dayNumber)
      ) || summaryDays[index] || {};

      return {
        ...detailDay,
        ...summaryDay,
        workoutSessions: detailDay?.workoutSessions?.length
          ? detailDay.workoutSessions
          : (summaryDay?.workoutSessions || []),
        clientExerciseLogs: summaryDay?.clientExerciseLogs
          ?? detailDay?.clientExerciseLogs
          ?? [],
      };
    });
  }

  /**
   * Assignment list responses can contain only a summary of each meal day.
   * Daily client feedback and meal reports live on the full assigned plan, so
   * use that as the source for the activity table while preserving assignment
   * metadata returned by the list endpoint.
   */
  private hydrateNutritionDashboardPlans(summaries: any[]): Observable<any[]> {
    if (!summaries.length) return of([]);

    return forkJoin(summaries.map((summary: any) => {
      if (!summary?.id || this.isFileNutritionPlan(summary)) return of(summary);

      return this.nutritionService.getNutritionPlanById(summary.id).pipe(
        map((detail: any) => ({
          ...summary,
          ...detail,
          mealDays: this.mergeNutritionDashboardDays(
            summary?.mealDays || [],
            detail?.mealDays || []
          ),
        })),
        catchError(() => of(summary))
      );
    }));
  }

  private mergeNutritionDashboardDays(summaryDays: any[], detailDays: any[]): any[] {
    if (!detailDays.length) return summaryDays;

    return detailDays.map((detailDay: any, index: number) => {
      const summaryDay = summaryDays.find((candidate: any) =>
        (detailDay?.id && candidate?.id === detailDay.id) ||
        (detailDay?.dayNumber && candidate?.dayNumber === detailDay.dayNumber)
      ) || summaryDays[index] || {};

      return {
        ...summaryDay,
        ...detailDay,
        meals: detailDay?.meals?.length ? detailDay.meals : (summaryDay?.meals || []),
        clientMealLogs: detailDay?.clientMealLogs ?? summaryDay?.clientMealLogs ?? [],
        dayTargets: Object.keys(detailDay?.dayTargets || {}).length
          ? detailDay.dayTargets
          : (summaryDay?.dayTargets || {}),
      };
    });
  }

  private extractTodaysWorkout(plans: any[]): TodaysWorkout | null {
    const today = this.startOfDay(new Date());

    for (const plan of this.sortPlansByStartDate(plans)) {
      const days = plan?.workoutDays || [];
      const start = this.safeDate(plan?.startDate);

      for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const dayDate = this.resolveProgramDayDate(day, start, index);

        if (!dayDate || !this.isSameDate(dayDate, today)) continue;
        if (day?.restDay === true) return null;

        const exercises = this.extractWorkoutExercises(day);
        if (!exercises.length) return null;

        const currentDay = index + 1;
        const totalDays = days.length || currentDay;

        return {
          programName: plan?.name || 'Workout program',
          currentWeek: Math.max(1, Math.ceil(currentDay / 7)),
          totalWeeks: Math.max(1, Math.ceil(totalDays / 7)),
          name: day?.title || day?.name || day?.dayOfWeek || `Day ${currentDay}`,
          exercises,
        };
      }
    }

    return null;
  }

  private extractWorkoutExercises(day: any): Exercise[] {
    const sessions = day?.workoutSessions || [];
    const exercises = sessions.flatMap((session: any) => session?.exercises || []);

    return exercises.map((exercise: any) => ({
      name: exercise?.name || exercise?.exerciseRef?.name || 'Exercise',
      sets: this.formatExerciseSets(exercise),
      rest: this.formatExerciseRest(exercise),
    }));
  }

  private formatExerciseSets(exercise: any): string {
    const sets = exercise?.sets || [];
    if (!sets.length) {
      return exercise?.duration ? `${exercise.duration} min` : 'No sets';
    }

    const reps = sets
      .map((set: any) => set?.reps)
      .filter((value: any) => value !== null && value !== undefined && value !== '');

    if (!reps.length) return `${sets.length} sets`;

    const uniqueReps = Array.from(new Set(reps.map((value: any) => String(value))));
    const repsLabel = uniqueReps.length === 1 ? uniqueReps[0] : `${uniqueReps[0]}–${uniqueReps[uniqueReps.length - 1]}`;

    return `${sets.length} sets × ${repsLabel} reps`;
  }

  private formatExerciseRest(exercise: any): string {
    const firstSet = (exercise?.sets || []).find((set: any) =>
      set?.restMin !== null || set?.restSec !== null || set?.rest !== null
    );

    if (!firstSet) return '--';

    const min = Number(firstSet.restMin || 0);
    const sec = Number(firstSet.restSec || 0);

    if (min > 0 && sec > 0) return `${min}m ${sec}s`;
    if (min > 0) return `${min}m`;
    if (sec > 0) return `${sec}s`;

    return firstSet.rest ? String(firstSet.rest) : '--';
  }

  private extractTodaysNutrition(plans: any[]): ActiveNutritionPlan | null {
    const today = this.startOfDay(new Date());

    for (const plan of this.sortPlansByStartDate(plans)) {
      const days = plan?.mealDays || [];
      const start = this.safeDate(plan?.startDate);

      for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const dayDate = this.resolveProgramDayDate(day, start, index);

        if (!dayDate || !this.isSameDate(dayDate, today)) continue;

        const targets = day?.dayTargets || {};
        const meals = day?.meals || [];

        return {
          name: plan?.name || 'Nutrition plan',
          dailyCalories: Number(targets.calories || 0),
          protein: Number(targets.proteinG || 0),
          carbs: Number(targets.carbsG || 0),
          fat: Number(targets.fatG || 0),
          mealCount: meals.length,
        };
      }
    }

    return null;
  }

  private sortPlansByStartDate(plans: any[]): any[] {
    return [...(plans || [])].sort((a, b) => {
      const aDate = (this.safeDate(a?.endDate) || this.safeDate(a?.startDate))?.getTime() || 0;
      const bDate = (this.safeDate(b?.endDate) || this.safeDate(b?.startDate))?.getTime() || 0;
      return bDate - aDate;
    });
  }

  get latestWorkoutPrograms(): any[] {
    return (this.assignedWorkoutPrograms || []).slice(0, 3);
  }

  get latestNutritionPrograms(): any[] {
    return (this.assignedNutritionPrograms || []).slice(0, 3);
  }

  getProgramDisplayName(program: any): string {
    return program?.name || program?.programName || 'Program';
  }

  getProgramDateRange(program: any): string {
    const start = this.formatShortDate(program?.startDate);
    const end = this.formatShortDate(program?.endDate);

    if (start && end) return `${start} - ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;

    return 'No dates set';
  }

  private formatShortDate(value: any): string {
    const date = this.safeDate(value);
    if (!date) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private resolveProgramDayDate(day: any, planStart: Date | null, index: number): Date | null {
    const explicitDate = this.safeDate(day?.date);
    if (explicitDate) return explicitDate;
    if (!planStart) return null;

    const dayNumber = Number(day?.dayNumber || index + 1);
    const date = new Date(planStart);
    date.setDate(planStart.getDate() + Math.max(0, dayNumber - 1));
    return this.startOfDay(date);
  }

  private safeDate(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return this.startOfDay(date);
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private isSameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  get assignedList(): FormAssignment[] {
    return this.assignedAssignments;
  }

  get submissionsList(): FormAssignment[] {
    return this.submissionAssignments;
  }

  async loadClientAssignments(): Promise<void> {
    if (!this.clientId) return;

    this.loadSubmissionsPage(0);
    this.loadAssignedPage(0);
  }

  loadSubmissionsPage(page: number = this.submissionsPage): void {
    if (!this.clientId) return;

    this.loadingAssignments = true;
    this.assignmentsError = null;
    this.submissionsPage = Math.max(page, 0);

    this.assignmentsApi
      .pageOwnerAssignmentsByAssigneeIdStatuses(
        this.submissionsPage,
        this.PAGE_SIZE,
        'submittedAt',
        'DESC',
        this.clientId,
        ['SUBMITTED', 'REVIEWED'],
        this.submissionSearch
      )
      .subscribe({
        next: async (res) => {
          this.submissionAssignments = res.content || [];
          await this.attachFormNames(this.submissionAssignments);
          this.submissionsTotalPages = res.totalPages || 0;
          this.submissionsPage = res.number ?? this.submissionsPage;
          this.submissionsPagesArray = Array.from({ length: this.submissionsTotalPages }, (_, i) => i);
          this.syncAssignmentsCache();
          this.loadingAssignments = false;
          if (this.notificationAssignmentId) {
            const assignment = this.submissionAssignments.find(item => item.id === this.notificationAssignmentId);
            if (assignment) {
              this.activeSubTab = 'submissions';
              this.openAssignmentModal(assignment);
              this.notificationAssignmentId = null;
              this.router.navigate([], { relativeTo: this.route, queryParams: { assignmentId: null }, queryParamsHandling: 'merge', replaceUrl: true });
            } else {
              this.openNotificationAssignmentById(this.notificationAssignmentId);
            }
          }
        },
        error: () => {
          this.assignmentsError = 'Failed to load submissions';
          this.loadingAssignments = false;
        },
      });
  }

  private buildWorkoutActivities(plans: any[]): WorkoutActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    const activities: WorkoutActivity[] = [];

    for (const plan of plans || []) {
      const days = plan?.workoutDays || [];
      const planStart = this.safeDate(plan?.startDate);
      days.forEach((day: any, index: number) => {
        if (day?.restDay === true) return;
        const scheduledDate = this.resolveProgramDayDate(day, planStart, index);
        if (!scheduledDate) return;
        const sessions = day?.workoutSessions || [];
        const exercises = sessions.flatMap((session: any) => session?.exercises || []);
        if (!exercises.length) return;

        const logs = day?.clientExerciseLogs || [];
        let completedCount = logs.filter(
          (log: any) => log?.completed === true && log?.skipped !== true
        ).length;
        const skippedCount = logs.filter((log: any) => log?.skipped === true).length;
        let partialCount = 0;
        let completedSets = 0;
        let missedSets = 0;
        let pendingSets = 0;
        let totalSets = 0;
        exercises.forEach((exercise: any, exerciseIndex: number) => {
          const log = logs.find((item: any) =>
            (!!exercise?.id && item?.exerciseId === exercise.id) ||
            String(item?.displayNumber || '') === String(exerciseIndex + 1)
          ) || logs[exerciseIndex];
          const plannedSets = exercise?.sets || [];
          totalSets += plannedSets.length;
          let exerciseDone = 0;
          let exerciseMissed = 0;
          plannedSets.forEach((set: any, setIndex: number) => {
            const actual = (log?.sets || []).find((item: any) =>
              Number(item?.setNumber) === Number(set?.setNumber || setIndex + 1)
            );
            const setStatus = String(actual?.status || '').toUpperCase();
            if (setStatus === 'MISSED' || actual?.missed === true) {
              missedSets++;
              exerciseMissed++;
            } else if (setStatus === 'COMPLETED' || setStatus === 'DONE' || actual?.completed === true || (actual && setStatus !== 'PENDING')) {
              completedSets++;
              exerciseDone++;
            } else {
              pendingSets++;
            }
          });
          if (!log?.skipped && exerciseDone > 0 && exerciseMissed > 0) partialCount++;
        });
        const rawStatus = String(day?.status || '').toUpperCase();
        const completionMode = String(day?.clientCompletionMode || '').toUpperCase();
        let status: WorkoutActivityStatus;

        if (rawStatus === 'COMPLETED' && completionMode === 'ALREADY_COMPLETED') {
          status = 'COMPLETED_AFTER_WORKOUT';
        } else if (rawStatus === 'COMPLETED') {
          status = 'COMPLETED';
        } else if (rawStatus === 'MISSED') {
          status = 'MISSED';
        } else if (scheduledDate.getTime() < today) {
          // A workout cannot remain active once its scheduled day has passed.
          // This also turns old pending workouts into items that need resolution.
          status = 'OVERDUE';
        } else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'PAUSED') {
          status = 'IN_PROGRESS';
        } else if (scheduledDate.getTime() > today) {
          status = 'UPCOMING';
        } else {
          status = 'NOT_STARTED';
        }
        if (status === 'COMPLETED_AFTER_WORKOUT') {
          completedCount = Math.max(0, exercises.length - skippedCount);
          completedSets = Math.max(0, totalSets - missedSets);
          pendingSets = 0;
        } else if (status === 'COMPLETED' && !logs.length) {
          completedCount = exercises.length;
          completedSets = totalSets;
          pendingSets = 0;
        } else if (status === 'MISSED') {
          missedSets = totalSets;
          completedSets = 0;
          pendingSets = 0;
        }

        const dayNumber = Number(day?.dayNumber || index + 1);
        activities.push({
          id: day?.id || `${plan?.id || 'plan'}-${dayNumber}`,
          planId: plan?.id || '',
          programName: plan?.name || 'Workout program',
          programDescription: plan?.details || plan?.description || '',
          week: Math.max(1, Math.ceil(dayNumber / 7)),
          dayInWeek: ((dayNumber - 1) % 7) + 1,
          workoutName:
            sessions.find((session: any) => String(session?.name || '').trim())?.name ||
            day?.name ||
            day?.title ||
            day?.dayOfWeek ||
            `Day ${dayNumber}`,
          scheduledDate,
          status,
          durationSeconds: status === 'COMPLETED_AFTER_WORKOUT'
            ? null
            : Number(day?.workoutElapsedSeconds || 0) || null,
          completedCount: Math.min(exercises.length, completedCount + partialCount),
          skippedCount,
          totalExercises: exercises.length,
          partialCount,
          completedSets,
          missedSets,
          pendingSets,
          totalSets,
          overallNote: day?.overallWorkoutNote || '',
          missedReason: day?.missedReason || day?.statusReason || day?.overallWorkoutNote || '',
          exercises,
          exerciseLogs: logs,
        });
      });
    }

    return activities.sort(
      (a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime()
    );
  }

  private buildNutritionActivities(plans: any[]): NutritionActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    const activities: NutritionActivity[] = [];

    for (const plan of plans || []) {
      const planStart = this.safeDate(plan?.startDate);
      (plan?.mealDays || []).forEach((day: any, index: number) => {
        const scheduledDate = this.resolveProgramDayDate(day, planStart, index);
        if (!scheduledDate || scheduledDate.getTime() > today) return;

        const meals = (day?.meals || []).map((meal: any) => {
          const macros = this.resolveNutritionMealMacros(meal);
          return { ...meal, ...macros };
        });
        const rawMealLogs = day?.clientMealLogs || day?.mealLogs || day?.loggedMeals || [];
        const mealLogs = rawMealLogs.map((log: any, logIndex: number) => {
          const mealId = log?.mealId || meals[logIndex]?.id;
          const photoUrl = log?.photoUrl || log?.imageUrl || '';

          return {
            ...log,
            mealId,
            photoUrl,
          };
        });
        const rawStatus = String(
          day?.nutritionStatus || day?.clientStatus || day?.status || ''
        ).toUpperCase().replace('-', '_');
        const offPlan = rawStatus === 'OFF_PLAN' || rawStatus === 'OFFPLAN' ||
          day?.offPlan === true || day?.followedPlan === false;
        const loggedMeals = mealLogs.filter((log: any) => {
          const logStatus = String(log?.status || log?.completionMode || '').toUpperCase();
          return log?.logged === true ||
            ['AS_PLANNED', 'COMPLETED', 'MODIFIED', 'SKIPPED'].includes(logStatus);
        }).length;
        let status: NutritionActivityStatus;

        if (offPlan) status = 'OFF_PLAN';
        else if (rawStatus === 'COMPLETED') status = 'COMPLETED';
        else if (rawStatus === 'IN_PROGRESS' || loggedMeals > 0) status = 'IN_PROGRESS';
        else status = 'NOT_LOGGED';

        const asPlannedMeals = mealLogs.filter((log: any) => {
          const value = String(log?.status || log?.completionMode || '').toUpperCase();
          return value === 'AS_PLANNED' || value === 'COMPLETED' || log?.asPlanned === true;
        }).length;
        const modifiedMeals = mealLogs.filter((log: any) => {
          const value = String(log?.status || log?.completionMode || '').toUpperCase();
          return value === 'MODIFIED' || log?.modified === true;
        }).length;
        const skippedMeals = mealLogs.filter((log: any) => {
          const value = String(log?.status || log?.completionMode || '').toUpperCase();
          return value === 'SKIPPED' || log?.skipped === true;
        }).length;
        const mealTotals = meals.reduce((sum: any, meal: any) => ({
          calories: sum.calories + meal.calories,
          protein: sum.protein + meal.protein,
          carbs: sum.carbs + meal.carbs,
          fat: sum.fat + meal.fat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        const dayTargets = day?.dayTargets || {};
        const totals = {
          calories: this.firstNutritionNumber(
            dayTargets?.calories,
            day?.totalCalories,
            mealTotals.calories
          ),
          protein: this.firstNutritionNumber(
            dayTargets?.proteinG,
            day?.totalProtein,
            mealTotals.protein
          ),
          carbs: this.firstNutritionNumber(
            dayTargets?.carbsG,
            day?.totalCarbs,
            mealTotals.carbs
          ),
          fat: this.firstNutritionNumber(
            dayTargets?.fatG,
            day?.totalFat,
            mealTotals.fat
          ),
        };
        const photos = mealLogs.flatMap((log: any, logIndex: number) => {
          const urls = [log?.photoUrl, log?.imageUrl, ...(log?.photos || [])]
            .map((photo: any) => typeof photo === 'string' ? photo : photo?.url)
            .filter(Boolean);
          const mealIndex = meals.findIndex((meal: any) => meal?.id === log?.mealId);
          return urls.map((url: string) => ({
            url,
            label: log?.mealName || meals[mealIndex >= 0 ? mealIndex : logIndex]?.name || `Meal ${logIndex + 1}`,
            time: log?.loggedAt || log?.createdAt || '',
            mealId: log?.mealId,
          }));
        });
        const dayNumber = Number(day?.dayNumber || index + 1);

        activities.push({
          id: day?.id || `${plan?.id || 'nutrition'}-${dayNumber}`,
          planId: plan?.id || '',
          programName: plan?.name || 'Nutrition plan',
          week: Math.max(1, Math.ceil(dayNumber / 7)),
          dayInWeek: ((dayNumber - 1) % 7) + 1,
          dayName: day?.name || `Day ${dayNumber}`,
          scheduledDate,
          status,
          meals,
          mealLogs,
          plannedMeals: meals.length,
          loggedMeals,
          asPlannedMeals,
          modifiedMeals,
          skippedMeals,
          hunger: day?.hunger ?? day?.dailyFeedback?.hunger ?? '',
          energy: day?.energy ?? day?.dailyFeedback?.energy ?? '',
          digestion: day?.digestion ?? day?.dailyFeedback?.digestion ?? '',
          overallNote: day?.overallNote ?? day?.clientNote ?? day?.dailyFeedback?.note ?? '',
          loggedAt: day?.loggedAt || day?.updatedAt || '',
          totals,
          photos,
        });
      });
    }

    return activities.sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime());
  }

  private resolveNutritionMealMacros(meal: any): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } {
    const targets = meal?.mealTargets || {};
    const foodTotals = (meal?.foods || []).reduce((sum: any, food: any) => {
      const foodRef = food?.foodRef || {};
      const quantity = Number(food?.quantity ?? foodRef?.servingSize ?? 100);
      const servingSize = Number(foodRef?.servingSize ?? 100);
      const ratio = servingSize > 0 ? quantity / servingSize : 1;
      return {
        calories: sum.calories + Number(food?.calories ?? foodRef?.energy ?? 0) * ratio,
        protein: sum.protein + Number(food?.protein ?? foodRef?.protein ?? 0) * ratio,
        carbs: sum.carbs + Number(
          food?.carbs ?? food?.carbohydrates ?? foodRef?.carbohydrates ?? 0
        ) * ratio,
        fat: sum.fat + Number(food?.fat ?? foodRef?.fat ?? 0) * ratio,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      calories: this.firstNutritionNumber(meal?.calories, targets?.calories, foodTotals.calories),
      protein: this.firstNutritionNumber(meal?.protein, targets?.proteinG, foodTotals.protein),
      carbs: this.firstNutritionNumber(meal?.carbs, targets?.carbsG, foodTotals.carbs),
      fat: this.firstNutritionNumber(meal?.fat, targets?.fatG, foodTotals.fat),
    };
  }

  private firstNutritionNumber(...values: any[]): number {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  openNutritionActivity(activity: NutritionActivity): void {
    this.selectedNutritionActivity = activity;
    this.loadNutritionActivityPhotoUrls(activity);
  }

  private loadNutritionActivityPhotoUrls(activity: NutritionActivity): void {
    activity.mealLogs.forEach((log: any, logIndex: number) => {
      const hasStoredPhoto = log?.photoPath && String(log.photoPath) !== 'null';
      const mealIndex = activity.meals.findIndex((meal: any) => meal?.id === log?.mealId);
      const resolvedMealIndex = mealIndex >= 0 ? mealIndex : logIndex;
      const meal = activity.meals[resolvedMealIndex];
      const mealId = log?.mealId || meal?.id;

      if (!hasStoredPhoto || !activity.planId || !activity.id || !mealId) return;

      this.mealplanDayService
        .getMealPhotoUrl(activity.planId, activity.id, mealId)
        .pipe(catchError(() => of(null)))
        .subscribe((result) => {
          if (!result?.photoUrl) return;

          log.photoUrl = result.photoUrl;
          const existingPhoto = activity.photos.find((photo) =>
            photo.mealId === mealId
          );
          if (existingPhoto) {
            existingPhoto.url = result.photoUrl;
          } else {
            activity.photos.push({
              url: result.photoUrl,
              label: log?.mealName || meal?.name || `Meal ${resolvedMealIndex + 1}`,
              time: log?.loggedAt || log?.createdAt || '',
              mealId,
            });
          }
        });
    });
  }

  closeNutritionActivity(): void {
    this.selectedNutritionActivity = null;
  }

  openAllNutritionActivity(): void {
    this.nutritionActivityFilter = 'ALL';
    this.nutritionActivityVisibleCount = 10;
    this.showAllNutritionActivity = true;
  }

  closeAllNutritionActivity(): void {
    this.showAllNutritionActivity = false;
  }

  setNutritionActivityFilter(filter: 'ALL' | NutritionActivityStatus): void {
    this.nutritionActivityFilter = filter;
    this.nutritionActivityVisibleCount = 10;
  }

  viewMoreNutritionActivities(): void {
    this.nutritionActivityVisibleCount += 10;
  }

  nutritionActivityStatusLabel(status: NutritionActivityStatus): string {
    if (status === 'IN_PROGRESS') return 'In progress';
    if (status === 'NOT_LOGGED') return 'Not logged';
    if (status === 'OFF_PLAN') return 'Off-plan';
    return 'Completed';
  }

  nutritionActivityAction(status: NutritionActivityStatus): string {
    if (status === 'COMPLETED') return 'View report';
    if (status === 'NOT_LOGGED') return 'View nutrition day';
    return 'Review log';
  }

  nutritionReportTitle(activity: NutritionActivity): string {
    return activity.status === 'IN_PROGRESS' || activity.status === 'OFF_PLAN'
      ? `Review log · ${activity.dayName}`
      : `Nutrition report · ${activity.dayName}`;
  }

  nutritionActivityDescription(activity: NutritionActivity): string {
    if (activity.status === 'COMPLETED') return 'All meals logged';
    if (activity.status === 'IN_PROGRESS') return activity.loggedMeals ? 'Some meals logged' : 'Day in progress';
    if (activity.status === 'OFF_PLAN') return 'Logged as off-plan';
    return 'No meals reported';
  }

  nutritionMealLog(activity: NutritionActivity, index: number): any {
    const meal = activity.meals[index];
    return activity.mealLogs.find((log: any) =>
      meal?.id && log?.mealId === meal.id
    ) || activity.mealLogs[index] || null;
  }

  nutritionMealState(log: any): string {
    if (!log) return 'Not logged';
    const value = String(log?.status || log?.completionMode || '').toUpperCase();
    if (value === 'SKIPPED' || log?.skipped) return 'Skipped';
    if (value === 'MODIFIED' || log?.modified) return 'Modified';
    if (value === 'OFF_PLAN' || log?.offPlan) return 'Off-plan';
    return 'As planned';
  }

  openAllWorkoutActivity(): void {
    this.workoutActivityFilter = 'ALL';
    this.workoutActivityVisibleCount = 10;
    this.showAllWorkoutActivity = true;
  }

  closeAllWorkoutActivity(): void {
    this.showAllWorkoutActivity = false;
    this.selectedWorkoutActivity = null;
  }

  setWorkoutActivityFilter(
    filter: 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'MISSED' | 'UPCOMING'
  ): void {
    this.workoutActivityFilter = filter;
    this.workoutActivityVisibleCount = 10;
  }

  viewMoreWorkoutActivities(): void {
    this.workoutActivityVisibleCount += 10;
  }

  openWorkoutActivity(activity: WorkoutActivity): void {
    this.selectedWorkoutActivity = activity;
  }

  closeWorkoutActivity(): void {
    this.selectedWorkoutActivity = null;
  }

  workoutActivityAction(activity: WorkoutActivity): string {
    if (activity.status === 'COMPLETED' || activity.status === 'COMPLETED_AFTER_WORKOUT') {
      return 'View results';
    }
    if (activity.status === 'IN_PROGRESS') return 'View progress';
    if (activity.status === 'OVERDUE') return 'Resolve workout';
    if (activity.status === 'MISSED') return 'View details';
    return 'View workout';
  }

  workoutActivityDetailTitle(activity: WorkoutActivity): string {
    const dayLabel = `Day ${activity.dayInWeek}`;
    return activity.workoutName.trim().toLowerCase() === dayLabel.toLowerCase()
      ? dayLabel
      : `${dayLabel} – ${activity.workoutName}`;
  }

  workoutActivityStatusLabel(activity: WorkoutActivity): string {
    if (activity.status === 'COMPLETED_AFTER_WORKOUT') return 'Completed';
    if (activity.status === 'NOT_STARTED') return 'Upcoming';
    return activity.status.toLowerCase().replace('_', ' ').replace(/\b\w/g, value => value.toUpperCase());
  }

  workoutActivityMode(activity: WorkoutActivity): string {
    if (activity.status === 'COMPLETED_AFTER_WORKOUT') return 'After workout';
    if (activity.status === 'COMPLETED') return 'Live workout';
    if (activity.status === 'IN_PROGRESS') return 'Ongoing';
    if (activity.status === 'OVERDUE') return 'Needs resolution';
    if (activity.status === 'MISSED') return 'Workout missed';
    return 'Not started';
  }

  workoutActivityDuration(activity: WorkoutActivity): string {
    if (activity.status === 'COMPLETED_AFTER_WORKOUT' || activity.status === 'MISSED') return 'Not recorded';
    if (activity.durationSeconds === null) return '—';
    const minutes = Math.floor(activity.durationSeconds / 60);
    const seconds = activity.durationSeconds % 60;
    return minutes ? `${minutes} min${seconds ? ` ${seconds}s` : ''}` : `${seconds}s`;
  }

  workoutActivityLog(activity: WorkoutActivity, exercise: any, index: number): any {
    return activity.exerciseLogs.find((log: any) =>
      (!!exercise?.id && log?.exerciseId === exercise.id) ||
      log?.displayNumber === this.getLetter(index) ||
      String(log?.displayNumber || '') === String(index + 1)
    ) || activity.exerciseLogs[index] || null;
  }

  performedSet(log: any, plannedSet: any, index: number): any {
    return (log?.sets || []).find(
      (set: any) => Number(set?.setNumber) === Number(plannedSet?.setNumber || index + 1)
    ) || null;
  }

  exerciseActivityState(activity: WorkoutActivity, exercise: any, index: number): string {
    const log = this.workoutActivityLog(activity, exercise, index);
    if (log?.skipped) return 'Skipped';
    const statuses = (exercise?.sets || []).map((set: any, setIndex: number) =>
      this.workoutSetStatus(activity, exercise, index, set, setIndex)
    );
    if (statuses.includes('Done') && statuses.includes('Missed')) return 'Partially completed';
    if (log?.completed) return 'Completed';
    if (activity.status === 'COMPLETED_AFTER_WORKOUT') return 'Completed';
    if (activity.status === 'COMPLETED' && !activity.exerciseLogs.length) return 'Completed';
    if (activity.status === 'IN_PROGRESS' && log) return 'In progress';
    return 'Pending';
  }

  workoutSetStatus(activity: WorkoutActivity, exercise: any, exerciseIndex: number, set: any, setIndex: number): string {
    const log = this.workoutActivityLog(activity, exercise, exerciseIndex);
    const actual = this.performedSet(log, set, setIndex);
    const status = String(actual?.status || '').toUpperCase();
    if (status === 'MISSED' || actual?.missed === true) return 'Missed';
    if (status === 'COMPLETED' || status === 'DONE' || actual?.completed === true || (actual && status !== 'PENDING')) return 'Done';
    if (activity.status === 'COMPLETED_AFTER_WORKOUT' || (activity.status === 'COMPLETED' && !activity.exerciseLogs.length)) return 'Done';
    if (activity.status === 'MISSED' || log?.skipped) return 'Missed';
    return 'Pending';
  }

  exerciseSetSummary(activity: WorkoutActivity, exercise: any, index: number): string {
    const sets = exercise?.sets || [];
    const done = sets.filter((set: any, setIndex: number) => this.workoutSetStatus(activity, exercise, index, set, setIndex) === 'Done').length;
    const missed = sets.filter((set: any, setIndex: number) => this.workoutSetStatus(activity, exercise, index, set, setIndex) === 'Missed').length;
    return `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} · ${done} done · ${missed} missed`;
  }

  formatActivityDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatActivityRest(set: any): string {
    const min = Number(set?.restMin || 0);
    const sec = Number(set?.restSec || 0);
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  formatActivityWeight(value: any): string {
    const converted = this.coachSettingsService.convertWeightFromKg(value);
    return converted === null ? '—' : this.coachSettingsService.formatNumber(converted);
  }

  workoutSetTypeLabel(type: any): string {
    const value = String(type || 'REGULAR').toUpperCase();
    if (value === 'WARM_UP') return 'Warm-up';
    if (value === 'DROP_SET') return 'Drop set';
    if (value === 'FAILURE') return 'To failure';
    return '—';
  }

  private openNotificationAssignmentById(assignmentId: string): void {
    this.assignmentsApi.getById(assignmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: assignment => {
          if (assignment.assigneeId !== this.clientId) return;
          this.activeTab = 'checkins';
          this.activeSubTab = 'submissions';
          this.openAssignmentModal(assignment);
          this.notificationAssignmentId = null;
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { assignmentId: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        },
        error: err => console.error('Failed to open notification check-in:', err)
      });
  }

  loadAssignedPage(page: number = this.assignedPage): void {
    if (!this.clientId) return;

    this.loadingAssignments = true;
    this.assignmentsError = null;
    this.assignedPage = Math.max(page, 0);

    this.assignmentsApi
      .pageOwnerAssignmentsByAssigneeIdStatuses(
        this.assignedPage,
        this.PAGE_SIZE,
        'assignedAt',
        'DESC',
        this.clientId,
        ['ASSIGNED', 'OPENED'],
        this.assignedSearch
      )
      .subscribe({
        next: async (res) => {
          this.assignedAssignments = res.content || [];
          await this.attachFormNames(this.assignedAssignments);
          this.assignedTotalPages = res.totalPages || 0;
          this.assignedPage = res.number ?? this.assignedPage;
          this.assignedPagesArray = this.buildCompactPages(this.assignedPage, this.assignedTotalPages);
          this.syncAssignmentsCache();
          this.loadingAssignments = false;
        },
        error: () => {
          this.assignmentsError = 'Failed to load assigned check-ins';
          this.loadingAssignments = false;
        },
      });
  }

  onSubmissionSearchChange(): void {
    this.loadSubmissionsPage(0);
  }

  onAssignedSearchChange(): void {
    this.loadAssignedPage(0);
  }

  changeSubmissionsPage(page: number): void {
    if (page < 0 || page >= this.submissionsTotalPages || page === this.submissionsPage) return;
    this.loadSubmissionsPage(page);
  }

  changeAssignedPage(page: number): void {
    if (page < 0 || page >= this.assignedTotalPages || page === this.assignedPage) return;
    this.loadAssignedPage(page);
  }

  private buildCompactPages(current: number, total: number): Array<number | 'ellipsis'> {
    if (total <= 5) return Array.from({ length: total }, (_, index) => index);

    const pages = new Set<number>([0, total - 1, current - 1, current, current + 1]);
    const visible = Array.from(pages)
      .filter(page => page >= 0 && page < total)
      .sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];

    visible.forEach((page, index) => {
      if (index > 0 && page - visible[index - 1] > 1) result.push('ellipsis');
      result.push(page);
    });

    return result;
  }

  private syncAssignmentsCache(): void {
    this.assignments = [...this.submissionAssignments, ...this.assignedAssignments];
  }

  private async attachFormNames(assignments: FormAssignment[]): Promise<void> {
    const uniqueFormIds = Array.from(new Set(assignments.map(a => a.formId)));
    const map = new Map<string, string>();

    await Promise.all(
      uniqueFormIds.map(formId =>
        this.formsApi.getFormById(formId).toPromise().then((f: any) => {
          map.set(formId, f?.name ?? f?.title ?? formId);
        }).catch(() => {
          map.set(formId, formId);
        })
      )
    );

    assignments.forEach(a => {
      a.formName = map.get(a.formId) ?? a.formId;
    });
  }

  markAsReviewed(): void {
    if (!this.selectedAssignment) return;

    this.reviewLoading = true;
    this.reviewError = null;

    this.assignmentsApi.reviewAssignment(this.selectedAssignment.id, null)
      .pipe(finalize(() => (this.reviewLoading = false)))
      .subscribe({
        next: (updated) => {
          const idx = this.assignments.findIndex(a => a.id === updated.id);
          if (idx >= 0) this.assignments[idx] = { ...this.assignments[idx], ...updated };

          this.selectedAssignment = { ...this.selectedAssignment, ...updated };

          this.closeModal();
          this.loadSubmissionsPage(this.submissionsPage);
          this.loadAssignedPage(this.assignedPage);
        },
        error: (err) => {
          console.error(err);
          this.reviewError = err?.error?.message ?? 'Failed to mark as reviewed.';
        }
      });
  }

  openAssignmentModal(a: FormAssignment): void {
    this.closeAllOverlays();
    this.selectedAssignment = a;
    this.isModalOpen = true;

    const isSubmitted = a.status === 'SUBMITTED' || a.status === 'REVIEWED';
    this.modalMode = isSubmitted ? 'view' : 'preview';

    this.currentForm = null;
    this.submittedAnswers = [];
    this.modalError = null;
    this.modalLoading = true;

    this.formsApi.getFormById(a.formId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (form) => {
          this.currentForm = {
            ...form,
            questions: form.questions.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
          };

          if (this.modalMode === 'view') {
            this.submissionsApi.getByAssignmentId(a.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (submission) => {
                  this.submittedAnswers = submission.answers ?? [];
                  this.modalLoading = false;
                },
                error: () => {
                  this.modalLoading = false;
                  this.modalError = 'Impossible de charger les réponses.';
                }
              });
          } else {
            this.modalLoading = false;
          }
        },
        error: () => {
          this.modalLoading = false;
          this.modalError = 'Impossible de charger le formulaire.';
        }
      });
  }

  openAssignedAssignment(a: FormAssignment, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (this.isAnyOverlayOpen) return;
    this.openAssignmentModal(a);
  }

  openSubmissionAssignment(a: FormAssignment) {
    if (this.isAnyOverlayOpen) return;
    this.openAssignmentModal(a);
  }


  isFileNutritionPlan(plan: any): boolean {
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

  get nutritionSelectionPrograms(): any[] {
    const baseList = this.nutritionFileEnabled === false
      ? this.nutritionSelectionList.filter((plan) => !this.isFileNutritionPlan(plan))
      : this.nutritionSelectionList;

    if (this.nutritionSelectionMode === 'APP') {
      return baseList.filter((plan) => !this.isFileNutritionPlan(plan));
    }

    if (this.nutritionSelectionMode === 'FILES') {
      return this.nutritionFileEnabled === false
        ? []
        : baseList.filter((plan) => this.isFileNutritionPlan(plan));
    }

    return baseList;
  }

  getAllNutrition() {
    this.nutritionService.getNutritionPlans(0, 1000).subscribe((res: any) => {
      this.nutritionSelectionList = (res.content || [])
        .filter((plan: any) => !plan.client)
        .map((plan: any) => ({
          ...plan,
          status: 'upcoming',
          totalDays: this.isFileNutritionPlan(plan) ? 0 : (plan.mealDays?.length || 0),
          calories: this.isFileNutritionPlan(plan) ? null : (plan.mealDays?.[0]?.dayTargets?.calories ?? null),
        }));
    });
  }

  openDirectWorkoutSelection(): void {
    this.assignType = 'WORKOUT';
    this.showAssignSelectModal = false;
    this.showProgramSelectionModal = true;
  }

  openAssignProgramModal(type: 'WORKOUT' | 'NUTRITION'): void {
    this.assignType = type;
    this.showAssignSelectModal = true;
  }

  onExistingFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'WORKOUT') {
      this.showProgramSelectionModal = true;
      return;
    }

    if (this.assignType === 'NUTRITION') {
      this.nutritionSelectionMode = 'ALL';
      this.showNutritionSelectionModal = true;
      return;
    }

    this.showFormSelectionModal = true;
  }


  closeNutritionExistingTypeModal(): void {
    this.showNutritionExistingTypeModal = false;
  }


  createNormalNutritionFromProfile(): void {
    this.showNutritionExistingTypeModal = false;
    this.selectedClientNutritionPlanType = null;
    this.showChooseModal = true;
  }

  importFileNutritionFromProfile(): void {
    if (this.nutritionFileEnabled === false) {
      return;
    }

    this.showNutritionExistingTypeModal = false;
    this.openImportNutritionFileFromProfile();
  }

  openImportNutritionFileFromProfile(): void {
    this.showNutritionFileImportModal = true;
    this.profileImportNutritionFile = null;
    this.profileImportNutritionName = '';
    this.profileImportNutritionDetails = '';
    this.profileImportNutritionStartDate = '';
    this.profileImportNutritionEndDate = '';
    this.profileImportNutritionError = '';
    this.profileImportNutritionSaving = false;
  }

  openExistingNutritionPrograms(mode: 'APP' | 'FILES'): void {
    if (this.nutritionFileEnabled === false && mode === 'FILES') {
      return;
    }

    this.nutritionSelectionMode = mode;
    this.showNutritionExistingTypeModal = false;
    this.showNutritionSelectionModal = true;
  }

  onCreateFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'CHECKIN') {
      this.router.navigate(['/forms/create-form'], {
        queryParams: {
          returnTo: 'client-profile',
          clientId: this.clientId,
          openAssign: 1,
        },
      });
      return;
    }

    if (this.assignType === 'WORKOUT') {
      if (!this.workoutFileEnabled) {
        this.createNormalWorkoutFromProfile();
        return;
      }

      // Create New Program / Build a custom program => open the same type chooser as Workout Library.
      this.showWorkoutTypeModal = true;
      return;
    }

    if (this.assignType === 'NUTRITION') {
      if (this.nutritionFileEnabled === false) {
        this.createNormalNutritionFromProfile();
        return;
      }
      this.showNutritionExistingTypeModal = true;
      return;
    }
  }


  closeWorkoutTypeModal(): void {
    this.showWorkoutTypeModal = false;
  }

  createNormalWorkoutFromProfile(): void {
    this.showWorkoutTypeModal = false;
    this.openClientWorkoutCreateModal();
  }

  openClientNutritionCreateModal(): void {
    this.clientNutritionProgramName = '';
    this.clientNutritionDurationWeeks = 4;
    this.clientNutritionStartDate = new Date().toISOString().slice(0, 10);
    this.clientNutritionConflict = null;
    this.showClientNutritionCreateModal = true;
    this.refreshClientNutritionConflict();
  }

  onClientNutritionPlanTypeSelected(type: NutritionPlanChoice): void {
    this.selectedClientNutritionPlanType = type;
    this.showChooseModal = false;
    this.openClientNutritionCreateModal();
  }

  closeClientNutritionCreateModal(): void {
    this.showClientNutritionCreateModal = false;
    this.clientNutritionConflict = null;
    this.selectedClientNutritionPlanType = null;
  }

  get clientNutritionDurationDays(): number {
    return this.clientNutritionDurationWeeks * 7;
  }

  get clientNutritionEndDate(): string {
    return this.addDays(this.clientNutritionStartDate, this.clientNutritionDurationDays - 1);
  }

  get canCreateClientNutritionProgram(): boolean {
    return !!this.clientNutritionProgramName.trim()
      && !!this.clientNutritionStartDate
      && (!this.clientNutritionConflict || !!this.clientNutritionConflict.resolution);
  }

  get profileNutritionReturnUrl(): string {
    return `${this.router.url.split('?')[0]}?tab=nutrition`;
  }

  onClientNutritionScheduleChange(): void {
    this.refreshClientNutritionConflict();
  }

  setClientNutritionConflictResolution(resolution: WorkoutConflictResolution): void {
    if (this.clientNutritionConflict) {
      this.clientNutritionConflict.resolution = resolution;
    }
  }

  private refreshClientNutritionConflict(): void {
    if (!this.clientNutritionStartDate || !this.clientNutritionEndDate) {
      this.clientNutritionConflict = null;
      return;
    }

    const previous = this.clientNutritionConflict;
    const conflictProgram = (this.assignedNutritionPrograms || []).find((program: any) => {
      if (this.nutritionFileEnabled === false && this.isFileNutritionPlan(program)) {
        return false;
      }

      return this.programOverlapsRange(program, this.clientNutritionStartDate, this.clientNutritionEndDate);
    });

    if (!conflictProgram) {
      this.clientNutritionConflict = null;
      return;
    }

    this.clientNutritionConflict = {
      program: conflictProgram,
      resolution: previous?.program?.id === conflictProgram.id ? previous.resolution : undefined,
    };
  }

  createClientNutritionProgram(): void {
    const name = this.clientNutritionProgramName.trim();
    if (!name || !this.canCreateClientNutritionProgram || !this.selectedClientNutritionPlanType) return;

    const conflict = this.clientNutritionConflict;
    const resolution = conflict?.resolution;
    const resolvedStartDate = resolution === 'START_AFTER' && conflict?.program?.endDate
      ? this.addDays(conflict.program.endDate, 1)
      : this.clientNutritionStartDate;

    this.showClientNutritionCreateModal = false;
    this.clientNutritionStartDate = resolvedStartDate;

    const queryParams = {
      name,
      durationWeeks: this.clientNutritionDurationWeeks,
      startDate: resolvedStartDate,
      endDate: this.clientNutritionEndDate,
      returnUrl: this.profileNutritionReturnUrl,
      assignAfterCreate: true,
    };

    if (this.selectedClientNutritionPlanType === 'full') {
      this.router.navigate([`/clients/create-full-plan/${this.clientId}`], { queryParams });
      return;
    }

    if (this.selectedClientNutritionPlanType === 'macro-total') {
      this.router.navigate([`/clients/create-macro-plan-total-day/${this.clientId}`], {
        queryParams: { ...queryParams, type: 'total' },
      });
      return;
    }

    this.router.navigate([`/clients/create-macro-plan/${this.clientId}`], {
      queryParams: { ...queryParams, type: 'each' },
    });
  }

  isFileWorkoutPlan(plan: any): boolean {
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

  openClientWorkoutCreateModal(): void {
    this.clientWorkoutProgramName = '';
    this.clientWorkoutDurationWeeks = 4;
    this.clientWorkoutStartDate = new Date().toISOString().slice(0, 10);
    this.clientWorkoutConflict = null;
    this.showClientWorkoutCreateModal = true;
    this.refreshClientWorkoutConflict();
  }

  closeClientWorkoutCreateModal(): void {
    this.showClientWorkoutCreateModal = false;
    this.clientWorkoutConflict = null;
  }

  get clientWorkoutDurationDays(): number {
    return this.clientWorkoutDurationWeeks * 7;
  }

  get clientWorkoutEndDate(): string {
    return this.addDays(this.clientWorkoutStartDate, this.clientWorkoutDurationDays - 1);
  }

  get canCreateClientWorkoutProgram(): boolean {
    return !!this.clientWorkoutProgramName.trim()
      && !!this.clientWorkoutStartDate
      && (!this.clientWorkoutConflict || !!this.clientWorkoutConflict.resolution);
  }

  onClientWorkoutScheduleChange(): void {
    this.refreshClientWorkoutConflict();
  }

  setClientWorkoutConflictResolution(resolution: WorkoutConflictResolution): void {
    if (this.clientWorkoutConflict) {
      this.clientWorkoutConflict.resolution = resolution;
    }
  }

  private refreshClientWorkoutConflict(): void {
    if (!this.clientWorkoutStartDate || !this.clientWorkoutEndDate) {
      this.clientWorkoutConflict = null;
      return;
    }

    const previous = this.clientWorkoutConflict;
    const conflictProgram = (this.assignedWorkoutPrograms || []).find((program: any) => {
      if (!this.workoutFileEnabled && this.isFileWorkoutPlan(program)) {
        return false;
      }

      return this.programOverlapsRange(program, this.clientWorkoutStartDate, this.clientWorkoutEndDate);
    });

    if (!conflictProgram) {
      this.clientWorkoutConflict = null;
      return;
    }

    this.clientWorkoutConflict = {
      program: conflictProgram,
      resolution: previous?.program?.id === conflictProgram.id ? previous.resolution : undefined,
    };
  }

  private programOverlapsRange(program: any, startDate: string, endDate: string): boolean {
    if (!program?.startDate || !program?.endDate) return false;

    const existingStart = new Date(`${program.startDate}T00:00:00`).getTime();
    const existingEnd = new Date(`${program.endDate}T00:00:00`).getTime();
    const nextStart = new Date(`${startDate}T00:00:00`).getTime();
    const nextEnd = new Date(`${endDate}T00:00:00`).getTime();

    return existingStart <= nextEnd && nextStart <= existingEnd;
  }

  createClientWorkoutProgram(): void {
    const name = this.clientWorkoutProgramName.trim();
    if (!name || !this.canCreateClientWorkoutProgram) return;

    const returnUrl = this.router.url.split('?')[0] + '?tab=workouts';
    const conflict = this.clientWorkoutConflict;
    const resolution = conflict?.resolution;
    const resolvedStartDate = resolution === 'START_AFTER' && conflict?.program?.endDate
      ? this.addDays(conflict.program.endDate, 1)
      : this.clientWorkoutStartDate;

    this.router.navigate(['clients/create-workout', this.clientId], {
      queryParams: {
        returnUrl,
        assignOnly: 1,
        name,
        durationWeeks: this.clientWorkoutDurationWeeks,
        startDate: resolvedStartDate,
        endDate: this.addDays(resolvedStartDate, this.clientWorkoutDurationDays - 1),
        conflictResolution: resolution || '',
        conflictId: conflict?.program?.id || '',
        conflictStartDate: conflict?.program?.startDate || '',
      },
    });
  }

  importFileWorkoutFromProfile(): void {
    // Do not redirect to Program Library from profile.
    // Open the import modal and save+assign ONLY to this client.
    this.showWorkoutTypeModal = false;
    this.openFileWorkoutImportModal();
  }

  openFileWorkoutImportModal(): void {
    this.showFileWorkoutImportModal = true;
    this.profileImportWorkoutFile = null;
    this.profileImportWorkoutName = '';
    this.profileImportWorkoutDetails = '';
    this.profileImportStartDate = '';
    this.profileImportEndDate = '';
    this.profileImportError = '';
    this.profileImportSaving = false;
  }

  closeFileWorkoutImportModal(): void {
    if (this.profileImportSaving) return;
    this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
    this.profileImportError = '';
  }

  browseProfileWorkoutFile(): void {
    const input = document.getElementById('profileWorkoutFileInput') as HTMLInputElement | null;
    input?.click();
  }

  onProfileWorkoutFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const valid = fileName.endsWith('.pdf') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

    if (!valid) {
      this.profileImportError = 'Only PDF, XLS, or XLSX files are accepted.';
      input.value = '';
      return;
    }

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      this.profileImportError = 'File size must be less than 25 MB.';
      input.value = '';
      return;
    }

    this.profileImportWorkoutFile = file;
    this.profileImportError = '';

    if (!this.profileImportWorkoutName) {
      this.profileImportWorkoutName = file.name.replace(/\.(pdf|xls|xlsx)$/i, '');
    }
  }

  clearProfileWorkoutFile(event?: Event): void {
    event?.stopPropagation();
    this.profileImportWorkoutFile = null;
    const input = document.getElementById('profileWorkoutFileInput') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  canSaveProfileFileWorkout(): boolean {
    return !!this.profileImportWorkoutFile
      && !!this.profileImportWorkoutName?.trim()
      && !!this.profileImportStartDate
      && !!this.profileImportEndDate
      && !this.profileImportSaving;
  }

  saveAndAssignProfileFileWorkout(): void {
    if (!this.canSaveProfileFileWorkout() || !this.profileImportWorkoutFile || !this.clientId) return;

    this.profileImportSaving = true;
    this.profileImportError = '';

    this.workoutService.createAndAssignFileWorkoutOnly(
      this.profileImportWorkoutFile,
      this.profileImportWorkoutName.trim(),
      this.profileImportWorkoutDetails?.trim() || undefined,
      this.clientId,
      this.profileImportStartDate,
      this.profileImportEndDate
    ).subscribe({
      next: () => {
        this.profileImportSaving = false;
        this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
        this.closeAssignFlow();
        this.loadDashboardPrograms();
        this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
      },
      error: (err) => {
        console.error('Failed to import and assign file workout:', err);
        this.profileImportSaving = false;
        this.profileImportError = 'Impossible d’importer et assigner ce programme. Vérifiez le fichier et les dates.';
      },
    });
  }



  closeNutritionFileImportModal(): void {
    if (this.profileImportNutritionSaving) return;
    this.showNutritionFileImportModal = false;
    this.profileImportNutritionError = '';
  }

  browseProfileNutritionFile(): void {
    const input = document.getElementById('profileNutritionFileInput') as HTMLInputElement | null;
    input?.click();
  }

  onProfileNutritionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const valid = fileName.endsWith('.pdf') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

    if (!valid) {
      this.profileImportNutritionError = 'Only PDF, XLS, or XLSX files are accepted.';
      input.value = '';
      return;
    }

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      this.profileImportNutritionError = 'File is too large. Maximum size is 25 MB.';
      input.value = '';
      return;
    }

    this.profileImportNutritionFile = file;
    this.profileImportNutritionError = '';

    if (!this.profileImportNutritionName) {
      this.profileImportNutritionName = file.name.replace(/\.(pdf|xls|xlsx)$/i, '');
    }
  }

  clearProfileNutritionFile(event?: Event): void {
    event?.stopPropagation();
    this.profileImportNutritionFile = null;
    const input = document.getElementById('profileNutritionFileInput') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  canSaveProfileFileNutrition(): boolean {
    return !!this.profileImportNutritionFile
      && !!this.profileImportNutritionName?.trim()
      && !!this.profileImportNutritionStartDate
      && !!this.profileImportNutritionEndDate
      && !this.profileImportNutritionSaving;
  }

  saveAndAssignProfileFileNutrition(): void {
    if (!this.canSaveProfileFileNutrition() || !this.profileImportNutritionFile || !this.client) return;

    this.profileImportNutritionSaving = true;
    this.profileImportNutritionError = '';

    this.nutritionService.createNutritionFilePlan(
      this.profileImportNutritionFile,
      this.profileImportNutritionName.trim(),
      this.profileImportNutritionDetails?.trim() || undefined,
      undefined,
      undefined
    ).subscribe({
      next: (createdPlan: any) => {
        const item = {
          ...createdPlan,
          client: this.client,
          startDate: this.profileImportNutritionStartDate,
          endDate: this.profileImportNutritionEndDate,
          mealDays: [],
          isMealPlanTemplate: false,
        };

        this.nutritionService.assignNutritionPlan(item).subscribe({
          next: () => {
            this.profileImportNutritionSaving = false;
            this.showNutritionFileImportModal = false;
            this.closeAssignFlow();
            this.getAllNutrition();
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: (err) => {
            console.error('Failed to assign imported nutrition file:', err);
            this.profileImportNutritionSaving = false;
            this.profileImportNutritionError = 'File imported, but assignment failed. Please try assigning it from Existing Nutrition Programs.';
            this.getAllNutrition();
          },
        });
      },
      error: (err) => {
        console.error('Failed to import nutrition file:', err);
        this.profileImportNutritionSaving = false;
        this.profileImportNutritionError = 'Impossible d’importer et assigner ce programme nutrition. Vérifiez le fichier et les dates.';
      },
    });
  }


  backToAssignModal(): void {
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
    this.showNutritionExistingTypeModal = false;
    this.showNutritionFileImportModal = false;
    this.showFormSelectionModal = false;
    this.showChooseModal = false;
    this.showAssignSelectModal = true;
  }

  closeChooseModal() {
    this.showChooseModal = false;
  }

  onAssignNutritionFromModal(payload: {
    program: any;
    startDate: string;
    endDate: string | null;
    conflictResolutions?: Record<string, { resolution: 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH'; conflict: any }>;
  }) {
    const { program, startDate: requestedStartDate, endDate } = payload;
    const resolution = this.getProfileConflictResolution(payload);
    const startDate = this.getResolvedStartDate(requestedStartDate, resolution);
    const item = { ...program };

    item.startDate = startDate;
    const replace$ = resolution?.resolution === 'REPLACE'
      ? this.stopExistingNutritionBefore(resolution.conflict, startDate)
      : of(null);

    if (this.isFileNutritionPlan(program)) {
      if (!endDate) {
        return;
      }

      const durationDays = this.daysBetweenInclusive(requestedStartDate, endDate);
      item.endDate = this.addDays(startDate, durationDays - 1);
      item.mealDays = [];
      item.client = this.client;
      item.isMealPlanTemplate = false;

      replace$.pipe(
        switchMap(() => this.nutritionService.assignNutritionPlan(item))
      ).subscribe(() => {
        this.showNutritionSelectionModal = false;
        this.loadDashboardPrograms();
        this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
      });

      return;
    }

    const mealDays = (program.mealDays || []).map((day: any, index: number) => {
      const current = new Date(startDate);
      current.setDate(current.getDate() + index);

      return {
        ...day,
        date: current.toISOString().split('T')[0],
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'long' }),
      };
    });

    item.mealDays = mealDays;

    const totalDays = mealDays.length || 0;
    if (totalDays > 0) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + totalDays - 1);
      item.endDate = end.toISOString().split('T')[0];
    } else {
      item.endDate = startDate;
    }

    item.client = this.client;

    replace$.pipe(
      switchMap(() => this.nutritionService.assignNutritionPlan(item))
    ).subscribe(() => {
      this.showNutritionSelectionModal = false;
      this.loadDashboardPrograms();
      this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
    });
  }

  private getProfileConflictResolution(payload: {
    conflictResolutions?: Record<string, { resolution: 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH'; conflict: any }>;
  }): { resolution: 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH'; conflict: any } | null {
    if (!this.client?.id) return null;
    return payload.conflictResolutions?.[this.client.id] || null;
  }

  private getResolvedStartDate(defaultStartDate: string, resolution: { resolution: string; conflict: any } | null): string {
    if (resolution?.resolution === 'START_AFTER' && resolution.conflict?.endDate) {
      return this.addDays(resolution.conflict.endDate, 1);
    }

    return defaultStartDate;
  }

  private stopExistingNutritionBefore(conflict: any, nextStartDate: string): Observable<unknown> {
    if (!conflict?.id || !conflict.startDate) return of(null);

    const replacementEndDate = this.addDays(nextStartDate, -1);
    if (new Date(`${replacementEndDate}T00:00:00`).getTime() < new Date(`${conflict.startDate}T00:00:00`).getTime()) {
      return this.nutritionService.deleteNutritionPlan(conflict.id);
    }

    return this.nutritionService.updateNutritionPlanDates(conflict.id, conflict.startDate, replacementEndDate);
  }

  private daysBetweenInclusive(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.floor((end - start) / 86400000) + 1;
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setSubTab(tab: 'submissions' | 'assigned' | 'scheduled') {
    this.activeSubTab = tab;

    if (tab === 'submissions') this.loadSubmissionsPage(0);
    if (tab === 'assigned') this.loadAssignedPage(0);
    if (tab === 'scheduled') this.loadScheduledItems(0);

    this.closeModal();
    this.closeScheduleDetail();
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
  }

  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.submittedAnswers.find(a => a.questionId === questionId);
  }

  getOptionLabel(question: any, optionId: string): string {
    return question.options?.find((o: any) => o.id === optionId)?.label ?? optionId;
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isViewMode = false;
    this.selectedAssignment = null;
    this.currentForm = null;
    this.submittedAnswers = [];
    this.modalLoading = false;
    this.modalError = null;
  }

  getStars(max: number | undefined): number[] {
    const count = max || 5;
    return Array.from({ length: count }, (_, i) => i + 1);
  }


  private assignPendingCreatedWorkoutIfNeeded(): void {
    if (!this.pendingCreatedWorkoutToAssign || !this.client) return;

    const program = this.pendingCreatedWorkoutToAssign;
    this.pendingCreatedWorkoutToAssign = null;

    const startDate = program.startDate || new Date().toISOString().slice(0, 10);
    const workoutDays = program.workoutDays || [];
    let endDate = program.endDate || startDate;

    if (!program.endDate && workoutDays.length) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + workoutDays.length - 1);
      endDate = end.toISOString().slice(0, 10);
    }

    const item = {
      ...program,
      startDate,
      endDate,
      client: this.client,
      isWorkoutPlanTemplate: false,
    };

    this.workoutService.assignWorkout(item.id, item).subscribe({
      next: () => {
        // Created from the client profile only to assign it.
        // Remove the source from Workout Library after the assigned copy is saved.
        this.workoutService.deleteWorkout(program.id).subscribe({
          next: () => {
            this.loadDashboardPrograms();
            this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: () => {
            this.loadDashboardPrograms();
            this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
          },
        });
      },
      error: (err) => {
        console.error('Failed to assign newly created workout:', err);
      },
    });
  }

  private assignPendingCreatedNutritionIfNeeded(): void {
    if (!this.pendingCreatedNutritionToAssign || !this.client) return;

    const program = this.pendingCreatedNutritionToAssign;
    this.pendingCreatedNutritionToAssign = null;

    const startDate = program.startDate || this.clientNutritionStartDate || new Date().toISOString().slice(0, 10);
    const mealDays = (program.mealDays || []).map((day: any, index: number) => {
      const current = new Date(`${startDate}T00:00:00`);
      current.setDate(current.getDate() + index);

      return {
        ...day,
        date: current.toISOString().slice(0, 10),
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'long' }),
      };
    });

    let endDate = program.endDate || startDate;
    if (!program.endDate && mealDays.length) {
      endDate = this.addDays(startDate, mealDays.length - 1);
    }

    const resolution = this.clientNutritionConflict?.resolution;
    const replace$ = resolution === 'REPLACE'
      ? this.stopExistingNutritionBefore(this.clientNutritionConflict?.program, startDate)
      : of(null);

    const item = {
      ...program,
      startDate,
      endDate,
      mealDays,
      client: this.client,
      isMealPlanTemplate: false,
    };

    replace$.pipe(
      switchMap(() => this.nutritionService.assignNutritionPlan(item))
    ).subscribe({
      next: () => {
        this.nutritionService.deleteNutritionPlan(program.id).subscribe({
          next: () => {
            this.clientNutritionConflict = null;
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: () => {
            this.clientNutritionConflict = null;
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
        });
      },
      error: (err) => {
        console.error('Failed to assign newly created nutrition plan:', err);
      },
    });
  }

  onAssignWorkoutFromModal(payload: {
    program: any;
    startDate: string;
    endDate: string | null;
    result?: any;
  }) {
    // The selection modal performs the assign request itself.
    // If result exists, just close and refresh.
    if (payload?.result) {
      this.showProgramSelectionModal = false;
      this.loadDashboardPrograms();
      this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
      return;
    }

    const { program, startDate, endDate } = payload;

    const item = { ...program };
    item.startDate = startDate;
    item.endDate = endDate;
    item.client = this.client;

    this.workoutService.assignWorkout(item.id, item).subscribe(() => {
      this.showProgramSelectionModal = false;
      this.loadDashboardPrograms();
      this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
    });
  }

  get isAnyOverlayOpen(): boolean {
    return (
      this.showAssignSelectModal ||
      this.showFormSelectionModal ||
      this.showProgramSelectionModal ||
      this.showNutritionSelectionModal ||
      this.showChooseModal ||
      this.showClientNutritionCreateModal ||
      this.isModalOpen ||
      !!this.selectedSchedule
    );
  }

  private closeAllOverlays(): void {
    this.closeModal();
    this.closeScheduleDetail();
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
  }

  closeAssignFlow(): void {
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
    this.showChooseModal = false;
    this.showClientNutritionCreateModal = false;
    this.clientNutritionConflict = null;
    this.selectedClientNutritionPlanType = null;
    this.showWorkoutTypeModal = false;
    this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
    this.preselectFormId = null;
  }

  openCheckinModal() {
    this.closeAllOverlays();
    this.assignType = 'CHECKIN';
    this.showAssignSelectModal = true;
  }

  onAssignFormFromModal(payload: { form: Form; assignedDate: string; dueDate: string; endDate: string | null }) {
    const { form, dueDate, endDate } = payload;
    const hasSchedule = !!form.schedule;

    this.showFormSelectionModal = false;
    this.loadingAssignments = true;

    this.formsApi.ensurePublished(form.id).pipe(
      switchMap(() =>
        this.assignmentsApi.bulkAssign(form.id, {
          assigneeIds: [this.clientId],
          dueDate: hasSchedule ? null : (dueDate || null),
          endDate: hasSchedule ? (endDate || null) : null,
        })
      ),
      switchMap(() =>
        this.assignmentsApi.pageOwnerAssignmentsByAssigneeIdStatuses(
          0,
          this.PAGE_SIZE,
          'assignedAt',
          'DESC',
          this.clientId,
          ['ASSIGNED', 'OPENED'],
          this.assignedSearch
        )
      ),
      switchMap((res: any) =>
        from((async () => {
          const items: FormAssignment[] = res.content ?? [];
          await this.attachFormNames(items);
          this.assignedTotalPages = res.totalPages || 0;
          this.assignedPage = res.number ?? 0;
          this.assignedPagesArray = this.buildCompactPages(this.assignedPage, this.assignedTotalPages);
          return items;
        })())
      ),
      map((items: FormAssignment[]) => [...items]),
      finalize(() => {
        this.loadingAssignments = false;
      })
    ).subscribe({
      next: (items) => {
        this.assignedAssignments = items;
        this.syncAssignmentsCache();
        this.preselectFormId = null;
        this.activeTab = 'checkins';
        this.activeSubTab = 'assigned';
      },
      error: (err) => {
        console.error(err);
        this.loadingAssignments = false;
        alert('Assign failed');
      }
    });
  }

  onCloseFormModal() {
    this.showFormSelectionModal = false;
    this.preselectFormId = null;
  }

  get activeSchedulesCount(): number {
    return this.scheduledCheckIns.length;
  }

  openScheduleDetail(item: ClientScheduleItemDto): void {
    this.closeScheduledDelete();
    this.closeAllOverlays();
    this.selectedSchedule = item;
  }

  closeScheduleDetail(): void {
    this.selectedSchedule = null;
  }

  openDeleteScheduled(item: ClientScheduleItemDto, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!item?.id) return;

    this.selectedScheduledToDelete = item;
    this.confirmScheduledDeleteOpen = true;
  }

  closeScheduledDelete(): void {
    if (this.deletingScheduled) return;
    this.confirmScheduledDeleteOpen = false;
    this.selectedScheduledToDelete = null;
  }

  confirmScheduledDelete(): void {
    const item = this.selectedScheduledToDelete;
    if (!item?.id) return;

    if (this.selectedSchedule?.id === item.id) {
      this.selectedSchedule = null;
    }

    this.deletingScheduled = true;
    this.scheduledError = null;

    const req$ =
      item.kind === 'ASSIGNED'
        ? this.assignmentsApi.hardDelete(item.id)
        : this.formsApi.deleteClientScheduleItem(item.id);

    req$
      .pipe(finalize(() => (this.deletingScheduled = false)))
      .subscribe({
        next: () => {
          this.confirmScheduledDeleteOpen = false;
          this.selectedScheduledToDelete = null;
          this.loadScheduledItems();

          if (item.kind === 'ASSIGNED') {
            this.loadClientAssignments();
          }
        },
        error: (err) => {
          console.error(err);
          this.scheduledError =
            err?.error?.message ??
            (item.kind === 'ASSIGNED'
              ? 'Failed to delete assignment'
              : 'Failed to delete scheduled item');
        }
      });
  }

  deleteSchedule(schedule: ScheduledCheckIn): void {
    this.scheduledCheckIns = this.scheduledCheckIns.filter(s => s.id !== schedule.id);
    if (this.selectedSchedule?.id === schedule.id) {
      this.selectedSchedule = null;
    }
  }

  loadScheduledItems(page: number = this.scheduledPage): void {
    if (!this.clientId) return;

    this.loadingScheduled = true;
    this.scheduledError = null;
    this.scheduledPage = Math.max(page, 0);

    this.formsApi.getClientScheduleItemsPage(this.clientId, this.scheduledPage, this.scheduledPageSize)
      .pipe(finalize(() => (this.loadingScheduled = false)))
      .subscribe({
        next: (res) => {
          this.scheduledItems = res.content ?? [];
          this.scheduledTotalPages = res.totalPages || 0;
          this.scheduledPage = res.number ?? this.scheduledPage;
          this.scheduledPagesArray = Array.from({ length: this.scheduledTotalPages }, (_, i) => i);
        },
        error: () => {
          // Fallback if backend page endpoint is not available yet.
          this.formsApi.getClientScheduleItems(this.clientId).subscribe({
            next: (items) => {
              const all = items ?? [];
              this.scheduledTotalPages = Math.ceil(all.length / this.scheduledPageSize);
              this.scheduledPagesArray = Array.from({ length: this.scheduledTotalPages }, (_, i) => i);
              const start = this.scheduledPage * this.scheduledPageSize;
              this.scheduledItems = all.slice(start, start + this.scheduledPageSize);
            },
            error: () => (this.scheduledError = 'Failed to load scheduled items'),
          });
        },
      });
  }

  changeScheduledPage(page: number): void {
    if (page < 0 || page >= this.scheduledTotalPages || page === this.scheduledPage) return;
    this.loadScheduledItems(page);
  }



}
