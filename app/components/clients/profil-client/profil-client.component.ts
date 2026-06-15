import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from 'app/service/client.service';

import { ChoosePlanTypeModalComponent } from 'app/components/nutrition/choose-plan-type-modal/choose-plan-type-modal.component';
import { WorkoutsClientTabComponent } from './workouts-client-tab/workouts-client-tab.component';
import { NutritionClientTabComponent } from './nutrition-client-tab/nutrition-client-tab.component';
import { NutritionSelectionModalComponent } from './nutrition-selection-modal/nutrition-selection-modal.component';
import { WorkoutProgramSelectionModalComponent } from './workout-program-selection-modal/workout-program-selection-modal.component';
import { AssignSelectModalComponent } from './assign-select-modal/assign-select-modal.component';
import { FormSelectionModalComponent } from './form-selection-modal/form-selection-modal.component';
import { AssignmentsApiService, FormAssignment } from '../../forms/services/assignments-api.service';
import { Subject, takeUntil, from } from 'rxjs';
import { FormDetails, FormsApiService, Form } from '../../forms/services/forms-api.service';
import { Answer, QuestionType } from '../../../models/forms.model';
import { SubmissionsApiService } from '../../forms/services/submissions-api.service';
import { switchMap, finalize, map } from 'rxjs/operators';
import { ClientScheduleItemDto } from '../../../models/client-schedule.model';
import { CalendarClientsComponent } from '../../calendar/calendar-clients/calendar-clients.component';
import { ProgressPicturesComponent } from 'app/components/progress-pictures-module/progress-pictures/progress-pictures.component';
import { BodyMeasurementsComponent } from 'app/components/body-measurements/body-measurements.component';
import { BodyMeasurement, BodyMeasurementsService } from 'app/service/body-measurements.service';

type TabId =
  | 'dashboard'
  | 'workouts'
  | 'nutrition'
  | 'checkins'
  | 'measurements'
  | 'pictures'
  | 'calendar';



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

