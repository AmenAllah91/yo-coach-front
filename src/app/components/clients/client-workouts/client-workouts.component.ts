import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { WorkoutService } from 'app/service/workout.service';
import { WorkoutDayService } from 'app/service/workout-day.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import {
  allExercises, capitalizeFirst, dateKey, estimatedWorkoutMinutes, exerciseCardImage, isRestDay, planDate,
  programWeek, workoutDayTitle, youtubeVideoId,
} from '../shared/client-plan-utils';

type RunStatus = 'NOT_STARTED' | 'OVERDUE' | 'MISSED' | 'IN_PROGRESS' | 'PAUSED' | 'LOG_WORKOUT' | 'COMPLETED' | 'ALREADY_COMPLETED';
type SetStatus = 'PENDING' | 'COMPLETED' | 'MISSED';

/** One scheduled day of a program (mobile WorkoutDayItem). */
interface DayItem { plan: any; day: any; date: Date; }

interface RunSet {
  setNumber: number; reps: number | null; duration: number | null; weight: number | null;
  restMin: number | null; restSec: number | null; type: string | null; status: SetStatus;
}

/** Run state of one exercise of the opened day (mobile _ExerciseRunData). */
interface RunExercise {
  key: string;          // "1", "2.1" — displayNumber saved in the logs
  displayLabel: string; // "1", "2A"
  exercise: any;
  sets: RunSet[];
  completed: boolean;
  skipped: boolean;
  note: string;
  showNote: boolean;
}

interface ExerciseGroup { label: string; isSuperset: boolean; letters: string[]; exercises: RunExercise[]; }

interface FileProgram { plan: any; type: 'PDF' | 'EXCEL'; isCurrent: boolean; }

/**
 * Client workouts, same content and logic as the mobile WorkoutScreen, WorkoutDetailScreen and
 * ExerciseDetailScreen: month list (upcoming / past), program files, the day run (timer, set by set
 * tracking, log as completed, missed) and the exercise page.
 */
@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './client-workouts.component.html',
  styleUrl: './client-workouts.component.scss',
})
export class ClientWorkoutsComponent implements OnInit, OnDestroy {
  @Input() previewClientId = '';
  @Input() previewMode = false;

  view: 'list' | 'files' | 'file' | 'day' = 'list';
  loading = true;
  error = '';
  upcoming = true;
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  plans: any[] = [];
  showExerciseWeight = true;
  workoutFilesEnabled = false;
  toast: { message: string; tone: 'success' | 'error' | 'info' } | null = null;

  // Opened day
  item: DayItem | null = null;
  runStatus: RunStatus = 'NOT_STARTED';
  elapsedSeconds = 0;
  groups: ExerciseGroup[] = [];
  runExercises: RunExercise[] = [];
  overallNote = '';
  saving = false;
  showLogCompletedNotice = false;
  showMenu = false;
  showSetTypes = false;
  showFinishSheet = false;
  skipTarget: RunExercise | null = null;
  statusTarget: DayItem | null = null;
  showPdfPreview = false;

  // Exercise page
  exercisePage: RunExercise | null = null;
  startedFromExercise = false;
  playing = false;
  playerUrl: SafeResourceUrl | null = null;

  // Files
  openedFile: FileProgram | null = null;
  fileLoading = false;
  fileError = '';
  fileBlobUrl: string | null = null;
  excelSheets: string[] = [];
  excelSheet = '';
  excelRows: any[][] = [];
  excelHeaders: string[] = [];
  pdfCurrentPage = 1;
  pdfTotalPages = 0;
  pdfZoom = 100;
  @ViewChild('pdfCanvas') pdfCanvas?: ElementRef<HTMLCanvasElement>;
  private pdfDocument: any = null;
  private pdfRenderTask: any = null;
  private workbook: XLSX.WorkBook | null = null;

  private clientId = sessionStorage.getItem('userId') || '';
  private initialDayId = '';
  private initialPlanId = '';
  private openedInitial = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingDraft = false;
  private subscriptions = new Subscription();
  private plansRequest?: Subscription;

