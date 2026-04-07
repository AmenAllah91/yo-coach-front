import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component } from '@angular/core';
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

type TabId =
  | 'dashboard'
  | 'workouts'
  | 'nutrition'
  | 'checkins'
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
    ProgressPicturesComponent
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

  todaysWorkout: TodaysWorkout = {
    programName: 'Full Body x3',
    currentWeek: 3,
    totalWeeks: 4,
    name: 'Full Body Day 1',
    exercises: [
      { name: 'Squat (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
      { name: 'Bench Press (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
      { name: 'Bent Over Row (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
    ],
  };

  activeNutritionPlan: ActiveNutritionPlan = {
    name: 'Weight Loss Plan - 2000kcal',
    dailyCalories: 2000,
    protein: 169,
    carbs: 180,
    fat: 60,
  };

  activeSubTab: 'submissions' | 'assigned' | 'scheduled' = 'submissions';
  submissionSearch = '';
  assignedSearch = '';

  showCheckinModal = false;
  showFormSelectionModal = false;

  scheduledCheckIns: ScheduledCheckIn[] = [];

  constructor(
    private route: ActivatedRoute,
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private router: Router,
    private nutritionService: NutritionService,
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService
  ) {
    this.clientId = this.route.snapshot.paramMap.get('id') || '';

    if (this.clientId) {
      this.getClientById(this.clientId);
      this.loadClientAssignments();
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

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
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
