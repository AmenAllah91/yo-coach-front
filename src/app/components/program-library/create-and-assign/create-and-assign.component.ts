import { ChangeDetectorRef, Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, of, switchMap } from 'rxjs';

import { Client, ClientService } from 'app/service/client.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { WorkoutService } from 'app/service/workout.service';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-create-and-assign',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './create-and-assign.component.html',
  styleUrl: './create-and-assign.component.scss',
})
export class CreateAndAssignComponent implements OnInit {
  isEditMode = false;
  activeVideoExerciseId: string | null = null;

  // assign-specific
  client: Client | null = null;
  latestAssignedPrograms: WorkoutPlan[] = [];

  // schedule-specific
  startDate = new Date().toISOString().split('T')[0];
  endDate = '';
  durationWeeks = 4;
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  private conflictResolution = '';
  private conflictId = '';
  private conflictStartDate = '';
  @ViewChild('mobileDaysScroller')
  mobileDaysScroller?: ElementRef<HTMLElement>;

  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private coachSettingsService: CoachSettingsService,
    private workoutService: WorkoutService
  ) {}

  // ====== PROPS utilisés par le template (alias facade) ======
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

  get hoveringExerciseId(): string | null {
    return this.facade.hoveringExerciseId;
  }

  set hoveringExerciseId(value: string | null) {
    this.facade.hoveringExerciseId = value;
  }

  // filters
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

  // ===== lifecycle =====
  ngOnInit() {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => this.initializeEditor(),
      error: () => this.initializeEditor(),
    });
  }

  private initializeEditor() {
    const planId = this.route.snapshot.paramMap.get('id');
    const clientId = this.route.snapshot.paramMap.get('idClient');
    const requestedName = (this.route.snapshot.queryParamMap.get('name') || '').trim();
    const requestedDuration = Number(this.route.snapshot.queryParamMap.get('durationWeeks'));
    const requestedStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.conflictResolution = this.route.snapshot.queryParamMap.get('conflictResolution') || '';
    this.conflictId = this.route.snapshot.queryParamMap.get('conflictId') || '';
    this.conflictStartDate = this.route.snapshot.queryParamMap.get('conflictStartDate') || '';
    this.durationWeeks = this.normalizeDurationWeeks(requestedDuration || this.durationWeeks);
    if (requestedStartDate) {
      this.startDate = requestedStartDate;
    }

    if (planId) {
      this.isEditMode = true;
      this.facade.loadPlanForEdit(planId).subscribe({
        next: (plan: WorkoutPlan) => {
          this.facade.applyPlanForEdit(plan);

          if (plan.startDate) {
            this.startDate = new Date(plan.startDate)
              .toISOString()
              .split('T')[0];
          }
          this.durationWeeks = this.normalizeDurationWeeks(Math.ceil((plan.workoutDays?.length || 28) / 7));

          this.updateAllDates();
          this.facade.syncPlanDays();
          this.cdr.markForCheck();
        },

        error: (err) =>
          console.error('Erreur lors du chargement du plan :', err),
      });
    } else {
      this.isEditMode = false;
      this.facade.initCreate();
      this.facade.setDurationWeeks(this.durationWeeks);
      this.facade.setPlan({
        ...this.facade.plan,
        name: requestedName || this.facade.plan.name,
        isWorkoutPlanTemplate: false,
      });
      this.updateAllDates();
    }

    if (clientId) {
      this.clientService.getClientById(clientId).subscribe({
        next: (res) => (this.client = res),
        error: (err) => console.error('Erreur chargement client :', err),
      });

      this.loadLatestAssignedPrograms(clientId);
    }

    this.facade.loadExercisesFromAPI();
  }

  get workoutWeeks(): { label: string; range: string; days: WorkoutDay[] }[] {
    const weeks: { label: string; range: string; days: WorkoutDay[] }[] = [];

    for (let index = 0; index < this.days.length; index += 7) {
      const days = this.days.slice(index, index + 7);
      weeks.push({
        label: `WEEK ${Math.floor(index / 7) + 1}`,
        range: this.getWeekRange(days),
        days,
      });
    }

    return weeks;
  }

  get durationDays(): number {
    return this.durationWeeks * 7;
  }

  getWeekWorkoutCount(days: WorkoutDay[]): number {
    return days.filter((day) =>
      (day.workoutSessions || []).some((session) => (session.exercises || []).length > 0)
    ).length;
  }

  getSelectedDayDateLabel(): string {
    if (!this.selectedDay?.date) return '';

    const date = new Date(`${this.selectedDay.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private normalizeDurationWeeks(value: number): number {
    return Math.max(1, Math.min(Number(value) || 4, 52));
  }

  private getWeekRange(days: WorkoutDay[]): string {
    const first = days[0]?.date ? this.formatShortDate(days[0].date) : '';
    const last = days[days.length - 1]?.date ? this.formatShortDate(days[days.length - 1].date) : '';

    if (first && last) return `${first} - ${last}`;
    return `${days.length} days`;
  }

  private formatShortDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  private loadLatestAssignedPrograms(clientId: string): void {
    const coachId = sessionStorage.getItem('userId');
    if (!coachId) return;

    this.workoutService.getWorkoutByCoachIdAndClient(coachId, clientId, 0, 5, 'ALL', 'ALL', 'ALL', 'END_DESC').subscribe({
      next: (res) => {
        const programs = Array.isArray(res) ? res : (res?.content || []);
        this.latestAssignedPrograms = this.sortProgramsByLatestDate(programs).slice(0, 3);
      },
      error: () => {
        this.latestAssignedPrograms = [];
      },
    });
  }

  getProgramDisplayName(program: any): string {
    return program?.name || program?.programName || 'Workout program';
  }

  getProgramDateRange(program: any): string {
    const start = this.formatProgramDate(program?.startDate);
    const end = this.formatProgramDate(program?.endDate);

    if (start && end) return `${start} - ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    return 'No dates set';
  }

  private sortProgramsByLatestDate(programs: any[]): any[] {
    return [...(programs || [])].sort((a, b) => {
      const aDate = this.toDateTime(a?.endDate || a?.startDate);
      const bDate = this.toDateTime(b?.endDate || b?.startDate);
      return bDate - aDate;
    });
  }

  private toDateTime(value: any): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private formatProgramDate(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // ===== schedule-specific =====
  updateAllDates() {
    if (!this.startDate) return;
    this.updateDatesFromCurrentOrder();
  }

  private updateDatesFromCurrentOrder() {
    if (!this.startDate) return;

    const start = new Date(this.startDate);

    this.facade.days.forEach((day, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);

      day.date = current.toISOString().split('T')[0];
      day.dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
      day.dayNumber = index + 1;
      day.title = `Day ${index + 1}`;
      day.name = day.title;
    });

    this.endDate = this.facade.days.length
      ? this.facade.days[this.facade.days.length - 1].date || this.startDate
      : this.startDate;
  }

  onDurationWeeksChange() {
    const nextWeeks = this.normalizeDurationWeeks(this.durationWeeks);
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
    this.updateAllDates();
  }

  // ===== template functions (proxies) =====
  trackByDay = (index: number, d: WorkoutDay) => d.id;
  trackByExercise = (_: number, ex: Exercise) => ex.id;

  selectDay(d: WorkoutDay) {
    this.facade.selectDay(d);
  }

  addDay() {
    this.facade.addDay();
    this.updateAllDates();
  }

  addDayFromMobile(): void {
    this.addDay();

    setTimeout(() => {
      this.scrollMobileDaysToEnd();
    }, 0);
  }

  private scrollMobileDaysToEnd(): void {
    const el = this.mobileDaysScroller?.nativeElement;

    if (!el) return;

    el.scrollTo({
      left: el.scrollWidth,
      behavior: 'smooth',
    });
  }

  duplicateSelectedDay() {
    this.facade.duplicateSelectedDay();
    this.updateAllDates();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    this.facade.deleteDay(d);
    this.updateAllDates();
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
      // recréer une session si on sort du rest day
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
    this.facade.showExerciseSelector = true;
    this.facade.loadExercisesFromAPI();
  }

  closeExerciseSelector() {
    this.facade.showExerciseSelector = false;
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

  handleSelectExercise(ex: Exercise) {
    this.facade.handleSelectExercise(ex);
  }

  // ===== Modal bindings (Common Exercises) =====
  get isExerciseModalOpen(): boolean {
    return this.facade.isExerciseModalOpen;
  }

  get exerciseStep(): 'list' | 'detail' {
    return this.facade.exerciseStep;
  }
  set exerciseStep(v: 'list' | 'detail') {
    this.facade.exerciseStep = v;
  }

  get exerciseSearch(): string {
    return this.facade.exerciseSearch;
  }
  set exerciseSearch(v: string) {
    this.facade.exerciseSearch = v;
  }

  get filteredExercises() {
    return this.facade.filteredExercises;
  }

  get selectedExercise() {
    return this.facade.selectedExercise;
  }
  set selectedExercise(v: Exercise) {
    this.facade.selectedExercise = v;
  }

  // ===== Modal actions proxies =====
  openExerciseModal() {
    this.facade.openExerciseModal();
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

  // Notes proxies (si template l'utilise)
  setEditingExerciseDescription(id: string | null) {
    this.facade.setEditingExerciseDescription(id);
  }

  // superset/sets proxies si template les utilise
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
    for (let i = 0; i < list.length; i++) {
      const g = list[i].supersetGroupId;
      if (!g) continue;
      const left = i > 0 && list[i - 1].supersetGroupId === g;
      const right = i < list.length - 1 && list[i + 1].supersetGroupId === g;
      if (!left && !right) return false;
    }
    return true;
  }

  onDropDay(event: CdkDragDrop<WorkoutDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.updateDatesFromCurrentOrder();
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

  handleSetChange(exId: string, si: number, field: string, value: string) {
    this.facade.handleSetChange?.(exId, si, field, value);
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
    if (existingImage) return existingImage;

    const videoId = this.getYouTubeVideoId(this.getExerciseVideoLink(exercise));
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
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

  openExerciseVideo(exercise: Exercise): void {
    const videoUrl = this.getExerciseVideoLink(exercise);
    if (!videoUrl) return;

    const viewerUrl = this.router.serializeUrl(
      this.router.createUrlTree(['/video-viewer'], {
        queryParams: {
          url: videoUrl,
          title: exercise.name || 'Exercise Video',
        },
      })
    );

    window.open(viewerUrl, '_blank', 'noopener,noreferrer');
  }

  toggleExerciseVideo(exercise: Exercise): void {
    const videoUrl = this.getExerciseVideoLink(exercise);

    if (!videoUrl) return;

    this.activeVideoExerciseId = this.activeVideoExerciseId === exercise.id ? null : exercise.id;
  }

  isExerciseVideoOpen(exercise: Exercise): boolean {
    return this.activeVideoExerciseId === exercise.id && !!this.getYouTubeEmbedUrl(exercise);
  }

  getYouTubeEmbedUrl(exercise: Exercise): SafeResourceUrl | null {
    const videoId = this.getYouTubeVideoId(this.getExerciseVideoLink(exercise));

    if (!videoId) return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
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

  private resolveConflictBeforeSave(): Observable<unknown> {
    if (this.conflictResolution !== 'REPLACE' || !this.conflictId || !this.conflictStartDate) {
      return of(null);
    }

    const replacementEndDate = this.addDays(this.startDate, -1);
    if (new Date(`${replacementEndDate}T00:00:00`).getTime() < new Date(`${this.conflictStartDate}T00:00:00`).getTime()) {
      return this.workoutService.deleteWorkout(this.conflictId);
    }

    return this.workoutService.updateWorkoutPlanDates(this.conflictId, this.conflictStartDate, replacementEndDate);
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ===== save (assign-specific) =====
  savePlan() {
    this.cleanRestDayWorkoutSessions();
    this.facade.setPlan({
      ...this.facade.plan,
      startDate: this.startDate,
      endDate: this.endDate,
      client: this.client ?? this.facade.plan.client,
    });

    this.facade.syncPlanDays();

    const save$ = this.resolveConflictBeforeSave().pipe(
      switchMap(() => this.facade.plan.id ? this.facade.updatePlan() : this.facade.createPlan())
    );

    save$.subscribe({
      next: (res) => {
        if (this.facade.plan.id) {
          console.log('Workout plan updated:', res);
        } else {
          console.log('Workout plan created:', res);
          this.facade.initCreate();
          this.startDate = new Date().toISOString().split('T')[0];
          this.updateAllDates();
        }
      },
      error: (err) => console.error('Error saving workout plan:', err),
    });

  }
}
