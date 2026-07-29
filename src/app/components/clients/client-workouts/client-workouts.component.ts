import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FeatherModule } from 'angular-feather';
import { WorkoutService } from 'app/service/workout.service';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';
import { WorkoutDayService } from 'app/service/workout-day.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import * as XLSX from 'xlsx';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

type WorkoutStatus = 'COMPLETED' | 'MISSED' | 'PENDING' | 'IN_PROGRESS' | 'OVERDUE';
type WorkoutRunStatus = 'NOT_STARTED' | 'OVERDUE' | 'MISSED' | 'IN_PROGRESS' | 'PAUSED' | 'LOG_WORKOUT' | 'COMPLETED' | 'ALREADY_COMPLETED';
type WorkoutSetType = 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE';

interface ExerciseSet {
  setNumber?: number;
  reps?: number;
  weight?: number | null;
  duration?: number;
  restMin: number;
  restSec: number;
  type?: WorkoutSetType | string;
}

interface RawExercise {
  id: string;
  name: string;
  type: 'CARDIO' | 'MUSCULATION';
  label?: string;
  category?: string;
  setType?: string;
  workoutType?: string;
  isWarmUp?: boolean;
  warmUp?: boolean;
  warmup?: boolean;
  supersetGroupId: string | null;
  sets: ExerciseSet[];
  duration?: number;
  description?: string;
  instructions?: string | string[];
  videoLink?: string;
  imageUrl?: string;
  equipment?: string;
  primaryMuscle?: string;
  coachNote?: string;
  muscle?: string;
  exerciseRef?: any;
}

interface WorkoutSession {
  name: string;
  exercises: RawExercise[];
}

interface GroupedExercise {
  sourceExerciseId?: string;
  groupIndex: number;
  subIndex?: number;
  displayNumber: string;
  isSuperset: boolean;
  label: string;
  name: string;
  type: string;
  sets: {
    setNumber: number;
    type: WorkoutSetType;
    displayLabel: string;
    reps: string | number;
    weight: number | null;
    rest: string;
    duration?: number;
  }[];
  duration?: number;
  isWarmUp: boolean;
  completed?: boolean;
  skipped?: boolean;
  note?: string;
  description?: string;
  instructions?: string[];
  videoLink?: string;
  imageUrl?: string;
  equipment?: string;
  primaryMuscle?: string;
  coachNote?: string;
}

interface Workout {
  id: string;
  planId: string;
  date: string;
  title: string;
  program: string;
  dayNumber: number;
  status: WorkoutStatus;
  rawSessions: WorkoutSession[];
  groupedExercises: GroupedExercise[];
  workoutElapsedSeconds?: number;
  clientCompletionMode?: 'TRACKED' | 'ALREADY_COMPLETED';
  overallWorkoutNote?: string;
  missedReason?: string;
}

interface WorkoutExerciseDisplay {
  badge: string;
  name: string;
  suffix: string;
  isWarmUp: boolean;
}

interface FileProgram {
  id: string;
  name: string;
  coachName: string;
  resourceType: string;
  originalFileName?: string;
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  startDate?: string;
  endDate?: string;
  addedLabel: string;
  isCurrent: boolean;
  pageCountLabel: string;
}

@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, ModalConfirmComponent],
  templateUrl: './client-workouts.component.html',
  styleUrl: './client-workouts.component.scss',
})
export class ClientWorkoutsComponent implements OnInit, OnDestroy {
  activeTab: 'upcoming' | 'past' = 'upcoming';
  clientViewMode: 'calendar' | 'file' = 'calendar';
  currentMonthDate = new Date();
  userid = sessionStorage.getItem('userId');
  selectedWorkout: Workout | null = null;
  workoutRunStatus: WorkoutRunStatus = 'NOT_STARTED';
  elapsedSeconds = 0;
  showWorkoutMenu = false;
  selectedExercise: GroupedExercise | null = null;
  showExerciseVideo = false;
  exerciseEmbedUrl: SafeResourceUrl | null = null;
  noteExercise: GroupedExercise | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  selectedFileProgram: FileProgram | null = null;
  selectedFileSafeUrl: SafeResourceUrl | null = null;
  selectedFileBlobUrl: string | null = null;
  selectedFileLoading = false;
  selectedFileError = '';

  @ViewChild('pdfCanvas') pdfCanvas?: ElementRef<HTMLCanvasElement>;

  private pdfJsLib: any = null;
  private pdfDocument: any = null;
  private pdfBlob: Blob | null = null;
  private pdfRenderTask: any = null;

  pdfCurrentPage = 1;
  pdfTotalPages = 0;
  pdfZoom: number = 100;
  isPdfFullscreen = false;

  excelSheets: string[] = [];
  selectedExcelSheetName = '';
  excelRows: any[][] = [];
  excelHeaders: string[] = [];
  excelLoading = false;

  workouts: Workout[] = [];
  filePrograms: FileProgram[] = [];
  filteredFilePrograms: FileProgram[] = [];
  coaches: any[] = [];
  selectedCoachId: string | 'all' = 'all';
  searchProgram = '';
  allPlans: any[] = [];
  workoutFileEnabled = false;
  fileSettingsResolved = false;
  coachWorkoutFileEnabled = new Map<string, boolean>();
  showMissedWorkoutModal = false;
  showPreviousOverdueModal = false;
  showNoExercisesCompletedModal = false;
  missedWorkoutReason = '';
  previousWorkoutReason = '';
  unresolvedPreviousWorkout: Workout | null = null;
  pendingWorkoutToStart: Workout | null = null;
  nextWorkoutAfterResolution: Workout | null = null;
  overdueWorkoutNotice = '';
  showWorkoutPdfPreview = false;
  private overdueNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public workoutService: WorkoutService,
    private workoutDayService: WorkoutDayService,
    private coachSettingsService: CoachSettingsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Programs are the page's critical data. Settings are refreshed silently in
    // parallel so they no longer delay the initial workout rendering.
    this.getWorkoutDay();
    this.coachSettingsService.loadConfig(true).subscribe({
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.overdueNoticeTimer) clearTimeout(this.overdueNoticeTimer);
    this.revokeSelectedFileBlob();
  }

