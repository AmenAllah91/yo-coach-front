import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { FeatherModule } from 'angular-feather';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { ExerciseService, PageResponse } from '../../service/exercise.service';
import { AuthService } from '../../config/auth.service';
import { ScrollLoaderComponent } from '../scroll-loader/scroll-loader.component';
import { EnumResponse, Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    FeatherModule,
    YouTubePlayerModule,
    ScrollLoaderComponent,
  ],
  templateUrl: './exercise-library.component.html',
  styleUrls: [
    './exercise-library.component.scss',
    '../../shared/styles/video-player.scss',
  ],
})
export class ExerciseLibraryComponent implements OnInit, OnDestroy {
  selectedExercise: string | null = null;
  showCreateModal = false;
  showExerciseSelectModal = false;
  showDeleteModal = false;
  exerciseToDelete: Exercise | null = null;
  videoPlayerWidth = 640;
  videoPlayerHeight = 360;
  private videoResizeObserver: ResizeObserver | null = null;
  private layoutBackButton: HTMLElement | null = null;
  private layoutBackButtonDisplay = '';
  private layoutBackButtonTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('videoWrapper')
  set videoWrapper(element: ElementRef<HTMLElement> | undefined) {
    this.videoResizeObserver?.disconnect();
    this.videoResizeObserver = null;

    if (!element) return;

    const wrapper = element.nativeElement;
    this.updateVideoPlayerSize(wrapper);
    setTimeout(() => this.updateVideoPlayerSize(wrapper));

    this.videoResizeObserver = new ResizeObserver(() => {
      this.updateVideoPlayerSize(wrapper);
    });
    this.videoResizeObserver.observe(wrapper);
  }

  exerciseName = '';
  exerciseType = '';
  equipment = '';
  muscle = '';
  videoLink = '';
  exerciseDescription = '';
  searchTerm = '';

  allExercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  myExercisesForTemplateFilter: Exercise[] = [];
  private customExercises = new Set<Exercise>();
  isLoading = false;
  enums: EnumResponse | null = null;

  editingExercise: Exercise | null = null;
  isTemplate = false;

  selectedEquipment = '';
  selectedMuscle = '';
  selectedType = '';

  currentUserId = '';
  isRoleAdmin = false;
  canCreateTemplate = false;

  constructor(
    private exerciseService: ExerciseService,
    private authService: AuthService,
    private location: Location,
    private hostElement: ElementRef<HTMLElement>,
  ) {}

  ngOnInit() {
    this.layoutBackButtonTimer = setTimeout(() => this.hideLayoutBackButton());
    console.log('Exercise Library - Checking authentication status');

    if (!this.authService.isLoggedIn()) {
      console.log('Exercise Library - Not logged in, redirecting to login');
      this.authService.login();
      return;
    }

    console.log('Exercise Library - User is logged in, loading data');
    this.loadCurrentUserAccess();
    this.loadEnums();
    this.loadAllExercises();
  }

  loadCurrentUserAccess() {
    const auth: any = this.authService as any;
    const token =
      this.callAuthGetter(auth, ['getValidAccessToken', 'getToken', 'getAccessToken', 'token']) ||
      this.readTokenFromStorage();

    const payload = this.decodeJwtPayload(token);
    const roles = this.extractRoles(payload);
    const normalizedRoles = roles.map((role) => role.toUpperCase());

    this.currentUserId =
      this.extractCurrentUserId(payload) ||
      this.callAuthGetter(auth, ['getCurrentUserId', 'getUserId', 'userId']) ||
      '';

    this.isRoleAdmin =
      normalizedRoles.includes('ROLE_ADMIN') ||
      normalizedRoles.includes('ADMIN') ||
      normalizedRoles.includes('ROLE_SUPER_ADMIN') ||
      normalizedRoles.includes('SUPER_ADMIN');

    this.canCreateTemplate = this.isRoleAdmin;

    console.log(
      '[ExerciseLibrary]',
      'currentUserId=',
      this.currentUserId,
      'roles=',
      normalizedRoles,
      'isAdmin=',
      this.isRoleAdmin,
      'canCreateTemplate=',
      this.canCreateTemplate,
    );
  }

  private callAuthGetter(auth: any, names: string[]): string {
    for (const name of names) {
      try {
        const value = typeof auth[name] === 'function' ? auth[name]() : auth[name];

        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }

        if (value && typeof value === 'object') {
          const possibleToken =
            value.access_token ||
            value.accessToken ||
            value.token ||
            value.id_token ||
            value.idToken;

          if (typeof possibleToken === 'string' && possibleToken.trim()) {
            return possibleToken.trim();
          }

          const possibleId = value.id || value.sub || value.userId;
          if (typeof possibleId === 'string' && possibleId.trim()) {
            return possibleId.trim();
          }
        }
      } catch {}
    }

