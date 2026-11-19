import { CopyDaysModalComponent } from '@shared/program-copy/copy-days-modal.component';
import { ClientProgramDatesComponent } from '@shared/components/client-program-dates/client-program-dates.component';
import { workoutDayActive } from '@shared/models/client-day-activity';
import { CopiedDayBannerComponent } from '@shared/program-copy/copied-day-banner.component';
import { ProgramCopyController } from '@shared/program-copy/program-copy-controller';
import { ProgramDayClipboardService } from '@shared/program-copy/program-day-clipboard.service';
import { copyWorkoutDayContent } from '@shared/program-copy/program-day-copy';
import {Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject, NgZone} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DragDropModule, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { canMoveExercise, groupMembers, groupTypeOf, isGroupStart, measureOf, warmupCount } from '@shared/models/exercise-groups';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import { workoutDayState } from '@shared/models/workout-publication';
import { ProgramDayState, ProgramSummary, firstWorkoutIssue, programDaysError, refusedDaysMessage, workoutDayStatus, workoutSummary } from '@shared/models/program-days';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { EmptyDaysModalComponent } from '@shared/components/empty-days-modal/empty-days-modal.component';
import { OverlapChoice, ProgramOverflowComponent } from '@shared/components/program-overflow/program-overflow.component';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ToastService } from 'app/service/toast.service';
import { Client, ClientService } from 'app/service/client.service';
import { WorkoutService } from 'app/service/workout.service';
import { isLockedError, isPlanLocked, todayIso } from '@shared/models/program-schedule';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { LeavesUnsavedChanges, SavedContent, warnBeforeUnload } from '@config/guard/unsaved-changes.guard';
import { WorkoutAiDraft } from 'app/service/workout-ai.service';
import { ExerciseHistoryService } from 'app/service/exercise-history.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ExerciseProgressDetailComponent } from '@shared/components/exercise-progress-detail/exercise-progress-detail.component';
import { ExerciseDifficulty, ExerciseMetric, ExerciseSummary, HistorySession, exerciseHistoryKey, sessionBelowPlan, sessionDoneLine, sessionFromDayLog, sessionPlannedLine, sessionForOccurrence } from '@shared/models/exercise-history';
import { findExerciseLog } from 'app/components/clients/profil-client/client-activity/client-activity';

/**
 * Sous un exercice d'une séance de client, prêt à afficher :
 * - DAY : ce jour est déjà fait, c'est ce que le client a fait CE jour-là ;
 * - LAST : ce jour n'est pas encore fait, c'est la dernière fois AVANT ce jour.
 */
interface LastTime {
  kind: 'DAY' | 'LAST';
  date: string;
  /** « 12, 12, 12 rép. » ; vide si le client n'a rien noté. */
  done: string;
  /** Montré seulement si le client a fait moins que prévu. */
  planned: string | null;
  below: boolean;
  /** DAY : exercice passé par le client, ou pas noté du tout. */
  state: 'DONE' | 'SKIPPED' | 'NOT_LOGGED';
  difficulty: ExerciseDifficulty | null;
}

/** Filled in by the display (photos, videos of the library exercise): not a change of the coach. */
const EXERCISE_DISPLAY_FIELDS = new Set(['image', 'imageUrl', 'thumbnailUrl', 'photoUrl', 'videoUrl', 'videoLink']);

/**
 * The one workout editor (backlog-programmes.md ED-01): a library program, or a client's program when the route has
 * the client (`clients/create-workout/:idClient`): then each day has its date, a finished or stopped program opens
 * read-only, and a longer program asks before it reaches the next one.
 */
@Component({
  selector: 'app-create-workout',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule, TranslateModule, SectionLoaderComponent, EmptyDaysModalComponent, ProgramOverflowComponent, CopyDaysModalComponent, CopiedDayBannerComponent, ClientProgramDatesComponent, ExerciseProgressDetailComponent],
  templateUrl: './create-workout.component.html',
  styleUrls: ['./create-workout.component.scss'],
})
export class CreateWorkoutComponent implements OnInit, AfterViewInit, OnDestroy, LeavesUnsavedChanges {
  /** Bottom of the app header, measured: the toolbar sticks right under it (no strip where the content shows). */
  isEditMode = false;
  isVisibleToOthers = false;
  durationWeeks = 4;
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  collapsedWeeks = new Set<number>(Array.from({length: 11}, (_, index) => index + 2));
  planSettingsCollapsed = true;
  mobileStructureOpen = false;
  savedAt: Date | null = null;
  savingDraft = false;
  saveError = '';
  /** Short "saved" confirmation on the toolbar button, right after a successful save. */
  private headerObserver: ResizeObserver | null = null;
  private destroyed = false;
  /** Edit mode: the plan is loading (the page shows its own loader), or could not be loaded. */
  planLoading = false;
  planLoadError = false;
  private readonly embedUrls = new Map<string, SafeResourceUrl>();
  private returnUrl: string | null = null;
  private assignOnly = false;
  activeVideoExerciseId: string | null = null;
  previewExercise: Exercise | null = null;
  @ViewChild('mobileDaysScroller')
  mobileDaysScroller?: ElementRef<HTMLElement>;

  /** The client of a client program (route `clients/...`), null for a library program. */
  readonly clientId: string | null;
  client: Client | null = null;
  startDate = todayIso();
  endDate = '';
  /** A stopped or finished client program: it opens, it is not changed (backlog-programmes.md A9). */
  readOnly = false;
  stoppedAt: string | null = null;
  /** The end saved on the server: a longer program is checked against the next one (backlog-programmes.md P9). */
  savedEnd: string | null = null;
  duplicating = false;
  @ViewChild(ProgramOverflowComponent) overflow?: ProgramOverflowComponent;
  /** The program as last loaded or saved: leaving with something else asks first. */
  private readonly savedContent = new SavedContent();

  constructor(
    public facade: WorkoutPlanFacade,
    public programSchedule: ProgramScheduleService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private host: ElementRef<HTMLElement>,
    private location: Location,
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private toast: ToastService,
    private dayClipboard: ProgramDayClipboardService,
    private confirmDialog: ConfirmDialogService,
    private exerciseHistories: ExerciseHistoryService,
    private historySettings: CoachSettingsService,
    private zone: NgZone,
  ) {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.assignOnly = this.route.snapshot.queryParamMap.get('assignOnly') === '1';
    this.clientId = this.route.snapshot.paramMap.get('idClient');
    this.loadLastTimes();
  }

  // ---------------------------------------------------------------------------
  // « La dernière fois » : ce que ce client a fait la dernière fois sur chaque exercice (séance d'un client seulement).
  // ---------------------------------------------------------------------------
  private lastSummaries = new Map<string, ExerciseSummary>();
  /** Par exercice de la séance (le même exercice deux fois a deux lignes) ; recalculé si le jour change. */
  private lastTimes = new WeakMap<object, { day: WorkoutDay | null; value: LastTime | null }>();
  /** L'exercice dont le coach regarde tout l'historique. */
  historyExercise: string | null = null;

  private loadLastTimes(): void {
    if (!this.clientId) return;
    // Sans historique, l'éditeur marche comme avant : une erreur ici ne se montre pas.
    this.exerciseHistories.summary(this.clientId).subscribe({
      next: data => {
        this.lastSummaries = new Map(data.exercises.map(item => [item.key, item]));
        this.lastTimes = new WeakMap();
      },
      error: () => {},
    });
  }

  /**
   * L'unité de l'exercice tel que l'éditeur l'affiche (cardio en minutes, exercice au temps en secondes) :
   * le serveur range parfois le cardio en secondes, d'où « —, —, — s » avant.
   */
  private displayMetric(exercise: any, history: ExerciseSummary | undefined, session: HistorySession): ExerciseMetric {
    if (exercise?.type === 'CARDIO') return 'MIN';
    if (measureOf(exercise) === 'TIME') return 'SEC';
    const weighted = history?.metric === 'WEIGHT'
      || session.sets.some(set => (set.weight ?? 0) > 0 || (set.plannedWeight ?? 0) > 0)
      || (exercise?.sets || []).some((set: any) => Number(set?.weight) > 0);
    return weighted ? 'WEIGHT' : 'REPS';
  }