  get formattedWorkoutTime(): string {
    const hours = Math.floor(this.elapsedSeconds / 3600);
    const minutes = Math.floor((this.elapsedSeconds % 3600) / 60);
    const seconds = this.elapsedSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  get workoutStatusLabel(): string {
    const labels: Record<WorkoutRunStatus, string> = {
      NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', PAUSED: 'Paused',
      OVERDUE: 'Overdue',
      MISSED: 'Missed',
      LOG_WORKOUT: 'Log workout',
      COMPLETED: 'Completed', ALREADY_COMPLETED: 'Already completed',
    };
    return labels[this.workoutRunStatus];
  }

  get reviewedExerciseCount(): number {
    return this.selectedWorkout?.groupedExercises.filter((exercise) => exercise.completed || exercise.skipped).length || 0;
  }

  get reviewableExerciseCount(): number {
    return this.selectedWorkout?.groupedExercises.length || 0;
  }

  get selectedWorkoutPlan(): any {
    return this.allPlans.find((plan: any) => plan.id === this.selectedWorkout?.planId) || null;
  }

  get pdfProgramWorkouts(): Workout[] {
    if (!this.selectedWorkout) return [];
    return this.workouts
      .filter(workout => workout.planId === this.selectedWorkout!.planId)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }

  get pdfProgramWeeks(): { number: number; workouts: Workout[] }[] {
    const weeks = new Map<number, Workout[]>();
    this.pdfProgramWorkouts.forEach(workout => {
      const weekNumber = Math.floor(Math.max(0, workout.dayNumber - 1) / 7) + 1;
      weeks.set(weekNumber, [...(weeks.get(weekNumber) || []), workout]);
    });
    return Array.from(weeks, ([number, workouts]) => ({ number, workouts }));
  }

  get pdfClientName(): string {
    const client = this.selectedWorkoutPlan?.client || {};
    return `${client.firstName || client.firstname || ''} ${client.lastName || client.lastname || ''}`.trim() || 'Client';
  }

  get pdfCoachName(): string {
    const coach = this.selectedWorkoutPlan?.coach || {};
    return `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
  }

  get pdfTotalDays(): number {
    const plan = this.selectedWorkoutPlan;
    const start = this.parseWorkoutDate(plan?.startDate);
    const end = this.parseWorkoutDate(plan?.endDate);
    return start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1) : this.pdfProgramWorkouts.length;
  }

  get pdfTotalWeeks(): number {
    return Math.max(1, Math.ceil(this.pdfTotalDays / 7));
  }

  get pdfActiveWorkoutCount(): number {
    return this.pdfProgramWorkouts.filter(workout => workout.groupedExercises.length > 0).length;
  }

  openWorkoutPdfPreview(): void {
    this.showWorkoutPdfPreview = true;
  }

  closeWorkoutPdfPreview(): void {
    this.showWorkoutPdfPreview = false;
  }

  downloadWorkoutPdf(): void {
    const preview = document.querySelector('.workout-pdf-document');
    if (!preview) return;
    const printWindow = window.open('', '_blank', 'width=960,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${this.escapeHtml(this.selectedWorkout?.program || 'workout-program')}</title>
      <style>${this.workoutPdfPrintStyles()}</style></head><body>${preview.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  pdfWorkoutLabel(workout: Workout): string {
    return workout.groupedExercises.length ? (workout.title || 'Main session') : 'Rest day';
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    }[character] || character));
  }

  private workoutPdfPrintStyles(): string {
    return `
      @page{size:A4;margin:8mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}body{margin:0;background:#fff;color:#07172b;font-family:Arial,sans-serif}
      .workout-pdf-document{width:100%;background:#fff}.workout-pdf-cover{min-height:270mm;padding:18mm 10mm}
      .workout-pdf-brand{display:flex;align-items:center;gap:12px;color:#078fc9;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase}.workout-pdf-brand>span:last-child{display:flex;flex-direction:column}.workout-pdf-brand strong{font:inherit}.workout-pdf-brand small{margin-top:3px;color:#8ba0b5;font-size:8px;letter-spacing:0;text-transform:none;font-weight:500}
      .workout-pdf-brand-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#12a7e5!important;color:#fff;font-size:22px}.workout-pdf-brand-mark svg{width:22px;height:22px}
      .workout-pdf-cover h1{margin:35px 0 10px;font-size:32px}.workout-pdf-description{color:#52677e;line-height:1.6}
      .workout-pdf-meta{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.workout-pdf-meta div{padding:13px;border:1px solid #d8e2ec;border-radius:8px}
      .workout-pdf-meta small{display:block;color:#8295aa;font-size:9px;text-transform:uppercase}.workout-pdf-meta strong{display:block;margin-top:7px;font-size:12px}
      .workout-pdf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.workout-pdf-stats div{padding:14px;border-radius:8px;background:#12a7e5!important;color:#fff!important}
      .workout-pdf-stats strong{display:block;font-size:23px}.workout-pdf-stats small{font-size:9px;font-weight:700}.workout-pdf-week{break-before:page;padding:4mm 2mm}
      .workout-pdf-week-header{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:1px solid #d9e3ec}.workout-pdf-week-header>div:last-child{display:flex;align-items:flex-end;flex-direction:column;gap:3px}.workout-pdf-week-header h2{margin:3px 0 0;font-size:22px}.workout-pdf-week-header small{color:#7890a8;font-size:8px;text-transform:uppercase}.workout-pdf-week-header strong{color:#34495f;font-size:9px}
      .workout-pdf-day{margin-top:14px;border:1px solid #cad8e4;border-radius:7px;overflow:hidden;break-inside:avoid}.workout-pdf-day-head{display:flex;justify-content:space-between;padding:9px 12px;background:#12a7e5;color:#fff;font-size:11px;font-weight:700}
      .workout-pdf-day.rest .workout-pdf-day-head{background:#f4f7fa!important;color:#17283b!important}.workout-pdf-day-head em{padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.25);font-size:8px;font-style:normal;text-transform:uppercase}.workout-pdf-day.rest em{border:1px solid #bdcbd8;background:#fff!important}
      .workout-pdf-rest{padding:18px;text-align:center;color:#8a9bb0;font-size:10px;font-style:italic}.workout-pdf-day-note{margin:0;padding:7px 12px;border-bottom:1px solid #e4ebf1;color:#778ba0;font-size:8px;font-style:italic}.workout-pdf-exercise{margin:9px;border:1px solid #dce5ed;border-radius:5px;overflow:hidden;break-inside:avoid}
      .workout-pdf-exercise-head{display:flex;justify-content:space-between;padding:7px 9px;background:#f7fafc!important;font-size:9px}.workout-pdf-exercise-head strong{display:flex;align-items:center;gap:5px;font-size:10px}.workout-pdf-exercise-head strong b{padding:2px 5px;border-radius:3px;background:#dff4fd!important;color:#087fae;font-size:7px}.workout-pdf-exercise-head strong em{padding:1px 4px;border:1px solid #20a9e0;border-radius:4px;background:#fff;color:#078fc9;font-size:6px;font-style:normal}.workout-pdf-exercise-description{margin:0;padding:5px 9px;color:#63778c;font-size:7px;line-height:1.35}.workout-pdf-exercise table{width:100%;border-collapse:collapse;font-size:8px}
      .workout-pdf-exercise th,.workout-pdf-exercise td{padding:5px 8px;border-top:1px solid #e6edf3;text-align:left}.workout-pdf-exercise th{color:#8093a8;font-size:7px;text-transform:uppercase}.workout-pdf-exercise th:last-child,.workout-pdf-exercise td:last-child{text-align:right}.workout-pdf-set-type{padding:2px 5px;border-radius:3px;background:#edf2f7!important;color:#42576c;font-size:6px}.workout-pdf-set-type[data-type='WARM_UP']{background:#fff2ca!important;color:#c97c00}.workout-pdf-set-type[data-type='DROP_SET']{background:#f1eaff!important;color:#6844d6}.workout-pdf-set-type[data-type='FAILURE']{background:#ffe8ed!important;color:#d83452}
      @media print{.workout-pdf-document{box-shadow:none}.workout-pdf-week:first-of-type{break-before:page}}
    `;
  }

  startWorkout(): void {
    if (!this.selectedWorkout) return;
    const previousWorkouts = this.findPreviousOverdueWorkouts(this.selectedWorkout);
    if (previousWorkouts.length === 1) {
      this.unresolvedPreviousWorkout = previousWorkouts[0];
      this.pendingWorkoutToStart = this.selectedWorkout;
      this.previousWorkoutReason = '';
      this.showPreviousOverdueModal = true;
      return;
    }
    if (previousWorkouts.length > 1) {
      this.showNonBlockingOverdueNotice(previousWorkouts.length);
    }
    this.startSelectedWorkout();
  }

  private showNonBlockingOverdueNotice(unresolvedCount: number): void {
    this.overdueWorkoutNotice =
      `You have ${unresolvedCount} unresolved workouts. This workout has started normally.`;
    if (this.overdueNoticeTimer) clearTimeout(this.overdueNoticeTimer);
    this.overdueNoticeTimer = setTimeout(() => {
      this.overdueWorkoutNotice = '';
      this.overdueNoticeTimer = null;
    }, 5000);
  }

  private startSelectedWorkout(): void {
    this.workoutRunStatus = 'IN_PROGRESS';
    this.startTimer();
    this.saveWorkoutProgress();
  }

  pauseWorkout(): void {
    this.workoutRunStatus = 'PAUSED';
    this.stopTimer();
    this.saveWorkoutProgress();
  }

  resumeWorkout(): void {
    this.workoutRunStatus = 'IN_PROGRESS';
    this.startTimer();
  }

  cancelWorkout(): void {
    if (!this.selectedWorkout) return;
    const workout = this.selectedWorkout;
    const previousStatus = workout.status;
    const previousElapsedSeconds = this.elapsedSeconds;
    const previousExercises = workout.groupedExercises.map(exercise => ({
      exercise,
      completed: exercise.completed,
      skipped: exercise.skipped,
      note: exercise.note,
    }));

    this.stopTimer();
    this.elapsedSeconds = 0;
    this.workoutRunStatus = 'NOT_STARTED';
    workout.status = 'PENDING';
    workout.workoutElapsedSeconds = 0;
    workout.clientCompletionMode = undefined;
    workout.overallWorkoutNote = '';
    workout.groupedExercises.forEach((exercise) => {
      exercise.completed = false;
      exercise.skipped = false;
      exercise.note = '';
    });
    this.showWorkoutMenu = false;

    this.workoutDayService.updateWorkoutDay({
      id: workout.id,
      dayNumber: workout.dayNumber,
      status: 'PENDING',
      workoutElapsedSeconds: 0,
      clientCompletionMode: null,
      clientExerciseLogs: [],
      overallWorkoutNote: '',
    }, workout.planId).subscribe({
      next: () => {
        const listedWorkout = this.workouts.find(item =>
          item.id === workout.id && item.planId === workout.planId
        );
        if (listedWorkout) {
          listedWorkout.status = 'PENDING';
          listedWorkout.workoutElapsedSeconds = 0;
          listedWorkout.clientCompletionMode = undefined;
          listedWorkout.overallWorkoutNote = '';
          listedWorkout.groupedExercises.forEach(exercise => {
            exercise.completed = false;
            exercise.skipped = false;
            exercise.note = '';
          });
        }
      },
      error: () => {
        workout.status = previousStatus;
        workout.workoutElapsedSeconds = previousElapsedSeconds;
        this.elapsedSeconds = previousElapsedSeconds;
        this.workoutRunStatus = 'IN_PROGRESS';
        previousExercises.forEach(snapshot => {
          snapshot.exercise.completed = snapshot.completed;
          snapshot.exercise.skipped = snapshot.skipped;
          snapshot.exercise.note = snapshot.note;
        });
        this.startTimer();
      },
    });
  }

  logCompletedWorkout(): void {
    if (!this.selectedWorkout) return;
    if (this.selectedWorkout.status !== 'OVERDUE') {
      const previous = this.findPreviousOverdueWorkout(this.selectedWorkout);
      if (previous) {
        this.unresolvedPreviousWorkout = previous;
        this.pendingWorkoutToStart = this.selectedWorkout;
        this.previousWorkoutReason = '';
        this.showPreviousOverdueModal = true;
        return;
      }
    }
    this.enterCompletedWorkoutMode();
  }

  private enterCompletedWorkoutMode(): void {
    this.stopTimer();
    this.elapsedSeconds = 0;
    this.workoutRunStatus = 'LOG_WORKOUT';
  }

  finishWorkout(alreadyCompleted = false): void {
    if (!this.selectedWorkout) return;
    if (!alreadyCompleted && this.hasNoCompletedExercises()) {
      this.showNoExercisesCompletedModal = true;
      return;
    }
    this.stopTimer();
    this.workoutRunStatus = alreadyCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED';
    this.selectedWorkout.groupedExercises
      .filter((exercise) => this.isSingleCardioWarmUp(exercise))
      .forEach((exercise) => exercise.completed = true);
    this.selectedWorkout.workoutElapsedSeconds = this.elapsedSeconds;
    this.selectedWorkout.clientCompletionMode = alreadyCompleted ? 'ALREADY_COMPLETED' : 'TRACKED';
    this.updateWorkoutStatus(this.selectedWorkout, 'COMPLETED', true);
  }

  private hasNoCompletedExercises(): boolean {
    const exercises = this.selectedWorkout?.groupedExercises.filter(
      exercise => !this.isSingleCardioWarmUp(exercise)
    ) || [];
    return exercises.length > 0 &&
      exercises.every(exercise => exercise.skipped === true && exercise.completed !== true);
  }

  openMissedWorkoutModal(workout: Workout = this.selectedWorkout!): void {
    if (!workout) return;
    this.unresolvedPreviousWorkout = workout;
    this.missedWorkoutReason = workout.missedReason || workout.overallWorkoutNote || '';
    this.showNoExercisesCompletedModal = false;
    this.showMissedWorkoutModal = true;
  }

  closeMissedWorkoutModal(): void {
    this.showMissedWorkoutModal = false;
    this.missedWorkoutReason = '';
    if (!this.showPreviousOverdueModal) this.unresolvedPreviousWorkout = null;
  }

  confirmWorkoutAsMissed(): void {
    const workout = this.unresolvedPreviousWorkout || this.selectedWorkout;
    if (!workout) return;
    workout.missedReason = this.missedWorkoutReason.trim();
    workout.overallWorkoutNote = workout.missedReason;
    this.updateWorkoutStatus(workout, 'MISSED', true, () => {
      if (this.selectedWorkout?.id === workout.id) {
        this.selectedWorkout.status = 'MISSED';
        this.backToList();
      }
      this.closeMissedWorkoutModal();
    });
  }

  markPreviousAsMissedAndContinue(): void {
    const previous = this.unresolvedPreviousWorkout;
    const next = this.pendingWorkoutToStart;
    if (!previous || !next) return;
    previous.missedReason = this.previousWorkoutReason.trim();
    previous.overallWorkoutNote = previous.missedReason;
    this.updateWorkoutStatus(previous, 'MISSED', true, () => {
      this.closePreviousOverdueModal();
      this.onSelectWorkout(next);
      // Re-run the guard: another older workout may still be overdue.
      this.startWorkout();
    });
  }

  logPreviousAsCompleted(): void {
    const previous = this.unresolvedPreviousWorkout;
    if (!previous) return;
    this.nextWorkoutAfterResolution = this.pendingWorkoutToStart;
    this.showPreviousOverdueModal = false;
    this.unresolvedPreviousWorkout = null;
    this.pendingWorkoutToStart = null;
    this.onSelectWorkout(previous);
    this.enterCompletedWorkoutMode();
  }

  closePreviousOverdueModal(): void {
    this.showPreviousOverdueModal = false;
    this.unresolvedPreviousWorkout = null;
    this.pendingWorkoutToStart = null;
    this.previousWorkoutReason = '';
  }

  startNextWorkout(): void {
    const next = this.nextWorkoutAfterResolution;
    if (!next) return;
    this.nextWorkoutAfterResolution = null;
    this.onSelectWorkout(next);
    // Re-run the guard before starting in case several workouts are overdue.
    this.startWorkout();
  }

  private findPreviousOverdueWorkout(workout: Workout): Workout | null {
    const previousWorkouts = this.findPreviousOverdueWorkouts(workout);
    return previousWorkouts.length === 1 ? previousWorkouts[0] : null;
  }

  private findPreviousOverdueWorkouts(workout: Workout): Workout[] {
    const selectedDate = this.workoutDateValue(workout.date);
    return this.workouts
      .filter(candidate =>
        candidate.status === 'OVERDUE' &&
        candidate.id !== workout.id &&
        this.workoutDateValue(candidate.date) < selectedDate
      )
      .sort((a, b) => this.workoutDateValue(b.date) - this.workoutDateValue(a.date));
  }

  private workoutDateValue(value: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
      : new Date(value).getTime();
  }

  markExercise(exercise: GroupedExercise, skipped: boolean): void {
    exercise.skipped = skipped;
    exercise.completed = !skipped;
    this.saveWorkoutProgress();
  }

  private saveWorkoutProgress(): void {
    if (!this.selectedWorkout) return;
    this.selectedWorkout.workoutElapsedSeconds = this.elapsedSeconds;
    this.selectedWorkout.clientCompletionMode = 'TRACKED';
    this.updateWorkoutStatus(this.selectedWorkout, 'IN_PROGRESS', true);
  }

  openExercise(exercise: GroupedExercise): void { this.selectedExercise = exercise; this.showExerciseVideo = false; this.exerciseEmbedUrl = null; }
  openExerciseVideo(exercise: GroupedExercise): void {
    if (!exercise.videoLink) return;
    this.openExercise(exercise);
    this.playExerciseVideo();
  }
  closeExercise(): void { this.selectedExercise = null; this.showExerciseVideo = false; this.exerciseEmbedUrl = null; }
  openNote(exercise: GroupedExercise): void { this.noteExercise = this.noteExercise === exercise ? null : exercise; }
  closeNote(): void { this.noteExercise = null; }

  playExerciseVideo(): void {
    this.exerciseEmbedUrl = this.getExerciseEmbedUrl(this.selectedExercise?.videoLink);
    this.showExerciseVideo = true;
  }

  isYouTubeExerciseVideo(url?: string): boolean {
    return !!url && /(?:youtube\.com|youtu\.be)/i.test(url);
  }

  getExercisePreviewImage(exercise?: GroupedExercise | null): string {
    const videoId = this.getYouTubeVideoId(exercise?.videoLink);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : (exercise?.imageUrl || '');
  }

  private getYouTubeVideoId(url?: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (parsed.pathname.includes('/shorts/')) return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      if (parsed.pathname.includes('/embed/')) return parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      return parsed.searchParams.get('v') || '';
    } catch {
      return '';
    }
  }

  getExerciseEmbedUrl(url?: string): SafeResourceUrl | null {
    if (!url) return null;
    const videoId = this.getYouTubeVideoId(url);
    return videoId
      ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`)
      : null;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => this.elapsedSeconds++, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  get showExerciseWeight(): boolean {
    return this.coachSettingsService.shouldShowExerciseWeight();
  }

  get weightUnitLabel(): string {
    return this.coachSettingsService.getWeightUnit();
  }

  formatExerciseWeight(value: number | null | undefined): string {
    const converted = this.coachSettingsService.convertWeightFromKg(value);
    return converted === null ? '-' : this.coachSettingsService.formatNumber(converted);
  }

  get showWorkoutFiles(): boolean {
    return this.fileSettingsResolved && this.workoutFileEnabled;
  }

  getWorkoutDay() {
    this.workoutService.getWorkoutPlansByClient(this.userid).subscribe((plans: any[]) => {
      this.allPlans = plans || [];
      const coachMap = new Map<string, any>();
      this.allPlans.forEach((plan: any) => {
        const coachId = this.getPlanCoachId(plan);
        if (coachId) {
          coachMap.set(coachId, {
            id: coachId,
            firstName: plan.coach?.firstName || 'Coach',
            lastName: plan.coach?.lastName || '',
            fullName: `${plan.coach?.firstName || 'Coach'} ${plan.coach?.lastName || ''}`.trim(),
          });
        }
      });
      this.coaches = Array.from(coachMap.values());
      this.selectedCoachId = this.resolveCurrentCoachId(this.allPlans) || this.coaches[0]?.id || 'all';
      this.fileSettingsResolved = false;
      this.workoutFileEnabled = false;
      this.coachWorkoutFileEnabled.clear();
      // Render regular workouts immediately while file permissions load.
      this.applyCoachFilter();
      this.loadCoachWorkoutFileSettings();
    });
  }


  loadCoachWorkoutFileSettings() {
    const coachIds = this.selectedCoachId !== 'all'
      ? [this.selectedCoachId]
      : this.coaches.map((coach) => coach.id).filter(Boolean);

    if (!coachIds.length) {
      this.fileSettingsResolved = true;
      this.applyCoachFilter();
      return;
    }

    forkJoin(
      coachIds.map((coachId) =>
        this.coachSettingsService.getConfigForCoach(coachId, true).pipe(
          map((config) => ({
            coachId,
            enabled: config.workout?.workoutFileEnabled !== false,
          })),
          catchError(() => of({ coachId, enabled: false }))
        )
      )
    ).subscribe({
      next: (items) => {
        this.coachWorkoutFileEnabled.clear();
        items.forEach((item) => {
          this.coachWorkoutFileEnabled.set(item.coachId, item.enabled);
        });
        this.fileSettingsResolved = true;
        this.applyCoachFilter();
      },
      error: () => {
        this.fileSettingsResolved = true;
        this.applyCoachFilter();
      },
    });
  }

  isWorkoutFileEnabledForCoach(coachId: string | null): boolean {
    if (!coachId) {
      return this.workoutFileEnabled;
    }

    if (!this.coachWorkoutFileEnabled.has(coachId)) {
      return false;
    }

    return this.coachWorkoutFileEnabled.get(coachId) !== false;
  }

  applyCoachFilter() {
    let filteredPlans = this.allPlans || [];

    if (this.selectedCoachId !== 'all') {
      filteredPlans = filteredPlans.filter((plan: any) => this.getPlanCoachId(plan) === this.selectedCoachId);
    }

    const selectedCoachSettingEnabled = this.fileSettingsResolved && (this.selectedCoachId === 'all'
      ? this.coaches.some((coach) => this.isWorkoutFileEnabledForCoach(coach.id))
      : this.isWorkoutFileEnabledForCoach(this.selectedCoachId));

    this.workoutFileEnabled = selectedCoachSettingEnabled;

    const normalPlans = filteredPlans.filter((plan: any) => !this.isFilePlan(plan));
    const filePlans = filteredPlans.filter((plan: any) =>
      this.isFilePlan(plan) && this.isWorkoutFileEnabledForCoach(this.getPlanCoachId(plan))
    );

    this.workouts = this.mapPlansToWorkouts(normalPlans);
    this.filePrograms = this.mapPlansToFilePrograms(filePlans);
    if (!this.workoutFileEnabled && this.clientViewMode === 'file') {
      this.clientViewMode = 'calendar';
    }
    this.applyFileSearch();

    if (this.filePrograms.length > 0 && !this.selectedFileProgram) {
      this.selectedFileProgram = this.currentPrograms[0] || this.filePrograms[0];
    } else if (this.selectedFileProgram) {
      const stillExists = this.filePrograms.find((p) => p.id === this.selectedFileProgram?.id);
      this.selectedFileProgram = stillExists || this.currentPrograms[0] || this.filePrograms[0] || null;
    }

    if (this.filePrograms.length > 0) {
      this.clientViewMode = 'file';
    }

    this.loadSelectedFilePreview();
    this.selectedWorkout = null;
  }

  getPlanCoachId(plan: any): string | null {
    return plan?.coach?.id || plan?.coach?._id || plan?.createdBy || plan?.client?.coachId || null;
  }

  private resolveCurrentCoachId(plans: any[]): string | null {
    const clientCoachId = (plans || [])
      .map((plan) => plan?.client?.coachId || plan?.client?.coach?.id || plan?.client?.coach?._id)
      .find((coachId) => !!coachId);

    if (clientCoachId) {
      return clientCoachId;
    }

    const activePlanCoachId = (plans || [])
      .filter((plan) => this.isPlanCurrent(plan))
      .map((plan) => this.getPlanCoachId(plan))
      .find((coachId) => !!coachId);

    return activePlanCoachId || null;
  }

  private isPlanCurrent(plan: any): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = plan?.startDate ? new Date(plan.startDate) : null;
    const end = plan?.endDate ? new Date(plan.endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);
    return (!start || start <= today) && (!end || end >= today);
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.fileSettingsResolved = false;
    this.workoutFileEnabled = false;
    this.applyCoachFilter();
    this.loadCoachWorkoutFileSettings();
  }

  get currentMonth(): string {
    return this.currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get displayWorkouts(): Workout[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.workouts.filter((w) => {
      const workoutDate = new Date(w.date);
      workoutDate.setHours(0, 0, 0, 0);
      const sameMonth = workoutDate.getMonth() === this.currentMonthDate.getMonth() && workoutDate.getFullYear() === this.currentMonthDate.getFullYear();
      if (!sameMonth) return false;
      return this.activeTab === 'upcoming' ? workoutDate >= today : workoutDate < today;
    });
  }

  get calendarCountLabel(): string {
    const count = this.displayWorkouts.length;
    return `${count} séance${count > 1 ? 's' : ''} ce mois`;
  }

  get currentPrograms(): FileProgram[] {
    return this.filteredFilePrograms.filter((p) => p.isCurrent);
  }

  get historyPrograms(): FileProgram[] {
    return this.filteredFilePrograms.filter((p) => !p.isCurrent);
  }

  mapPlansToWorkouts(plans: any[]): Workout[] {
    const workouts: Workout[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    plans.forEach((plan) => {
      if (!plan.startDate || !plan.workoutDays?.length) return;
      const planStart = this.parseWorkoutDate(plan.startDate);
      plan.workoutDays.forEach((day: any, index: number) => {
        const explicitDate = this.parseWorkoutDate(day?.date);
        const workoutDate = explicitDate || (planStart ? new Date(planStart) : null);
        if (!workoutDate) return;
        const dayNumber = Number(day?.dayNumber || index + 1);
        if (!explicitDate) workoutDate.setDate(planStart!.getDate() + Math.max(0, dayNumber - 1));
        const dateStr = this.toWorkoutDate(workoutDate);
        const groupedExercises = this.groupExercisesBySuperset(day.workoutSessions || []);
        this.applyClientExerciseLogs(groupedExercises, day.clientExerciseLogs || []);
        if (day.status === 'COMPLETED' && !(day.clientExerciseLogs || []).length) {
          groupedExercises.forEach((exercise) => exercise.completed = true);
        }
        const persistedStatus = (day.status ?? 'PENDING') as WorkoutStatus;
        const status: WorkoutStatus = (persistedStatus === 'PENDING' || persistedStatus === 'IN_PROGRESS') && workoutDate < today
          ? 'OVERDUE'
          : persistedStatus;
        workouts.push({
          id: day.id,
          planId: plan.id,
          date: dateStr,
          title: day.title || `Day ${day.dayNumber}`,
          program: plan.name,
          dayNumber,
          status,
          rawSessions: day.workoutSessions || [],
          groupedExercises,
          workoutElapsedSeconds: Number(day.workoutElapsedSeconds || 0),
          clientCompletionMode: day.clientCompletionMode,
          overallWorkoutNote: day.overallWorkoutNote || '',
          missedReason: day.missedReason || day.statusReason || '',
        });
      });
    });
    return workouts;
  }

  private parseWorkoutDate(value: any): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toWorkoutDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  mapPlansToFilePrograms(plans: any[]): FileProgram[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (plans || []).map((plan: any) => {
      const type = String(plan.resourceType || '').toUpperCase();
      const coachName = `${plan.coach?.firstName || 'Coach'} ${plan.coach?.lastName || ''}`.trim();
      const end = plan.endDate ? new Date(plan.endDate) : null;
      if (end) end.setHours(0, 0, 0, 0);
      const isCurrent = !end || end >= today;
      return {
        id: plan.id,
        name: plan.name || 'Programme fichier',
        coachName,
        resourceType: type === 'XLS' || type === 'XLSX' ? 'EXCEL' : (type || 'PDF'),
        originalFileName: plan.originalFileName,
        fileName: plan.fileName,
        fileUrl: plan.fileUrl,
        fileSizeBytes: plan.fileSizeBytes,
        startDate: plan.startDate,
        endDate: plan.endDate,
        addedLabel: plan.startDate ? this.formatFrenchDate(plan.startDate) : '',
        isCurrent,
        pageCountLabel: type === 'PDF' ? '12 pages' : 'Feuille Excel',
      } as FileProgram;
    }).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }

  applyFileSearch() {
    const q = this.searchProgram.trim().toLowerCase();
    this.filteredFilePrograms = !q
      ? [...this.filePrograms]
      : this.filePrograms.filter((p) =>
          [p.name, p.originalFileName, p.resourceType].filter(Boolean).join(' ').toLowerCase().includes(q)
        );
  }

  isFilePlan(plan: any): boolean {
    const mode = String(plan?.workoutPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    return mode === 'FILE' || !!plan?.fileName || !!plan?.fileUrl || ['PDF', 'XLS', 'XLSX', 'EXCEL'].includes(type);
  }

  setClientViewMode(mode: 'calendar' | 'file') {
    if (mode === 'file' && !this.workoutFileEnabled) {
      return;
    }

    this.clientViewMode = mode;
    this.selectedWorkout = null;
    if (mode === 'file' && !this.selectedFileProgram) {
      this.selectedFileProgram = this.currentPrograms[0] || this.filePrograms[0] || null;
    }
    if (mode === 'file') {
      this.loadSelectedFilePreview();
    }
  }

  selectFileProgram(program: FileProgram) {
    if (!this.workoutFileEnabled) {
      return;
    }

    this.selectedFileProgram = program;
    this.clientViewMode = 'file';
    this.loadSelectedFilePreview();
  }

  getSafeSelectedFileUrl(): SafeResourceUrl | null {
    return this.selectedFileSafeUrl;
  }

  private revokeSelectedFileBlob() {
    if (this.selectedFileBlobUrl) {
      window.URL.revokeObjectURL(this.selectedFileBlobUrl);
      this.selectedFileBlobUrl = null;
    }
    this.selectedFileSafeUrl = null;
    this.pdfDocument = null;
    this.pdfBlob = null;
  }


  async ensurePdfJsLoaded() {
    if (this.pdfJsLib) {
      return this.pdfJsLib;
    }

    const pdfjs = await import('pdfjs-dist');
    (pdfjs as any).GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

    this.pdfJsLib = pdfjs as any;
    return this.pdfJsLib;
  }

  async renderPdfPage() {
    if (!this.pdfDocument || !this.pdfCanvas?.nativeElement) {
      return;
    }

    if (this.pdfRenderTask) {
      try {
        this.pdfRenderTask.cancel();
      } catch (e) {}
      this.pdfRenderTask = null;
    }

    const canvas = this.pdfCanvas.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const page = await this.pdfDocument.getPage(this.pdfCurrentPage);
    const parent = canvas.parentElement;
    const availableWidth = Math.max(320, (parent?.clientWidth || 900) - 48);

    const baseViewport = page.getViewport({ scale: 1 });
    const pageWidthScale = availableWidth / baseViewport.width;
    const scale = pageWidthScale * (Number(this.pdfZoom || 100) / 100);
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    this.pdfRenderTask = page.render({ canvasContext: ctx, viewport });

    try {
      await this.pdfRenderTask.promise;
    } catch (error: any) {
      if (error?.name !== 'RenderingCancelledException') {
        console.error('PDF render error:', error);
      }
    } finally {
      this.pdfRenderTask = null;
    }
  }

  loadSelectedFilePreview() {
    this.revokeSelectedFileBlob();
    this.selectedFileError = '';

    const resourceType = String(this.selectedFileProgram?.resourceType || '').toUpperCase();

    if (!this.selectedFileProgram) {
      this.selectedFileLoading = false;
      return;
    }

    if (resourceType === 'EXCEL' || resourceType === 'XLS' || resourceType === 'XLSX') {
      this.loadSelectedExcelPreview();
      return;
    }

    if (resourceType !== 'PDF') {
      this.selectedFileLoading = false;
      return;
    }

    this.selectedFileLoading = true;

    this.workoutService.getWorkoutFileBlob(this.selectedFileProgram as any).subscribe({
      next: async (blob) => {
        try {
          const pdfBlob = blob.type === 'application/pdf'
            ? blob
            : new Blob([blob], { type: 'application/pdf' });

          this.pdfBlob = pdfBlob;
          this.selectedFileBlobUrl = window.URL.createObjectURL(pdfBlob);
          this.selectedFileSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.selectedFileBlobUrl);

          const pdfjs = await this.ensurePdfJsLoaded();
          const arrayBuffer = await pdfBlob.arrayBuffer();

          this.pdfDocument = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          this.pdfTotalPages = this.pdfDocument.numPages || 0;
          this.pdfCurrentPage = 1;
          this.selectedFileLoading = false;

          setTimeout(() => this.renderPdfPage(), 0);
        } catch (error) {
          console.error('Error preparing PDF preview:', error);
          this.selectedFileError = 'Impossible d’afficher l’aperçu du PDF. Téléchargez le fichier pour l’ouvrir.';
          this.selectedFileLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading PDF preview:', error);
        this.selectedFileError = 'Impossible d’afficher l’aperçu du PDF. Téléchargez le fichier pour l’ouvrir.';
        this.selectedFileLoading = false;
      },
    });
  }

  loadSelectedExcelPreview() {
    this.excelLoading = true;
    this.selectedFileLoading = true;
    this.selectedFileError = '';

    if (!this.selectedFileProgram) return;

    this.workoutService.getWorkoutFileBlob(this.selectedFileProgram as any).subscribe({
      next: async (blob) => {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });

          this.excelSheets = workbook.SheetNames || [];
          this.selectedExcelSheetName = this.excelSheets[0] || '';

          this.populateExcelPreview(workbook, this.selectedExcelSheetName);

          this.excelLoading = false;
          this.selectedFileLoading = false;
        } catch (error) {
          console.error('Error loading Excel preview:', error);
          this.selectedFileError = 'Impossible d’afficher l’aperçu Excel. Téléchargez le fichier pour l’ouvrir.';
          this.excelLoading = false;
          this.selectedFileLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading Excel preview:', error);
        this.selectedFileError = 'Impossible d’afficher l’aperçu Excel. Téléchargez le fichier pour l’ouvrir.';
        this.excelLoading = false;
        this.selectedFileLoading = false;
      },
    });
  }

  populateExcelPreview(workbook: XLSX.WorkBook, sheetName: string) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      this.excelHeaders = [];
      this.excelRows = [];
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as any[][];

    const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
    const previewRows = nonEmptyRows.slice(0, 80);
    const maxColumns = Math.min(
      16,
      Math.max(1, ...previewRows.map((row) => row.length))
    );

    this.excelHeaders = Array.from({ length: maxColumns }).map((_, index) => this.excelColumnName(index));
    this.excelRows = previewRows.map((row) =>
      Array.from({ length: maxColumns }).map((_, index) => row[index] ?? '')
    );
  }

  excelColumnName(index: number): string {
    let name = '';
    let n = index + 1;

    while (n > 0) {
      const r = (n - 1) % 26;
      name = String.fromCharCode(65 + r) + name;
      n = Math.floor((n - 1) / 26);
    }

    return name;
  }


  onExcelSheetChange(sheetName: string) {
    if (!this.selectedFileProgram || !sheetName) return;

    this.selectedExcelSheetName = sheetName;
    this.loadSelectedExcelPreview();
  }

  openSelectedFile() {
    // Open preview in a new tab without forcing download.
    if (this.selectedFileBlobUrl) {
      window.open(this.selectedFileBlobUrl, '_blank');
      return;
    }

    if (!this.selectedFileProgram) return;

    this.workoutService.getWorkoutFileBlob(this.selectedFileProgram as any).subscribe({
      next: (blob) => {
        const pdfBlob = blob.type === 'application/pdf'
          ? blob
          : new Blob([blob], { type: 'application/pdf' });

        const blobUrl = window.URL.createObjectURL(pdfBlob);
        window.open(blobUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      },
      error: (error) => {
        console.error('Error opening file:', error);
      },
    });
  }

  downloadSelectedFile() {
    // Download only when user clicks Télécharger.
    if (!this.selectedFileProgram) return;

    this.workoutService.getWorkoutFileBlob(this.selectedFileProgram as any).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download =
          this.selectedFileProgram?.originalFileName ||
          (this.selectedFileProgram as any)?.fileName ||
          `${this.selectedFileProgram?.name || 'workout-program'}.pdf`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      },
      error: (error) => {
        console.error('Error downloading file:', error);
      },
    });
  }

  pdfPreviousPage() {
    if (this.pdfCurrentPage > 1) {
      this.pdfCurrentPage -= 1;
      this.renderPdfPage();
    }
  }

  pdfNextPage() {
    if (!this.pdfTotalPages || this.pdfCurrentPage < this.pdfTotalPages) {
      this.pdfCurrentPage += 1;
      this.renderPdfPage();
    }
  }

  pdfZoomOut() {
    this.pdfZoom = Math.max(50, Number(this.pdfZoom || 100) - 10);
    this.renderPdfPage();
  }

  pdfZoomIn() {
    this.pdfZoom = Math.min(180, Number(this.pdfZoom || 100) + 10);
    this.renderPdfPage();
  }

  setPdfPageWidth() {
    this.pdfZoom = 100;
    this.renderPdfPage();
  }

  get pdfZoomLabel(): string {
    return this.pdfZoom === 100 ? 'Page width' : `${this.pdfZoom}%`;
  }

  togglePdfFullscreen() {
    this.isPdfFullscreen = !this.isPdfFullscreen;
    setTimeout(() => this.renderPdfPage(), 120);
  }

  scrollPdfToBottom() {
    const container = document.querySelector('.yo-pdf-stage') as HTMLElement | null;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  fullscreenSelectedFile() {
    this.togglePdfFullscreen();
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatFrenchDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  private groupExercisesBySuperset(sessions: any[]): GroupedExercise[] {
    const allExercises: RawExercise[] = sessions.flatMap((s) => s.exercises || []);
    const groups: { [key: string]: RawExercise[] } = {};
    allExercises.forEach((ex) => {
      const groupId = ex.supersetGroupId || `solo_${ex.id}`;
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(ex);
    });

    const groupedExercises: GroupedExercise[] = [];
    let globalIndex = 0;
    Object.values(groups).forEach((groupExercises: RawExercise[]) => {
      groupExercises.forEach((ex, subIndex) => {
        const exerciseRef = ex.exerciseRef || {};
        const isSuperset = groupExercises.length > 1;
        const groupNumber = globalIndex + 1;
        const displayNumber = isSuperset ? `${groupNumber}.${subIndex + 1}` : `${groupNumber}`;
        const totalDuration = ex.sets?.reduce((sum, s) => sum + (s.duration || 0), 0) ?? ex.duration;
        groupedExercises.push({
          sourceExerciseId: ex.id,
          groupIndex: globalIndex,
          subIndex: isSuperset ? subIndex + 1 : undefined,
          displayNumber,
          isSuperset,
          label: ex.type,
          name: ex.name,
          type: ex.type,
          sets: ex.sets?.map((s, setIndex) => {
            const setType = this.normalizeSetType(s);
            const displaySetNumber = setIndex + 1;
            return {
              setNumber: displaySetNumber,
              type: setType,
              displayLabel: this.getSetDisplayLabel(setType, displaySetNumber),
              reps: s.reps != null ? `${s.reps}` : '-',
              weight: this.coachSettingsService.convertWeightFromKg(s.weight),
              rest: this.formatRest(s.restMin ?? 0, s.restSec ?? 0),
              duration: s.duration,
            };
          }) || [],
          duration: totalDuration,
          isWarmUp: this.isWarmUpExercise(ex),
          description: ex.description || exerciseRef.description,
          instructions: Array.isArray(ex.instructions || exerciseRef.instructions)
            ? (ex.instructions || exerciseRef.instructions)
            : (ex.instructions || exerciseRef.instructions || '').split(/\r?\n/).filter(Boolean),
          videoLink: ex.videoLink || exerciseRef.videoLink || exerciseRef.videoUrl,
          imageUrl: ex.imageUrl || exerciseRef.imageUrl || exerciseRef.image || exerciseRef.thumbnailUrl || exerciseRef.photoUrl,
          equipment: ex.equipment || exerciseRef.equipment,
          primaryMuscle: ex.primaryMuscle || ex.muscle || ex.category || exerciseRef.muscle,
          coachNote: ex.coachNote || exerciseRef.coachNote || ex.description,
        });
      });
      globalIndex++;
    });
    return groupedExercises;
  }

  private normalizeSetType(set: any): WorkoutSetType {
    const rawType = (set?.type ?? set?.setType ?? set?.workoutSetType ?? set?.typeSet ?? set?.workoutType ?? set?.set_type ?? set?.setTypeEnum ?? set?.exerciseSetType ?? 'REGULAR')
      .toString().trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (rawType === 'W' || rawType === 'WARMUP' || rawType === 'WARM_UP') return 'WARM_UP';
    if (rawType === 'D' || rawType === 'DROPSET' || rawType === 'DROP_SET') return 'DROP_SET';
    if (rawType === 'F' || rawType === 'FAILURE') return 'FAILURE';
    return 'REGULAR';
  }

  getSetDisplayLabel(type: WorkoutSetType, setNumber: number): string {
    if (type === 'WARM_UP') return 'W';
    if (type === 'DROP_SET') return 'D';
    if (type === 'FAILURE') return 'F';
    return String(setNumber);
  }

  getSetTypeClass(type?: WorkoutSetType): string {
    switch (type) {
      case 'WARM_UP': return 'cw-set-type--warmup';
      case 'DROP_SET': return 'cw-set-type--dropset';
      case 'FAILURE': return 'cw-set-type--failure';
      default: return 'cw-set-type--regular';
    }
  }

  getSetTypeText(type?: WorkoutSetType): string {
    if (type === 'DROP_SET') return 'Dropset';
    if (type === 'FAILURE') return 'Failure';
    if (type === 'WARM_UP') return 'Warm up';
    return '';
  }

  isSingleCardioWarmUp(exercise: GroupedExercise): boolean {
    return exercise.isWarmUp && exercise.type === 'CARDIO' && exercise.sets.length === 1;
  }

  cardioMinutes(exercise: GroupedExercise): number {
    return Number(exercise.sets[0]?.duration ?? exercise.duration ?? 0);
  }

  hasExerciseWeight(exercise: GroupedExercise): boolean {
    return true;
  }

  isSelectedWorkoutToday(): boolean {
    if (!this.selectedWorkout?.date) return false;
    const workoutDate = new Date(this.selectedWorkout.date);
    const today = new Date();
    return workoutDate.getFullYear() === today.getFullYear() &&
      workoutDate.getMonth() === today.getMonth() && workoutDate.getDate() === today.getDate();
  }

  formatRest(restMin: number, restSec: number): string {
    const min = Number(restMin || 0);
    const sec = Number(restSec || 0);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  getTotalExercises(workout: Workout): number {
    return this.getWorkoutExerciseDisplay(workout).length;
  }

  getWorkoutExerciseDisplay(workout: Workout): WorkoutExerciseDisplay[] {
    const exercises = (workout.rawSessions || []).flatMap((session) => session.exercises || []);
    const display: WorkoutExerciseDisplay[] = [];
    const groupNumbers = new Map<string, number>();
    let groupIndex = 0;

    exercises.forEach((exercise) => {
      if (this.isWarmUpExercise(exercise)) {
        groupIndex++;
        display.push({
          badge: '',
          name: 'Warm up',
          suffix: '',
          isWarmUp: true,
        });
        return;
      }

      const groupId = exercise.supersetGroupId || '';
      let badgeGroupNumber: number;
      if (groupId) {
        const existingNumber = groupNumbers.get(groupId);
        badgeGroupNumber = existingNumber || ++groupIndex;
        groupNumbers.set(groupId, badgeGroupNumber);
      } else {
        badgeGroupNumber = ++groupIndex;
      }
      const sameGroupExercises = groupId
        ? exercises.filter((item) => item.supersetGroupId === groupId)
        : [];
      const subIndex = sameGroupExercises.findIndex((item) => item === exercise || (!!item.id && item.id === exercise.id));
      const badge = groupId && sameGroupExercises.length > 1
        ? `${badgeGroupNumber}.${subIndex + 1}`
        : `${badgeGroupNumber}`;

      display.push({
        badge,
        name: exercise.name || 'Exercise',
        suffix: this.getExerciseSuffix(exercise),
        isWarmUp: false,
      });
    });

    return display;
  }

  private indexToExerciseLetter(index: number): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < alphabet.length) {
      return alphabet[index];
    }
    return alphabet[index % alphabet.length] + Math.floor(index / alphabet.length + 1);
  }

  private isWarmUpExercise(exercise: RawExercise): boolean {
    if (exercise.isWarmUp || exercise.warmUp || exercise.warmup) return true;

    const warmUpFields = [
      exercise.name,
      exercise.label,
      exercise.category,
      exercise.setType,
      exercise.workoutType,
      exercise.type,
    ];
    const hasWarmUpField = warmUpFields.some((value) => {
      const normalized = (value || '').toString().toLowerCase().replace(/[\s_-]+/g, '');
      return normalized === 'warmup' || normalized.includes('warmup');
    });
    const setTypes = (exercise.sets || []).map((set) => this.normalizeSetType(set));
    return hasWarmUpField || (!!setTypes.length && setTypes.every((type) => type === 'WARM_UP'));
  }

  private getExerciseSuffix(exercise: RawExercise): string {
    const setTypes = (exercise.sets || []).map((set) => this.normalizeSetType(set));
    if (setTypes.includes('DROP_SET')) return '(Drop set)';
    if (setTypes.includes('FAILURE')) return '(To failure)';
    return '';
  }

  userName = 'Kolton';
  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  setActiveTab(tab: 'upcoming' | 'past') {
    this.activeTab = tab;
    this.selectedWorkout = null;
  }

  prevMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
  }

  onSelectWorkout(workout: Workout): void {
    this.stopTimer();
    this.elapsedSeconds = Number(workout.workoutElapsedSeconds || 0);
    this.workoutRunStatus = workout.status === 'COMPLETED'
      ? (workout.clientCompletionMode === 'ALREADY_COMPLETED' ? 'ALREADY_COMPLETED' : 'COMPLETED')
      : workout.status === 'OVERDUE' ? 'OVERDUE'
      : workout.status === 'MISSED' ? 'MISSED'
      : workout.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
      : 'NOT_STARTED';
    this.selectedWorkout = {
      ...workout,
      groupedExercises: workout.groupedExercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set })),
      })),
    };
  }

  backToList() { this.stopTimer(); this.selectedWorkout = null; }

  showConfirmModal = false;
  pendingStatus: WorkoutStatus | null = null;

  openConfirmModal(status: WorkoutStatus): void { this.pendingStatus = status; this.showConfirmModal = true; }
  closeConfirmModal(): void { this.showConfirmModal = false; this.pendingStatus = null; }
  confirmStatusUpdate(): void {
    if (this.selectedWorkout && this.pendingStatus) this.updateWorkoutStatus(this.selectedWorkout, this.pendingStatus);
    this.closeConfirmModal();
  }

  private applyClientExerciseLogs(exercises: GroupedExercise[], logs: any[]): void {
    exercises.forEach((exercise) => {
      const log = logs.find((item) =>
        (exercise.sourceExerciseId && item.exerciseId === exercise.sourceExerciseId) ||
        item.displayNumber === exercise.displayNumber
      );
      if (!log) return;
      exercise.completed = !!log.completed;
      exercise.skipped = !!log.skipped;
      exercise.note = log.note || '';
      exercise.sets.forEach((set) => {
        const savedSet = (log.sets || []).find((item: any) => Number(item.setNumber) === set.setNumber);
        if (!savedSet) return;
        if (savedSet.reps !== undefined && savedSet.reps !== null) set.reps = savedSet.reps;
        if (savedSet.weight !== undefined) set.weight = this.coachSettingsService.convertWeightFromKg(savedSet.weight);
        if (savedSet.duration !== undefined && savedSet.duration !== null) set.duration = savedSet.duration;
      });
    });
  }

  updateWorkoutStatus(
    workout: Workout,
    status: WorkoutStatus,
    saveClientLog = false,
    onSuccess?: () => void
  ): void {
    const previousStatus = workout.status;
    workout.status = status;
    const payload: any = { id: workout.id, dayNumber: workout.dayNumber, status };
    if (saveClientLog) {
      payload.overallWorkoutNote = workout.overallWorkoutNote?.trim() || '';
      payload.missedReason = workout.missedReason?.trim() || '';
      if (status !== 'MISSED') {
        payload.workoutElapsedSeconds = workout.workoutElapsedSeconds || 0;
        payload.clientCompletionMode = workout.clientCompletionMode || 'TRACKED';
        payload.clientExerciseLogs = workout.groupedExercises.map((exercise) => ({
          exerciseId: exercise.sourceExerciseId,
          displayNumber: exercise.displayNumber,
          completed: !!exercise.completed,
          skipped: !!exercise.skipped,
          note: exercise.note || '',
          sets: exercise.sets.map((set) => ({
            setNumber: set.setNumber,
            reps: set.reps,
            weight: this.coachSettingsService.convertWeightToKg(set.weight),
            duration: set.duration,
            rest: set.rest,
            type: set.type,
          })),
        }));
      }
    }
    this.workoutDayService.updateWorkoutDay(payload, workout.planId).subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        const listedWorkout = this.workouts.find((item) => item.id === workout.id && item.planId === workout.planId);
        if (listedWorkout) Object.assign(listedWorkout, workout);
        onSuccess?.();
      },
      error: (err) => {
        console.error('Update failed:', err);
        workout.status = previousStatus;
      },
    });
  }
}
