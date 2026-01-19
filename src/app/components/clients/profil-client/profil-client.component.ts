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

type SubmissionStatus = 'reviewed' | 'pendingReview';
type AssignedStatus = 'pending' | 'active';

interface CheckInSubmissionAnswer {
  questionNumber: number;
  question: string;
  type?: 'text' | 'scale' | 'rating' | 'photos';
  answer?: string;
  scaleValue?: number;
  scaleMax?: number;
  ratingValue?: number;
  ratingMax?: number;
  photos?: string[];
}

interface CheckInQuestionDefinition {
  order: number;
  label: string;
  type: 'Text' | 'Number' | 'Scale';
  required: boolean;
}

interface CheckInSubmission {
  id: number;
  title: string;
  date: string;
  status: SubmissionStatus;
  coachNote?: string;
  answers: CheckInSubmissionAnswer[];
}

interface AssignedCheckIn {
  id: number;
  name: string;
  assignedDate: string;
  dueDate: string;
  status: AssignedStatus;
  questions: CheckInQuestionDefinition[];
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

interface ActiveNutritionPlan {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  ],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {
  // Tabs
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
  assignType: 'WORKOUT' | 'NUTRITION' = 'WORKOUT';

  showProgramSelectionModal = false; // workout selection modal
  showNutritionSelectionModal = false; // nutrition selection modal
  showChooseModal = false; // choose-plan-type modal

  nutritionSelectionList: any[] = [];

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
    private nutritionService: NutritionService
  ) {
    this.clientId = this.route.snapshot.paramMap.get('id') || '';

    if (this.clientId) {
      this.getClientById(this.clientId);
    }

    this.getAllNutrition();
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  // Fetch nutrition templates (used by nutrition-selection-modal input)
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

  closeAssignSelectModal() {
    this.showAssignSelectModal = false;
  }

  onExistingFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'WORKOUT') {
      this.showProgramSelectionModal = true;
    } else {
      this.showNutritionSelectionModal = true;
    }
  }

  onCreateFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'WORKOUT') {
      this.router.navigateByUrl('clients/create-workout/' + this.clientId);
    } else {
      this.showChooseModal = true;
    }
  }

  // Called by workout-program-selection-modal back button
  backToAssignModal(): void {
    this.showProgramSelectionModal = false;
    this.showAssignSelectModal = true;
  }

  // ChoosePlanType modal close
  closeChooseModal() {
    this.showChooseModal = false;
  }

  // Nutrition selection modal assign
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

  activeSubTab: 'submissions' | 'assigned' = 'submissions';
  submissionSearch = '';
  assignedSearch = '';

  setSubTab(tab: 'submissions' | 'assigned') {
    this.activeSubTab = tab;
  }

  submissions: CheckInSubmission[] = [
    {
      id: 1,
      title: 'Weekly Check-In',
      date: '2025-10-15',
      status: 'reviewed',
      coachNote: 'Great progress this week! Keep up the good work.',
      answers: [
        {
          questionNumber: 1,
          question: 'What was your biggest win this week?',
          type: 'text',
          answer: 'Completed all workouts.',
        },
      ],
    },
  ];

  assignedForms: AssignedCheckIn[] = [
    {
      id: 1,
      name: 'Weekly Check-In',
      assignedDate: '2025-10-01',
      dueDate: '2025-10-22',
      status: 'pending',
      questions: [
        {
          order: 1,
          label: 'What was your biggest win this week?',
          type: 'Text',
          required: true,
        },
      ],
    },
  ];

  get filteredSubmissions(): CheckInSubmission[] {
    const term = this.submissionSearch.trim().toLowerCase();
    if (!term) return this.submissions;
    return this.submissions.filter((s) => s.title.toLowerCase().includes(term));
  }

  get filteredAssignedForms(): AssignedCheckIn[] {
    const term = this.assignedSearch.trim().toLowerCase();
    if (!term) return this.assignedForms;
    return this.assignedForms.filter((f) =>
      f.name.toLowerCase().includes(term)
    );
  }

  showSubmissionModal = false;
  showAssignedModal = false;

  selectedSubmission: CheckInSubmission | null = null;
  selectedAssigned: AssignedCheckIn | null = null;

  openSubmissionModal(submission: CheckInSubmission) {
    this.selectedSubmission = submission;
    this.showSubmissionModal = true;
  }

  closeSubmissionModal() {
    this.showSubmissionModal = false;
    this.selectedSubmission = null;
  }

  openAssignedModal(form: AssignedCheckIn, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.selectedAssigned = form;
    this.showAssignedModal = true;
  }

  closeAssignedModal() {
    this.showAssignedModal = false;
    this.selectedAssigned = null;
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
}