  constructor(
    private workoutService: WorkoutService,
    private workoutDayService: WorkoutDayService,
    private coachSettings: CoachSettingsService,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private theme: ClientThemeService,
  ) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnInit(): void {
    this.theme.ensureLoaded();
    if (this.previewClientId) this.clientId = this.previewClientId;
    this.subscriptions.add(this.coachSettings.loadConfig(true).subscribe({ error: () => undefined }));
    if (!this.previewMode) {
      this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
        this.initialDayId = params.get('dayId') || '';
        this.initialPlanId = params.get('planId') || '';
        this.openedInitial = false;
        this.load();
      }));
    } else {
      this.load();
    }
  }

  ngOnDestroy(): void {
    if (this.hasPendingDraft && this.canEditWorkout) this.saveProgress();
    this.stopTimer();
    [this.draftTimer, this.noticeTimer, this.toastTimer].forEach(timer => timer && clearTimeout(timer));
    this.subscriptions.unsubscribe();
    this.plansRequest?.unsubscribe();
    this.revokeFile();
    document.body.classList.remove('client-workout-detail-open');
  }

  // -------------------------------------------------------------------------
  // Loading (mobile WorkoutProvider.load + _loadClientWorkouts)
  // -------------------------------------------------------------------------
  load(): void {
    if (!this.clientId) { this.loading = false; this.error = this.somethingWentWrong; return; }
    this.plansRequest?.unsubscribe();
    this.loading = !this.plans.length;
    this.error = '';
    this.plansRequest = this.workoutService.getWorkoutPlansByClient(this.clientId).subscribe({
      next: plans => {
        this.plans = this.plansOfCurrentCoach((plans as any[]) || []);
        this.loading = false;
        this.loadCoachSettings();
        this.openInitialTarget();
      },
      error: err => { this.loading = false; this.error = err?.message || this.somethingWentWrong; },
    });
  }

  /** Only the plans of the client's current coach (mobile _resolveCurrentCoachId). */
  private plansOfCurrentCoach(plans: any[]): any[] {
    const coachId = this.currentCoachId(plans);
    return coachId ? plans.filter(plan => this.planCoachId(plan) === coachId) : plans;
  }

  private currentCoachId(plans: any[]): string | null {
    const clientCoach = plans.map(plan => String(plan?.clientCoachId || plan?.client?.coachId || '').trim()).find(Boolean);
    if (clientCoach) return clientCoach;
    const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    for (const plan of plans) {
      const start = planDate(plan?.startDate); const end = planDate(plan?.endDate);
      if ((!start || start.getTime() <= today) && (!end || end.getTime() >= today)) {
        const coachId = this.planCoachId(plan);
        if (coachId) return coachId;
      }
    }
    return plans.map(plan => this.planCoachId(plan)).find(Boolean) || null;
  }

  private planCoachId(plan: any): string | null {
    const coachId = String(plan?.coach?.id || '').trim();
    if (coachId) return coachId;
    const createdBy = String(plan?.createdBy || '').trim();
    return createdBy || null;
  }

  /** Program files and the weight column follow the coach's settings. */
  private loadCoachSettings(): void {
    const coachId = this.plans.map(plan => String(plan?.coach?.id || '').trim()).find(Boolean);
    if (!coachId) { this.workoutFilesEnabled = false; return; }
    this.subscriptions.add(this.coachSettings.getConfigForCoach(coachId, true).pipe(catchError(() => of(null))).subscribe(config => {
      this.workoutFilesEnabled = !!config && config.workout?.workoutFileEnabled !== false;
      this.showExerciseWeight = config ? config.workout?.showExerciseWeight !== false : true;
    }));
  }

  /** ?planId= opens the program (its files, or its first day), ?dayId= that day. */
  private openInitialTarget(): void {
    if (this.openedInitial || this.view === 'day') return;
    if (this.initialPlanId) {
      const plan = this.plans.find(item => item.id === this.initialPlanId);
      if (plan) {
        this.openedInitial = true;
        if (this.isFileProgram(plan)) { this.view = 'files'; return; }
        const first = plan.workoutDays?.[0];
        const focus = planDate(plan.startDate) || (first ? this.scheduledDate(plan, first) : null);
        if (focus) this.month = new Date(focus.getFullYear(), focus.getMonth(), 1);
        const day = this.initialDayId ? (plan.workoutDays || []).find((d: any) => d.id === this.initialDayId) : first;
        if (day) this.openDay({ plan, day, date: this.scheduledDate(plan, day) });
        return;
      }
    }
    if (this.initialDayId) {
      for (const plan of this.plans) {
        const day = (plan.workoutDays || []).find((d: any) => d.id === this.initialDayId);
        if (day) {
          this.openedInitial = true;
          this.openDay({ plan, day, date: this.scheduledDate(plan, day) });
          return;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------
  private scheduledDate(plan: any, day: any): Date {
    const explicit = planDate(day?.date);
    if (explicit) return explicit;
    const start = planDate(plan?.startDate);
    const number = Number(day?.dayNumber);
    if (start && Number.isFinite(number)) return new Date(start.getFullYear(), start.getMonth(), start.getDate() + number - 1);
    return new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  }

  private get dayItems(): DayItem[] {
    const items: DayItem[] = [];
    for (const plan of this.plans) {
      if (this.isFileProgram(plan)) continue;
      for (const day of plan.workoutDays || []) items.push({ plan, day, date: this.scheduledDate(plan, day) });
    }
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  get visibleItems(): DayItem[] {
    const today = this.today.getTime();
    return this.dayItems.filter(item => (this.upcoming ? item.date.getTime() >= today : item.date.getTime() < today)
      && item.date.getFullYear() === this.month.getFullYear() && item.date.getMonth() === this.month.getMonth());
  }

  private get today(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  private get isCurrentMonth(): boolean {
    const now = new Date();
    return this.month.getFullYear() === now.getFullYear() && this.month.getMonth() === now.getMonth();
  }
  get canGoPrevious(): boolean { return this.upcoming ? !this.isCurrentMonth : true; }
  get canGoNext(): boolean { return this.upcoming ? true : !this.isCurrentMonth; }
  get monthLabel(): string {
    const label = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(this.month);
    return label ? label[0].toUpperCase() + label.slice(1) : label;
  }

  setTab(upcoming: boolean): void {
    this.upcoming = upcoming;
    const now = new Date();
    const nowIndex = now.getFullYear() * 12 + now.getMonth();
    const viewIndex = this.month.getFullYear() * 12 + this.month.getMonth();
    if (upcoming ? viewIndex < nowIndex : viewIndex > nowIndex) this.month = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  shiftMonth(delta: number): void {
    if (delta < 0 ? !this.canGoPrevious : !this.canGoNext) return;
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
  }

  isToday(item: DayItem): boolean { return item.date.getTime() === this.today.getTime(); }

  /** Persisted status, or OVERDUE for a past day that was never resolved. */
  dayStatus(item: DayItem): string {
    const persisted = String(item.day?.status || 'PENDING').toUpperCase();
    return item.date.getTime() < this.today.getTime() && ['PENDING', 'NOT_STARTED', 'IN_PROGRESS', 'PAUSED'].includes(persisted)
      ? 'OVERDUE' : persisted;
  }

  highlighted(item: DayItem): boolean {
    const status = this.dayStatus(item);
    return this.isToday(item) && status !== 'COMPLETED' && status !== 'MISSED';
  }

  inProgress(item: DayItem): boolean { return ['IN_PROGRESS', 'PAUSED'].includes(this.dayStatus(item)); }

  /** [label, chip color class] of the list chip (mobile _statusChip). */
  statusChip(item: DayItem): { label: string; color: string; icon?: string } {
    switch (this.dayStatus(item)) {
      case 'COMPLETED': {
        const logged = this.loggedSets(item.day);
        if (logged && logged[0] > 0 && logged[0] < logged[1] && item.day?.clientCompletionMode !== 'ALREADY_COMPLETED') {
          return { label: `${this.t('Partial', 'Partielle')} · ${logged[0]}/${logged[1]}`, color: '#D97706' };
        }
        return { label: this.t('Completed', 'Terminé'), color: '#1E8E4E' };
      }
      case 'MISSED': return { label: this.t('Missed', 'Manqué'), color: '#D93A3A' };
      case 'OVERDUE': return { label: this.t('Overdue', 'En retard'), color: '#D99100' };
      case 'IN_PROGRESS':
      case 'PAUSED': return { label: this.t('In progress', 'En cours'), color: 'var(--yc-primary)' };
      default:
        return this.isToday(item) ? { label: this.t('Today', 'Aujourd’hui'), color: 'var(--yc-primary)' }
          : { label: this.t('Planned', 'Prévu'), color: 'var(--yc-text-secondary)', icon: 'calendar' };
    }
  }

  private loggedSets(day: any): [number, number] | null {
    let done = 0; let total = 0;
    for (const log of day?.clientExerciseLogs || []) {
      for (const set of Array.isArray(log?.sets) ? log.sets : []) {
        total += 1;
        if (String(set?.status || '').toUpperCase() === 'COMPLETED') done += 1;
      }
    }
    return total === 0 ? null : [done, total];
  }

  dayTitle(item: DayItem): string { return workoutDayTitle(item.day, this.fr); }
  planLine(item: DayItem): string {
    return `${capitalizeFirst(item.plan?.name)} · ${this.t('Week', 'Semaine')} ${programWeek(item.plan?.startDate, item.date)}`;
  }
  exercises(item: DayItem): any[] { return isRestDay(item.day) ? [] : allExercises(item.day); }
  exercisesCount(item: DayItem): string { const n = this.exercises(item).length; return `${n} ${this.t('exercises', 'exercices')}`; }
  minutes(item: DayItem): number { return estimatedWorkoutMinutes(item.day); }
  isRest(item: DayItem): boolean { return isRestDay(item.day); }
  previewExercises(item: DayItem): any[] { return this.exercises(item).slice(0, 3); }

  /** Display labels (1, 2A, 2B, 3...) matching the day page. */
  exerciseLabels(item: DayItem): string[] {
    const exercises = this.exercises(item);
    const labels = new Array<string>(exercises.length).fill('');
    let group = 0; let i = 0;
    while (i < exercises.length) {
      const id = this.supersetId(exercises[i]);
      let j = i + 1;
      if (id) while (j < exercises.length && this.supersetId(exercises[j]) === id) j += 1;
      group += 1;
      if (j - i > 1) for (let k = i; k < j; k++) labels[k] = `${group}${String.fromCharCode(65 + k - i)}`;
      else labels[i] = `${group}`;
      i = j;
    }
    return labels;
  }

  private supersetId(exercise: any): string { return String(exercise?.supersetGroupId ?? exercise?.supersetWith ?? '').trim(); }

  exerciseVolume(exercise: any): string {
    const sets: any[] = exercise?.sets || [];
    if (!sets.length) return '';
    const first = sets[0];
    if (exercise?.type === 'CARDIO') return `${sets.length} × ${first?.duration ?? 0} min`;
    if (first?.reps != null && first.reps !== '') return `${sets.length} × ${first.reps}`;
    return this.t(`${sets.length} sets`, `${sets.length} séries`);
  }

  exerciseImage(exercise: any): string | null { return exerciseCardImage(exercise); }
  capitalize(value: string): string { return capitalizeFirst(value); }

  weekdayShort(date: Date): string { return new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(date).toUpperCase().replace('.', ''); }
  dayNumber(date: Date): string { return String(date.getDate()).padStart(2, '0'); }
  monthShort(date: Date): string { return new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(date).toUpperCase().replace('.', ''); }

  /** Right click on a day: mobile long press, quick status change. */
  openStatusSheet(event: MouseEvent, item: DayItem): void {
    if (this.previewMode) return;
    event.preventDefault();
    this.statusTarget = item;
  }

  applyQuickStatus(status: 'COMPLETED' | 'MISSED' | 'PENDING'): void {
    const item = this.statusTarget;
    this.statusTarget = null;
    if (!item) return;
    const previous = item.day.status;
    item.day.status = status;
    this.subscriptions.add(this.workoutDayService.updateWorkoutDay({
      id: item.day.id, status, ...(item.day.dayNumber != null ? { dayNumber: item.day.dayNumber } : {}),
    }, item.plan.id).subscribe({
      next: () => this.showToast(status === 'COMPLETED' ? this.t('Workout marked as completed', 'Entraînement marqué comme terminé')
        : status === 'MISSED' ? this.t('Workout marked as missed', 'Entraînement marqué comme manqué')
        : this.t('Workout reset to pending', 'Entraînement remis en attente'), status === 'MISSED' ? 'error' : 'success'),
      error: () => { item.day.status = previous; this.showToast(this.t('Failed to update', 'Échec de la mise à jour'), 'error'); },
    }));
  }

  get statusOptions(): { value: 'COMPLETED' | 'MISSED' | 'PENDING'; icon: string; color: string; label: string; hint: string }[] {
    const status = String(this.statusTarget?.day?.status || 'PENDING').toUpperCase();
    const options: { value: 'COMPLETED' | 'MISSED' | 'PENDING'; icon: string; color: string; label: string; hint: string }[] = [
      { value: 'COMPLETED', icon: 'check-circle', color: '#1E8E4E', label: this.t('Completed', 'Terminé'), hint: this.t('All sets are done', 'Toutes les séries sont faites') },
      { value: 'MISSED', icon: 'x-circle', color: '#D93A3A', label: this.t('Missed', 'Manqué'), hint: this.t('The workout was not done', 'La séance n’a pas été faite') },
    ];
    if (status !== 'PENDING') {
      options.push({ value: 'PENDING', icon: 'rotate-ccw', color: 'var(--yc-text-secondary)', label: this.t('Planned', 'Prévu'), hint: this.t('Back to “to do”', 'Revenir à « à faire »') });
    }
    return options;
  }

  get statusTargetIsCurrent(): string { return String(this.statusTarget?.day?.status || 'PENDING').toUpperCase(); }

  // -------------------------------------------------------------------------
  // Program files (mobile _buildFilesEntry / _openFilesPage)
  // -------------------------------------------------------------------------
  isFileProgram(plan: any): boolean {
    const mode = String(plan?.workoutPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    return mode === 'FILE' || ['PDF', 'EXCEL', 'XLS', 'XLSX'].includes(type);
  }

  get filePrograms(): FileProgram[] {
    if (!this.workoutFilesEnabled) return [];
    const files = this.plans.filter(plan => this.isFileProgram(plan)).map(plan => ({
      plan, type: this.fileType(plan), isCurrent: this.isCurrentFile(plan),
    }) as FileProgram);
    return files.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      const ad = (planDate(a.plan.createdAt) || planDate(a.plan.startDate) || new Date(0)).getTime();
      const bd = (planDate(b.plan.createdAt) || planDate(b.plan.startDate) || new Date(0)).getTime();
      return bd - ad;
    });
  }
  get currentFiles(): FileProgram[] { return this.filePrograms.filter(file => file.isCurrent); }
  get historyFiles(): FileProgram[] { return this.filePrograms.filter(file => !file.isCurrent); }

  get filesSummary(): string {
    const n = this.filePrograms.length; const active = this.currentFiles.length; const s = n > 1 ? 's' : '';
    return this.fr ? `${n} document${s} de votre coach${active > 0 ? ` · ${active} actif${active > 1 ? 's' : ''}` : ''}`
      : `${n} document${s} from your coach${active > 0 ? ` · ${active} active` : ''}`;
  }

  private isCurrentFile(plan: any): boolean {
    const end = planDate(plan?.endDate);
    return !end || end.getTime() >= this.today.getTime();
  }

  private fileType(plan: any): 'PDF' | 'EXCEL' {
    const combined = [plan?.resourceType, plan?.originalFileName, plan?.fileName, plan?.fileUrl, plan?.fileContentType]
      .map(value => String(value || '').toLowerCase()).join(' ');
    return /xlsx|xls|excel|spreadsheet/.test(combined) ? 'EXCEL' : 'PDF';
  }

  fileMeta(file: FileProgram): string {
    const parts: string[] = [file.type];
    if (file.plan.originalFileName) parts.push(file.plan.originalFileName);
    const size = Number(file.plan.fileSizeBytes || 0);
    if (size > 0) parts.push(this.formatFileSize(size));
    return parts.join(' · ');
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  }

  fileDates(file: FileProgram): string {
    const start = planDate(file.plan.startDate); const end = planDate(file.plan.endDate);
    const format = (date: Date) => new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    return `${start ? format(start) : ''}${end ? ` → ${format(end)}` : ''}`;
  }

  openFiles(): void { this.view = 'files'; }

  openFile(file: FileProgram): void {
    this.openedFile = file;
    this.view = 'file';
    this.loadFile();
  }

  closeFile(): void { this.revokeFile(); this.openedFile = null; this.view = 'files'; }

  private revokeFile(): void {
    if (this.fileBlobUrl) URL.revokeObjectURL(this.fileBlobUrl);
    this.fileBlobUrl = null;
    this.pdfDocument = null;
    this.workbook = null;
  }

  private loadFile(): void {
    const file = this.openedFile;
    if (!file) return;
    this.revokeFile();
    this.fileLoading = true;
    this.fileError = '';
    this.subscriptions.add(this.workoutService.getWorkoutFileBlob(file.plan).subscribe({
      next: async blob => {
        try {
          if (file.type === 'EXCEL') {
            this.workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
            this.excelSheets = this.workbook.SheetNames || [];
            this.excelSheet = this.excelSheets[0] || '';
            this.showExcelSheet(this.excelSheet);
            if (!this.excelRows.length) this.fileError = this.t('This Excel file is empty or unreadable.', 'Ce fichier Excel est vide ou illisible.');
          } else {
            const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
            this.fileBlobUrl = URL.createObjectURL(pdf);
            const pdfjs: any = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
            this.pdfDocument = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
            this.pdfTotalPages = this.pdfDocument.numPages || 0;
            this.pdfCurrentPage = 1;
            setTimeout(() => this.renderPdfPage(), 0);
          }
        } catch {
          this.fileError = file.type === 'EXCEL'
            ? this.t('Unable to display a preview of this Excel file.', 'Impossible d’afficher un aperçu de ce fichier Excel.')
            : this.t('Unable to load this workout file.', 'Impossible de charger ce fichier d’entraînement.');
        }
        this.fileLoading = false;
      },
      error: () => {
        this.fileLoading = false;
        this.fileError = this.t('Unable to load this workout file.', 'Impossible de charger ce fichier d’entraînement.');
      },
    }));
  }

  showExcelSheet(name: string): void {
    this.excelSheet = name;
    const sheet = this.workbook?.Sheets[name];
    if (!sheet) { this.excelHeaders = []; this.excelRows = []; return; }
    const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as any[][])
      .filter(row => row.some(cell => String(cell || '').trim() !== '')).slice(0, 200);
    const columns = Math.min(26, Math.max(1, ...rows.map(row => row.length)));
    this.excelHeaders = Array.from({ length: columns }, (_, index) => String.fromCharCode(65 + index));
    this.excelRows = rows.map(row => Array.from({ length: columns }, (_, index) => row[index] ?? ''));
  }

  async renderPdfPage(): Promise<void> {
    const canvas = this.pdfCanvas?.nativeElement;
    if (!this.pdfDocument || !canvas) return;
    try { this.pdfRenderTask?.cancel(); } catch { /* finished already */ }
    const context = canvas.getContext('2d');
    if (!context) return;
    const page = await this.pdfDocument.getPage(this.pdfCurrentPage);
    const available = Math.max(280, (canvas.parentElement?.clientWidth || 800) - 16);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (available / base.width) * (this.pdfZoom / 100) });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    this.pdfRenderTask = page.render({ canvasContext: context, viewport });
    try { await this.pdfRenderTask.promise; } catch { /* cancelled by a newer render */ }
    this.pdfRenderTask = null;
  }

  pdfPage(delta: number): void {
    const next = this.pdfCurrentPage + delta;
    if (next < 1 || (this.pdfTotalPages && next > this.pdfTotalPages)) return;
    this.pdfCurrentPage = next;
    this.renderPdfPage();
  }

  pdfZoomBy(delta: number): void {
    this.pdfZoom = Math.min(200, Math.max(50, this.pdfZoom + delta));
    this.renderPdfPage();
  }

  downloadFile(file: FileProgram): void {
    this.subscriptions.add(this.workoutService.getWorkoutFileBlob(file.plan).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const extension = file.type === 'EXCEL' ? '.xlsx' : '.pdf';
        link.href = url;
        link.download = (file.plan.originalFileName || file.plan.fileName || `${file.plan.name || 'workout-file'}${extension}`)
          .trim().replace(/[\\/:*?"<>|]+/g, '_');
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.showToast(this.t(`Downloaded: ${link.download}`, `Téléchargé : ${link.download}`), 'success');
      },
      error: () => this.showToast(this.t('Unable to load this workout file.', 'Impossible de charger ce fichier d’entraînement.'), 'error'),
    }));
  }

  // -------------------------------------------------------------------------
  // Day page (mobile WorkoutDetailScreen)
  // -------------------------------------------------------------------------
  openDay(item: DayItem): void {
    this.stopTimer();
    this.item = item;
    const day = item.day;
    this.overallNote = day.overallWorkoutNote || '';
    this.elapsedSeconds = Number(day.workoutElapsedSeconds || 0);
    const persisted = String(day.status || 'PENDING').toUpperCase();
    const isPast = item.date.getTime() < this.today.getTime();
    this.runStatus = persisted === 'COMPLETED'
      ? (day.clientCompletionMode === 'ALREADY_COMPLETED' ? 'ALREADY_COMPLETED' : 'COMPLETED')
      : persisted === 'MISSED' ? 'MISSED'
      : (persisted === 'OVERDUE' || (isPast && ['IN_PROGRESS', 'PAUSED', 'PENDING'].includes(persisted))) ? 'OVERDUE'
      : (persisted === 'IN_PROGRESS' || persisted === 'PAUSED') ? persisted as RunStatus : 'NOT_STARTED';
    this.buildRunData();
    this.showLogCompletedNotice = false;
    this.showMenu = false;
    this.exercisePage = null;
    this.view = 'day';
    // Phone width: the day page is full screen like the mobile pushed page (styles.scss).
    if (!this.previewMode) document.body.classList.add('client-workout-detail-open');
    if (this.runStatus === 'IN_PROGRESS') this.startTimer();
    window.scrollTo({ top: 0 });
  }

  backToList(): void {
    if (this.hasPendingDraft && this.canEditWorkout) this.saveProgress();
    this.stopTimer();
    this.item = null;
    this.exercisePage = null;
    this.view = 'list';
    document.body.classList.remove('client-workout-detail-open');
    this.load();
  }

  private buildRunData(): void {
    const day = this.item!.day;
    const exercises = allExercises(day);
    const logs: any[] = day.clientExerciseLogs || [];
    this.groups = [];
    this.runExercises = [];
    let groupIndex = 0; let i = 0;
    while (i < exercises.length) {
      const id = this.supersetId(exercises[i]);
      let j = i + 1;
      if (id) while (j < exercises.length && this.supersetId(exercises[j]) === id) j += 1;
      groupIndex += 1;
      const members = exercises.slice(i, j);
      const isSuperset = members.length > 1;
      const label = `${groupIndex}`;
      const letters = members.map((_, index) => `${label}${String.fromCharCode(65 + index)}`);
      const group: ExerciseGroup = { label, isSuperset, letters, exercises: [] };
      members.forEach((exercise, index) => {
        const key = isSuperset ? `${label}.${index + 1}` : label;
        const log = logs.find(item => String(item?.exerciseId ?? '') === String(exercise?.id ?? '') || String(item?.displayNumber ?? '') === key);
        const legacy: SetStatus = log?.completed === true ? 'COMPLETED' : log?.skipped === true ? 'MISSED' : 'PENDING';
        const savedSets: any[] = Array.isArray(log?.sets) ? log.sets : [];
        const run: RunExercise = {
          key, displayLabel: isSuperset ? letters[index] : label, exercise,
          completed: log?.completed === true, skipped: log?.skipped === true,
          note: String(log?.note ?? ''), showNote: !!String(log?.note ?? '').trim(),
          sets: (exercise?.sets || []).map((source: any, setIndex: number) => {
            const setNumber = Number(source?.setNumber) || setIndex + 1;
            const saved = savedSets.find(item => Number(item?.setNumber) === setNumber);
            return {
              setNumber,
              reps: this.toInt(saved?.reps) ?? this.toInt(source?.reps),
              duration: this.toInt(saved?.duration) ?? this.toInt(source?.duration),
              weight: this.toNumber(saved?.weight) ?? this.toNumber(source?.weight),
              restMin: this.toInt(saved?.restMin) ?? this.toInt(source?.restMin),
              restSec: this.toInt(saved?.restSec) ?? this.toInt(source?.restSec),
              type: saved?.type != null ? String(saved.type) : this.setType(source),
              status: this.normalizeStatus(saved?.status ?? legacy),
            } as RunSet;
          }),
        };
        this.recalculate(run);
        group.exercises.push(run);
        this.runExercises.push(run);
      });
      this.groups.push(group);
      i = j;
    }
  }

  private toInt(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
  }
  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  private normalizeStatus(value: any): SetStatus {
    const status = String(value || '').trim().toUpperCase();
    return status === 'COMPLETED' || status === 'MISSED' ? status : 'PENDING';
  }
  private setType(set: any): string {
    const raw = set?.type ?? set?.setType ?? set?.workoutSetType ?? set?.typeSet ?? set?.exerciseSetType ?? set?.set_type;
    return this.normalizedType(raw);
  }
  normalizedType(raw: any): string {
    const value = String(raw ?? 'REGULAR').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (value === 'W' || value === 'WARMUP' || value === 'WARM_UP') return 'WARM_UP';
    if (value === 'D' || value === 'DROPSET' || value === 'DROP_SET') return 'DROP_SET';
    if (value === 'F' || value === 'FAILURE') return 'FAILURE';
    return 'REGULAR';
  }

  exerciseStatus(run: RunExercise): string {
    if (!run.sets.length) return run.completed ? 'COMPLETED' : run.skipped ? 'MISSED' : 'PENDING';
    const statuses = run.sets.map(set => set.status);
    if (statuses.every(status => status === 'PENDING')) return 'PENDING';
    if (statuses.every(status => status === 'COMPLETED')) return 'COMPLETED';
    if (statuses.every(status => status === 'MISSED')) return 'MISSED';
    if (statuses.some(status => status === 'PENDING')) return 'IN_PROGRESS';
    return 'PARTIALLY_COMPLETED';
  }

  private recalculate(run: RunExercise): void {
    const status = this.exerciseStatus(run);
    run.completed = status === 'COMPLETED';
    run.skipped = status === 'MISSED';
  }

  count(run: RunExercise, status: SetStatus): number { return run.sets.filter(set => set.status === status).length; }

  get canEditWorkout(): boolean { return ['IN_PROGRESS', 'PAUSED', 'LOG_WORKOUT'].includes(this.runStatus); }
  get isFinished(): boolean { return this.runStatus === 'COMPLETED' || this.runStatus === 'ALREADY_COMPLETED'; }
  get totalSets(): number { return this.runExercises.reduce((sum, run) => sum + run.sets.length, 0); }
  get doneSets(): number { return this.runExercises.reduce((sum, run) => sum + this.count(run, 'COMPLETED'), 0); }
  get missedSets(): number { return this.runExercises.reduce((sum, run) => sum + this.count(run, 'MISSED'), 0); }
  get pendingSets(): number { return this.runExercises.reduce((sum, run) => sum + this.count(run, 'PENDING'), 0); }
  get reviewedExercises(): number { return this.runExercises.filter(run => this.exerciseStatus(run) === 'COMPLETED').length; }
  get progress(): number { return this.totalSets ? Math.min((this.doneSets + this.missedSets) / this.totalSets, 1) : 0; }

  /** First exercise that still has work to do while the session is running. */
  get currentKey(): string | null {
    if (this.runStatus !== 'IN_PROGRESS' && this.runStatus !== 'PAUSED') return null;
    return this.runExercises.find(run => run.sets.length > 0 && this.count(run, 'PENDING') > 0)?.key ?? null;
  }

  get formattedTime(): string {
    const h = Math.floor(this.elapsedSeconds / 3600);
    const m = Math.floor((this.elapsedSeconds % 3600) / 60);
    const s = this.elapsedSeconds % 60;
    return (h === 0 ? [m, s] : [h, m, s]).map(value => String(value).padStart(2, '0')).join(':');
  }

  get dayHeaderTitle(): string { return this.item ? workoutDayTitle(this.item.day, this.fr) : ''; }
  get dayHeaderSubtitle(): string {
    if (!this.item) return '';
    const date = new Intl.DateTimeFormat(this.locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(this.item.date);
    return `${date} · ${this.planLine(this.item)}`;
  }

  get runBadge(): { label: string; color: string } {
    const labels: Record<RunStatus, string> = {
      NOT_STARTED: this.t('Not started', 'Non commencé'), IN_PROGRESS: this.t('In progress', 'En cours'),
      PAUSED: this.t('Paused', 'En pause'), LOG_WORKOUT: this.t('Log workout', 'Enregistrer l’entraînement'),
      OVERDUE: this.t('Overdue', 'En retard'), MISSED: this.t('Missed', 'Manqué'),
      COMPLETED: this.t('Finished', 'Terminée'), ALREADY_COMPLETED: this.t('Log completed', 'Enregistrer comme terminé'),
    };
    const color = this.runStatus === 'OVERDUE' ? '#D99100' : this.runStatus === 'MISSED' ? '#D93A3A'
      : this.runStatus === 'IN_PROGRESS' || this.runStatus === 'LOG_WORKOUT' ? 'var(--yc-primary)'
      : this.runStatus === 'PAUSED' ? '#B57A00' : this.isFinished ? '#1E8E4E' : 'var(--yc-text-secondary)';
    return { label: labels[this.runStatus], color };
  }

  badgeColor(run: RunExercise): string {
    const status = this.exerciseStatus(run);
    return status === 'COMPLETED' ? '#1E8E4E' : status === 'MISSED' ? '#D93A3A'
      : this.currentKey === run.key ? 'var(--yc-primary)' : 'var(--yc-active-bg)';
  }

  isWarmup(run: RunExercise): boolean { return String(run.exercise?.name || '').toLowerCase().includes('warm'); }
  isCardio(run: RunExercise): boolean { return run.exercise?.type === 'CARDIO'; }
  hasVideo(run: RunExercise): boolean { return !!this.videoLink(run); }
  coachNote(run: RunExercise): string | null { return this.clean(run.exercise?.coachNote ?? run.exercise?.notes) ?? this.clean(run.exercise?.exerciseRef?.coachNote); }

  private clean(value: any): string | null {
    const text = String(value ?? '').trim();
    return !text || text.toLowerCase() === 'null' ? null : text;
  }

  formatRest(min: number | null | undefined, sec: number | null | undefined): string | null {
    const m = Number(min || 0); const s = Number(sec || 0);
    if (!m && !s) return null;
    if (m > 0 && !s) return `${m} min`;
    if (!m) return `${s}s`;
    return `${m} min ${s} s`;
  }

  exerciseSummary(run: RunExercise): string {
    const sets: any[] = run.exercise?.sets || [];
    if (!sets.length) return run.exercise?.muscle || '';
    const rest = this.formatRest(this.toInt(sets[0]?.restMin), this.toInt(sets[0]?.restSec));
    const volume = this.exerciseVolume(run.exercise);
    return rest ? `${volume} · ${this.t('Rest', 'Repos')} ${rest}` : volume;
  }

  setTypeChip(set: RunSet): { text: string; color: string } | null {
    switch (this.normalizedType(set.type)) {
      case 'WARM_UP': return { text: this.t('Warm-up', 'Échauf.'), color: '#D97706' };
      case 'DROP_SET': return { text: 'Drop set', color: '#7455D9' };
      case 'FAILURE': return { text: this.t('Failure', 'Échec'), color: '#D93A3A' };
      default: return null;
    }
  }

  /** Number shown for regular sets: warm-up / drop / failure sets are not counted. */
  regularNumber(run: RunExercise, index: number): number {
    return run.sets.slice(0, index + 1).filter(set => this.normalizedType(set.type) === 'REGULAR').length;
  }

  get weightUnit(): string { return this.coachSettings.getWeightUnit(); }

  displayWeight(kg: number | null): string {
    if (kg == null) return '';
    const value = this.coachSettings.convertWeightFromKg(kg);
    if (value == null) return '';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  onWeightInput(set: RunSet, value: string): void {
    const entered = parseFloat(String(value).replace(',', '.'));
    set.weight = Number.isFinite(entered) ? this.coachSettings.convertWeightToKg(entered) : null;
    this.scheduleDraftSave();
  }

  onAmountInput(run: RunExercise, set: RunSet, value: string): void {
    const n = parseInt(String(value), 10);
    if (this.isCardio(run)) set.duration = Number.isFinite(n) ? n : null;
    else set.reps = Number.isFinite(n) ? n : null;
    this.scheduleDraftSave();
  }

  setSetStatus(run: RunExercise, set: RunSet, status: SetStatus): void {
    if (!this.canEditWorkout || this.saving) return;
    set.status = set.status === status ? 'PENDING' : status;
    this.recalculate(run);
    // Rapid taps are grouped into one request.
    this.scheduleDraftSave();
  }

  toggleNote(run: RunExercise): void { run.showNote = !(run.showNote || !!run.note); }
  onNoteInput(): void { this.scheduleDraftSave(); }

  // Run status
  private setRunStatus(status: RunStatus): void {
    this.runStatus = status;
    if (status === 'IN_PROGRESS') { this.startTimer(); this.saveProgress(); }
    else { this.stopTimer(); if (status === 'PAUSED') this.saveProgress(); }
  }

  startWorkout(): void { this.setRunStatus('IN_PROGRESS'); }
  togglePause(): void { this.setRunStatus(this.runStatus === 'IN_PROGRESS' ? 'PAUSED' : 'IN_PROGRESS'); }

  enterLogCompletedMode(): void {
    this.setRunStatus('LOG_WORKOUT');
    this.showLogCompletedInfo();
  }

  private showLogCompletedInfo(): void {
    this.showLogCompletedNotice = true;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.showLogCompletedNotice = false), 5000);
  }

  cancelWorkout(): void {
    this.showMenu = false;
    this.stopTimer();
    this.elapsedSeconds = 0;
    this.runStatus = 'NOT_STARTED';
    this.runExercises.forEach(run => { run.sets.forEach(set => (set.status = 'PENDING')); if (!run.sets.length) { run.completed = false; run.skipped = false; } else this.recalculate(run); });
    this.updateStatus('PENDING');
  }

  markAsMissed(): void { this.updateStatus('MISSED'); }

  finishWorkout(): void {
    const alreadyCompleted = this.runStatus === 'LOG_WORKOUT';
    if (alreadyCompleted && this.pendingSets > 0) { this.showLogCompletedInfo(); return; }
    if (!alreadyCompleted && this.pendingSets > 0) { this.showFinishSheet = true; return; }
    this.stopTimer();
    this.updateStatus('COMPLETED', alreadyCompleted);
  }

  confirmFinish(): void {
    this.showFinishSheet = false;
    this.runExercises.forEach(run => {
      run.sets.forEach(set => { if (set.status === 'PENDING') set.status = 'MISSED'; });
      if (run.sets.length) this.recalculate(run);
    });
    this.stopTimer();
    this.updateStatus('COMPLETED', false);
  }

  get finishPending(): number { return this.pendingSets; }
  get finishPendingText(): string {
    const n = this.pendingSets;
    return this.fr
      ? `${n} série${n > 1 ? 's sont encore en attente et seront marquées' : ' est encore en attente et sera marquée'} comme manquée${n > 1 ? 's' : ''}.`
      : `${n} set${n > 1 ? 's are' : ' is'} still pending and will be marked as missed.`;
  }

  completeRemaining(run: RunExercise): void {
    run.sets.forEach(set => { if (set.status === 'PENDING') set.status = 'COMPLETED'; });
    this.recalculate(run);
    this.scheduleDraftSave();
  }

  askSkip(run: RunExercise): void { this.skipTarget = run; }
  confirmSkip(): void {
    const run = this.skipTarget;
    this.skipTarget = null;
    if (!run) return;
    run.sets.forEach(set => (set.status = 'MISSED'));
    if (!run.sets.length) { run.completed = false; run.skipped = true; } else this.recalculate(run);
    this.scheduleDraftSave();
  }

  // Saving (mobile _saveProgress / _scheduleDraftSave / _updateStatus)
  private payload(status: string, alreadyCompleted: boolean): any {
    const day = this.item!.day;
    return {
      id: day.id,
      status,
      workoutElapsedSeconds: alreadyCompleted ? 0 : this.elapsedSeconds,
      clientCompletionMode: alreadyCompleted ? 'ALREADY_COMPLETED' : 'TRACKED',
      overallWorkoutNote: this.overallNote.trim(),
      clientExerciseLogs: this.runExercises.map(run => ({
        exerciseId: run.exercise?.id,
        displayNumber: run.key,
        completed: run.completed,
        skipped: run.skipped,
        exerciseStatus: this.exerciseStatus(run),
        note: run.note.trim(),
        sets: run.sets.map(set => ({ ...set })),
      })),
      ...(day.dayNumber != null ? { dayNumber: day.dayNumber } : {}),
    };
  }

  private applyToDay(payload: any): void {
    const day = this.item?.day;
    if (!day) return;
    Object.assign(day, {
      status: payload.status, workoutElapsedSeconds: payload.workoutElapsedSeconds,
      clientCompletionMode: payload.clientCompletionMode, overallWorkoutNote: payload.overallWorkoutNote,
      clientExerciseLogs: payload.clientExerciseLogs,
    });
  }

  private saveProgress(): void {
    if (!this.item) return;
    this.hasPendingDraft = false;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    const payload = this.payload('IN_PROGRESS', false);
    this.applyToDay(payload);
    // Not tied to the page: a save sent while leaving it must still reach the server.
    this.workoutDayService.updateWorkoutDay(payload, this.item.plan.id).subscribe({ error: () => undefined });
  }

  scheduleDraftSave(): void {
    if (!this.canEditWorkout) return;
    this.hasPendingDraft = true;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveProgress(), 400);
  }

  private updateStatus(status: 'PENDING' | 'MISSED' | 'COMPLETED', alreadyCompleted = false): void {
    if (this.saving || !this.item) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.hasPendingDraft = false;
    this.saving = true;
    const payload = this.payload(status, alreadyCompleted);
    this.subscriptions.add(this.workoutDayService.updateWorkoutDay(payload, this.item.plan.id).subscribe({
      next: () => {
        this.saving = false;
        this.applyToDay(payload);
        this.runStatus = status === 'COMPLETED' ? (alreadyCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED')
          : status === 'PENDING' ? 'NOT_STARTED' : status;
        this.showToast(status === 'PENDING' ? this.t('Workout cancelled', 'Entraînement annulé')
          : this.t('Workout saved', 'Entraînement enregistré'), 'success');
      },
      error: () => {
        this.saving = false;
        this.showToast(this.t('Unable to save workout. Please try again.', 'Impossible d’enregistrer l’entraînement. Veuillez réessayer.'), 'error');
      },
    }));
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => { if (this.runStatus === 'IN_PROGRESS') this.elapsedSeconds += 1; }, 1000);
  }
  private stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  // -------------------------------------------------------------------------
  // Exercise page (mobile ExerciseDetailScreen)
  // -------------------------------------------------------------------------
  openExercise(run: RunExercise, autoplay = false): void {
    if (this.saving) return;
    this.exercisePage = run;
    this.startedFromExercise = false;
    this.stopVideo();
    if (autoplay && this.hasVideo(run)) this.playVideo();
    window.scrollTo({ top: 0 });
  }

  closeExercise(): void { this.stopVideo(); this.exercisePage = null; }

  private videoLink(run: RunExercise): string | null { return this.clean(run.exercise?.exerciseRef?.videoLink) ?? this.clean(run.exercise?.videoLink ?? run.exercise?.youtubeUrl ?? run.exercise?.videoUrl); }
  youtubeId(run: RunExercise): string | null { const link = this.videoLink(run); return link ? youtubeVideoId(link) : null; }
  uploadedVideo(run: RunExercise): string | null { return this.youtubeId(run) ? null : this.videoLink(run); }

  thumbnail(run: RunExercise): string | null {
    const image = this.clean(run.exercise?.imageUrl ?? run.exercise?.image ?? run.exercise?.thumbnailUrl) ?? this.clean(run.exercise?.exerciseRef?.imageUrl);
    const id = this.youtubeId(run);
    return image ?? (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null);
  }

  playVideo(): void {
    const run = this.exercisePage;
    if (!run) return;
    const id = this.youtubeId(run);
    this.playerUrl = id ? this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`) : null;
    this.playing = true;
  }

  stopVideo(): void { this.playing = false; this.playerUrl = null; }
  youtubeUrl(run: RunExercise): string { return `https://www.youtube.com/watch?v=${this.youtubeId(run)}`; }

  exerciseName(run: RunExercise): string {
    return capitalizeFirst(run.exercise?.name || run.exercise?.exerciseRef?.name || this.t('Exercise', 'Exercice'));
  }

  description(run: RunExercise): string | null {
    const ref = run.exercise?.exerciseRef;
    if (this.clean(ref?.description)) return this.clean(ref?.description);
    if ((this.clean(run.exercise?.coachNote) || this.clean(ref?.coachNote)) && this.clean(run.exercise?.description)) {
      return this.clean(run.exercise?.description);
    }
    return null;
  }

  instructions(run: RunExercise): string[] {
    const parse = (value: any): string[] => Array.isArray(value) ? value.map(String).filter(item => item.trim())
      : String(value ?? '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const own = parse(run.exercise?.instructions);
    return own.length ? own : parse(run.exercise?.exerciseRef?.instructions);
  }

  tags(run: RunExercise): { label: string; background: string; color: string }[] {
    const label = (value: any) => String(value ?? '').trim().split(/[_\s]+/).filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1).toLowerCase()).join(' ');
    return [
      { label: label(run.exercise?.type ?? run.exercise?.exerciseRef?.type), background: '#F1F5F9', color: '#475569' },
      { label: label(this.clean(run.exercise?.muscle) ?? this.clean(run.exercise?.exerciseRef?.muscle)), background: '#E8F4FB', color: '#1F78AD' },
      { label: label(this.clean(run.exercise?.equipment) ?? this.clean(run.exercise?.exerciseRef?.equipment)), background: '#FDF2E2', color: '#B4661C' },
    ].filter(tag => tag.label);
  }

  plannedFact(run: RunExercise): string {
    const sets: any[] = run.exercise?.sets || [];
    const first = sets[0];
    return this.isCardio(run) ? `${first?.duration ?? run.exercise?.duration ?? 0} min` : `${sets.length} × ${first?.reps ?? '—'}`;
  }

  restFact(run: RunExercise): string {
    const first = (run.exercise?.sets || [])[0];
    return first ? (this.formatRest(this.toInt(first.restMin), this.toInt(first.restSec)) ?? '—') : '—';
  }

  get exerciseCanEdit(): boolean { return this.canEditWorkout || this.startedFromExercise; }
  get showStartFromExercise(): boolean { return this.runStatus === 'NOT_STARTED' && !this.startedFromExercise; }

  startFromExercise(): void {
    this.startWorkout();
    this.startedFromExercise = true;
  }

  setDetails(run: RunExercise, set: RunSet, index: number): string {
    const source = (run.exercise?.sets || [])[index] || {};
    const rest = this.formatRest(this.toInt(source.restMin), this.toInt(source.restSec));
    const weight = this.toNumber(source.weight);
    return [
      this.isCardio(run) ? `${source.duration ?? run.exercise?.duration ?? 0} min` : `${source.reps ?? '—'} ${this.t('reps', 'répétitions')}`,
      ...(this.showExerciseWeight && !this.isCardio(run) && (weight ?? 0) > 0 ? [`${this.displayWeight(weight)} ${this.weightUnit}`] : []),
      ...(rest ? [`${this.t('rest time', 'temps de repos')} ${rest}`] : []),
    ].join(' · ');
  }

  exerciseSetTypeLabel(set: RunSet): string | null {
    switch (this.normalizedType(set.type)) {
      case 'WARM_UP': return this.t('Warm up', 'Échauffement');
      case 'DROP_SET': return 'Drop set';
      case 'FAILURE': return this.t('To failure', 'Jusqu’à l’échec');
      default: return null;
    }
  }

  // -------------------------------------------------------------------------
  // PDF of the program (web print preview, mobile "Export PDF")
  // -------------------------------------------------------------------------
  get pdfDays(): { date: Date; day: any }[] {
    if (!this.item) return [];
    return (this.item.plan.workoutDays || []).map((day: any) => ({ date: this.scheduledDate(this.item!.plan, day), day }))
      .sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime());
  }

  pdfExercises(day: any): any[] { return allExercises(day); }
  pdfLabels(day: any): string[] { return this.exerciseLabels({ plan: this.item?.plan, day, date: new Date() }); }
  formatLongDate(date: Date | null): string {
    return date ? new Intl.DateTimeFormat(this.locale, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '—';
  }
  planStart(): Date | null { return planDate(this.item?.plan?.startDate); }
  planEnd(): Date | null { return planDate(this.item?.plan?.endDate); }
  get pdfCoachName(): string {
    const coach = this.item?.plan?.coach || {};
    return `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
  }
  get pdfClientName(): string {
    const client = this.item?.plan?.client || {};
    return `${client.firstName || client.firstname || ''} ${client.lastName || client.lastname || ''}`.trim() || this.t('Client', 'Client');
  }

  downloadPdf(): void {
    const preview = document.querySelector('.cw-pdf-document');
    if (!preview) return;
    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) return;
    const title = (this.item?.plan?.name || 'workout-program').replace(/[<>&"']/g, '');
    win.document.write(`<!doctype html><html><head><title>${title}</title><style>${PDF_PRINT_STYLES}</style></head><body>${preview.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  // -------------------------------------------------------------------------
  private get somethingWentWrong(): string { return this.t('Something went wrong', 'Une erreur est survenue'); }

  showToast(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
    this.toast = { message, tone };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 3500);
  }

  trackByDay = (_: number, item: DayItem) => `${item.plan?.id}-${item.day?.id}-${dateKey(item.date)}`;
  trackByRun = (_: number, run: RunExercise) => run.key;
}

/** Print styles of the program PDF (opened in a new window, then printed / saved as PDF). */
const PDF_PRINT_STYLES = `
  @page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{margin:0;color:#0f1b2d;font-family:Arial,Helvetica,sans-serif}
  .cw-pdf-cover{padding:10mm 4mm}.cw-pdf-brand{color:#0c86c8;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
  .cw-pdf-cover h1{margin:24px 0 8px;font-size:28px}.cw-pdf-cover p{color:#546175;line-height:1.5}
  .cw-pdf-meta{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.cw-pdf-meta div{padding:12px;border:1px solid #e5e7eb;border-radius:8px}
  .cw-pdf-meta small{display:block;color:#7d889b;font-size:9px;text-transform:uppercase}.cw-pdf-meta strong{display:block;margin-top:6px;font-size:12px}
  .cw-pdf-day{margin-top:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid}
  .cw-pdf-day h2{margin:0;padding:9px 12px;background:#0c86c8;color:#fff;font-size:12px}.cw-pdf-day.rest h2{background:#f4f6f9;color:#0f1b2d}
  .cw-pdf-rest{padding:14px;text-align:center;color:#7d889b;font-size:11px;font-style:italic}
  table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:6px 10px;border-top:1px solid #eef1f4;text-align:left}th{color:#7d889b;font-size:9px;text-transform:uppercase}
  .cw-pdf-ex{padding:8px 12px 0;font-size:11px;font-weight:700}.cw-pdf-ex b{display:inline-block;min-width:20px;margin-right:6px;padding:1px 5px;border-radius:4px;background:#e8f3fa;color:#0c86c8;font-size:9px;text-align:center}
`;
