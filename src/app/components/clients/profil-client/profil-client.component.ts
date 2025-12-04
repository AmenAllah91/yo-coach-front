import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
const PROGRESS_IMAGE_URL =
  'https://myindianthings.com/cdn/shop/products/Gym_Yoga_wallpapers-compressed-page-100_0076fb15-cb84-43e3-996f-cbad0dc0dd06_800x.jpg?v=1658401669';
interface ProgressPicture {
  id: string;
  date: string;   // ISO string
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

type WorkoutStatus = 'active' | 'upcoming' | 'completed';
type PlanStatus = 'active' | 'upcoming' | 'completed';

interface Exercise {
  name: string;
  sets: string; // ex: "4 sets × 8–12 reps"
  rest: string; // ex: "90s"
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

interface WorkoutProgram {
  id: number;
  name: string;
  status: WorkoutStatus;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  currentWeek?: number;
  daysPerWeek: number;
}

interface NutritionPlan {
  id: number;
  name: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
}

/* ---------- CHECK-INS TYPES ---------- */

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
  date: string; // ISO or string
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

@Component({
  selector: 'app-profil-client',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {
  activeTab: TabId = 'dashboard';
// ----- Progress pictures : état du modal -----

  selectedSinglePicture: ProgressPicture | null = null;

  client = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    photoUrl: 'assets/images/default-avatar.png',
    lastWorkout: '6 days ago',
  };

  clientGoal = `Lose 5kg in 3 months
Train 3x per week
Improve conditioning`;

  clientNotes = `Prefers training in the morning.
Avoids heavy overhead movements.
Motivated but needs accountability.`;

  subscriptions = [
    { startDate: '2024-09-01', endDate: '2024-10-01', status: 'ACTIVE' },
    { startDate: '2024-08-01', endDate: '2024-09-01', status: 'EXPIRED' },
  ];

  latestWeight = 78.5; // kg

  workoutPrograms: WorkoutProgram[] = [
    {
      id: 1,
      name: 'Full Body x3',
      status: 'active',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
      totalWeeks: 12,
      currentWeek: 3,
      daysPerWeek: 3,
    },
    {
      id: 2,
      name: 'Advanced Strength Program',
      status: 'upcoming',
      startDate: '2024-04-16',
      endDate: '2024-07-16',
      totalWeeks: 12,
      daysPerWeek: 4,
    },
    {
      id: 3,
      name: 'Beginner Program',
      status: 'completed',
      startDate: '2023-10-01',
      endDate: '2024-01-14',
      totalWeeks: 8,
      currentWeek: 8,
      daysPerWeek: 3,
    },
  ];

  nutritionPlans: NutritionPlan[] = [
    {
      id: 1,
      name: 'Weight Loss Plan - 2000kcal',
      status: 'active',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
    },
    {
      id: 2,
      name: 'Maintenance Plan - 2500kcal',
      status: 'upcoming',
      startDate: '2024-04-16',
      endDate: '2024-07-16',
    },
    {
      id: 3,
      name: 'Initial Plan - 2750kcal',
      status: 'completed',
      startDate: '2023-10-01',
      endDate: '2024-01-14',
    },
  ];

  setTab(tab: TabId) {
    this.activeTab = tab;
  }

  get fullName(): string {
    return `${this.client.firstName} ${this.client.lastName}`;
  }

  getDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /* ---------- DASHBOARD ---------- */

  todaysWorkout: TodaysWorkout = {
    programName: 'Full Body x3',
    currentWeek: 3,
    totalWeeks: 4,
    name: 'Full Body Day 1',
    exercises: [
      { name: 'Squat (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
      { name: 'Bench Press (Barbell)', sets: '4 sets × 8–12 reps', rest: '90s' },
      {
        name: 'Bent Over Row (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s',
      },
      {
        name: 'Overhead Press (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s',
      },
      { name: 'Lat Pulldown (Cable)', sets: '3 sets × 10–15 reps', rest: '60s' },
      {
        name: 'Seated Leg Curl (Machine)',
        sets: '3 sets × 12–15 reps',
        rest: '60s',
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

  /* ---------- CHECK-INS (LISTES + MODALS) ---------- */

  activeSubTab: 'submissions' | 'assigned' = 'submissions';
  submissionSearch = '';
  assignedSearch = '';

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
          answer:
            'I managed to complete all 5 of my scheduled workouts, which is a first for me!',
        },
        {
          questionNumber: 2,
          question: 'How many workouts did you complete this week?',
          type: 'text',
          answer: '5',
        },
        {
          questionNumber: 3,
          question:
            'Did you achieve your target weight or body composition for the week?',
          type: 'text',
          answer: 'Yes',
        },
        {
          questionNumber: 4,
          question:
            'How would you rate your overall progress this week on a scale of 1-10?',
          type: 'scale',
          scaleValue: 8,
          scaleMax: 10,
        },
        {
          questionNumber: 5,
          question:
            'On which date this week did you feel most energized and productive?',
          type: 'text',
          answer: '06/14/2023',
        },
        {
          questionNumber: 6,
          question: 'Rate your overall satisfaction with this week’s progress',
          type: 'rating',
          ratingValue: 4,
          ratingMax: 5,
        },
        {
          questionNumber: 7,
          question: 'Upload your progress photos for this week',
          type: 'photos',
          photos: ['p1', 'p2', 'p3'],
        },
        {
          questionNumber: 8,
          question:
            'Which area of fitness routine do you feel improved the most this week?',
          type: 'text',
          answer: 'Strength',
        },
      ],
    },
    {
      id: 2,
      title: 'Weekly Check-In',
      date: '2025-10-08',
      status: 'pendingReview',
      answers: [
        {
          questionNumber: 1,
          question: 'What was your biggest win this week?',
          type: 'text',
          answer: 'Stayed consistent with my meals.',
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
        {
          order: 2,
          label: 'How many workouts did you complete this week?',
          type: 'Number',
          required: true,
        },
        {
          order: 3,
          label: 'Rate your overall progress this week (1-10)',
          type: 'Scale',
          required: true,
        },
      ],
    },
    {
      id: 2,
      name: 'Monthly Progress Review',
      assignedDate: '2025-10-01',
      dueDate: '2025-10-31',
      status: 'pending',
      questions: [
        {
          order: 1,
          label: 'What went well this month?',
          type: 'Text',
          required: true,
        },
      ],
    },
  ];

  showSubmissionModal = false;
  showAssignedModal = false;

  selectedSubmission: CheckInSubmission | null = null;
  selectedAssigned: AssignedCheckIn | null = null;

  setSubTab(tab: 'submissions' | 'assigned') {
    this.activeSubTab = tab;
  }

  get filteredSubmissions(): CheckInSubmission[] {
    const term = this.submissionSearch.trim().toLowerCase();
    if (!term) return this.submissions;
    return this.submissions.filter((s) =>
      s.title.toLowerCase().includes(term),
    );
  }

  get filteredAssignedForms(): AssignedCheckIn[] {
    const term = this.assignedSearch.trim().toLowerCase();
    if (!term) return this.assignedForms;
    return this.assignedForms.filter((f) =>
      f.name.toLowerCase().includes(term),
    );
  }

  openSubmissionModal(submission: CheckInSubmission) {
    this.selectedSubmission = submission;
    this.showSubmissionModal = true;
  }

  closeSubmissionModal() {
    this.showSubmissionModal = false;
    this.selectedSubmission = null;
  }

  openAssignedModal(form: AssignedCheckIn, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
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

  showPicturesComparison = false;



// vue active dans le modal
  comparisonView: 'single' | 'comparison' = 'comparison';

// images sélectionnées
  selectedAfterPicture: ProgressPicture | null = null;
  selectedBeforePicture: ProgressPicture | null = null;





  comparisonMode: 'single' | 'comparison' = 'comparison';


  onOpenPicturesComparison(): void {
    this.showPicturesComparison = true;

    // on ouvre directement sur "Comparison"
    this.comparisonMode = 'comparison';

    const first = this.progressPictures[0] || null;
    this.selectedAfterPicture = first;
    this.selectedBeforePicture = null;
    this.selectedSinglePicture = first;
  }

  onClosePicturesComparison(): void {
    this.showPicturesComparison = false;
  }

  onSelectPictureForComparison(picture: ProgressPicture): void {
    // si rien en After -> on met After
    if (!this.selectedAfterPicture) {
      this.selectedAfterPicture = picture;
      return;
    }

    // si pas encore de Before et que ce n'est pas la même photo
    if (
      !this.selectedBeforePicture &&
      this.selectedAfterPicture.id !== picture.id
    ) {
      this.selectedBeforePicture = picture;
      return;
    }

    // si les deux sont déjà remplis : on remplace toujours le Before
    if (this.selectedAfterPicture.id !== picture.id) {
      this.selectedBeforePicture = picture;
    }
  }

  progressPictures: ProgressPicture[] = [
    {
      id: '1',
      date: '2025-10-30',
      weight: 76.0,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
    {
      id: '2',
      date: '2025-10-23',
      weight: 84.1,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
    {
      id: '3',
      date: '2025-10-16',
      weight: 88.1,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
    {
      id: '4',
      date: '2025-10-09',
      weight: 98.2,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
    {
      id: '5',
      date: '2025-10-02',
      weight: 98.3,
      unit: 'kg',
      imageUrl: PROGRESS_IMAGE_URL,
    },
  ];



  onChangeComparisonMode(mode: 'single' | 'comparison'): void {
    this.comparisonMode = mode;
  }

  onSelectComparisonPicture(picture: ProgressPicture): void {
    if (this.comparisonMode === 'single') {
      this.selectedSinglePicture = picture;
      return;
    }

    // COMPARISON : 1er clic -> Before, 2e -> After, puis on écrase Before
    if (!this.selectedBeforePicture || (this.selectedBeforePicture && this.selectedAfterPicture)) {
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

}