    return '';
  }

  private readTokenFromStorage(): string {
    const keys = [
      'access_token',
      'accessToken',
      'token',
      'id_token',
      'idToken',
      'kc_token',
      'auth_token',
    ];

    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) {
        const value = storage.getItem(key);

        if (value && value.trim()) {
          return value.trim();
        }
      }
    }

    return '';
  }

  private decodeJwtPayload(token: string): any {
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

  private extractRoles(payload: any): string[] {
    const roles = new Set<string>();

    const addRole = (value: any) => {
      if (!value) return;

      if (Array.isArray(value)) {
        value.forEach(addRole);
        return;
      }

      if (typeof value === 'object') {
        ['authority', 'name', 'role', 'value'].forEach((key) => addRole(value[key]));
        return;
      }

      String(value)
        .replace('[', '')
        .replace(']', '')
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => roles.add(item));
    };

    if (payload) {
      addRole(payload.authorities);
      addRole(payload.roles);
      addRole(payload.scope);
      addRole(payload.scp);
      addRole(payload.auth);
      addRole(payload.realm_access?.roles);

      const resourceAccess = payload.resource_access;
      if (resourceAccess && typeof resourceAccess === 'object') {
        Object.values(resourceAccess).forEach((value: any) => addRole(value?.roles));
      }
    }

    return Array.from(roles);
  }

  private extractCurrentUserId(payload: any): string {
    if (!payload) return '';

    return String(
      payload.sub ||
      payload.userId ||
      payload.user_id ||
      payload.id ||
      payload.uid ||
      '',
    ).trim();
  }

  selectExercise(exerciseId: string) {
    this.selectedExercise = exerciseId;
  }

  deselectExercise() {
    this.selectedExercise = null;
  }

  openExerciseSelectModal(): void {
    this.showExerciseSelectModal = true;
  }

  closeExerciseSelectModal(): void {
    this.showExerciseSelectModal = false;
  }

  getExerciseName(): string {
    const exercise = this.allExercises.find(
      (item) => item.id === this.selectedExercise,
    );

    return exercise ? exercise.name : '';
  }

  getSelectedExercise(): Exercise | null {
    return (
      this.allExercises.find((item) => item.id === this.selectedExercise) ||
      null
    );
  }

  getExerciseVideoLink(exercise: Exercise | null): string {
    if (!exercise) return '';

    return (
      ((exercise as any).videoLink as string) ||
      ((exercise as any).videoUrl as string) ||
      ''
    ).trim();
  }

  getExerciseImageUrl(exercise: Exercise | null): string {
    if (!exercise) return '';

    return (
      ((exercise as any).imageUrl as string) ||
      ((exercise as any).image as string) ||
      ((exercise as any).thumbnailUrl as string) ||
      ((exercise as any).photoUrl as string) ||
      ''
    ).trim();
  }

  getExerciseThumbnail(exercise: Exercise | null): string {
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

  getModalPreviewImage(): string {
    const videoId = this.getYouTubeVideoId(this.videoLink);

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

  openCreateModal() {
    this.resetForm();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }

  loadEnums() {
    this.exerciseService.getEnums().subscribe({
      next: (enums) => {
        this.enums = enums;

        if (enums.typeExercise.length > 0) {
          this.exerciseType = enums.typeExercise[0];
        }

        if (enums.equipment.length > 0) {
          this.equipment = enums.equipment[0];
        }

        if (enums.muscleGroup.length > 0) {
          this.muscle = enums.muscleGroup[0];
        }
      },
      error: (error) => console.error('Error loading enums:', error),
    });
  }

  loadAllExercises() {
    this.isLoading = true;
    this.exerciseService.getMyExercises(0, 1000).subscribe({
      next: (myResponse: PageResponse<Exercise>) => {
        this.myExercisesForTemplateFilter = myResponse.content || [];
        this.customExercises = new Set(this.myExercisesForTemplateFilter);

        this.exerciseService
          .getTemplateExercises(0, 1000)
          .subscribe({
            next: (templateResponse: PageResponse<Exercise>) => {
              const visibleTemplates = (templateResponse.content || []).filter(
                (template) => !this.templateAlreadyInMyExercises(template),
              );
              this.applyExercises([
                ...visibleTemplates,
                ...this.myExercisesForTemplateFilter,
              ]);
            },
            error: (error) => {
              console.error('Error loading template exercises:', error);
              this.applyExercises(this.myExercisesForTemplateFilter);
            },
          });
      },
      error: () => {
        this.myExercisesForTemplateFilter = [];
        this.customExercises.clear();

        this.exerciseService
          .getTemplateExercises(0, 1000)
          .subscribe({
            next: (response: PageResponse<Exercise>) => {
              this.applyExercises(response.content || []);
            },
            error: (error) => this.handleLoadError(error),
          });
      },
    });
  }

  private applyExercises(exercises: Exercise[]) {
    this.allExercises = exercises;
    this.filteredExercises = exercises;
    this.isLoading = false;
    this.applyFilters();
  }

  ngOnDestroy() {
    if (this.layoutBackButtonTimer) {
      clearTimeout(this.layoutBackButtonTimer);
    }
    if (this.layoutBackButton) {
      this.layoutBackButton.style.display = this.layoutBackButtonDisplay;
    }
    this.videoResizeObserver?.disconnect();
  }

  goBack(): void {
    this.location.back();
  }

  private hideLayoutBackButton(): void {
    const host = this.hostElement.nativeElement;
    const button = Array.from(document.querySelectorAll<HTMLElement>('button')).find(
      (candidate) =>
        !host.contains(candidate) && candidate.textContent?.trim().toLowerCase() === 'back',
    );

    if (!button) return;

    this.layoutBackButton = button;
    this.layoutBackButtonDisplay = button.style.display;
    button.style.setProperty('display', 'none', 'important');
  }

  private updateVideoPlayerSize(wrapper: HTMLElement) {
    const rect = wrapper.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height || (width * 9) / 16));

    if (this.videoPlayerWidth === width && this.videoPlayerHeight === height) {
      return;
    }

    this.videoPlayerWidth = width;
    this.videoPlayerHeight = height;
  }

  private handleLoadError(error: any) {
    console.error('Error loading exercises:', error);
    this.isLoading = false;
  }

  createExercise() {
    if (!this.exerciseName.trim()) return;

    if (this.editingExercise && !this.canManageExercise(this.editingExercise)) {
      console.warn('Edit blocked: current user is not the owner of this exercise');
      return;
    }

    const videoId = this.getYouTubeVideoId(this.videoLink);
    const generatedThumbnail = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : '';

    const exercise: any = {
      name: this.exerciseName,
      type: this.exerciseType,
      equipment: this.equipment,
      muscle: this.muscle,
      isTemplate: this.canCreateTemplate ? this.isTemplate : false,
      videoLink: this.videoLink,
      description: this.exerciseDescription,
      createdBy: this.editingExercise?.createdBy || null,

      imageUrl:
        this.getExerciseImageUrl(this.editingExercise) || generatedThumbnail,
      thumbnailUrl:
        this.getExerciseImageUrl(this.editingExercise) || generatedThumbnail,
    };

    if (this.editingExercise) {
      this.exerciseService.updateExercise(this.editingExercise.id!, exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.resetForm();
          this.closeCreateModal();
        },
        error: (error) => console.error('Error updating exercise:', error),
      });
    } else {
      this.exerciseService.createExercise(exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.resetForm();
          this.closeCreateModal();
        },
        error: (error) => console.error('Error creating exercise:', error),
      });
    }
  }

  resetForm() {
    this.exerciseName = '';
    this.exerciseType = this.enums?.typeExercise[0] || '';
    this.equipment = this.enums?.equipment[0] || '';
    this.muscle = this.enums?.muscleGroup[0] || '';
    this.videoLink = '';
    this.exerciseDescription = '';
    this.isTemplate = false;
    this.editingExercise = null;
  }

  editExercise(exercise: Exercise) {
    if (!this.canManageExercise(exercise)) {
      console.warn('Edit blocked: current user is not the owner of this exercise');
      return;
    }

    this.editingExercise = exercise;
    this.exerciseName = exercise.name;
    this.exerciseType = exercise.type;
    this.equipment = exercise.equipment;
    this.muscle = exercise.muscle;
    this.isTemplate = this.canCreateTemplate ? exercise.isTemplate || false : false;
    this.videoLink = this.getExerciseVideoLink(exercise);
    this.exerciseDescription = exercise.description || '';
    this.showCreateModal = true;
  }

  deleteExercise(exercise: Exercise) {
    if (!this.canManageExercise(exercise)) {
      console.warn('Delete blocked: current user is not the owner of this exercise');
      return;
    }

    this.exerciseToDelete = exercise;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (this.exerciseToDelete) {
      if (!this.canManageExercise(this.exerciseToDelete)) {
        console.warn('Delete blocked: current user is not the owner of this exercise');
        this.closeDeleteModal();
        return;
      }

      this.exerciseService.deleteExercise(this.exerciseToDelete.id!).subscribe({
        next: () => {
          this.loadAllExercises();
          this.closeDeleteModal();
        },
        error: (error) => console.error('Error deleting exercise:', error),
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.exerciseToDelete = null;
  }

  applyFilters() {
    const q = this.searchTerm.trim().toLowerCase();

    this.filteredExercises = this.allExercises.filter((exercise) => {
      const matchesSearch =
        !q ||
        exercise.name.toLowerCase().includes(q) ||
        exercise.equipment?.toLowerCase().includes(q) ||
        exercise.muscle?.toLowerCase().includes(q) ||
        exercise.type?.toLowerCase().includes(q);

      const matchesEquipment =
        !this.selectedEquipment || exercise.equipment === this.selectedEquipment;

      const matchesMuscle =
        !this.selectedMuscle || exercise.muscle === this.selectedMuscle;

      const matchesType = !this.selectedType || exercise.type === this.selectedType;

      return matchesSearch && matchesEquipment && matchesMuscle && matchesType;
    });

    this.clearSelectionIfFilteredOut();
  }

  onSearch() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  canShowExerciseActions(exercise: Exercise): boolean {
    return this.isCustomExercise(exercise);
  }

  canManageExercise(exercise: Exercise | null): boolean {
    if (!exercise) return false;
    return this.isCustomExercise(exercise);
  }

  isCustomExercise(exercise: Exercise): boolean {
    return this.customExercises.has(exercise);
  }

  private clearSelectionIfFilteredOut() {
    if (!this.selectedExercise) return;

    const selectedStillVisible = this.filteredExercises.some(
      (exercise) => exercise.id === this.selectedExercise,
    );

    if (!selectedStillVisible) {
      this.selectedExercise = null;
    }
  }

  getInstructionLines(exercise: Exercise | null): string[] {
    if (!exercise) return [];

    const data = exercise as any;
    const rawInstructions =
      data.instructions ||
      data.instruction ||
      data.instructionSteps ||
      data.steps ||
      exercise.description ||
      '';

    return this.normalizeDetailLines(rawInstructions);
  }

  getTipLines(exercise: Exercise | null): string[] {
    if (!exercise) return [];

    const data = exercise as any;
    const rawTips =
      data.tips ||
      data.tip ||
      data.coachingTips ||
      data.safetyTips ||
      data.notes ||
      '';

    return this.normalizeDetailLines(rawTips);
  }

  private normalizeDetailLines(value: any): string[] {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }

    return String(value)
      .split(/\r?\n|(?:^|\s)(?:\d+[\).]|[-•])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private templateAlreadyInMyExercises(template: Exercise): boolean {
    const templateKeys = this.getExerciseDuplicateKeys(template);

    return this.myExercisesForTemplateFilter.some((exercise) => {
      const exerciseKeys = this.getExerciseDuplicateKeys(exercise);
      return exerciseKeys.some((key) => templateKeys.includes(key));
    });
  }

  private getExerciseDuplicateKeys(exercise: Exercise): string[] {
    const keys = new Set<string>();

    const id = String((exercise as any).id || '').trim();
    const refId = String((exercise as any).exerciseRef?.id || '').trim();

    if (id) keys.add(`id:${id}`);
    if (refId) keys.add(`id:${refId}`);

    const name = String(
      (exercise as any).name || (exercise as any).exerciseRef?.name || '',
    )
      .trim()
      .toLowerCase();

    const type = String(
      (exercise as any).type || (exercise as any).exerciseRef?.type || '',
    )
      .trim()
      .toLowerCase();

    const muscle = String(
      (exercise as any).muscle || (exercise as any).exerciseRef?.muscle || '',
    )
      .trim()
      .toLowerCase();

    const equipment = String(
      (exercise as any).equipment || (exercise as any).exerciseRef?.equipment || '',
    )
      .trim()
      .toLowerCase();

    if (name) keys.add(`name:${name}`);
    if (name && type) keys.add(`name_type:${name}|${type}`);
    if (name && muscle && equipment) {
      keys.add(`details:${name}|${type}|${muscle}|${equipment}`);
    }

    return Array.from(keys);
  }
}