interface ActiveNutritionPlan {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount?: number;
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
    BodyMeasurementsComponent
  ],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {

  activeTab: TabId = 'dashboard';
  setTab(tab: TabId) {
    this.activeTab = tab;
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

  get clientObjective(): string {
    return (
      (this.client as any)?.idealShapeDescription ||
      (this.client as any)?.objective ||
      (this.client as any)?.goal ||
      (this.clientTargetWeight ? `Goal weight ${this.formatNumber(this.clientTargetWeight)} kg` : '')
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
  showChooseModal = false;

  nutritionSelectionList: any[] = [];
  assignments: FormAssignment[] = [];
  loadingAssignments = false;
  assignmentsError: string | null = null;
  private readonly PAGE_SIZE = 50;
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
  loadingDashboardPrograms = false;
  dashboardProgramsError: string | null = null;

  get hasTodaysWorkout(): boolean {
    return !!this.todaysWorkout && this.todaysWorkout.exercises.length > 0;
  }

  get hasActiveNutritionPlan(): boolean {
    return !!this.activeNutritionPlan;
  }

  activeSubTab: 'submissions' | 'assigned' | 'scheduled' = 'submissions';
  submissionSearch = '';
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
    private bodyMeasurementsService: BodyMeasurementsService
  ) {
    const routeId = this.route.snapshot.paramMap.get('id') || '';
    if (routeId) {
      this.clientId = routeId;
      this.loadClientData();
    }

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as TabId | undefined;
      if (tab) this.activeTab = tab;

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

    this.getAllNutrition();
  }

  private loadClientData(): void {
    if (!this.clientId) return;
    this.getClientById(this.clientId);
    this.loadClientAssignments();
    this.loadBodyMeasurements();
    this.loadDashboardPrograms();
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }


  private loadDashboardPrograms(): void {
    if (!this.clientId || !this.userid) return;

    this.loadingDashboardPrograms = true;
    this.dashboardProgramsError = null;
    this.todaysWorkout = null;
    this.activeNutritionPlan = null;

    this.workoutService
      .getWorkoutByCoachIdAndClient(this.userid, this.clientId, 0, 100)
      .subscribe({
        next: (res: any) => {
          const plans = res?.content || [];
          this.todaysWorkout = this.extractTodaysWorkout(plans);
        },
        error: (err) => {
          console.error('Failed to load today workout:', err);
          this.todaysWorkout = null;
          this.dashboardProgramsError = 'Failed to load today workout.';
        },
      });

    this.nutritionService
      .getNutritionPlanByCoachIdAndClient(this.userid, this.clientId, 0, 100)
      .subscribe({
        next: (res: any) => {
          const plans = res?.content || [];
          this.activeNutritionPlan = this.extractTodaysNutrition(plans);
          this.loadingDashboardPrograms = false;
        },
        error: (err) => {
          console.error('Failed to load active nutrition plan:', err);
          this.activeNutritionPlan = null;
          this.loadingDashboardPrograms = false;
          this.dashboardProgramsError = 'Failed to load active nutrition plan.';
        },
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
      const aDate = this.safeDate(a?.startDate)?.getTime() || 0;
      const bDate = this.safeDate(b?.startDate)?.getTime() || 0;
      return bDate - aDate;
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
    const now = new Date().getTime();

    const list = this.assignments.filter(a =>
      a.status !== 'SUBMITTED' &&
      a.status !== 'REVIEWED' &&
      (!a.dueAt || new Date(a.dueAt).getTime() <= now)
    );

    const term = this.assignedSearch.trim().toLowerCase();
    if (!term) return list;

    return list.filter(a => (a.formName ?? a.formId).toLowerCase().includes(term));
  }

  get submissionsList(): FormAssignment[] {
    const list = this.assignments.filter(a =>
      a.status === 'SUBMITTED' || a.status === 'REVIEWED'
    );

    const term = this.submissionSearch.trim().toLowerCase();
    if (!term) return list;

    return list.filter(a => (a.formName ?? a.formId).toLowerCase().includes(term));
  }

  async loadClientAssignments(): Promise<void> {
    if (!this.clientId) return;

    this.loadingAssignments = true;
    this.assignmentsError = null;

    this.assignmentsApi
      .pageOwnerAssignmentsByAsigneeId(0, this.PAGE_SIZE, 'assignedAt', 'DESC', this.clientId)
      .subscribe({
        next: async (res) => {
          this.assignments = res.content;
          await this.attachFormNames(this.assignments);
          this.loadingAssignments = false;
        },
        error: () => {
          this.assignmentsError = 'Failed to load assignments';
          this.loadingAssignments = false;
        },
      });
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
          this.loadClientAssignments();
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

  getAllNutrition() {
    this.nutritionService.getNutritionPlans().subscribe((res: any) => {
      this.nutritionSelectionList = (res.content || [])
        .filter((plan: any) => plan.client === null)
        .map((plan: any) => ({
          ...plan,
          status: 'upcoming',
          totalDays: plan.mealDays?.length || 0,
          calories: plan.mealDays?.[0]?.dayTargets?.calories ?? null,
        }));
    });
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
      this.showNutritionSelectionModal = true;
      return;
    }

    this.showFormSelectionModal = true;
  }

  onCreateFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'CHECKIN') {
      this.router.navigate(['/forms/create-form'], {
        queryParams: {
          returnTo: 'client-profile',
          clientId: this.clientId,
          openAssign: 1
        }
      });
      return;
    }

    if (this.assignType === 'WORKOUT') {
      this.router.navigateByUrl('clients/create-workout/' + this.clientId);
    }

    if (this.assignType === 'NUTRITION') {
      this.showChooseModal = true;
    }
  }

  backToAssignModal(): void {
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
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
  }) {
    const { program, startDate } = payload;
    const item = { ...program };

    item.startDate = startDate;

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

    this.nutritionService.assignNutritionPlan(item).subscribe(() => {
      this.showNutritionSelectionModal = false;
      this.loadDashboardPrograms();
    });
  }

  setSubTab(tab: 'submissions' | 'assigned' | 'scheduled') {
    this.activeSubTab = tab;
    if (tab === 'scheduled') this.loadScheduledItems();

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

  onAssignWorkoutFromModal(payload: {
    program: any;
    startDate: string;
    endDate: string | null;
  }) {
    const { program, startDate, endDate } = payload;

    const item = { ...program };
    item.startDate = startDate;
    item.endDate = endDate;
    item.client = this.client;

    this.workoutService.assignWorkout(item.id, item).subscribe(() => {
      this.showProgramSelectionModal = false;
      this.loadDashboardPrograms();
    });
  }

  get isAnyOverlayOpen(): boolean {
    return (
      this.showAssignSelectModal ||
      this.showFormSelectionModal ||
      this.showProgramSelectionModal ||
      this.showNutritionSelectionModal ||
      this.showChooseModal ||
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
        this.assignmentsApi.pageOwnerAssignmentsByAsigneeId(
          0, this.PAGE_SIZE, 'assignedAt', 'DESC', this.clientId
        )
      ),
      switchMap((res: any) =>
        from((async () => {
          const items: FormAssignment[] = res.content ?? [];
          await this.attachFormNames(items);
          return items;
        })())
      ),
      map((items: FormAssignment[]) => [...items]),
      finalize(() => {
        this.loadingAssignments = false;
      })
    ).subscribe({
      next: (items) => {
        this.assignments = items;
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

  loadScheduledItems(): void {
    if (!this.clientId) return;

    this.loadingScheduled = true;
    this.scheduledError = null;

    this.formsApi.getClientScheduleItems(this.clientId)
      .pipe(finalize(() => (this.loadingScheduled = false)))
      .subscribe({
        next: (items) => (
          this.scheduledItems = items ?? []),
        error: () => (this.scheduledError = 'Failed to load scheduled items'),
      });
  }



}