  private describe(kind: 'DAY' | 'LAST', session: HistorySession, metric: ExerciseMetric): LastTime {
    const fr = this.translate.currentLang !== 'en';
    const words = {
      fr,
      weight: (kg: number) => {
        const value = Math.round((this.historySettings.convertWeightFromKg(kg) ?? 0) * 10) / 10;
        const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
        return `${fr ? text.replace('.', ',') : text} ${this.historySettings.getWeightUnit()}`;
      },
    };
    const below = sessionBelowPlan(session, metric);
    return {
      kind,
      date: new Date(`${session.date}T00:00:00`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }),
      done: sessionDoneLine(session, metric, words),
      // Le prévu n'est utile que si le client a fait moins : sinon « Comme prévu ».
      planned: below ? sessionPlannedLine(session, metric, words) : null,
      below,
      state: 'DONE',
      difficulty: session.difficulty,
    };
  }

  /** Le jour ouvert est déjà commencé ou fait par le client : on montre CE jour, pas « la dernière fois ». */
  private get selectedDayDone(): boolean {
    return this.isClientMode && workoutDayActive(this.selectedDay);
  }

  /** Ce que le client a noté ce jour-là pour cet exercice. */
  private dayResult(exercise: any): LastTime | null {
    const day: any = this.selectedDay;
    const list: any[] = day?.workoutSessions?.[0]?.exercises ?? [];
    const index = Math.max(list.indexOf(exercise), 0);
    const log = findExerciseLog(day?.clientExerciseLogs || [], exercise, index);
    const date = String(day?.date || todayIso()).slice(0, 10);
    const empty = (state: LastTime['state']): LastTime => ({
      kind: 'DAY', state, done: '', planned: null, below: false, difficulty: null,
      date: new Date(`${date}T00:00:00`).toLocaleDateString(this.translate.currentLang !== 'en' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }),
    });
    if (log?.skipped) return empty('SKIPPED');
    const session = log ? sessionFromDayLog(log, exercise?.sets || [], date) : null;
    if (!session || !session.sets.some(set => set.status !== 'PENDING')) {
      // « J'ai déjà fait la séance » sans détail : tout est fait comme prévu.
      return String(day?.status || '').toUpperCase() === 'COMPLETED' ? { ...empty('DONE'), done: this.ht('Done', 'Fait') } : empty('NOT_LOGGED');
    }
    const result = this.describe('DAY', session, this.displayMetric(exercise, this.lastSummaries.get(exerciseHistoryKey(exercise?.name)), session));
    return { ...result, difficulty: session.difficulty };
  }

  lastTime(exercise: { name?: string } | null | undefined): LastTime | null {
    if (!this.clientId || !exercise) return null;
    const cached = this.lastTimes.get(exercise);
    if (cached !== undefined && cached.day === this.selectedDay) return cached.value;
    let value: LastTime | null;
    if (this.selectedDayDone) {
      value = this.dayResult(exercise);
    } else {
      const key = exerciseHistoryKey(exercise?.name);
      const history = this.lastSummaries.get(key);
      const session = history ? sessionForOccurrence(history.last, this.occurrenceInSession(exercise, key)) : null;
      // « Dernière fois » = avant ce jour : jamais ce jour-là ni un jour d'après.
      const dayDate = String(this.selectedDay?.date || '').slice(0, 10);
      const before = !!session && (!dayDate || session.date < dayDate);
      value = before ? this.describe('LAST', session!, this.displayMetric(exercise, history, session!)) : null;
    }
    this.lastTimes.set(exercise, { day: this.selectedDay, value });
    return value;
  }

  /** Le rang de cet exercice parmi les exercices du même nom dans la séance (1 = le premier). */
  private occurrenceInSession(exercise: unknown, key: string): number {
    const list: { name?: string }[] = this.selectedDay?.workoutSessions?.[0]?.exercises ?? [];
    let rank = 0;
    for (const item of list) {
      if (exerciseHistoryKey(item?.name) === key) rank++;
      if (item === exercise) return Math.max(rank, 1);
    }
    return 1;
  }

  /** Petit texte de l'éditeur dans la langue du coach (sans passer par les fichiers de traduction). */
  ht(en: string, fr: string): string { return this.translate.currentLang === 'en' ? en : fr; }

  difficultyText(value: ExerciseDifficulty | null): string {
    return value === 'EASY' ? this.ht('Easy', 'Facile') : value === 'HARD' ? this.ht('Hard', 'Dur') : value === 'GOOD' ? this.ht('Just right', 'Bien') : '';
  }

  /** « Copier vers… », « Dupliquer la semaine », « Copier le jour » / « Coller sur… » of the day rail. */
  readonly copy = new ProgramCopyController<WorkoutDay>(this.dayClipboard, 'workout', {
    days: () => this.days,
    selectedDay: () => this.selectedDay,
    isFilled: (day) => !['EMPTY', 'GAP'].includes(this.dayRailState(day)),
    // A client's past days, and the days they already did, keep what the client saw and logged.
    isLocked: (day) => this.isClientMode && ((!!day.date && String(day.date).slice(0, 10) < todayIso()) || workoutDayActive(day)),
    apply: (source, target) => copyWorkoutDayContent(source, target),
    // The JSON copy kept for « Annuler » splits the session from its list: relink them.
    restored: (day) => (day.session = day.workoutSessions?.[0] ?? null),
    planName: () => this.workoutPlan?.name || '',
    translate: (key, params) => this.translate.instant(key, params),
    notify: (title, message, undo) =>
      this.toast.show({
        type: 'success',
        title,
        message,
        duration: undo ? 8000 : 5000,
        actions: undo ? [{ label: this.translate.instant('COPY_DAYS.UNDO'), run: undo, icon: 'fa-undo' }] : undefined,
      }),
    readOnly: () => this.readOnly,
  });

  get isClientMode(): boolean {
    return !!this.clientId;
  }

  get clientName(): string {
    return this.client ? `${this.client.firstName || ''} ${this.client.lastName || ''}`.trim() : '';
  }

  /** Days the client sees once saved (the filled and rest days up to the last filled one). */
  get visibleDaysCount(): number {
    return this.programSummary.lastNonEmpty;
  }

  get workoutPlan(): WorkoutPlan {
    return this.facade.plan;
  }

  set workoutPlan(value: WorkoutPlan) {
    this.facade.setPlan(value);
  }

  get days(): WorkoutDay[] {
    return this.facade.days;
  }

  get selectedDay(): WorkoutDay | null {
    return this.facade.selectedDay;
  }

  set selectedDay(v: WorkoutDay | null) {
    this.facade.selectedDay = v;
  }

  toggleMobileStructure(): void {
    this.mobileStructureOpen = !this.mobileStructureOpen;
  }

  closeMobileStructure(): void {
    this.mobileStructureOpen = false;
  }

  /** Back to the list the program belongs to: the public templates for a template, else « Programmes ». */
  private get libraryUrl(): string {
    return this.isVisibleToOthers || this.facade.plan?.isWorkoutPlanTemplate ? '/workout/public-templates' : '/workout/program-library';
  }

  goBack(): void {
    if (this.returnUrl?.startsWith('/')) {
      void this.router.navigateByUrl(this.returnUrl);
      return;
    }
    if (this.clientId) {
      void this.router.navigate(['/clients/profil-client', this.clientId], { queryParams: { tab: 'workouts' } });
      return;
    }
    void this.router.navigate([this.libraryUrl]);
  }

  get selectedWorkoutSession(): WorkoutSession | null {
    if (!this.selectedDay || this.selectedDay.isRestDay || this.selectedDay.restDay) {
      return null;
    }

    if (!this.selectedDay.workoutSessions?.length) {
      const session: WorkoutSession = {
        name: '',
        exercises: [],
        totalSets: 0,
        totalReps: 0,
        totalDurationMin: 0,
      };

      this.selectedDay.workoutSessions = [session];
      this.selectedDay.session = session;
    }

    return this.selectedDay.workoutSessions[0];
  }

  get showPlanDescription(): boolean {
    return this.facade.showPlanDescription;
  }

  get showRestNotes(): boolean {
    return this.facade.showRestNotes;
  }

  get isExerciseModalOpen(): boolean {
    return this.facade.isExerciseModalOpen ?? false;
  }

  get showExerciseSelector(): boolean {
    return this.facade.showExerciseSelector;
  }

  get loading(): boolean {
    return this.facade.loading;
  }

  get exerciseDatabase(): Exercise[] {
    return this.facade.exerciseDatabase;
  }

  get page(): number {
    return this.facade.page;
  }

  get totalPages(): number {
    return this.facade.totalPages;
  }

  get searchQuery(): string {
    return this.facade.searchQuery;
  }

  set searchQuery(v: string) {
    this.facade.searchQuery = v;
  }

  get muscleFilter(): string {
    return this.facade.muscleFilter;
  }

  set muscleFilter(v: string) {
    this.facade.muscleFilter = v;
  }

  get equipmentFilter(): string {
    return this.facade.equipmentFilter;
  }

  set equipmentFilter(v: string) {
    this.facade.equipmentFilter = v;
  }

  get typeFilter(): string {
    return this.facade.typeFilter;
  }

  set typeFilter(v: string) {
    this.facade.typeFilter = v;
  }

  get editingExerciseDescription(): string | null {
    return this.facade.editingExerciseDescription;
  }

  get exerciseStep(): 'list' | 'detail' {
    return this.facade.exerciseStep;
  }

  set exerciseStep(value: 'list' | 'detail') {
    this.facade.exerciseStep = value;
  }

  get exerciseSearch(): string {
    return this.facade.exerciseSearch;
  }

  set exerciseSearch(value: string) {
    this.facade.exerciseSearch = value;
  }

  get filteredExercises(): Exercise[] {
    return this.facade.filteredExercises;
  }

  get selectedExercise(): any {
    return this.facade.selectedExercise;
  }

  set selectedExercise(value: any) {
    this.facade.selectedExercise = value;
  }

  get hoveringExerciseId(): string | null {
    return this.facade.hoveringExerciseId;
  }

  set hoveringExerciseId(value: string | null) {
    this.facade.hoveringExerciseId = value;
  }


  private canCreateTemplateValue?: boolean;

  // Read by the template at every change detection: the roles (token decoding) are computed once per page.
  get canCreateTemplate(): boolean {
    this.canCreateTemplateValue ??= this.computeCanCreateTemplate();
    return this.canCreateTemplateValue;
  }

  private computeCanCreateTemplate(): boolean {
    const roles = this.getCurrentRoles();

    return roles.some((role) =>
      role === 'ROLE_ADMIN' ||
      role === 'ADMIN' ||
      role === 'ROLE_SUPER_ADMIN' ||
      role === 'SUPER_ADMIN'
    );
  }

  private getCurrentRoles(): string[] {
    const roles = new Set<string>();

    const cleanRole = (value: any): string => {
      return String(value)
        .replace(/\\/g, '')
        .replace(/"/g, '')
        .replace(/'/g, '')
        .trim()
        .toUpperCase();
    };

    const addRole = (value: any) => {
      if (!value) return;

      if (Array.isArray(value)) {
        value.forEach(addRole);
        return;
      }

      if (typeof value === 'object') {
        ['authority', 'name', 'role', 'value'].forEach((key) => {
          if (value[key]) addRole(value[key]);
        });
        return;
      }

      String(value)
        .replace('[', '')
        .replace(']', '')
        .replace(/"/g, '')
        .replace(/'/g, '')
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map(cleanRole)
        .filter(Boolean)
        .forEach((role) => roles.add(role));
    };

    const currentToken =
      sessionStorage.getItem('access_token') ||
      sessionStorage.getItem('accessToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('id_token') ||
      sessionStorage.getItem('idToken');

    const payload = this.decodeJwtPayload(currentToken);

    if (payload) {
      addRole(payload.authorities);
      addRole(payload.roles);
      addRole(payload.scope);
      addRole(payload.scp);
      addRole(payload.auth);
      addRole(payload.realm_access?.roles);

      const resourceAccess = payload.resource_access;
      if (resourceAccess && typeof resourceAccess === 'object') {
        Object.values(resourceAccess).forEach((entry: any) =>
          addRole(entry?.roles)
        );
      }
    }

    if (roles.size === 0) {
      try {
        addRole(JSON.parse(sessionStorage.getItem('roles') || '[]'));
      } catch {
        addRole(sessionStorage.getItem('roles'));
      }

      try {
        addRole(JSON.parse(sessionStorage.getItem('authorities') || '[]'));
      } catch {
        addRole(sessionStorage.getItem('authorities'));
      }
    }

    return Array.from(roles);
  }

  private decodeJwtPayload(token: string | null): any {
    if (!token || !token.includes('.')) return null;

    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );

      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    const requestedName = (this.route.snapshot.queryParamMap.get('name') || '').trim();
    const requestedDuration = Number(this.route.snapshot.queryParamMap.get('durationWeeks'));
    const requestedTemplate = this.route.snapshot.queryParamMap.get('template') === '1';
    this.durationWeeks = this.normalizeDurationWeeks(requestedDuration || this.durationWeeks);

    if (planId) {
      this.isEditMode = true;
      this.facade.initEdit();
      // Opened from the library (or just created): the program is already here, shown at once.
      const handedOver = history.state?.workoutPlan as WorkoutPlan | undefined;
      if (handedOver?.id === planId && Array.isArray(handedOver.workoutDays)) {
        this.applyLoadedPlan(handedOver);
      } else {
        this.loadPlan(planId);
      }
    } else {
      this.isEditMode = false;
      this.facade.initCreate();
      this.facade.setDurationWeeks(this.durationWeeks);
      this.isVisibleToOthers = !this.clientId && requestedTemplate && this.canCreateTemplate;
      this.facade.setPlan({
        ...this.facade.plan,
        name: requestedName || this.facade.plan.name,
        isWorkoutPlanTemplate: this.isVisibleToOthers,
      });
      const aiDraft = history.state?.aiDraft as WorkoutAiDraft | undefined;
      if (aiDraft?.plan) {
        this.applyAiDraft(aiDraft);
      }
      if (this.clientId) {
        // The start chosen in the creation window (A2).
        this.startDate = this.route.snapshot.queryParamMap.get('startDate') || this.startDate;
        this.refreshDates();
      } else if (history.state?.autoCreate && requestedName) {
        this.createInBackground();
      }
      if (aiDraft?.plan) {
        // IA-54: an AI draft is not saved yet: leaving the page asks first, like any unsaved change.
        this.savedContent.remember('');
      } else {
        this.savedContent.rememberAfterDisplay(() => this.content());
      }
    }

    if (this.clientId) {
      this.clientService.getClientById(this.clientId).subscribe({
        next: (client) => (this.client = client),
        error: () => (this.client = null),
      });
    }

    // The exercises are only needed when the panel opens: fetch them once the page is shown, in the background.
    this.scheduleExercisePrefetch();
  }

  /** IA-33 / IA-53: the program comes from the AI, not saved yet (banner and health warnings above it). */
  aiDraftShown = false;
  aiWarnings: string[] = [];

  /** IA-33: puts the AI draft in the editor, as a new program (the first « Enregistrer » creates it). */
  private applyAiDraft(draft: WorkoutAiDraft): void {
    // Not handed over again on a reload of this page (the draft was never saved).
    history.replaceState({ ...history.state, aiDraft: null }, '');
    this.facade.applyPlanForEdit({
      ...draft.plan,
      id: undefined,
      client: this.facade.plan.client,
      coach: this.facade.plan.coach,
      isWorkoutPlanTemplate: this.isVisibleToOthers,
    });
    this.durationWeeks = this.normalizeDurationWeeks(Math.ceil((this.days.length || 7) / 7));
    this.aiDraftShown = true;
    this.aiWarnings = draft.warnings || [];
  }

  /**
   * "New program" from the library: the program is created as soon as the editor opens, without waiting for the
   * server to show the page. Saving stays disabled until it exists (no second program); on failure, "Save draft"
   * creates it.
   */
  private createInBackground(): void {
    // A reload of this page must not create it a second time (the first request may already have done it).
    history.replaceState({...history.state, autoCreate: false}, '');
    this.isEditMode = true;
    this.savingDraft = true;
    this.facade.createPlan().subscribe({
      next: (created) => {
        // Page left meanwhile: the shared facade and the address now belong to another page.
        if (this.destroyed) return;
        this.savingDraft = false;
        this.facade.setPlan({...this.facade.plan, id: created.id});
        // The program's own address, without reloading the editor: a reload or a shared link opens this program.
        this.location.replaceState(`/workout/edit-workout/${created.id}`, '', history.state);
      },
      error: () => {
        if (this.destroyed) return;
        this.savingDraft = false;
        this.saveError = this.translate.instant('WORKOUT_SAVE_ERROR');
      },
    });
  }

  retryLoadPlan(): void {
    const planId = this.route.snapshot.paramMap.get('id');
    if (planId) this.loadPlan(planId);
  }

  private loadPlan(planId: string): void {
    this.planLoading = true;
    this.planLoadError = false;
    this.facade.loadPlanForEdit(planId).subscribe({
        next: (plan: WorkoutPlan) => this.applyLoadedPlan(plan),
        error: (err) => {
          console.error('Erreur lors du chargement du plan :', err);
          this.planLoading = false;
          this.planLoadError = true;
        },
      });
  }

  private applyLoadedPlan(plan: WorkoutPlan): void {
    this.planLoading = false;
    this.facade.applyPlanForEdit(plan);
    this.isVisibleToOthers = this.canCreateTemplate && !this.clientId
      ? Boolean(plan.isWorkoutPlanTemplate)
      : false;
    this.facade.setPlan({
      ...this.facade.plan,
      isWorkoutPlanTemplate: this.isVisibleToOthers,
    });
    this.durationWeeks = this.normalizeDurationWeeks(
      Math.ceil((this.days.length || 28) / 7)
    );
    if (this.clientId) {
      this.readOnly = isPlanLocked(plan as any, todayIso());
      this.stoppedAt = (plan as any)?.stoppedAt || null;
      if (plan.startDate) this.startDate = String(plan.startDate).slice(0, 10);
      this.refreshDates();
      this.facade.syncPlanDays();
      this.savedEnd = this.endDate || null;
    }
    this.openRequestedDay();
    this.savedContent.rememberAfterDisplay(() => this.content());
  }

  /** What the coach edits (name, settings, days, sessions, exercises and their sets), to compare with the saved one. */
  private content(): string {
    return JSON.stringify({
      name: this.workoutPlan.name || '',
      details: this.workoutPlan.details || '',
      template: Boolean(this.isVisibleToOthers),
      days: this.days.map((day) => ({
        rest: Boolean(day.isRestDay || day.restDay),
        description: day.description || '',
        // The empty session the display adds to a day without one is not content.
        sessions: (day.workoutSessions || [])
          .filter((session) => session.exercises?.length || session.name?.trim())
          .map((session) => ({ name: session.name || '', exercises: session.exercises || [] })),
      })),
    }, (key, value) => (EXERCISE_DISPLAY_FIELDS.has(key) ? undefined : value));
  }

  hasUnsavedChanges(): boolean {
    return !this.readOnly && this.savedContent.changed(this.content());
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    warnBeforeUnload(event, this);
  }

  /** « Semaine 2 · Jour 3 »: the days are numbered 1 to 7 in each week. */
  private weekDayLabel(day: WorkoutDay): string {
    const index = this.days.indexOf(day);
    return this.translate.instant('WEEK_DAY_LABEL', { week: Math.floor(index / 7) + 1, day: (index % 7) + 1 });
  }

  /** The client did something in the program: its dates no longer move (« Modifier les dates », rule D1). */
  get clientStarted(): boolean {
    return this.isClientMode && this.days.some((day) => workoutDayActive(day));
  }

  /** New dates from « Modifier les dates » (or its « Annuler »): the days follow, the server already has them. */
  onClientDatesMoved(dates: { start: string; end: string }): void {
    this.startDate = dates.start;
    this.refreshDates();
    this.facade.syncPlanDays();
    this.savedEnd = this.endDate || null;
  }

  /** Opened on a day (the client's « Programmes » tab, « Remplir »): that day, its week open. */
  private openRequestedDay(): void {
    const dayNumber = Number(this.route.snapshot.queryParamMap.get('day'));
    const day = dayNumber > 0 ? this.days[dayNumber - 1] : null;
    if (day) this.selectDay(day);
  }

  /** A client program: each day gets its date from the start, in the order of the days (library programs have none). */
  private refreshDates(): void {
    if (!this.clientId || !this.startDate) return;
    const [year, month, date] = this.startDate.split('-').map(Number);
    const locale = this.dateLocale();
    this.days.forEach((day, index) => {
      const current = new Date(year, month - 1, date + index);
      day.date = this.toIsoDate(current);
      day.dayOfWeek = current.toLocaleDateString(locale, { weekday: 'long' });
      day.dayNumber = index + 1;
      day.title = `Day ${(index % 7) + 1}`;
      day.name = day.title;
    });
    this.endDate = this.days.length ? this.days[this.days.length - 1].date || this.startDate : this.startDate;
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private dateLocale(): string {
    return this.translate.currentLang?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
  }

  /** Short date of a day in the structure rail (client programs). */
  getRailDateLabel(day: WorkoutDay): string {
    if (!day.date) return '';
    const date = new Date(`${String(day.date).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(this.dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /** The toolbar sticks right under the app header, whatever its real height (it changes with the screen and the
   *  header content), so the page never shows through between them. */
  ngAfterViewInit(): void {
    const header = document.querySelector<HTMLElement>('app-header .navbar, app-header nav');
    if (!header) return;
    const measure = () => {
      const height = Math.round(header.getBoundingClientRect().height);
      if (height > 0) this.host.nativeElement.style.setProperty('--wb-app-header', `${height}px`);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.headerObserver = new ResizeObserver(measure);
      this.headerObserver.observe(header);
    }
  }

  private scheduleExercisePrefetch(): void {
    const run = () => this.facade.prefetchExercises();
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (win.requestIdleCallback) win.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 300);
  }

  get totalExercises(): number {
    return this.facade.totalExercises;
  }

  get workoutWeeks(): { label: string; days: WorkoutDay[] }[] {
    const weeks: { label: string; days: WorkoutDay[] }[] = [];

    for (let index = 0; index < this.days.length; index += 7) {
      weeks.push({
        label: `WEEK ${Math.floor(index / 7) + 1}`,
        days: this.days.slice(index, index + 7),
      });
    }

    return weeks;
  }

  getWeekDisplayLabel(label: string): string {
    const number = label.match(/\d+/)?.[0] || label;
    return this.translate.instant('WEEK_NUMBER', { number });
  }

  getDayDisplayTitle(day: WorkoutDay): string {
    const title = day.title || day.name || '';
    const match = title.match(/^Day\s+(\d+)$/i);
    return match ? this.translate.instant('DAY_NUMBER', { number: match[1] }) : title;
  }

  getWeekWorkoutCount(days: WorkoutDay[]): number {
    return days.filter((day) =>
      this.getDayExerciseCount(day) > 0
    ).length;
  }

  getDayBuilderStatus(day: WorkoutDay): 'EMPTY' | 'READY' | 'REST_DAY' {
    return workoutDayState(day);
  }

  /** Days summary (last filled day, gaps), computed once per change detection: the rail asks it for every day. */
  private summaryCache: ProgramSummary | null = null;

  ngDoCheck(): void {
    this.summaryCache = null;
  }

  get programSummary(): ProgramSummary {
    return this.summaryCache ??= workoutSummary(this.days);
  }

  /**
   * State shown on a day of the rail (backlog-programmes.md R3/R4): filled, rest, to fix (an error), empty, or empty
   * in the middle of the program (to fill or to mark as rest before saving).
   */
  dayRailState(day: WorkoutDay): ProgramDayState | 'GAP' {
    const state = workoutDayStatus(day);
    if (state !== 'EMPTY') return state;
    return this.days.indexOf(day) + 1 < this.programSummary.lastNonEmpty ? 'GAP' : 'EMPTY';
  }

  /** Filled and rest days of a week. */
  getWeekReadyCount(days: WorkoutDay[]): number {
    return days.filter((day) => this.getDayBuilderStatus(day) !== 'EMPTY').length;
  }

  getSelectedWeekNumber(): number {
    const index = Math.max(0, this.days.indexOf(this.selectedDay!));
    return Math.floor(index / 7) + 1;
  }

  getDayExerciseCount(day: WorkoutDay): number {
    const sessions = day.workoutSessions?.length
      ? day.workoutSessions
      : (day.session ? [day.session] : []);
    return sessions.reduce(
      (total, session) => total + (session.exercises?.length || 0),
      0
    );
  }

  getDayDateLabel(day: WorkoutDay): string {
    if (!day.date) return '';
    const date = new Date(`${day.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(this.translate.currentLang?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  isWeekCollapsed(weekLabel: string): boolean {
    return this.collapsedWeeks.has(Number(weekLabel.replace(/\D/g, '')));
  }

  toggleWeek(weekLabel: string): void {
    const weekNumber = Number(weekLabel.replace(/\D/g, ''));
    if (this.collapsedWeeks.has(weekNumber)) {
      this.collapsedWeeks.delete(weekNumber);
    } else {
      this.collapsedWeeks.add(weekNumber);
    }
  }

  allWeeksExpanded(): boolean {
    return this.workoutWeeks.every((_, index) => !this.collapsedWeeks.has(index + 1));
  }

  toggleAllWeeks(): void {
    if (this.allWeeksExpanded()) {
      for (let i = 1; i <= this.workoutWeeks.length; i++) {
        this.collapsedWeeks.add(i);
      }
    } else {
      this.collapsedWeeks.clear();
    }
  }

  getWeekDateRange(week: { days: WorkoutDay[] }): string {
    const dates = week.days
      .filter(d => d.date)
      .map(d => new Date(`${d.date}T00:00:00`))
      .filter(d => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length) return '';
    const fmt = (d: Date) =>
      d.toLocaleDateString(this.translate.currentLang?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
    return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
  }

  getSelectedDayDateLabel(): string {
    if (!this.selectedDay?.date) return '';

    const date = new Date(`${this.selectedDay.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString(this.translate.currentLang?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private normalizeDurationWeeks(value: number): number {
    return Math.max(1, Math.min(Number(value) || 4, 52));
  }

  onDurationWeeksChange(value: number) {
    const nextWeeks = this.normalizeDurationWeeks(value);
    const currentWeeks = this.normalizeDurationWeeks(Math.ceil((this.days.length || 1) / 7));

    if (nextWeeks < currentWeeks) {
      this.pendingDurationWeeks = nextWeeks;
      this.pendingDurationRemovedDays = this.days.length - nextWeeks * 7;
      this.durationWeeks = currentWeeks;
      return;
    }

    this.applyDurationWeeks(nextWeeks);
  }

  confirmDurationReduction() {
    if (!this.pendingDurationWeeks) return;
    const nextWeeks = this.pendingDurationWeeks;
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
    this.applyDurationWeeks(nextWeeks);
    if (this.saveAfterDuration) {
      this.saveAfterDuration = false;
      this.savePlan();
    }
  }

  cancelDurationReduction() {
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
    // « Modifier le programme » : le reste est déjà appliqué, on l'enregistre avec l'ancienne durée.
    if (this.saveAfterDuration) {
      this.saveAfterDuration = false;
      this.savePlan();
    }
  }

  // ---------- « Modifier le programme » (programme déjà créé) ----------

  planEditOpen = false;
  planEdit = { name: '', details: '', weeks: 4, visible: false };
  planEditError = '';
  /** La durée réduite attend la confirmation (jours retirés) avant l'enregistrement. */
  private saveAfterDuration = false;

  /** Ouvre la fenêtre avec les valeurs actuelles : rien ne change tant que le coach n'enregistre pas. */
  openPlanEdit() {
    this.planEdit = {
      name: this.workoutPlan.name || '',
      details: this.workoutPlan.details || '',
      weeks: this.durationWeeks,
      visible: this.isVisibleToOthers,
    };
    this.planEditError = '';
    this.planEditOpen = true;
    setTimeout(() => document.getElementById('npPlanEditName')?.focus());
  }

  closePlanEdit() {
    this.planEditOpen = false;
  }

  savePlanEdit() {
    const name = this.planEdit.name.trim();
    if (!name) {
      this.planEditError = 'PLAN_EDIT_NAME_REQUIRED';
      document.getElementById('npPlanEditName')?.focus();
      return;
    }
    this.workoutPlan.name = name;
    this.workoutPlan.details = this.planEdit.details.trim();
    this.facade.showPlanDescription = !!this.workoutPlan.details;
    if (this.canCreateTemplate && !this.isClientMode) this.isVisibleToOthers = this.planEdit.visible;
    this.planEditOpen = false;

    const weeks = this.normalizeDurationWeeks(this.planEdit.weeks);
    if (weeks !== this.durationWeeks) {
      this.onDurationWeeksChange(weeks);
      // Moins de semaines : la confirmation des jours retirés s'affiche, l'enregistrement suit sa réponse.
      if (this.pendingDurationWeeks) {
        this.saveAfterDuration = true;
        return;
      }
    }
    this.savePlan();
  }

  private applyDurationWeeks(weeks: number) {
    this.durationWeeks = this.normalizeDurationWeeks(weeks);
    this.facade.setDurationWeeks(this.durationWeeks);
    this.refreshDates();
  }

  trackByDay = (index: number, d: WorkoutDay) => d.id;
  trackByWeek = (index: number, week: {label: string}) => week.label;
  trackByExercise = (_: number, ex: Exercise) => ex.id;

  selectDay(d: WorkoutDay) {
    this.facade.selectDay(d);
    const weekIndex = this.workoutWeeks.findIndex(week => week.days.some(day => day.id === d.id));
    if (weekIndex >= 0) this.collapsedWeeks.delete(weekIndex + 1);
  }

  addDay() {
    this.facade.addDay();
    this.refreshDates();
  }

  duplicateSelectedDay() {
    this.facade.duplicateSelectedDay();
    this.refreshDates();
  }

  /** The following days move up by one: always asked. */
  async deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    if (this.days.length <= 1) return;
    const confirmed = await this.confirmDialog.ask({
      title: 'CONFIRM_ACTION.DELETE_DAY_TITLE',
      text: 'CONFIRM_ACTION.DELETE_DAY_TEXT',
      params: { label: this.weekDayLabel(d) },
      confirm: 'DELETE',
      icon: 'trash-2',
    });
    if (!confirmed || !this.days.includes(d)) return;
    this.facade.deleteDay(d);
    this.refreshDates();
  }

  togglePlanDescription() {
    this.facade.showPlanDescription = !this.facade.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.facade.selectedDay) {
      this.facade.selectedDay.showDescription =
        !this.facade.selectedDay.showDescription;
    }
  }

  toggleRestNotes() {
    this.facade.showRestNotes = !this.facade.showRestNotes;
  }

  async toggleRestDay() {
    const day = this.selectedDay;
    if (!day) return;
    // A rest day has no session: the exercises of the day are removed, so it is asked first.
    if (!day.isRestDay && workoutDayStatus(day) !== 'EMPTY') {
      const confirmed = await this.confirmDialog.ask({
        title: 'CONFIRM_ACTION.REST_DAY_TITLE',
        text: 'CONFIRM_ACTION.REST_DAY_TEXT',
        params: { label: this.weekDayLabel(day) },
        confirm: 'CONFIRM_ACTION.REST_DAY_CONFIRM',
      });
      if (!confirmed || this.selectedDay !== day) return;
    }

    this.selectedDay.isRestDay = !this.selectedDay.isRestDay;
    this.selectedDay.restDay = this.selectedDay.isRestDay;

    if (this.selectedDay.isRestDay) {
      this.activeVideoExerciseId = null;
      this.facade.closeExerciseSelector();
      this.selectedDay.workoutSessions = [];
      this.selectedDay.session = null;
    } else {
      if (
        !this.selectedDay.workoutSessions ||
        this.selectedDay.workoutSessions.length === 0
      ) {
        const newSession: WorkoutSession = {
          name: 'Main Session',
          exercises: [],
          totalSets: 0,
          totalReps: 0,
          totalDurationMin: 0,
        };

        this.selectedDay.workoutSessions = [newSession];
        this.selectedDay.session = newSession;
      } else {
        this.selectedDay.session = this.selectedDay.workoutSessions[0];
      }
    }
  }

  openExerciseSelector() {
    // Already fetched in the background: the panel opens with its list.
    this.facade.openExerciseSelector();
  }

  closeExerciseSelector() {
    this.facade.closeExerciseSelector();
  }

  closeExerciseModal() {
    this.facade.closeExerciseModal();
  }

  filterExercises() {
    this.facade.filterExercises();
  }

  showExerciseDetail(ex: Exercise) {
    this.facade.showExerciseDetail(ex);
  }

  addExerciseToSession() {
    this.facade.addExerciseToSession();
  }

  onFilterChange() {
    this.facade.onFilterChange();
  }

  nextPage() {
    this.facade.nextPage();
  }

  prevPage() {
    this.facade.prevPage();
  }

  goToExercisePage(targetPage: number) {
    this.facade.goToPage(targetPage);
  }

  get exercisePageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index);
  }

  handleSelectExercise(ex: Exercise) {
    this.facade.handleSelectExercise(ex);
  }

  isExerciseAdded(ex: Exercise): boolean {
    return this.facade.isExerciseAdded(ex);
  }

  isExerciseInSession(ex: Exercise): boolean {
    return this.facade.isExerciseInSession(ex);
  }

  isInSuperset(i: number) {
    return this.facade.isInSuperset?.(i) ?? false;
  }

  isSecondOfSuperset(i: number) {
    return this.facade.isSecondOfSuperset?.(i) ?? false;
  }

  isSupersetPair(i: number) {
    return this.facade.isSupersetPair?.(i) ?? false;
  }

  canShowSupersetButton(i: number) {
    return this.facade.canShowSupersetButton?.(i) ?? false;
  }

  toggleSuperset(i: number) {
    this.facade.toggleSuperset?.(i);
  }

  handleRemoveExercise(exId: string) {
    if (this.activeVideoExerciseId === exId) {
      this.activeVideoExerciseId = null;
    }

    this.facade.handleRemoveExercise?.(exId);
  }

  onDropDay(event: CdkDragDrop<WorkoutDay[]>) {
    if (this.readOnly) return;
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.refreshDates();
  }

  // ---------- Glisser-déposer : un exercice seul, un exercice dans son groupe, ou tout un groupe ----------
  // Dès qu'on appuie sur une poignée ☰, la liste se replie en lignes (un superset / circuit = une seule ligne) :
  // on voit toute la séance, un trait bleu montre où l'élément va tomber, les places interdites n'en ont pas.

  /** 'units' : on déplace un exercice seul ou un groupe entier ; 'members' : un exercice à l'intérieur de son groupe. */
  sortMode: 'units' | 'members' | null = null;
  private sortGroupId: string | null = null;
  private dragActive = false;
  /** Les lignes que l'on peut glisser, dans l'ordre de la page : en-tête de groupe ('head') ou exercice ('ex'). */
  private sortRows: { kind: 'head' | 'ex'; i: number }[] = [];
  /** Téléphone / tablette : on garde le doigt un instant avant d'attraper (sinon on déplace en voulant défiler). */
  readonly dragDelay = { touch: 300, mouse: 0 };
  /** Espaces vides ajoutés pendant le glisser quand la page ne peut pas défiler assez
   *  pour garder l'élément attrapé sous le pointeur (la liste repliée est bien plus courte). */
  sortSpacerTop = 0;
  sortSpacerBottom = 0;
  private readonly cdr = inject(ChangeDetectorRef);

  private get dayExercises(): Exercise[] {
    return this.selectedDay?.workoutSessions?.[0]?.exercises ?? [];
  }

  /** Appui sur une poignée ☰ : la liste passe en lignes avant que le geste commence. */
  beginSort(mode: 'units' | 'members', i: number, ev?: Event) {
    if (this.readOnly || this.dragActive) return;
    if (ev instanceof MouseEvent && ev.button !== 0) return;
    const list = this.dayExercises;
    if (!list[i]) return;
    const item = (ev?.target as HTMLElement | null)?.closest('.cdk-drag') as HTMLElement | null;
    const before = item?.getBoundingClientRect().top;
    this.groupMenuAt = null;
    this.sortMode = mode;
    this.sortGroupId = mode === 'members' ? list[i].supersetGroupId ?? null : null;
    this.sortRows = [];
    list.forEach((ex, index) => {
      if (isGroupStart(list, index)) this.sortRows.push({ kind: 'head', i: index });
      if (mode === 'members' || !ex.supersetGroupId) this.sortRows.push({ kind: 'ex', i: index });
    });
    // La liste se replie tout de suite (avant que le geste commence) ; on garde l'élément sous le pointeur.
    if (item && before != null) {
      this.cdr.detectChanges();
      this.keepUnderPointer(item, before);
    }
  }

  /** Défile la page pour que l'élément attrapé reste sous le pointeur ; sinon un espace vide en haut ou en bas. */
  private keepUnderPointer(item: HTMLElement, before: number) {
    const scroller = this.scrollParent(item);
    for (let attempt = 0; attempt < 3; attempt++) {
      const error = item.getBoundingClientRect().top - before;
      if (Math.abs(error) < 1) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const target = scroller.scrollTop + error;
      const clamped = Math.max(0, Math.min(max, target));
      scroller.scrollTop = clamped;
      const rest = target - clamped;
      if (Math.abs(rest) < 1) continue;
      if (rest < 0) this.sortSpacerTop += -rest; // page tout en haut : l'espace vide pousse l'élément vers le bas
      else this.sortSpacerBottom += rest; // page tout en bas : on lui donne de la place pour défiler
      this.cdr.detectChanges();
    }
  }

  private scrollParent(el: HTMLElement): HTMLElement {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }

  onDragStarted() {
    this.dragActive = true;
  }

  /** Filet de sécurité : la liste se déplie toujours à la fin du geste. */
  onDragEnded() {
    setTimeout(() => {
      if (this.dragActive) this.endSort();
    });
  }

  /** Appui relâché sans avoir glissé : la liste se déplie. */
  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  @HostListener('document:touchcancel')
  onPointerReleased() {
    if (this.sortMode && !this.dragActive) this.endSort();
  }

  private endSort() {
    this.sortMode = null;
    this.sortGroupId = null;
    this.dragActive = false;
    this.sortRows = [];
    this.sortSpacerTop = 0;
    this.sortSpacerBottom = 0;
  }

  private rowOf(data: { kind: 'head' | 'ex'; i: number } | null | undefined): number {
    return data ? this.sortRows.findIndex((r) => r.kind === data.kind && r.i === data.i) : -1;
  }

  /** Les places permises pour la ligne `from` (bornes comprises). */
  private allowedRows(from: number): { min: number; max: number } {
    const rows = this.sortRows;
    const list = this.dayExercises;
    if (this.sortMode === 'members') {
      const own = rows
        .map((r, k) => (r.kind === 'ex' && list[r.i]?.supersetGroupId === this.sortGroupId ? k : -1))
        .filter((k) => k >= 0);
      return own.length ? { min: Math.min(...own), max: Math.max(...own) } : { min: from, max: from };
    }
    // Un exercice seul ou un groupe : partout, sauf que l'échauffement reste en haut (ses lignes sont les premières).
    const warm = warmupCount(list);
    return from < warm ? { min: 0, max: warm - 1 } : { min: warm, max: rows.length - 1 };
  }

  /** Le trait bleu ne s'affiche qu'aux places permises. */
  sortPredicate = (index: number, drag: CdkDrag): boolean => {
    const from = this.rowOf(drag.data);
    if (from < 0) return false;
    const { min, max } = this.allowedRows(from);
    return index >= min && index <= max;
  };

  onDropExercise(event: CdkDragDrop<Exercise[]>) {
    const list = this.dayExercises;
    const rows = this.sortRows;
    const mode = this.sortMode;
    const from = event.previousIndex;
    const to = event.currentIndex;
    if (this.readOnly || !mode || !list.length || !rows[from] || !rows[to]) {
      this.endSort();
      return;
    }

    const before = [...list];
    const refused = this.refusedText(event, from);
    const { min, max } = this.allowedRows(from);
    let moved = false;
    if (from !== to && to >= min && to <= max) {
      let next: Exercise[];
      if (mode === 'units') {
        const units = rows.map((r) => (r.kind === 'head' ? groupMembers(list, r.i) : [list[r.i]]));
        moveItemInArray(units, from, to);
        next = units.flat();
      } else {
        next = [...list];
        moveItemInArray(next, rows[from].i, rows[to].i);
      }
      // Dernière vérification : même liste, aucun groupe coupé.
      const ok = next.length === list.length && next.every((ex) => list.includes(ex))
        && (mode === 'units' || canMoveExercise(list, rows[from].i, rows[to].i));
      if (ok) {
        list.splice(0, list.length, ...next);
        moved = true;
      }
    }

    const movedEx = before[rows[from].i];
    const movedGroup = rows[from].kind === 'head';
    this.endSort();
    if (refused) this.showMoveToast(refused, moved ? before : null);
    else if (moved) this.showMoveToast(this.translate.instant('DRAG_MOVED'), before);
    if (moved) {
      this.dismissDragTip();
      this.scrollToExercise(movedEx, movedGroup);
    }
  }

  /** Lâché hors des places permises : on dit pourquoi au lieu de ne rien faire en silence. */
  private refusedText(event: CdkDragDrop<Exercise[]>, from: number): string | null {
    const host = event.container.element.nativeElement as HTMLElement;
    const items = Array.from(host.querySelectorAll(':scope > .cdk-drag')) as HTMLElement[];
    const { min, max } = this.allowedRows(from);
    if (items.length !== this.sortRows.length || !items[min] || !items[max]) return null;
    const top = items[min].getBoundingClientRect().top;
    const bottom = items[max].getBoundingClientRect().bottom;
    const y = event.dropPoint?.y;
    if (y == null || (y >= top - 12 && y <= bottom + 12)) return null;
    const list = this.dayExercises;
    if (this.sortMode === 'members') {
      const circuit = groupTypeOf(list[this.sortRows[from].i]) === 'CIRCUIT';
      return this.translate.instant(circuit ? 'DRAG_REFUSED_CIRCUIT' : 'DRAG_REFUSED_SUPERSET');
    }
    return this.translate.instant(from < warmupCount(list) ? 'DRAG_REFUSED_WARMUP_STAY' : 'DRAG_REFUSED_WARMUP');
  }

  /** Après le déplacement, la liste se déplie : on garde l'élément déplacé à l'écran. */
  private scrollToExercise(ex: Exercise | undefined, group: boolean) {
    if (!ex?.id) return;
    setTimeout(() => {
      const selector = group && ex.supersetGroupId ? `[data-grp-head="${ex.supersetGroupId}"]` : `[data-exid="${ex.id}"]`;
      (document.querySelector(selector) as HTMLElement | null)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
  }

  /** Une ligne d'un groupe replié : « Circuit · 4 exercices ». */
  groupSummary(i: number): string {
    const list = this.dayExercises;
    const type = this.translate.instant(groupTypeOf(list[i]) === 'CIRCUIT' ? 'WKGRP_CIRCUIT' : 'WKGRP_SUPERSET');
    return this.translate.instant('WKGRP_SUMMARY', { type, n: groupMembers(list, i).length });
  }

  // ---------- « Déplacé · Annuler » (5 s) ----------

  moveToast: { text: string; undo: boolean } | null = null;
  private undoOrder: { list: Exercise[]; order: Exercise[] } | null = null;
  private moveToastTimer: ReturnType<typeof setTimeout> | null = null;

  private showMoveToast(text: string, before: Exercise[] | null) {
    this.undoOrder = before ? { list: this.dayExercises, order: before } : null;
    this.moveToast = { text, undo: !!before };
    if (this.moveToastTimer) clearTimeout(this.moveToastTimer);
    this.moveToastTimer = setTimeout(() => {
      this.moveToast = null;
      this.undoOrder = null;
    }, 5000);
  }

  undoMove() {
    const undo = this.undoOrder;
    if (undo && undo.list === this.dayExercises) {
      undo.list.splice(0, undo.list.length, ...undo.order);
      // « Annuler » retire aussi un exercice glissé depuis la bibliothèque : les totaux suivent.
      const session = this.selectedDay?.workoutSessions?.[0];
      if (session) this.facade.recomputeSession(session);
    }
    this.undoOrder = null;
    this.moveToast = null;
    if (this.moveToastTimer) clearTimeout(this.moveToastTimer);
  }

  // ---------- Menu « ⋮ » du groupe : Monter / Descendre (pour qui préfère ne pas glisser) ----------

  groupMenuAt: number | null = null;

  toggleGroupMenu(i: number, ev: Event) {
    ev.stopPropagation();
    this.dayMenuOpen = false;
    this.groupMenuAt = this.groupMenuAt === i ? null : i;
  }

  moveGroupBy(i: number, direction: -1 | 1) {
    this.groupMenuAt = null;
    if (this.readOnly || !this.facade.canMoveGroupAt(i, direction)) return;
    const list = this.dayExercises;
    const before = [...list];
    const ex = list[i];
    this.facade.moveGroupAt(i, direction);
    this.showMoveToast(this.translate.instant('DRAG_MOVED'), before);
    this.scrollToExercise(ex, true);
  }

  // ---------- Astuce affichée une seule fois ----------

  private dragTipDismissed = (() => {
    try {
      return localStorage.getItem('yc.tip.dragGroups') === '1';
    } catch {
      return false;
    }
  })();

  get showDragTip(): boolean {
    return !this.readOnly && !this.dragTipDismissed && this.dayExercises.length >= 2;
  }

  dismissDragTip() {
    if (this.dragTipDismissed) return;
    this.dragTipDismissed = true;
    try {
      localStorage.setItem('yc.tip.dragGroups', '1');
    } catch {
      /* navigation privée : l'astuce reviendra, ce n'est pas grave */
    }
  }

  // ---------- Glisser un exercice de la bibliothèque dans la séance ----------
  // Glisser fait maison (souris seulement), à part du tri ☰ (CDK) : une carte nette suit la souris,
  // une place en pointillés s'ouvre dans la séance, la carte s'y pose en douceur.
  // Actif quand la bibliothèque est une colonne à côté de la séance (≥ 768 px). Sur téléphone, le « + » reste le seul moyen.
  // Les mouvements de souris tournent hors d'Angular : on ne relance l'affichage que quand la place change.

  private readonly libDragMedia = (() => {
    try {
      return window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    } catch {
      return null;
    }
  })();

  private readonly reducedMotion = (() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  /** Exercice de la bibliothèque en cours de glisser. */
  libDrag: Exercise | null = null;
  /** Place où il tomberait (la place en pointillés), null quand la souris est hors de la séance. */
  libDropIndex: number | null = null;
  /** La carte qui suit la souris. */
  libGhost: { name: string; sub: string; thumb: string | null } | null = null;
  /** L'exercice qui vient d'arriver : il clignote une fois. */
  justAddedId: string | null = null;

  @ViewChild('libGhostEl') private libGhostEl?: ElementRef<HTMLElement>;

  private libPress: { ex: Exercise; x: number; y: number; source: HTMLElement; offX: number; offY: number } | null = null;
  private libPointer = { x: 0, y: 0 };
  private libFrame = 0;
  private libLanding = false;
  private libScroller: HTMLElement | null = null;
  private justAddedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Pour un ajout simple seulement : en mode « ajouter au groupe / à l'échauffement », le « + » suffit. */
  get canDragFromLibrary(): boolean {
    return !this.readOnly && !this.facade.addTargetGroup && !this.facade.addTargetWarmup && !!this.libDragMedia?.matches;
  }

  /** Appui sur une ligne de la bibliothèque : le glisser commence après 5 px de mouvement (un clic reste un clic). */
  onLibPointerDown(ex: Exercise, ev: PointerEvent) {
    if (!this.canDragFromLibrary || ev.pointerType !== 'mouse' || ev.button !== 0 || this.libLanding) return;
    if ((ev.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    ev.preventDefault(); // pas de sélection de texte pendant le geste
    const source = ev.currentTarget as HTMLElement;
    const r = source.getBoundingClientRect();
    this.libPress = {
      ex, x: ev.clientX, y: ev.clientY, source,
      offX: Math.min(ev.clientX - r.left, 260), offY: Math.min(ev.clientY - r.top, 40),
    };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.onLibPointerMove);
      document.addEventListener('pointerup', this.onLibPointerUp);
      document.addEventListener('pointercancel', this.onLibCancel);
      document.addEventListener('keydown', this.onLibKey);
    });
  }

  private onLibPointerMove = (ev: PointerEvent) => {
    const press = this.libPress;
    if (!press) return;
    this.libPointer = { x: ev.clientX, y: ev.clientY };
    if (!this.libDrag) {
      if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 5) return;
      this.startLibDrag(press);
    }
    if (!this.libFrame) this.libFrame = requestAnimationFrame(this.libTick);
  };

  private startLibDrag(press: NonNullable<CreateWorkoutComponent['libPress']>) {
    const ex = press.ex;
    this.zone.run(() => {
      this.libDrag = ex;
      this.libDropIndex = null;
      this.libGhost = {
        name: ex.name || '',
        sub: ex.type || 'Exercise',
        thumb: this.getExerciseThumbnail(ex) || null,
      };
    });
    this.libScroller = this.findScroller(this.host.nativeElement.querySelector('.wkex') as HTMLElement | null);
    document.body.classList.add('yc-lib-dragging');
    this.placeGhost();
  }

  /** Une image par écran : la carte suit, la page défile près des bords, la place se met à jour. */
  private libTick = () => {
    this.libFrame = 0;
    if (!this.libDrag || this.libLanding) return;
    this.placeGhost();
    const scrolled = this.autoScroll();
    const zone = this.host.nativeElement.querySelector('.wkex') as HTMLElement | null;
    let index: number | null = null;
    if (zone) {
      const r = zone.getBoundingClientRect();
      const { x, y } = this.libPointer;
      if (x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24) {
        index = this.libDropSpot(zone, y);
      }
    }
    if (index !== this.libDropIndex) this.zone.run(() => (this.libDropIndex = index));
    if (scrolled) this.libFrame = requestAnimationFrame(this.libTick);
  };

  private placeGhost() {
    const el = this.libGhostEl?.nativeElement;
    const press = this.libPress;
    if (!el || !press) return;
    el.style.transform = `translate3d(${this.libPointer.x - press.offX}px, ${this.libPointer.y - press.offY}px, 0)`;
  }

  /** Près du haut ou du bas de la zone qui défile, la page défile toute seule. */
  private autoScroll(): boolean {
    const box = this.libScroller;
    const top = box ? box.getBoundingClientRect().top : 0;
    const bottom = box ? box.getBoundingClientRect().bottom : window.innerHeight;
    const y = this.libPointer.y;
    const edge = 70;
    let speed = 0;
    if (y < top + edge) speed = -Math.ceil(((top + edge - y) / edge) * 14);
    else if (y > bottom - edge) speed = Math.ceil(((y - (bottom - edge)) / edge) * 14);
    if (!speed) return false;
    if (box) {
      const before = box.scrollTop;
      box.scrollTop += speed;
      return box.scrollTop !== before;
    }
    const before = window.scrollY;
    window.scrollBy(0, speed);
    return window.scrollY !== before;
  }

  private findScroller(from: HTMLElement | null): HTMLElement | null {
    for (let el = from?.parentElement; el && el !== document.body; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
    }
    return null;
  }

  private onLibPointerUp = () => {
    if (!this.libDrag) {
      this.clearLibDrag(); // simple clic : rien ne bouge
      return;
    }
    if (this.libDropIndex === null) this.flyBack();
    else this.land();
  };

  private onLibCancel = () => (this.libDrag ? this.flyBack() : this.clearLibDrag());

  private onLibKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && this.libDrag) this.flyBack();
  };

  /** Lâché dans la séance : la carte se pose dans la place en pointillés, puis l'exercice y est ajouté. */
  private land() {
    const ex = this.libDrag;
    const index = this.libDropIndex;
    if (!ex || index === null) return;
    this.libLanding = true;
    const slot = this.host.nativeElement.querySelector('.wklib-slot') as HTMLElement | null;
    const el = this.libGhostEl?.nativeElement;
    const finish = () => this.zone.run(() => {
      const before = [...this.dayExercises];
      this.clearLibDrag();
      const added = this.facade.insertExerciseAt(ex, index);
      if (!added) return;
      this.showMoveToast(this.translate.instant('LIB_DROP_ADDED', { name: added.name }), before);
      this.flashAdded(added);
    });
    if (!slot || !el || this.reducedMotion) {
      finish();
      return;
    }
    const r = slot.getBoundingClientRect();
    el.classList.add('is-landing');
    el.style.transform = `translate3d(${r.left + 12}px, ${r.top + 8}px, 0)`;
    setTimeout(finish, 200);
  }

  /** Lâché ailleurs (ou Échap) : la carte revient à sa ligne et disparaît. */
  private flyBack() {
    const press = this.libPress;
    const el = this.libGhostEl?.nativeElement;
    this.libLanding = true;
    if (this.libDropIndex !== null) this.zone.run(() => (this.libDropIndex = null));
    if (!press || !el || this.reducedMotion || !press.source.isConnected) {
      this.zone.run(() => this.clearLibDrag());
      return;
    }
    const r = press.source.getBoundingClientRect();
    el.classList.add('is-returning');
    el.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    setTimeout(() => this.zone.run(() => this.clearLibDrag()), 220);
  }

  private clearLibDrag() {
    document.removeEventListener('pointermove', this.onLibPointerMove);
    document.removeEventListener('pointerup', this.onLibPointerUp);
    document.removeEventListener('pointercancel', this.onLibCancel);
    document.removeEventListener('keydown', this.onLibKey);
    if (this.libFrame) cancelAnimationFrame(this.libFrame);
    this.libFrame = 0;
    document.body.classList.remove('yc-lib-dragging');
    this.libPress = null;
    this.libDrag = null;
    this.libDropIndex = null;
    this.libGhost = null;
    this.libLanding = false;
    this.libScroller = null;
  }

  /** Le nouvel exercice s'éclaire une seconde, à l'écran. */
  private flashAdded(ex: Exercise) {
    this.justAddedId = ex.id ?? null;
    if (this.justAddedTimer) clearTimeout(this.justAddedTimer);
    this.justAddedTimer = setTimeout(() => (this.justAddedId = null), 1400);
    this.scrollToExercise(ex, false);
  }

  /**
   * La place la plus proche du pointeur : entre deux exercices seuls ou groupes entiers,
   * jamais dans un superset / circuit, jamais au-dessus de l'échauffement.
   * La place en pointillés déjà ouverte pousse la suite vers le bas : on mesure comme si elle n'était pas là,
   * sinon la place sauterait d'un cran à chaque image.
   */
  private libDropSpot(host: HTMLElement, y: number): number {
    const list = this.dayExercises;
    const slot = host.querySelector('.wklib-slot') as HTMLElement | null;
    const open = slot ? this.libDropIndex : null;
    const slotSpace = slot ? slot.offsetHeight + (parseFloat(getComputedStyle(slot).marginTop) || 0) : 0;
    const shift = (start: number, v: number) => (open !== null && start >= open ? v - slotSpace : v);
    const find = (selector: string) => host.querySelector(selector) as HTMLElement | null;
    const cardOf = (ex: Exercise) => find(`[data-exid="${CSS.escape(String(ex.id))}"]`);
    const headOf = (ex: Exercise) => (ex.supersetGroupId ? find(`[data-grp-head="${CSS.escape(String(ex.supersetGroupId))}"]`) : null);

    // Chaque bloc (exercice seul ou groupe entier, avec son pied « Ajouter au circuit ») : son haut et son bas à l'écran.
    const units: { start: number; top: number; bottom: number }[] = [];
    for (let i = 0; i < list.length; ) {
      const end = list[i].supersetGroupId ? groupMembers(list, i).length + i - 1 : i;
      const top = (headOf(list[i]) ?? cardOf(list[i]))?.getBoundingClientRect().top;
      let lastEl = cardOf(list[end]);
      const foot = lastEl?.nextElementSibling as HTMLElement | null;
      if (foot?.classList.contains('wkgrp-foot')) lastEl = foot;
      const bottom = lastEl?.getBoundingClientRect().bottom;
      if (top != null && bottom != null) units.push({ start: i, top: shift(i, top), bottom: shift(i, bottom) });
      i = end + 1;
    }

    const warm = warmupCount(list);
    const spots: { index: number; y: number }[] = [];
    units.forEach((u, k) => {
      if (u.start < warm) return;
      const prev = units[k - 1];
      spots.push({ index: u.start, y: prev ? (prev.bottom + u.top) / 2 : u.top });
    });
    const last = units[units.length - 1];
    spots.push({ index: list.length, y: last ? last.bottom + 24 : y });

    let best = spots[0];
    for (const s of spots) if (Math.abs(s.y - y) < Math.abs(best.y - y)) best = s;
    return best.index;
  }

  handleAddSet(exId: string) {
    this.facade.handleAddSet?.(exId);
  }

  handleRemoveSet(exId: string, si: number) {
    this.facade.handleRemoveSet?.(exId, si);
  }

  handleExerciseDescriptionChange(exId: string, v: string) {
    this.facade.handleExerciseDescriptionChange?.(exId, v);
  }

  setEditingExerciseDescription(exId: string | null) {
    this.facade.editingExerciseDescription = exId;
  }

  handleSetChange(exId: string, si: number, field: string, value: string) {
    this.facade.handleSetChange?.(exId, si, field, value);
  }

  preventInvalidNumericKey(event: KeyboardEvent, allowDecimal = false): void {
    if (['e', 'E', '+', '-'].includes(event.key)
      || (!allowDecimal && ['.', ','].includes(event.key))) {
      event.preventDefault();
    }
  }

  openSetTypeKey: string | null = null;

  toggleSetTypeMenu(exerciseId: string, setIndex: number, event?: MouseEvent) {
    event?.stopPropagation();
    const key = `${exerciseId}-${setIndex}`;
    this.openSetTypeKey = this.openSetTypeKey === key ? null : key;
  }

  isSetTypeMenuOpen(exerciseId: string, setIndex: number): boolean {
    return this.openSetTypeKey === `${exerciseId}-${setIndex}`;
  }

  selectSetType(exerciseId: string, setIndex: number, type: 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE') {
    this.facade.handleSetChange(exerciseId, setIndex, 'type', type);
    this.openSetTypeKey = null;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.openSetTypeKey = null;
    this.dayMenuOpen = false;
    this.groupMenuAt = null;
  }

  // ---------- Pistes 5 à 7 : résumé de séance, « Tout replier », nom de séance dans le titre ----------

  /** Exercices repliés (une ligne chacun), par id. */
  private collapsedIds = new Set<string>();

  isCollapsed(ex: { id?: string }): boolean {
    // Pendant un glisser, toute la liste est en lignes.
    if (this.sortMode) return true;
    return !!ex?.id && this.collapsedIds.has(ex.id);
  }

  toggleCollapse(ex: { id?: string }) {
    if (!ex?.id) return;
    if (this.collapsedIds.has(ex.id)) this.collapsedIds.delete(ex.id);
    else this.collapsedIds.add(ex.id);
  }

  allCollapsed(): boolean {
    const list = this.selectedWorkoutSession?.exercises || [];
    return list.length > 0 && list.every((ex) => this.isCollapsed(ex));
  }

  toggleCollapseAll() {
    const list = this.selectedWorkoutSession?.exercises || [];
    if (this.allCollapsed()) list.forEach((ex) => ex.id && this.collapsedIds.delete(ex.id));
    else list.forEach((ex) => ex.id && this.collapsedIds.add(ex.id));
  }

  /** « 3 × 12 · 60 kg · repos 90 s » (des écarts : « 3 × 8–12 »). */
  exerciseLine(ex: Exercise): string {
    const sets = ex.sets || [];
    if (!sets.length) return this.ht('No set', 'Aucune série');
    const range = (values: (number | null | undefined)[]) => {
      const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
      if (!nums.length) return '';
      const min = Math.min(...nums), max = Math.max(...nums);
      return min === max ? `${min}` : `${min}–${max}`;
    };
    const cardio = ex.type === 'CARDIO';
    const timed = this.facade.measureOf(ex) === 'TIME';
    const value = range(sets.map((st) => this.facade.singleValue(ex, st)));
    const unit = cardio ? ' min' : timed ? ' s' : '';
    const parts = [`${sets.length} × ${value || '—'}${value ? unit : ''}`];
    const weight = range(sets.map((st) => st.weight));
    if (weight && !cardio && this.facade.shouldShowWeightField()) parts.push(`${weight} ${this.facade.getWeightUnitLabel()}`);
    if (!ex.supersetGroupId) {
      const rest = range(sets.map((st) => this.facade.restSeconds(st)));
      if (rest) parts.push(`${this.ht('rest', 'repos')} ${rest} s`);
    }
    return parts.join(' · ');
  }

  /** « 6 exercices · 18 séries · ~50 min » : durée = travail (≈ 3 s par rep, temps, minutes de cardio) + repos. */
  sessionSummaryText(): string | null {
    const list = this.selectedWorkoutSession?.exercises || [];
    if (!list.length) return null;
    let sets = 0;
    let seconds = 0;
    for (const ex of list) {
      for (const st of ex.sets || []) {
        sets++;
        const v = Number(this.facade.singleValue(ex, st)) || 0;
        seconds += ex.type === 'CARDIO' ? v * 60 : this.facade.measureOf(ex) === 'TIME' ? v : (v || 10) * 3;
        seconds += this.facade.restSeconds(st);
      }
    }
    const minutes = Math.max(5, Math.round(seconds / 60 / 5) * 5);
    return this.ht(
      `${list.length} exercise${list.length > 1 ? 's' : ''} · ${sets} set${sets > 1 ? 's' : ''} · ~${minutes} min`,
      `${list.length} exercice${list.length > 1 ? 's' : ''} · ${sets} série${sets > 1 ? 's' : ''} · ~${minutes} min`,
    );
  }

  /** Le champ du nom prend la largeur de son texte (le titre reste sur une ligne). */
  nameFieldSize(name: string | null | undefined): number {
    const text = (name || '').trim() || this.translate.instant('WORKOUT_NAME');
    return Math.min(Math.max(text.length, 6), 40);
  }

  /** ⧉ d'une semaine (colonne de gauche) : elle devient la semaine choisie, puis la fenêtre « Dupliquer la semaine » s'ouvre. */
  duplicateWeek(week: { days: WorkoutDay[] }, ev?: Event) {
    ev?.stopPropagation();
    const days = week?.days || [];
    if (!days.length) return;
    if (!days.includes(this.selectedDay as WorkoutDay)) {
      const first = days.find((d) => !['EMPTY', 'GAP'].includes(this.dayRailState(d))) || days[0];
      this.selectDay(first);
    }
    this.copy.openWeek();
  }

  /** Menu « ⋮ » du jour (Copier, Jour de repos, Vider la séance, Supprimer le jour). */
  dayMenuOpen = false;

  toggleDayMenu(ev: Event) {
    ev.stopPropagation();
    this.dayMenuOpen = !this.dayMenuOpen;
  }

  @HostListener('document:keydown.escape')
  onEscapeDayMenu() {
    this.dayMenuOpen = false;
    this.groupMenuAt = null;
  }

  /** « Vider la séance » : tous les exercices du jour retirés, toujours demandé avant. */
  async clearDay() {
    const day = this.selectedDay;
    if (!day || !this.selectedWorkoutSession?.exercises?.length) return;
    const confirmed = await this.confirmDialog.ask({
      title: 'CONFIRM_ACTION.CLEAR_DAY_TITLE',
      text: 'CONFIRM_ACTION.CLEAR_DAY_TEXT',
      params: { label: this.weekDayLabel(day) },
      confirm: 'CONFIRM_ACTION.CLEAR_DAY_CONFIRM',
      icon: 'x-circle',
    });
    if (!confirmed || this.selectedDay !== day) return;
    this.activeVideoExerciseId = null;
    this.facade.clearSelectedSession();
  }

  getSetDisplayLabel(set: any, index: number): string {
    switch (set?.type) {
      case 'WARM_UP':
        return 'W';
      case 'DROP_SET':
        return 'D';
      case 'FAILURE':
        return 'F';
      default:
        return String(set?.setNumber ?? index + 1);
    }
  }

  getSetTypeMenuLabel(type: 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE'): string {
    switch (type) {
      case 'REGULAR':
        return 'Regular';
      case 'WARM_UP':
        return 'Warm up';
      case 'DROP_SET':
        return 'Drop set';
      case 'FAILURE':
        return 'Failure';
    }
  }

  getSetTypeClass(type?: string): string {
    switch (type) {
      case 'WARM_UP':
        return 'wkex-settype__value--warmup';
      case 'DROP_SET':
        return 'wkex-settype__value--dropset';
      case 'FAILURE':
        return 'wkex-settype__value--failure';
      default:
        return 'wkex-settype__value--regular';
    }
  }

  getExerciseVideoLink(exercise: Exercise | null | undefined): string {
    if (!exercise) return '';

    return (
      ((exercise as any).videoLink as string) ||
      ((exercise as any).videoUrl as string) ||
      ((exercise as any).exerciseRef?.videoLink as string) ||
      ((exercise as any).exerciseRef?.videoUrl as string) ||
      ''
    ).trim();
  }

  getExerciseImageUrl(exercise: Exercise | null | undefined): string {
    if (!exercise) return '';

    return (
      ((exercise as any).imageUrl as string) ||
      ((exercise as any).image as string) ||
      ((exercise as any).thumbnailUrl as string) ||
      ((exercise as any).photoUrl as string) ||
      ((exercise as any).exerciseRef?.imageUrl as string) ||
      ((exercise as any).exerciseRef?.image as string) ||
      ((exercise as any).exerciseRef?.thumbnailUrl as string) ||
      ((exercise as any).exerciseRef?.photoUrl as string) ||
      ''
    ).trim();
  }

  getExerciseThumbnail(exercise: Exercise | null | undefined): string {
    if (!exercise) return '';

    const existingImage = this.getExerciseImageUrl(exercise);

    if (existingImage) {
      return existingImage;
    }

    const videoUrl = this.getExerciseVideoLink(exercise);
    const videoId = this.getYouTubeVideoId(videoUrl);

    if (!videoId) return '';

    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  getYouTubeVideoId(url: string): string {
    if (!url || !url.trim()) return '';

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const segments = parsed.pathname.split('/').filter(Boolean);

      let videoId = '';

      if (host.includes('youtu.be')) {
        videoId = segments[0] ?? '';
      }

      if (host.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v') ?? '';

        if (!videoId && segments[0] === 'shorts') {
          videoId = segments[1] ?? '';
        }

        if (!videoId && segments[0] === 'embed') {
          videoId = segments[1] ?? '';
        }
      }

      return videoId.split('?')[0].split('&')[0].trim();
    } catch {
      const regex =
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^"&?/\s]{6,})/;

      const match = url.match(regex);

      return match ? match[1] : '';
    }
  }

  toggleExerciseVideo(exercise: Exercise): void {
    const videoUrl = this.getExerciseVideoLink(exercise);

    if (!videoUrl) return;

    this.previewExercise = exercise;
    this.activeVideoExerciseId = exercise.id || null;
  }

  closeExercisePreview(): void {
    this.previewExercise = null;
    this.activeVideoExerciseId = null;
  }

  isExerciseVideoOpen(exercise: Exercise): boolean {
    return this.activeVideoExerciseId === exercise.id && !!this.getYouTubeEmbedUrl(exercise);
  }

  getYouTubeEmbedUrl(exercise: Exercise): SafeResourceUrl | null {
    const videoId = this.getYouTubeVideoId(this.getExerciseVideoLink(exercise));

    if (!videoId) return null;

    // Same object for the same video: a new one at each change detection reloaded the player and slowed the page.
    let url = this.embedUrls.get(videoId);
    if (!url) {
      url = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
      this.embedUrls.set(videoId, url);
    }
    return url;
  }

  private cleanRestDayWorkoutSessions(): void {
    this.facade.days.forEach((day) => {
      if (day.isRestDay || day.restDay) {
        day.isRestDay = true;
        day.restDay = true;
        day.workoutSessions = [];
        day.session = null;
      }
    });
  }

  /** Empty days before the last filled one, shown by the "empty days" modal (null: closed). */
  emptyDaysPrompt: number[] | null = null;

  /**
   * One save, no weekly publication (backlog-programmes.md): the client sees the filled days once saved. Empty days
   * in the middle are not allowed (R4): the coach marks them as rest days or fills them first.
   */
  savePlan() {
    if (this.savingDraft || this.readOnly) return;
    if (!this.validateBeforeSave()) return;
    const gaps = this.programSummary.gaps;
    if (gaps.length) {
      this.emptyDaysPrompt = [...gaps];
      return;
    }
    this.persistDraft(false);
  }

  /** "Mark as rest days" in the modal: the listed days become rest days, then the program is saved. */
  markEmptyDaysAsRest(): void {
    (this.emptyDaysPrompt || []).forEach((dayNumber) => {
      const day = this.days[dayNumber - 1];
      if (!day) return;
      day.isRestDay = true;
      day.restDay = true;
    });
    this.emptyDaysPrompt = null;
    this.summaryCache = null;
    this.savePlan();
  }

  /** "Fill it" in the modal: opens the first empty day. */
  fillEmptyDay(dayNumber: number): void {
    this.emptyDaysPrompt = null;
    const day = this.days[dayNumber - 1];
    if (day) this.selectDay(day);
  }

  /** Name and days with an error (R2): the message names the day and the exercise. */
  private validateBeforeSave(): boolean {
    this.saveError = '';
    if (!this.workoutPlan.name.trim()) {
      this.saveError = this.translate.instant('WORKOUT_PLAN_NAME_REQUIRED');
      return false;
    }
    // The day, exercise and set to fix, translated (R2).
    const issue = firstWorkoutIssue(this.days);
    if (issue) {
      this.saveError = this.translate.instant(issue.key, issue.params);
      return false;
    }
    return true;
  }

  /** A refusal of the server on the day rules (another tab, an older version): same handling as before saving. */
  private onSaveError(error: unknown): void {
    this.savingDraft = false;
    const refused = programDaysError(error);
    if (refused?.code === 'PROGRAM_GAP') {
      this.emptyDaysPrompt = refused.days;
      return;
    }
    if (refused) {
      // What to fix and where, and the day opened so the coach sees it.
      this.saveError = refusedDaysMessage(refused, (key, params) => this.translate.instant(key, params));
      const day = this.days[(refused.issue?.day ?? refused.days?.[0] ?? 0) - 1];
      if (day) this.selectDay(day);
      return;
    }
    this.saveError = this.translate.instant('WORKOUT_SAVE_ERROR');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.headerObserver?.disconnect();
    if (this.moveToastTimer) clearTimeout(this.moveToastTimer);
    if (this.justAddedTimer) clearTimeout(this.justAddedTimer);
    if (this.libPress || this.libDrag) this.clearLibDrag();
  }

  /** `sent`: the content when the save was sent (what the coach changed meanwhile is still unsaved). */
  private markSaved(sent: string): void {
    this.savingDraft = false;
    this.savedAt = new Date();
    this.savedContent.remember(sent);
    this.aiDraftShown = false; // the AI program is saved: the coach's own now (the health warnings stay shown)
  }

  private persistDraft(navigateAfterSave: boolean) {
    if (this.savingDraft) return;
    if (!this.validateBeforeSave()) return;
    if (this.clientId) {
      this.persistClientPlan();
      return;
    }

    this.savingDraft = true;
    this.cleanRestDayWorkoutSessions();
    this.facade.days.forEach((day, index) => {
      day.date = undefined;
      day.dayOfWeek = undefined;
      day.dayNumber = index + 1;
      day.title = `Day ${(index % 7) + 1}`;
      day.name = day.title;
    });
    this.facade.syncPlanDays();

    const finalTemplateValue = this.assignOnly
      ? false
      : (this.canCreateTemplate ? Boolean(this.isVisibleToOthers) : false);

    this.facade.setPlan({
      ...this.facade.plan,
      isWorkoutPlanTemplate: finalTemplateValue,
      workoutDays: this.facade.days,
    });
    const sent = this.content();

    if (this.facade.plan.id) {
      this.facade.updatePlan().subscribe({
        next: () => {
          this.markSaved(sent);
          if (navigateAfterSave) this.router.navigate([this.libraryUrl]);
        },
        error: (error) => this.onSaveError(error),
      });
    } else {
      this.facade.createPlan().subscribe({
        next: (res) => {
          this.markSaved(sent);
          this.facade.setPlan({...this.facade.plan, id: res.id});
          this.isEditMode = true;

          if (this.returnUrl) {
            if (navigateAfterSave) this.router.navigateByUrl(this.returnUrl, {
              state: {
                assignAfterCreate: {
                  type: 'workout',
                  item: res,
                  assignOnly: this.assignOnly,
                },
              },
            });
          } else if (navigateAfterSave) {
            this.router.navigate([this.libraryUrl]);
          }
        },
        error: (error) => this.onSaveError(error),
      });
    }
  }
  /**
   * A client program: saved with its dates and its client. Longer than saved and reaching the next program, the coach
   * chooses first (« Décaler » or « Retirer », P9); what moved on the client's calendar is said after the save.
   */
  async persistClientPlan(overlap?: OverlapChoice): Promise<void> {
    if (this.savingDraft || this.readOnly) return;
    if (!overlap && this.workoutPlan.id && this.overflow) {
      this.savingDraft = true; // « Enregistrement… » while the next programs are checked
      const asked = await this.overflow.askWhenChecked();
      this.savingDraft = false;
      if (asked || this.destroyed) return;
    }
    this.savingDraft = true;
    this.saveError = '';
    this.cleanRestDayWorkoutSessions();
    this.refreshDates();
    this.facade.setPlan({
      ...this.facade.plan,
      startDate: this.startDate,
      endDate: this.endDate,
      isWorkoutPlanTemplate: false,
      client: this.client ?? this.facade.plan.client ?? ({ id: this.clientId } as any),
    });
    this.facade.syncPlanDays();
    const sent = this.content();
    const request = this.facade.plan.id ? this.facade.updatePlan(overlap) : this.facade.createPlan();
    request.subscribe({
      next: (res) => {
        if (this.destroyed) return;
        this.markSaved(sent);
        if (!this.facade.plan.id && res?.id) {
          this.facade.setPlan({ ...this.facade.plan, id: res.id });
          this.location.replaceState(`/clients/create-workout/${this.clientId}/edit/${res.id}`);
        }
        this.isEditMode = true;
        this.programSchedule.announceChanges((res as any)?.scheduleChanges, this.clientName, (res as any)?.scheduleUndoId);
        this.savedEnd = this.endDate || this.savedEnd;
      },
      error: (error) => {
        if (this.destroyed) return;
        if (isLockedError(error)) {
          this.savingDraft = false;
          this.readOnly = true;
          this.saveError = this.translate.instant('ASSIGN_FLOW.LOCKED_ERROR');
          return;
        }
        this.onSaveError(error);
      },
    });
  }

  /** « Dupliquer » from the read-only banner: a full copy in the library (A9), opened in the library editor. */
  duplicateLocked(): void {
    const id = this.workoutPlan?.id;
    if (!id || this.duplicating) return;
    this.duplicating = true;
    this.workoutService.duplicateWorkout(id, true).subscribe({
      next: (copy) => {
        this.duplicating = false;
        this.toast.success(this.translate.instant('ASSIGN_FLOW.DUPLICATED'));
        if (copy?.id) void this.router.navigateByUrl('workout/edit-workout/' + copy.id);
      },
      error: () => {
        this.duplicating = false;
        this.toast.error(this.translate.instant('ASSIGN_FLOW.DUPLICATE_FAILED'));
      },
    });
  }

  addDayFromMobile(): void {
    this.addDay();

    setTimeout(() => {
      this.scrollMobileDaysToEnd();
    }, 0);
  }

  private scrollMobileDaysToEnd(): void {
    const el = this.mobileDaysScroller?.nativeElement;

    if (!el) {
      return;
    }

    el.scrollTo({
      left: el.scrollWidth,
      behavior: 'smooth'
    });
  }
}
