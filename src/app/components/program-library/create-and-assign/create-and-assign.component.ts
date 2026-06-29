import { ChangeDetectorRef, Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Client, ClientService } from 'app/service/client.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
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

  // schedule-specific
  startDate = new Date().toISOString().split('T')[0];
  endDate = '';

  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private coachSettingsService: CoachSettingsService
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
      this.updateAllDates();
    }

    if (clientId) {
      this.clientService.getClientById(clientId).subscribe({
        next: (res) => (this.client = res),
        error: (err) => console.error('Erreur chargement client :', err),
      });
    }

    this.facade.loadExercisesFromAPI();
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

    if (this.facade.plan.id) {
      this.facade.updatePlan().subscribe({
        next: (res) => console.log('Workout plan updated:', res),
        error: (err) => console.error('Error updating workout plan:', err),
      });
    } else {
      this.facade.createPlan().subscribe({
        next: (res) => {
          console.log('Workout plan created:', res);
          this.facade.initCreate();
          this.startDate = new Date().toISOString().split('T')[0];
          this.updateAllDates();
        },
        error: (err) => console.error('Error creating workout plan:', err),
      });
    }
  }
}
