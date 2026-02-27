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
import {FormSelectionModalComponent} from "./form-selection-modal/form-selection-modal.component";
import {AssignmentsApiService, FormAssignment} from "../../forms/services/assignments-api.service";
import {Subject, takeUntil} from "rxjs";
import {FormDetails, FormsApiService} from "../../forms/services/forms-api.service";
import {Answer, QuestionType} from "../../../models/forms.model";
import {SubmissionsApiService} from "../../forms/services/submissions-api.service";
import { Form } from '../../forms/services/forms-api.service';
import { from } from 'rxjs';
import { switchMap, finalize, map } from 'rxjs/operators';
const PROGRESS_IMAGE_URL =
  'https://myindianthings.com/cdn/shop/products/Gym_Yoga_wallpapers-compressed-page-100_0076fb15-cb84-43e3-996f-cbad0dc0dd06_800x.jpg?v=1658401669';

interface ProgressPicture {
  id: string;
  date: string;
  weight: number;
  unit: 'kg' | 'lb';
  imageUrl: string;
}

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
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'| 'onetime';
  selectedDays: string[];
  sendTime: string;
  endDate: string; // ISO string: '2026-06-30'
  status: 'active' | 'paused';
  nextSendDate: string; // ISO ou Date
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
    AssignSelectModalComponent,FormSelectionModalComponent
  ],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {

  activeTab: TabId = 'dashboard';
  setTab(tab: TabId) {
    this.activeTab = tab;
  }

  // User / client
  userid = sessionStorage.getItem('userId');
  clientId: string = '';
  client!: Client;

  get fullName(): string {
    return `${this.client?.firstName} ${this.client?.lastName}`;
  }

  // Assign flow (NEW)
  showAssignSelectModal = false;
  assignType: 'WORKOUT' | 'NUTRITION' | 'CHECKIN' = 'WORKOUT';

  showProgramSelectionModal = false; // workout selection modal
  showNutritionSelectionModal = false; // nutrition selection modal
  showChooseModal = false; // choose-plan-type modal

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

  // Dashboard mock
  todaysWorkout: TodaysWorkout = {
    programName: 'Full Body x3',
    currentWeek: 3,
    totalWeeks: 4,
    name: 'Full Body Day 1',
    exercises: [
      { name: 'Squat (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
      {
        name: 'Bench Press (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s',
      },
      {
        name: 'Bent Over Row (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s',
      },
    ],
  };

  activeNutritionPlan: ActiveNutritionPlan = {
    name: 'Weight Loss Plan - 2000kcal',
    dailyCalories: 2000,
    protein: 169,
    carbs: 180,
    fat: 60,
  };

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

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
        });      }

      if (typeof preselectFormId === 'string' && preselectFormId.trim() !== '') {
        this.preselectFormId = preselectFormId;
      }
      if (openAssign || preselectFormId) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            openAssign: null
          },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });

    this.getAllNutrition();
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  get assignedList(): FormAssignment[] {
    const list = this.assignments.filter(a =>
      a.status !== 'SUBMITTED' && a.status !== 'REVIEWED'
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
        next: async (res) => {   // ✅ هنا
          this.assignments = res.content;
          await this.attachFormNames(this.assignments);
          this.loadingAssignments = false;
        },
        error: (err) => {
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
    this.openAssignmentModal(a);
  }

  openSubmissionAssignment(a: FormAssignment) {
    this.openAssignmentModal(a);
  }
  getAllNutrition() {
    this.nutritionService.getNutritionPlans().subscribe((res: any) => {
      this.nutritionSelectionList = res.content
        .filter((plan: any) => plan.client === null)
        .map((plan: any) => {
          const totalDays = plan.mealDays?.length || 0;

          return {
            id: plan.id,
            name: plan.name,
            coach: plan.coach,
            status: 'upcoming',
            startDate: '',
            endDate: '',
            totalDays,
            trackingMode: plan.trackingMode,
            calories: plan.mealDays?.[0]?.dayTargets?.calories ?? null,
          };
        });
    });
  }

  // Open assign modal from tabs
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
      });      return;
    }

    if (this.assignType === 'WORKOUT') this.router.navigateByUrl('clients/create-workout/' + this.clientId);
    if (this.assignType === 'NUTRITION') this.showChooseModal = true;
  }

  backToAssignModal(): void {
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
    this.showFormSelectionModal = false;
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
    const { program, startDate, endDate } = payload;

    const item = { ...program };
    item.startDate = startDate;
    item.endDate = endDate;
    item.client = this.client;

    this.nutritionService.assignNutritionPlan(item).subscribe(() => {
      this.showNutritionSelectionModal = false;
    });
  }

  /* ---------- CHECK-INS ---------- */

  activeSubTab: 'submissions' | 'assigned' | 'scheduled' = 'submissions';
  submissionSearch = '';
  assignedSearch = '';

  setSubTab(tab: 'submissions' | 'assigned' | 'scheduled') {
    this.activeSubTab = tab;
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

  /* ---------- PROGRESS PICTURES ---------- */

  showPicturesComparison = false;
  comparisonMode: 'single' | 'comparison' = 'comparison';

  selectedSinglePicture: ProgressPicture | null = null;
  selectedAfterPicture: ProgressPicture | null = null;
  selectedBeforePicture: ProgressPicture | null = null;

  progressPictures: ProgressPicture[] = [
    {
      id: '1',
      date: '2025-10-30',
      weight: 76.0,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
  ];

  onOpenPicturesComparison(): void {
    this.showPicturesComparison = true;
    this.comparisonMode = 'comparison';

    const first = this.progressPictures[0] || null;
    this.selectedAfterPicture = first;
    this.selectedBeforePicture = null;
    this.selectedSinglePicture = first;
  }

  onClosePicturesComparison(): void {
    this.showPicturesComparison = false;
  }

  onChangeComparisonMode(mode: 'single' | 'comparison'): void {
    this.comparisonMode = mode;
  }

  onSelectComparisonPicture(picture: ProgressPicture): void {
    if (this.comparisonMode === 'single') {
      this.selectedSinglePicture = picture;
      return;
    }

    if (
      !this.selectedBeforePicture ||
      (this.selectedBeforePicture && this.selectedAfterPicture)
    ) {
      this.selectedBeforePicture = picture;
      this.selectedAfterPicture =
        this.selectedAfterPicture && this.selectedAfterPicture.id === picture.id
          ? null
          : this.selectedAfterPicture;
    } else if (!this.selectedAfterPicture) {
      this.selectedAfterPicture = picture;
    }
  }

  isSelectedAsBefore(picture: ProgressPicture): boolean {
    return this.selectedBeforePicture?.id === picture.id;
  }

  isSelectedAsAfter(picture: ProgressPicture): boolean {
    return this.selectedAfterPicture?.id === picture.id;
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

  showCheckinModal = false;

  openCheckinModal() {
    this.assignType = 'CHECKIN'; // ← plus besoin de "as any"
    this.showAssignSelectModal = true; // ← utilise showAssignSelectModal pas showCheckinModal
  }
  showFormSelectionModal = false;


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

  selectedSchedule: ScheduledCheckIn | null = null;

  scheduledCheckIns: ScheduledCheckIn[] = [
    {
      id: 'sched-1',
      formName: 'Weekly Check-In',
      frequency: 'weekly',
      selectedDays: ['Mon'],
      sendTime: '09:00',
      endDate: '2026-06-30',
      status: 'active',
      nextSendDate: '2026-03-03',
      createdDate: '2026-01-15',
      description: 'Weekly progress tracking form sent every Monday',
      questions: [
        { id: '1', label: 'What was your biggest win this week?', type: 'TEXT', required: true },
        { id: '2', label: 'How many workouts did you complete this week?', type: 'NUMBER', required: true },
        { id: '3', label: 'Rate your overall progress this week (1-10)', type: 'SCALE', required: true },
        { id: '4', label: 'Did you achieve your target weight or body composition?', type: 'YES_NO', required: true },
        { id: '5', label: 'Upload your progress photos for this week', type: 'PROGRESS_PHOTOS', required: false },
        { id: '6', label: "Rate your overall satisfaction with this week's progress", type: 'STAR_RATING', required: true },
      ],
    },
    {
      id: 'sched-2',
      formName: 'One-Time-Form',
      frequency: 'onetime',
      selectedDays: [],
      sendTime: '10:00',
      endDate: '2026-12-31',
      status: 'active',
      nextSendDate: '2026-03-01',
      createdDate: '2026-01-01',
      description: 'Monthly comprehensive progress assessment',
      questions: [
        { id: '1', label: 'Upload your monthly progress photos', type: 'PROGRESS_PHOTOS', required: true },
        { id: '2', label: 'What are your goals for next month?', type: 'TEXT', required: true },
        { id: '3', label: 'Rate your overall satisfaction this month (1-10)', type: 'SCALE', required: true },
        { id: '4', label: 'Which area of fitness improved the most this month?', type: 'MULTIPLE_CHOICE', required: true },
      ],
    },
    {
      id: 'sched-3',
      formName: 'Daily Mood Tracker',
      frequency: 'daily',
      selectedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      sendTime: '08:00',
      endDate: '2026-04-30',
      status: 'paused',
      nextSendDate: '',
      createdDate: '2026-02-01',
      description: 'Quick daily mood and energy check',
      questions: [
        { id: '1', label: 'How are you feeling today?', type: 'SCALE', required: true },
        { id: '2', label: 'Rate your energy level', type: 'STAR_RATING', required: true },
        { id: '3', label: 'Any notes for your coach?', type: 'TEXT', required: false },
      ],
    },
  ];

// --- Getters ---
  get activeSchedulesCount(): number {
    return this.scheduledCheckIns.filter(s => s.status === 'active').length;
  }
  get pausedSchedulesCount(): number {
    return this.scheduledCheckIns.filter(s => s.status === 'paused').length;
  }

// --- Méthodes ---
  openScheduleDetail(schedule: ScheduledCheckIn): void {
    this.selectedSchedule = { ...schedule };
  }

  closeScheduleDetail(): void {
    this.selectedSchedule = null;
  }

  toggleScheduleStatus(schedule: ScheduledCheckIn): void {
    const newStatus = schedule.status === 'active' ? 'paused' : 'active';
    this.scheduledCheckIns = this.scheduledCheckIns.map(s =>
      s.id === schedule.id ? { ...s, status: newStatus } : s
    );
    if (this.selectedSchedule?.id === schedule.id) {
      this.selectedSchedule = { ...this.selectedSchedule, status: newStatus };
    }
  }

  deleteSchedule(schedule: ScheduledCheckIn): void {
    this.scheduledCheckIns = this.scheduledCheckIns.filter(s => s.id !== schedule.id);
    if (this.selectedSchedule?.id === schedule.id) {
      this.selectedSchedule = null;
    }
  }





}
