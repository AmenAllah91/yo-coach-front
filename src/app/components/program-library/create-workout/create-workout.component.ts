import { CopyDaysModalComponent } from '@shared/program-copy/copy-days-modal.component';
import { ClientProgramDatesComponent } from '@shared/components/client-program-dates/client-program-dates.component';
import { workoutDayActive } from '@shared/models/client-day-activity';
import { CopiedDayBannerComponent } from '@shared/program-copy/copied-day-banner.component';
import { ProgramCopyController } from '@shared/program-copy/program-copy-controller';
import { ProgramDayClipboardService } from '@shared/program-copy/program-day-clipboard.service';
import { copyWorkoutDayContent } from '@shared/program-copy/program-day-copy';
import {Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import { WorkoutWeekPanelComponent } from '../workout-week-panel.component';
import { workoutDayState } from '@shared/models/workout-publication';
import { ProgramDayState, ProgramSummary, firstWorkoutIssue, programDaysError, workoutDayStatus, workoutSummary } from '@shared/models/program-days';
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
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule, TranslateModule, WorkoutWeekPanelComponent, SectionLoaderComponent, EmptyDaysModalComponent, ProgramOverflowComponent, CopyDaysModalComponent, CopiedDayBannerComponent, ClientProgramDatesComponent],
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
  ) {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.assignOnly = this.route.snapshot.queryParamMap.get('assignOnly') === '1';
    this.clientId = this.route.snapshot.paramMap.get('idClient');
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

  goBack(): void {
    if (this.returnUrl?.startsWith('/')) {
      void this.router.navigateByUrl(this.returnUrl);
      return;
    }
    if (this.clientId) {
      void this.router.navigate(['/clients/profil-client', this.clientId], { queryParams: { tab: 'workouts' } });
      return;
    }
    void this.router.navigate(['/workout/program-library']);
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
      if (this.clientId) {
        // The start chosen in the creation window (A2).
        this.startDate = this.route.snapshot.queryParamMap.get('startDate') || this.startDate;
        this.refreshDates();
      } else if (history.state?.autoCreate && requestedName) {
        this.createInBackground();
      }
      this.savedContent.rememberAfterDisplay(() => this.content());
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
  }

  cancelDurationReduction() {
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
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
      this.facade.showExerciseSelector = false;
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
    this.facade.showExerciseSelector = false;
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

  private isSupersetOrderValid(list: Exercise[]): boolean {
    const ranges = new Map<string, { first: number; last: number; count: number }>();

    list.forEach((exercise, index) => {
      const groupId = exercise.supersetGroupId;
      if (!groupId) return;

      const range = ranges.get(groupId) || { first: index, last: index, count: 0 };
      range.first = Math.min(range.first, index);
      range.last = Math.max(range.last, index);
      range.count += 1;
      ranges.set(groupId, range);
    });

    for (const [groupId, range] of ranges.entries()) {
      if (range.count < 2) return false;

      for (let i = range.first; i <= range.last; i += 1) {
        if (list[i]?.supersetGroupId !== groupId) {
          return false;
        }
      }
    }

    return true;
  }

  onDropDay(event: CdkDragDrop<WorkoutDay[]>) {
    if (this.readOnly) return;
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.refreshDates();
  }

  onDropExercise(event: CdkDragDrop<Exercise[]>) {
    const exercises = this.selectedDay?.workoutSessions[0]?.exercises;
    if (!exercises) return;
    const item = exercises[event.previousIndex];
    if (item.supersetGroupId) return;
    const simulated = [...exercises];
    simulated.splice(event.previousIndex, 1);
    simulated.splice(event.currentIndex, 0, item);
    if (!this.isSupersetOrderValid(simulated)) return;
    moveItemInArray(exercises, event.previousIndex, event.currentIndex);
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
    this.saveError = refused ? refused.error : this.translate.instant('WORKOUT_SAVE_ERROR');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.headerObserver?.disconnect();
  }

  /** `sent`: the content when the save was sent (what the coach changed meanwhile is still unsaved). */
  private markSaved(sent: string): void {
    this.savingDraft = false;
    this.savedAt = new Date();
    this.savedContent.remember(sent);
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
          if (navigateAfterSave) this.router.navigate(['/workout/program-library']);
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
            this.router.navigate(['/workout/program-library']);
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
