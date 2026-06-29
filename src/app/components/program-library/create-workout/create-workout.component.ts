import {Component, OnInit, HostListener, ViewChild, ElementRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-create-workout',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './create-workout.component.html',
  styleUrls: ['./create-workout.component.scss'],
})
export class CreateWorkoutComponent implements OnInit {
  isEditMode = false;
  isVisibleToOthers = false;
  private returnUrl: string | null = null;
  private assignOnly = false;
  activeVideoExerciseId: string | null = null;
  @ViewChild('mobileDaysScroller')
  mobileDaysScroller?: ElementRef<HTMLElement>;
  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
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


  get canCreateTemplate(): boolean {
    const roles = this.getCurrentRoles();

    console.log('[ADMIN CHECK CURRENT ROLES]', roles);

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

    if (planId) {
      this.isEditMode = true;
      this.facade.loadPlanForEdit(planId).subscribe({
        next: (plan: WorkoutPlan) => {
          this.facade.applyPlanForEdit(plan);
          this.isVisibleToOthers = this.canCreateTemplate
            ? Boolean(plan.isWorkoutPlanTemplate)
            : false;
          this.facade.setPlan({
            ...this.facade.plan,
            isWorkoutPlanTemplate: this.isVisibleToOthers,
          });
        },
        error: (err) =>
          console.error('Erreur lors du chargement du plan :', err),
      });
    } else {
      this.isEditMode = false;
      this.facade.initCreate();
      this.isVisibleToOthers = false;
      this.facade.setPlan({
        ...this.facade.plan,
        isWorkoutPlanTemplate: false,
      });
    }

    this.facade.loadExercisesFromAPI();
  }

  trackByDay = (index: number, d: WorkoutDay) => d.id;
  trackByExercise = (_: number, ex: Exercise) => ex.id;

  selectDay(d: WorkoutDay) {
    this.facade.selectDay(d);
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
    this.facade.showExerciseSelector = true;
    this.facade.loadExercisesFromAPI();
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

  handleSelectExercise(ex: Exercise) {
    this.facade.handleSelectExercise(ex);
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

  savePlan() {
    this.cleanRestDayWorkoutSessions();
    this.facade.syncPlanDays();

    const finalTemplateValue = this.assignOnly
      ? false
      : (this.canCreateTemplate ? Boolean(this.isVisibleToOthers) : false);

    this.facade.setPlan({
      ...this.facade.plan,
      isWorkoutPlanTemplate: finalTemplateValue,
      workoutDays: this.facade.days,
    });

    console.log(
      '[CreateWorkoutComponent] final isWorkoutPlanTemplate =',
      finalTemplateValue,
      this.facade.plan,
    );

    if (this.facade.plan.id) {
      this.facade.updatePlan().subscribe({
        next: (res) => {
          console.log('Workout plan updated:', res);
          this.router.navigate(['/workout/program-library']);
        },
        error: (err) => console.error('Error updating workout plan:', err),
      });
    } else {
      this.facade.createPlan().subscribe({
        next: (res) => {
          console.log('Workout plan created:', res);

          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl, {
              state: {
                assignAfterCreate: {
                  type: 'workout',
                  item: res,
                  assignOnly: this.assignOnly,
                },
              },
            });
          } else {
            this.router.navigate(['/workout/program-library']);
          }
        },
        error: (err) => console.error('Error creating workout plan:', err),
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
