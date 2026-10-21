import {Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import { WorkoutWeekPanelComponent } from '../workout-week-panel.component';
import { workoutDayState, workoutDayValidationMessages } from '@shared/models/workout-publication';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { ReadyWeeksModalComponent } from '@shared/components/ready-weeks-modal/ready-weeks-modal.component';

@Component({
  selector: 'app-create-workout',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule, TranslateModule, WorkoutWeekPanelComponent, SectionLoaderComponent, ReadyWeeksModalComponent],
  templateUrl: './create-workout.component.html',
  styleUrls: ['./create-workout.component.scss'],
})
export class CreateWorkoutComponent implements OnInit, AfterViewInit, OnDestroy {
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
  justSaved = false;
  private justSavedTimer: ReturnType<typeof setTimeout> | null = null;
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
  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private host: ElementRef<HTMLElement>,
    private location: Location,
  ) {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.assignOnly = this.route.snapshot.queryParamMap.get('assignOnly') === '1';
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
      this.isVisibleToOthers = requestedTemplate && this.canCreateTemplate;
      this.facade.setPlan({
        ...this.facade.plan,
        name: requestedName || this.facade.plan.name,
        isWorkoutPlanTemplate: this.isVisibleToOthers,
      });
      if (history.state?.autoCreate && requestedName) this.createInBackground();
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
        this.facade.setPlan({...this.facade.plan, id: created.id, publishedWeeks: created.publishedWeeks || []});
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
    this.isVisibleToOthers = this.canCreateTemplate
      ? Boolean(plan.isWorkoutPlanTemplate)
      : false;
    this.facade.setPlan({
      ...this.facade.plan,
      isWorkoutPlanTemplate: this.isVisibleToOthers,
    });
    this.durationWeeks = this.normalizeDurationWeeks(
      Math.ceil((this.days.length || 28) / 7)
    );
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

  private legacyDayBuilderStatus(day: WorkoutDay): 'EMPTY' | 'READY' | 'REST_DAY' {
    if (day.isRestDay || day.restDay) return 'REST_DAY';
    const sessions = day.workoutSessions?.length
      ? day.workoutSessions
      : (day.session ? [day.session] : []);
    const hasName = Boolean((sessions[0]?.name || '').trim());
    const exercises = sessions.flatMap((session) => session.exercises || []);
    const hasValidExercises = exercises.length > 0
      && exercises.every((exercise) =>
        (exercise.sets || []).some((set) => this.isSetValid(exercise, set))
      );

    return hasName && hasValidExercises ? 'READY' : 'EMPTY';
  }

  private isSetValid(exercise: Exercise, set: any): boolean {
    const restMin = Number(set?.restMin ?? 0);
    const restSec = Number(set?.restSec ?? 0);
    const weightIsValid = set?.weight == null
      || set.weight === ''
      || (Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0);
    const restIsValid = Number.isFinite(restMin) && restMin >= 0
      && Number.isFinite(restSec) && restSec >= 0;

    if (!weightIsValid || !restIsValid) return false;

    if (exercise.type === 'CARDIO') {
      const duration = Number(set?.duration);
      return Number.isFinite(duration) && duration > 0;
    }

    const reps = Number(set?.reps);
    return set?.reps !== '' && set?.reps != null
      && Number.isFinite(reps) && reps >= 0;
  }

  getWeekReadyCount(days: WorkoutDay[]): number {
    return days.filter((day) => this.getDayBuilderStatus(day) !== 'EMPTY').length;
  }

  getSelectedWeekNumber(): number {
    const index = Math.max(0, this.days.indexOf(this.selectedDay!));
    return Math.floor(index / 7) + 1;
  }

  isWeekPublished(weekNumber: number): boolean {
    return (this.workoutPlan.publishedWeeks || []).includes(weekNumber);
  }

  canPublishSelectedWeek(): boolean {
    const weekIndex = this.getSelectedWeekNumber() - 1;
    return this.getWeekReadyCount(this.workoutWeeks[weekIndex]?.days || []) === 7;
  }

  publishSelectedWeek(): void {
    this.saveError = '';
    const weekNumber = this.getSelectedWeekNumber();
    const weekDays = this.workoutWeeks[weekNumber - 1]?.days || [];
    const validation = weekDays
      .map((day, index) => workoutDayValidationMessages(day, (weekNumber - 1) * 7 + index)[0])
      .find((message): message is string => !!message);
    if (validation) {
      this.saveError = validation;
      return;
    }
    if (!this.canPublishSelectedWeek()) {
      const firstEmpty = weekDays.findIndex((day) => workoutDayState(day) === 'EMPTY');
      this.saveError = firstEmpty >= 0
        ? `Week ${weekNumber} cannot be published: Day ${(weekNumber - 1) * 7 + firstEmpty + 1} is not ready.`
        : `Week ${weekNumber} cannot be published until all 7 days are ready.`;
      return;
    }
    this.persistDraft(false, weekNumber);
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
  }

  duplicateSelectedDay() {
    this.facade.duplicateSelectedDay();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    this.facade.deleteDay(d);
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

  toggleRestDay() {
    if (!this.selectedDay) return;

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
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
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

  /** Weeks shown by the "ready to publish" modal (null: closed), and the ones the coach chose to keep as drafts. */
  readyWeeksPrompt: number[] | null = null;
  private readyWeeksKeptAsDraft = new Set<number>();

  /** Weeks whose 7 days are ready and which are not published yet. */
  private readyUnpublishedWeeks(): number[] {
    return this.workoutWeeks
      .map((week, index) => index + 1)
      .filter((week) => !this.isWeekPublished(week)
        && this.getWeekReadyCount(this.workoutWeeks[week - 1].days) === 7);
  }

  savePlan() {
    if (this.savingDraft) return;
    // The coach may not know a draft week stays hidden from the client: offer to publish the ready ones.
    const ready = this.readyUnpublishedWeeks().filter((week) => !this.readyWeeksKeptAsDraft.has(week));
    if (ready.length) {
      this.readyWeeksPrompt = ready;
      return;
    }
    this.persistDraft(false);
  }

  publishReadyWeeks(weeks: number[]): void {
    this.readyWeeksPrompt = null;
    this.persistDraft(false, weeks);
  }

  keepReadyWeeksAsDraft(): void {
    (this.readyWeeksPrompt || []).forEach((week) => this.readyWeeksKeptAsDraft.add(week));
    this.readyWeeksPrompt = null;
    this.persistDraft(false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.justSavedTimer) clearTimeout(this.justSavedTimer);
    this.headerObserver?.disconnect();
  }

  private markSaved(): void {
    this.savingDraft = false;
    this.savedAt = new Date();
    this.justSaved = true;
    if (this.justSavedTimer) clearTimeout(this.justSavedTimer);
    this.justSavedTimer = setTimeout(() => { this.justSaved = false; this.justSavedTimer = null; }, 2500);
  }

  private persistDraft(navigateAfterSave: boolean, publishWeek?: number | number[]) {
    if (this.savingDraft) return;
    this.saveError = '';
    if (!this.workoutPlan.name.trim()) {
      this.saveError = 'Workout plan name is required.';
      return;
    }

    const validation = this.days
      .map((day, index) => workoutDayValidationMessages(day, index)[0])
      .find((message): message is string => !!message);
    if (validation) {
      this.saveError = validation;
      return;
    }

    this.savingDraft = true;
    const previous = [...(this.workoutPlan.publishedWeeks || [])];
    const publishedWeeks = previous.filter(week => this.getWeekReadyCount(this.days.slice((week - 1) * 7, week * 7)) === 7);
    publishedWeeks.push(...(Array.isArray(publishWeek) ? publishWeek : publishWeek ? [publishWeek] : []));
    this.facade.setPlan({...this.workoutPlan, publishedWeeks: Array.from(new Set(publishedWeeks))});
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

    if (this.facade.plan.id) {
      this.facade.updatePlan().subscribe({
        next: (res) => {
          this.markSaved();
          this.facade.setPlan({...this.facade.plan, publishedWeeks: res.publishedWeeks || []});
          if (navigateAfterSave) this.router.navigate(['/workout/program-library']);
        },
        error: () => { this.savingDraft = false; this.saveError = this.translate.instant('WORKOUT_SAVE_ERROR'); this.facade.setPlan({...this.workoutPlan, publishedWeeks: previous}); },
      });
    } else {
      this.facade.createPlan().subscribe({
        next: (res) => {
          this.markSaved();
          this.facade.setPlan({...this.facade.plan, id: res.id, publishedWeeks: res.publishedWeeks || []});
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
        error: () => { this.savingDraft = false; this.saveError = this.translate.instant('WORKOUT_SAVE_ERROR'); this.facade.setPlan({...this.workoutPlan, publishedWeeks: previous}); },
      });
    }
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
