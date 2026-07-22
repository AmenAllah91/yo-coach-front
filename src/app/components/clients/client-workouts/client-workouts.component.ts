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

type WorkoutStatus = 'COMPLETED' | 'MISSED' | 'PENDING';
type WorkoutRunStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'LOG_WORKOUT' | 'COMPLETED' | 'ALREADY_COMPLETED';
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

  startWorkout(): void {
    this.workoutRunStatus = 'IN_PROGRESS';
    this.startTimer();
  }

  pauseWorkout(): void {
    this.workoutRunStatus = 'PAUSED';
    this.stopTimer();
  }

  resumeWorkout(): void {
    this.workoutRunStatus = 'IN_PROGRESS';
    this.startTimer();
  }

  cancelWorkout(): void {
    this.stopTimer();
    this.elapsedSeconds = 0;
    this.workoutRunStatus = 'NOT_STARTED';
    this.showWorkoutMenu = false;
    this.selectedWorkout?.groupedExercises.forEach((exercise) => {
      exercise.completed = false;
      exercise.skipped = false;
    });
  }

  logCompletedWorkout(): void {
    this.stopTimer();
    this.elapsedSeconds = 0;
    this.workoutRunStatus = 'LOG_WORKOUT';
  }

  finishWorkout(alreadyCompleted = false): void {
    if (!this.selectedWorkout) return;
    this.stopTimer();
    this.workoutRunStatus = alreadyCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED';
    this.selectedWorkout.groupedExercises
      .filter((exercise) => this.isSingleCardioWarmUp(exercise))
      .forEach((exercise) => exercise.completed = true);
    this.selectedWorkout.workoutElapsedSeconds = this.elapsedSeconds;
    this.selectedWorkout.clientCompletionMode = alreadyCompleted ? 'ALREADY_COMPLETED' : 'TRACKED';
    this.updateWorkoutStatus(this.selectedWorkout, 'COMPLETED', true);
  }

  markExercise(exercise: GroupedExercise, skipped: boolean): void {
    exercise.skipped = skipped;
    exercise.completed = !skipped;
  }

  openExercise(exercise: GroupedExercise): void { this.selectedExercise = exercise; this.showExerciseVideo = false; this.exerciseEmbedUrl = null; }
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
    plans.forEach((plan) => {
      if (!plan.startDate || !plan.workoutDays?.length) return;
      const planStart = new Date(plan.startDate);
      plan.workoutDays.forEach((day: any) => {
        if (!day.dayNumber) return;
        const workoutDate = new Date(planStart);
        workoutDate.setDate(planStart.getDate() + (day.dayNumber - 1));
        const dateStr = workoutDate.toISOString().split('T')[0];
        const groupedExercises = this.groupExercisesBySuperset(day.workoutSessions || []);
        this.applyClientExerciseLogs(groupedExercises, day.clientExerciseLogs || []);
        if (day.status === 'COMPLETED' && !(day.clientExerciseLogs || []).length) {
          groupedExercises.forEach((exercise) => exercise.completed = true);
        }
        workouts.push({
          id: day.id,
          planId: plan.id,
          date: dateStr,
          title: day.title || `Day ${day.dayNumber}`,
          program: plan.name,
          dayNumber: day.dayNumber,
          status: day.status ?? 'PENDING',
          rawSessions: day.workoutSessions || [],
          groupedExercises,
          workoutElapsedSeconds: Number(day.workoutElapsedSeconds || 0),
          clientCompletionMode: day.clientCompletionMode,
        });
      });
    });
    return workouts;
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
    let globalIndex = 1;
    Object.values(groups).forEach((groupExercises: RawExercise[]) => {
      groupExercises.forEach((ex, subIndex) => {
        const exerciseRef = ex.exerciseRef || {};
        const isSuperset = groupExercises.length > 1;
        const displayNumber = isSuperset ? `${globalIndex}.${subIndex + 1}` : `${globalIndex}`;
        const totalDuration = ex.sets?.reduce((sum, s) => sum + (s.duration || 0), 0) ?? ex.duration;
        groupedExercises.push({
          sourceExerciseId: ex.id,
          groupIndex: globalIndex,
          subIndex: isSuperset ? subIndex + 1 : undefined,
          displayNumber,
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
              weight: s.weight ?? null,
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
    const groupLetters = new Map<string, string>();
    let letterIndex = 0;

    exercises.forEach((exercise) => {
      if (this.isWarmUpExercise(exercise)) {
        display.push({
          badge: '',
          name: 'Warm up',
          suffix: '',
          isWarmUp: true,
        });
        return;
      }

      const groupId = exercise.supersetGroupId || '';
      let badgeLetter: string;
      if (groupId) {
        const existingLetter = groupLetters.get(groupId);
        badgeLetter = existingLetter || this.indexToExerciseLetter(letterIndex++);
        groupLetters.set(groupId, badgeLetter);
      } else {
        badgeLetter = this.indexToExerciseLetter(letterIndex++);
      }
      const sameGroupExercises = groupId
        ? exercises.filter((item) => item.supersetGroupId === groupId)
        : [];
      const subIndex = sameGroupExercises.findIndex((item) => item === exercise || (!!item.id && item.id === exercise.id));
      const badge = groupId && sameGroupExercises.length > 1
        ? `${badgeLetter}${subIndex + 1}`
        : badgeLetter;

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
        if (savedSet.weight !== undefined) set.weight = savedSet.weight;
        if (savedSet.duration !== undefined && savedSet.duration !== null) set.duration = savedSet.duration;
      });
    });
  }

  updateWorkoutStatus(workout: Workout, status: WorkoutStatus, saveClientLog = false): void {
    workout.status = status;
    const payload: any = { id: workout.id, dayNumber: workout.dayNumber, status };
    if (saveClientLog) {
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
          weight: set.weight,
          duration: set.duration,
        })),
      }));
    }
    this.workoutDayService.updateWorkoutDay(payload, workout.planId).subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        const listedWorkout = this.workouts.find((item) => item.id === workout.id && item.planId === workout.planId);
        if (listedWorkout) Object.assign(listedWorkout, workout);
      },
      error: (err) => {
        console.error('Update failed:', err);
        workout.status = 'PENDING';
      },
    });
  }
}
