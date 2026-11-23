import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';

import { ExerciseService, PageResponse } from 'app/service/exercise.service';
import { WorkoutService } from 'app/service/workout.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
  TypeWorkoutPlan,
} from '@shared/models/workout.models';
import { Exercise, ExerciseSet, WorkoutSetType } from '@shared/models/exercice.models';
import { daysInCalendarOrder } from '@shared/models/program-days';
import { workoutDayActive } from '@shared/models/client-day-activity';
import {
  GroupType,
  Measure,
  SUPERSET_MAX,
  canMoveGroup,
  changeMeasure,
  flattenSets,
  groupBounds,
  groupCount,
  groupMembers,
  groupRest,
  groupTypeOf,
  isGroupEnd,
  isGroupStart,
  isUniform,
  isWarmupExercise,
  measureOf,
  memberLabel,
  moveGroup,
  setGroupCount,
  setGroupRest,
  setValue,
  syncGroup,
  ungroup,
  warmupCount,
  writeSetValue,
} from '@shared/models/exercise-groups';

@Injectable({ providedIn: 'root' })
export class WorkoutPlanFacade {
  private userid = sessionStorage.getItem('userId');

  private _plan = new BehaviorSubject<WorkoutPlan>({
    name: '',
    details: '',
    workoutDays: [],
    typeWorkoutPlan: TypeWorkoutPlan.STRENGTH_TRAINING,
    isWorkoutPlanTemplate: false,
    coach: { id: this.userid },
  });

  plan$ = this._plan.asObservable();

  get plan(): WorkoutPlan {
    return this._plan.value;
  }

  setPlan(p: WorkoutPlan) {
    this._plan.next(p);
  }

  showPlanDescription = false;
  showRestNotes = false;

  days: WorkoutDay[] = [];
  selectedDay: WorkoutDay | null = null;

  showExerciseSelector = false;
  hoveringExerciseId: string | null = null;

  /** Superset ou circuit qui reçoit les exercices choisis dans la bibliothèque (null = la séance). */
  addTargetGroup: { id: string; type: GroupType } | null = null;
  /** La bibliothèque remplit le bloc « Échauffement » en haut de la séance. */
  addTargetWarmup = false;
  /** Exercices de groupe dont le coach a ouvert « Régler série par série ». */
  private setDetailOpen = new Set<string>();

  searchQuery = '';
  muscleFilter = '';
  equipmentFilter = '';
  typeFilter = '';

  exerciseDatabase: Exercise[] = [];
  loading = false;
  /** Total of the current search (all pages), and whether the list was fetched once. */
  totalExercises = 0;
  exercisesLoaded = false;

  page = 0;
  size = 10;
  totalPages = 1;

  exerciseCatalog: Exercise[] = [
    { id: '1', name: 'Barbell Squat', sets: [] },
    { id: '2', name: 'Bench Press', sets: [] },
    { id: '3', name: 'Deadlift', sets: [] },
    { id: '4', name: 'Pull-ups', sets: [] },
    { id: '5', name: 'Plank', sets: [] },
  ];

  filteredExercises: Exercise[] = [...this.exerciseCatalog];

  isExerciseModalOpen = false;
  exerciseStep: 'list' | 'detail' = 'list';
  exerciseSearch = '';
  selectedExercise: any = null;

  editingExerciseDescription: string | null = null;

  constructor(
    private exerciseRefService: ExerciseService,
    private workoutService: WorkoutService,
    private coachSettingsService: CoachSettingsService,
  ) {}

  shouldShowWeightField(): boolean {
    return this.coachSettingsService.shouldShowExerciseWeight();
  }

  getWeightUnitLabel(): string {
    return this.coachSettingsService.getWeightUnit();
  }

  /** Pas de poids tant que le coach n'en écrit pas un (jamais « 0 » chez le client). */
  private defaultWeightForSet(_isCardio: boolean): number | null {
    return null;
  }

  /** Texte du champ poids : vide sans poids, « 62.5 » sinon. */
  weightText(weight: number | null | undefined): string {
    return weight != null && Number(weight) > 0 ? String(weight) : '';
  }

  /** « 62,5 » ou « 62.5 » tapé par le coach ; vide = pas de poids. */
  private parseWeight(raw: unknown): number | null {
    if (raw === '' || raw == null) return null;
    const n = Number(String(raw).replace(',', '.').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private stripWeightsWhenDisabled(days: WorkoutDay[]): WorkoutDay[] {
    if (this.shouldShowWeightField()) return days;

    return (days || []).map((day) => ({
      ...day,
      workoutSessions: (day.workoutSessions || []).map((session) => ({
        ...session,
        exercises: (session.exercises || []).map((exercise) => ({
          ...exercise,
          sets: (exercise.sets || []).map((set) => ({
            ...set,
            weight: null,
          })),
        })),
      })),
      session: day.session
        ? {
            ...day.session,
            exercises: (day.session.exercises || []).map((exercise) => ({
              ...exercise,
              sets: (exercise.sets || []).map((set) => ({
                ...set,
                weight: null,
              })),
            })),
          }
        : day.session,
    }));
  }

  /**
   * Opening a plan for editing: this service is shared by the whole app, so the previous page's plan, days and
   * open panels are cleared first (they used to show until the new plan arrived).
   */
  initEdit() {
    this.days = [];
    this.selectedDay = null;
    this.resetUiState();
  }

  initCreate() {
    this.days = [];
    this.selectedDay = null;

    this.setPlan({
      name: '',
      details: '',
      workoutDays: [],
      typeWorkoutPlan: TypeWorkoutPlan.STRENGTH_TRAINING,
      isWorkoutPlanTemplate: false,
      coach: { id: this.userid },
    });

    this.resetUiState();
    this.initDefaultDay();
  }

  private resetUiState() {
    this.showPlanDescription = false;
    this.showRestNotes = false;
    this.showExerciseSelector = false;
    this.addTargetGroup = null;
    this.addTargetWarmup = false;
    this.setDetailOpen.clear();
    this.hoveringExerciseId = null;

    this.searchQuery = '';
    this.muscleFilter = '';
    this.equipmentFilter = '';
    this.typeFilter = '';

    this.page = 0;
    this.size = 10;
    this.totalPages = 1;
    this.exercisesLoaded = false; // filters are back to default: fetch the first page again (in the background)

    this.isExerciseModalOpen = false;
    this.exerciseStep = 'list';
    this.exerciseSearch = '';
    this.selectedExercise = null;

    this.editingExerciseDescription = null;
    this.filteredExercises = [...this.exerciseCatalog];
  }

  syncPlanDays() {
    this.setPlan({
      ...this.plan,
      workoutDays: this.stripWeightsWhenDisabled(this.days),
      isWorkoutPlanTemplate: Boolean(this.plan.isWorkoutPlanTemplate),
    });
  }

  private initDefaultDay() {
    const firstDay: WorkoutDay = {
      id: crypto.randomUUID(),
      name: 'Day 1',
      isRestDay: false,
      showDescription: false,
      title: 'Day 1',
      dayNumber: 1,
      restDay: false,
      workoutSessions: [],
      session: null,
      description: '',
      status: 'PENDING',
    };

    this.days.push(firstDay);
    this.selectedDay = firstDay;
    this.syncPlanDays();
  }

  setDurationWeeks(weeks: number) {
    const safeWeeks = Math.max(1, Math.min(Number(weeks) || 1, 12));
    const totalDays = safeWeeks * 7;
    const currentDays = [...this.days];

    this.days = Array.from({ length: totalDays }, (_, index) => {
      const existing = currentDays[index];

      if (existing) {
        existing.dayNumber = index + 1;
        existing.title = `Day ${(index % 7) + 1}`;
        existing.name = existing.title;
        return existing;
      }

      return {
        id: crypto.randomUUID(),
        name: `Day ${(index % 7) + 1}`,
        isRestDay: false,
        showDescription: false,
        title: `Day ${(index % 7) + 1}`,
        dayNumber: index + 1,
        restDay: false,
        workoutSessions: [],
        session: null,
        description: '',
        status: 'PENDING',
      };
    });

    this.selectedDay = this.days.find((day) => day.id === this.selectedDay?.id) || this.days[0] || null;
    this.syncPlanDays();
  }

  loadPlanForEdit(id: string) {
    // The page shows its own loading state: no full-screen loader.
    return this.workoutService.getWorkoutById(id, true);
  }

  private buildSavePayload(): WorkoutPlan {
    const payload: WorkoutPlan = {
      ...this.plan,
      workoutDays: this.stripWeightsWhenDisabled(this.days),
      coach: this.plan.coach ?? { id: this.userid },
      client: this.plan.client ?? null,
      typeWorkoutPlan:
        this.plan.typeWorkoutPlan ?? TypeWorkoutPlan.STRENGTH_TRAINING,
      isWorkoutPlanTemplate: Boolean(this.plan.isWorkoutPlanTemplate),
    };

    this.setPlan(payload);

    return payload;
  }

  createPlan() {
    const payload = this.buildSavePayload();
    return this.workoutService.createWorkout(payload, true) // the toolbar shows the saving state
      .pipe(tap((saved) => this.rememberRevision(saved)));
  }

  updatePlan(overlap?: 'SHIFT' | 'REMOVE' | null) {
    const payload = this.buildSavePayload();
    return this.workoutService.updateWorkout(payload.id!, payload, true, overlap)
      .pipe(tap((saved) => this.rememberRevision(saved)));
  }

  /** The next save sends the revision the server gave this one (two devices: 409 PLAN_CHANGED otherwise). */
  private rememberRevision(saved: WorkoutPlan | null | undefined): void {
    if (saved && saved.revision != null) this.setPlan({ ...this.plan, revision: saved.revision });
  }

  private clean(value: any): string {
    if (value === null || value === undefined) return '';

    const text = String(value).trim();

    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') {
      return '';
    }

    return text;
  }

  private getExerciseRef(e: any): any {
    return e?.exerciseRef || e?.ref || e?.exercise || null;
  }

  private getExerciseVideoLink(e: any): string {
    const ref = this.getExerciseRef(e);

    return (
      this.clean(e?.videoLink) ||
      this.clean(e?.videoUrl) ||
      this.clean(e?.video) ||
      this.clean(e?.url) ||
      this.clean(ref?.videoLink) ||
      this.clean(ref?.videoUrl) ||
      this.clean(ref?.video) ||
      this.clean(ref?.url)
    );
  }

  private getExerciseImageUrl(e: any): string {
    const ref = this.getExerciseRef(e);

    return (
      this.clean(e?.imageUrl) ||
      this.clean(e?.image) ||
      this.clean(e?.thumbnailUrl) ||
      this.clean(e?.photoUrl) ||
      this.clean(e?.pictureUrl) ||
      this.clean(ref?.imageUrl) ||
      this.clean(ref?.image) ||
      this.clean(ref?.thumbnailUrl) ||
      this.clean(ref?.photoUrl) ||
      this.clean(ref?.pictureUrl)
    );
  }

  private getYouTubeVideoId(url: string): string {
    const cleaned = this.clean(url);

    if (!cleaned) return '';

    try {
      const parsed = new URL(cleaned);
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

        if (!videoId && segments[0] === 'live') {
          videoId = segments[1] ?? '';
        }
      }

      return videoId.split('?')[0].split('&')[0].trim();
    } catch {
      const regex =
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^"&?/\s]{6,})/;

      const match = cleaned.match(regex);

      return match ? match[1] : '';
    }
  }

  private getYoutubeThumbnailFromUrl(url: string): string {
    const videoId = this.getYouTubeVideoId(url);

    if (!videoId) return '';

    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  private getGeneratedThumbnail(e: any): string {
    const imageUrl = this.getExerciseImageUrl(e);

    if (imageUrl) {
      return imageUrl;
    }

    const videoUrl = this.getExerciseVideoLink(e);

    return this.getYoutubeThumbnailFromUrl(videoUrl);
  }

  private buildInitialSets(isCardio: boolean): ExerciseSet[] {
    const autoFill = this.coachSettingsService.shouldAutoFillWorkoutDefaults();

    if (!autoFill) {
      return isCardio
        ? [{
            setNumber: 1,
            type: 'REGULAR',
            duration: 30,
            weight: null,
            restMin: 1,
            restSec: 0
          }]
        : [{
            setNumber: 1,
            type: 'REGULAR',
            reps: '8',
            weight: this.defaultWeightForSet(false),
            restMin: 1,
            restSec: 0
          }];
    }

    const count = isCardio
      ? this.coachSettingsService.getCardioSets()
      : this.coachSettingsService.getWorkoutSets();

    return Array.from({ length: count }, (_, index) => {
      if (isCardio) {
        return {
          setNumber: index + 1,
          type: 'REGULAR',
          duration: this.coachSettingsService.getCardioMinutes(),
          weight: null,
          restMin: 1,
          restSec: 0,
        };
      }

      return {
        setNumber: index + 1,
        type: 'REGULAR',
        reps: this.coachSettingsService.getWorkoutReps(),
        weight: this.defaultWeightForSet(false),
        restMin: 1,
        restSec: 0,
      };
    });
  }

  private buildAdditionalSet(isCardio: boolean, setNumber: number): ExerciseSet {
    const autoFill = this.coachSettingsService.shouldAutoFillWorkoutDefaults();

    if (!autoFill) {
      return isCardio
        ? {
            setNumber: setNumber + 1,
            type: 'REGULAR',
            duration: 10,
            weight: null,
            restMin: 1,
            restSec: 0
          }
        : {
            setNumber: setNumber + 1,
            type: 'REGULAR',
            reps: '8',
            weight: this.defaultWeightForSet(false),
            restMin: 1,
            restSec: 0
          };
    }

    return isCardio
      ? {
          setNumber: setNumber + 1,
          type: 'REGULAR',
          duration: this.coachSettingsService.getCardioMinutes(),
          weight: null,
          restMin: 1,
          restSec: 0,
        }
      : {
          setNumber: setNumber + 1,
          type: 'REGULAR',
          reps: this.coachSettingsService.getWorkoutReps(),
          weight: this.defaultWeightForSet(false),
          restMin: 1,
          restSec: 0,
        };
  }

  private normalizeExerciseForDrawer(e: Exercise): Exercise {
    const isCardio = e.type === 'CARDIO';
    const videoLink = this.getExerciseVideoLink(e);
    const thumbnailUrl = this.getGeneratedThumbnail(e);

    return {
      ...(e as any),

      id: e.id,
      name: e.name,
      type: e.type,
      exerciseRef: (e as any).exerciseRef,

      videoUrl: videoLink,
      videoLink,

      imageUrl: thumbnailUrl,
      image: thumbnailUrl,
      thumbnailUrl,
      photoUrl: thumbnailUrl,

      sets: this.buildInitialSets(isCardio),
    } as Exercise;
  }

  private normalizeExerciseForSession(ex: Exercise): Exercise {
    const isCardio = ex.type === 'CARDIO';
    const videoLink = this.getExerciseVideoLink(ex);
    const thumbnailUrl = this.getGeneratedThumbnail(ex);

    return {
      ...(ex as any),

      id: crypto.randomUUID(),
      sourceExerciseId: this.getExerciseIdentity(ex),
      name: ex.name,
      type: ex.type,
      exerciseRef: (ex as any).exerciseRef,

      videoUrl: videoLink,
      videoLink,

      imageUrl: thumbnailUrl,
      image: thumbnailUrl,
      thumbnailUrl,
      photoUrl: thumbnailUrl,

      sets: this.buildInitialSets(isCardio),
    } as Exercise;
  }

  loadExercisesFromAPI() {
    this.loading = true;

    const filters = {
      name: this.searchQuery,
      muscle: this.muscleFilter,
      equipment: this.equipmentFilter,
      type: this.typeFilter,
    };

    // The exercise panel shows its own loading state: no full-screen loader.
    this.exerciseRefService
      .getExercises(this.page, this.size, filters, true)
      .subscribe({
        next: (res: PageResponse<Exercise>) => {
          this.exerciseDatabase = (res.content || []).map((e: Exercise) =>
            this.normalizeExerciseForDrawer(e),
          );

          this.totalPages = res.totalPages ?? 1;
          this.totalExercises = res.totalElements ?? this.exerciseDatabase.length;
          this.exercisesLoaded = true;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading exercises:', error);
          this.loading = false;
        },
      });
  }

  onFilterChange() {
    this.page = 0;
    this.loadExercisesFromAPI();
  }

  nextPage() {
    if (this.page + 1 < this.totalPages) {
      this.page++;
      this.loadExercisesFromAPI();
    }
  }

  prevPage() {
    if (this.page > 0) {
      this.page--;
      this.loadExercisesFromAPI();
    }
  }

  goToPage(targetPage: number) {
    if (targetPage < 0 || targetPage >= this.totalPages || targetPage === this.page) {
      return;
    }
    this.page = targetPage;
    this.loadExercisesFromAPI();
  }

  openExerciseSelector() {
    this.addTargetGroup = null;
    this.addTargetWarmup = false;
    this.showExerciseSelector = true;
    if (!this.exercisesLoaded && !this.loading) this.loadExercisesFromAPI();
  }

  /** Fetches the first exercises in the background, so the panel opens with its list already there. */
  prefetchExercises() {
    if (!this.exercisesLoaded && !this.loading) this.loadExercisesFromAPI();
  }

  closeExerciseSelector() {
    this.showExerciseSelector = false;
    this.addTargetGroup = null;
    this.addTargetWarmup = false;
  }

  trackByDay(index: number, d: WorkoutDay) {
    return d.id;
  }

  selectDay(d: WorkoutDay) {
    this.selectedDay = d;
  }

  addDay() {
    const sortedDays = [...this.days].sort((a, b) => {
      const aTime = a.date ? this.parseDateOnly(a.date).getTime() : 0;
      const bTime = b.date ? this.parseDateOnly(b.date).getTime() : 0;
      return aTime - bTime;
    });

    let nextDate = new Date();

    if (sortedDays.length > 0) {
      const lastDay = sortedDays[sortedDays.length - 1];
      nextDate = lastDay.date ? this.parseDateOnly(lastDay.date) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);
    }

    const newIdx = this.days.length + 1;
    const nextDateStr = this.toDateOnly(nextDate);

    const session: WorkoutSession = {
      name: 'Main Session',
      exercises: [],
      totalSets: 0,
      totalReps: 0,
      totalDurationMin: 0,
    };

    const newDay: WorkoutDay = {
      id: crypto.randomUUID(),
      name: `Day ${newIdx}`,
      isRestDay: false,
      showDescription: false,
      title: `Day ${newIdx}`,
      dayNumber: newIdx,
      date: nextDateStr,
      dayOfWeek: nextDate.toLocaleDateString('en-US', { weekday: 'long' }),
      restDay: false,
      workoutSessions: [session],
      session,
      description: '',
      status: 'PENDING',
    };

    this.days.push(newDay);
    this.selectedDay = newDay;
    this.syncPlanDays();
  }

  duplicateSelectedDay() {
    if (!this.selectedDay) return;

    const sortedDays = [...this.days].sort((a, b) => {
      const aTime = a.date ? this.parseDateOnly(a.date).getTime() : 0;
      const bTime = b.date ? this.parseDateOnly(b.date).getTime() : 0;
      return aTime - bTime;
    });

    let nextDate = new Date();

    if (sortedDays.length > 0) {
      const lastDay = sortedDays[sortedDays.length - 1];
      nextDate = lastDay.date ? this.parseDateOnly(lastDay.date) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);
    }

    const copy: WorkoutDay = JSON.parse(JSON.stringify(this.selectedDay));
    copy.id = crypto.randomUUID();
    copy.date = this.toDateOnly(nextDate);
    copy.dayOfWeek = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
    copy.dayNumber = this.days.length + 1;
    copy.title = `Day ${copy.dayNumber}`;
    copy.name = copy.title;

    if (!copy.workoutSessions || copy.workoutSessions.length === 0) {
      copy.workoutSessions = [
        {
          name: 'Main Session',
          exercises: [],
          totalSets: 0,
          totalReps: 0,
          totalDurationMin: 0,
        },
      ];
    }

    copy.session = copy.workoutSessions[0];

    this.days.push(copy);
    this.selectedDay = copy;
    this.syncPlanDays();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();

    if (this.days.length <= 1) return;

    const idx = this.days.indexOf(d);
    this.days.splice(idx, 1);

    if (this.selectedDay === d) {
      this.selectedDay = this.days[Math.max(0, idx - 1)] || null;
    }

    this.syncPlanDays();
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.selectedDay) {
      this.selectedDay.showDescription = !this.selectedDay.showDescription;
    }
  }

  toggleRestNotes() {
    this.showRestNotes = !this.showRestNotes;
  }

  toggleRestDay() {
    if (!this.selectedDay) return;

    this.selectedDay.isRestDay = !this.selectedDay.isRestDay;
    this.selectedDay.restDay = this.selectedDay.isRestDay;

    this.selectedDay.workoutSessions = [];
    this.selectedDay.session = null;
  }

  filterExercises() {
    const q = (this.exerciseSearch || '').toLowerCase();

    this.filteredExercises = this.exerciseCatalog.filter((e) =>
      (e.name || '').toLowerCase().includes(q),
    );
  }

  openExerciseModal() {
    this.isExerciseModalOpen = true;
    this.exerciseStep = 'list';
    this.exerciseSearch = '';
    this.filterExercises();
  }

  closeExerciseModal() {
    this.isExerciseModalOpen = false;
    this.selectedExercise = null;
  }

  showExerciseDetail(ex: Exercise) {
    this.selectedExercise = { ...(ex as any) };
    this.exerciseStep = 'detail';
  }

  private get currentSession(): WorkoutSession | null {
    if (!this.selectedDay) return null;

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
    }

    return this.selectedDay.workoutSessions[0];
  }

  private parseFirstInt(s?: string): number {
    if (!s) return 0;

    const m = String(s).match(/\d+/);

    return m ? parseInt(m[0], 10) : 0;
  }

  recomputeSession(s: WorkoutSession) {
    const exercises = s.exercises || [];

    s.totalSets = exercises.reduce((a, e) => a + (e.sets?.length || 0), 0);

    s.totalReps = exercises.reduce((acc, e) => {
      const repsSum = (e.sets || []).reduce(
        (rAcc, st) => rAcc + this.parseFirstInt(st.reps),
        0,
      );

      return acc + repsSum;
    }, 0);

    s.totalDurationMin = exercises.reduce((acc, e) => {
      const durSum = (e.sets || []).reduce(
        (dAcc, st) => dAcc + (st.duration || 0),
        0,
      );

      return acc + durSum;
    }, 0);
  }

  private get exList(): Exercise[] {
    return this.currentSession?.exercises ?? [];
  }

  trackByExercise = (_: number, ex: Exercise) => ex.id;

  handleSelectExercise(ex: Exercise) {
    const session = this.currentSession;

    const target = this.addTargetGroup;

    // Le même exercice peut revenir dans la séance (ex. squat lourd au début, léger à la fin) ;
    // seulement pas deux fois dans le même superset / circuit.
    if (!session || (target && this.isExerciseAdded(ex))) return;

    const copy = this.normalizeExerciseForSession(ex);

    if (target) {
      this.insertIntoGroup(session.exercises, copy, target);
    } else if (this.addTargetWarmup) {
      // Une seule série légère, rangée à la fin du bloc « Échauffement ».
      copy.sets = (copy.sets || []).slice(0, 1).map((s) => ({ ...s, type: 'WARM_UP' as WorkoutSetType }));
      session.exercises.splice(warmupCount(session.exercises), 0, copy);
    } else {
      session.exercises.push(copy);
    }
    this.recomputeSession(session);
  }

  /**
   * Glisser depuis la bibliothèque : l'exercice tombe à la place `index`.
   * Jamais au milieu d'un superset / circuit, jamais au-dessus de l'échauffement : on recule à la place permise.
   */
  insertExerciseAt(ex: Exercise, index: number): Exercise | null {
    const session = this.currentSession;
    if (!session) return null;
    const list = session.exercises;
    let at = Math.max(warmupCount(list), Math.min(Math.round(index), list.length));
    if (at < list.length && list[at].supersetGroupId) at = groupBounds(list, at).start;
    const copy = this.normalizeExerciseForSession(ex);
    list.splice(at, 0, copy);
    this.recomputeSession(session);
    return copy;
  }

  // ---------- Échauffement (voir shared/models/exercise-groups.ts) ----------

  /** « Ajouter un échauffement » : la bibliothèque s'ouvre et range les exercices choisis en haut de la séance. */
  startWarmup() {
    this.addTargetGroup = null;
    this.addTargetWarmup = true;
    this.showExerciseSelector = true;
    if (!this.exercisesLoaded && !this.loading) this.loadExercisesFromAPI();
  }

  /** Nombre d'exercices du bloc « Échauffement » en haut de la séance. */
  get warmupCount(): number {
    return warmupCount(this.exList);
  }

  // ---------- Superset et circuit (voir shared/models/exercise-groups.ts) ----------

  /** « ou créer un groupe : Superset · Circuit » : la bibliothèque s'ouvre et remplit le nouveau groupe. */
  startGroup(type: GroupType) {
    this.addTargetWarmup = false;
    this.addTargetGroup = { id: this.getNewSupersetGroupId(), type };
    this.showExerciseSelector = true;
    if (!this.exercisesLoaded && !this.loading) this.loadExercisesFromAPI();
  }

  /** « Ajouter un exercice au circuit / au superset » sous le dernier exercice du groupe. */
  addToGroup(index: number) {
    const ex = this.exList[index];
    if (!ex?.supersetGroupId) return;
    this.addTargetWarmup = false;
    this.addTargetGroup = { id: ex.supersetGroupId, type: groupTypeOf(ex) };
    this.showExerciseSelector = true;
    if (!this.exercisesLoaded && !this.loading) this.loadExercisesFromAPI();
  }

  /** Le groupe choisi n'a encore aucun exercice : on affiche sa carte d'attente. */
  get pendingGroup(): { id: string; type: GroupType } | null {
    const t = this.addTargetGroup;
    if (!t || !this.showExerciseSelector) return null;
    return this.exList.some((e) => e.supersetGroupId === t.id) ? null : t;
  }

  /** Type du groupe qui termine la séance, ou null si le dernier exercice est seul. */
  get trailingGroupType(): GroupType | null {
    const last = this.exList[this.exList.length - 1];
    return last?.supersetGroupId ? groupTypeOf(last) : null;
  }

  isAddingToGroup(index: number): boolean {
    const id = this.exList[index]?.supersetGroupId;
    return !!id && this.showExerciseSelector && this.addTargetGroup?.id === id;
  }

  private insertIntoGroup(list: Exercise[], ex: Exercise, target: { id: string; type: GroupType }) {
    const last = list.map((e) => e.supersetGroupId).lastIndexOf(target.id);
    const members = last >= 0 ? groupMembers(list, last) : [];
    const count = members.length ? groupCount(members) : 3;
    const cardio = ex.type === 'CARDIO';

    ex.supersetGroupId = target.id;
    ex.groupType = target.type;
    ex.groupRestSec = members.length ? groupRest(members) : target.type === 'CIRCUIT' ? 60 : 90;
    ex.measure = cardio ? 'TIME' : null;
    ex.sets = Array.from({ length: count }, (_, i) => ({
      setNumber: i + 1,
      type: 'REGULAR' as WorkoutSetType,
      reps: cardio ? '' : target.type === 'CIRCUIT' ? '15' : '10',
      durationSec: cardio ? 30 : null,
      weight: cardio ? null : this.defaultWeightForSet(false),
      restMin: 0,
      restSec: 0,
    }));

    if (last >= 0) list.splice(last + 1, 0, ex);
    else list.push(ex);
  }

  /**
   * Le petit lien « + Superset » : seulement entre deux exercices simples. À côté d'un superset ou d'un circuit,
   * on passe par « Ajouter un exercice au superset / au circuit » du groupe.
   */
  canLinkAt(i: number): boolean {
    const a = this.exList[i];
    const b = this.exList[i + 1];
    return !!a && !!b && !a.supersetGroupId && !b.supersetGroupId;
  }

  isGroupStartAt(i: number): boolean {
    return isGroupStart(this.exList, i);
  }

  isGroupEndAt(i: number): boolean {
    return isGroupEnd(this.exList, i);
  }

  groupTypeAt(i: number): GroupType {
    return groupTypeOf(this.exList[i]);
  }

  groupCountAt(i: number): number {
    return groupCount(groupMembers(this.exList, i));
  }

  groupRestAt(i: number): number {
    return groupRest(groupMembers(this.exList, i));
  }

  groupSizeAt(i: number): number {
    return groupMembers(this.exList, i).length;
  }

  memberLabelAt(i: number): string {
    return memberLabel(this.exList, i);
  }

  /** Un superset de plus de 3 exercices : on propose de passer en circuit. */
  suggestCircuitAt(i: number): boolean {
    return this.groupTypeAt(i) === 'SUPERSET' && this.groupSizeAt(i) > SUPERSET_MAX;
  }

  changeGroupCount(i: number, delta: number) {
    const members = groupMembers(this.exList, i);
    if (!members.length) return;
    setGroupCount(members, groupCount(members) + delta);
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  changeGroupRest(i: number, seconds: unknown) {
    setGroupRest(groupMembers(this.exList, i), Number(seconds));
  }

  convertGroup(i: number, type: GroupType) {
    groupMembers(this.exList, i).forEach((m) => (m.groupType = type));
  }

  duplicateGroup(i: number) {
    const list = this.exList;
    const { end } = groupBounds(list, i);
    const id = this.getNewSupersetGroupId();
    const copies = groupMembers(list, i).map((m) => ({
      ...JSON.parse(JSON.stringify(m)),
      id: crypto.randomUUID(),
      supersetGroupId: id,
    }));
    list.splice(end + 1, 0, ...copies);
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  /** Flèches ↑ ↓ de la barre du groupe : tout le groupe passe au-dessus / en dessous du voisin. */
  canMoveGroupAt(i: number, direction: -1 | 1): boolean {
    return canMoveGroup(this.exList, i, direction);
  }

  moveGroupAt(i: number, direction: -1 | 1) {
    moveGroup(this.exList, i, direction);
  }

  ungroupAt(i: number) {
    ungroup(groupMembers(this.exList, i));
  }

  /** Une seule ligne « Toutes les séries » tant que les séries sont identiques et que le coach n'a pas ouvert le détail. */
  isSetDetail(ex: Exercise): boolean {
    return (!!ex.id && this.setDetailOpen.has(ex.id)) || !isUniform(ex);
  }

  openSetDetail(ex: Exercise) {
    if (ex.id) this.setDetailOpen.add(ex.id);
  }

  // ---------- Exercice seul : une ligne « 3 séries · 12 reps · 60 kg · 90 s » tant que les séries sont pareilles ----------

  /** Le chiffre d'une série : minutes (cardio), secondes (au temps) ou répétitions. */
  singleValue(ex: Exercise, s: ExerciseSet | undefined): number | null {
    if (!s) return null;
    if (ex.type === 'CARDIO') return s.duration ?? null;
    return setValue(ex, s);
  }

  /** Repos d'une série en secondes (enregistré en minutes + secondes). */
  restSeconds(s: ExerciseSet | undefined): number {
    return (Number(s?.restMin) || 0) * 60 + (Number(s?.restSec) || 0);
  }

  /** Le détail série par série : ouvert par le coach, ou des séries différentes (poids, reps, repos, type). */
  isSingleDetail(ex: Exercise): boolean {
    if (ex.id && this.setDetailOpen.has(ex.id)) return true;
    const sets = ex.sets || [];
    const first = sets[0];
    return sets.some((s) =>
      this.singleValue(ex, s) !== this.singleValue(ex, first) ||
      (s.weight ?? null) !== (first?.weight ?? null) ||
      this.restSeconds(s) !== this.restSeconds(first) ||
      (s.type || 'REGULAR') !== (first?.type || 'REGULAR'));
  }

  /** « Toutes les séries » : la même valeur dans chaque série. */
  singleChange(ex: Exercise, field: 'value' | 'weight' | 'rest', raw: unknown) {
    (ex.sets || []).forEach((_, si) => this.setFieldChange(ex, si, field, raw));
  }

  /** Une série (ligne du détail). `rest` : secondes, rangées en minutes + secondes. */
  setFieldChange(ex: Exercise, si: number, field: 'value' | 'weight' | 'rest', raw: unknown) {
    const id = ex.id || '';
    if (field === 'weight') {
      this.handleSetChange(id, si, 'weight', raw as string);
    } else if (field === 'rest') {
      const n = raw === '' || raw == null ? 0 : Number(raw);
      const total = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
      this.handleSetChange(id, si, 'restMin', Math.floor(total / 60));
      this.handleSetChange(id, si, 'restSec', total % 60);
    } else {
      const field2 = ex.type === 'CARDIO' ? 'duration' : measureOf(ex) === 'TIME' ? 'durationSec' : 'reps';
      this.handleSetChange(id, si, field2, raw as string);
    }
  }

  /** − / + du nombre de séries : la nouvelle série recopie la dernière. */
  changeSetCount(ex: Exercise, delta: number) {
    const sets = ex.sets || (ex.sets = []);
    if (delta < 0) {
      if (sets.length > 1) sets.pop();
    } else {
      const last = sets[sets.length - 1];
      sets.push(last ? { ...last, setNumber: sets.length + 1 } : this.buildAdditionalSet(ex.type === 'CARDIO', 0));
    }
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  /** « Même valeur partout » : la 1re série recopiée sur les autres, puis la ligne unique revient. */
  flattenSingleSets(ex: Exercise) {
    const first = ex.sets?.[0];
    if (!first) return;
    ex.sets!.forEach((s, si) => {
      if (si === 0) return;
      s.reps = first.reps;
      s.duration = first.duration;
      s.durationSec = first.durationSec;
      s.weight = first.weight ?? null;
      s.restMin = first.restMin;
      s.restSec = first.restSec;
      s.type = first.type;
    });
    if (ex.id) this.setDetailOpen.delete(ex.id);
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  /**
   * ↓ « Recopier vers le bas » : les séries sous `si` prennent ses reps (ou temps), son poids et son repos.
   * Le type (échauffement, drop set…) reste celui de chaque série. Le détail reste ouvert.
   */
  copySetDown(ex: Exercise, si: number) {
    const source = ex.sets?.[si];
    if (!source) return;
    ex.sets!.forEach((s, k) => {
      if (k <= si) return;
      s.reps = source.reps;
      s.duration = source.duration;
      s.durationSec = source.durationSec;
      s.weight = source.weight ?? null;
      s.restMin = source.restMin;
      s.restSec = source.restSec;
    });
    this.openSetDetail(ex);
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  /** « Vider la séance » (menu ⋮ du jour). */
  clearSelectedSession() {
    const session = this.currentSession;
    if (!session) return;
    session.exercises = [];
    this.recomputeSession(session);
  }

  flattenGroupSets(ex: Exercise) {
    flattenSets(ex);
    if (ex.id) this.setDetailOpen.delete(ex.id);
  }

  measureOf(ex: Exercise): Measure {
    return measureOf(ex);
  }

  changeExerciseMeasure(ex: Exercise, measure: Measure) {
    changeMeasure(ex, measure);
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  groupSetValue(ex: Exercise, si: number): number | null {
    return setValue(ex, ex.sets?.[si]);
  }

  /** Change une série (`si`), ou toutes (`si` = -1, ligne « Toutes les séries »). */
  groupSetChange(ex: Exercise, si: number, field: 'value' | 'weight', raw: unknown) {
    const sets = si < 0 ? ex.sets || [] : ex.sets?.[si] ? [ex.sets[si]] : [];
    const n = raw === '' || raw == null ? null : Number(raw);
    const value = n == null || !Number.isFinite(n) ? null : Math.max(0, n);
    sets.forEach((s) => {
      if (field === 'weight') {
        if (this.shouldShowWeightField()) s.weight = this.parseWeight(raw);
      } else {
        writeSetValue(ex, s, value);
      }
    });
    if (this.currentSession) this.recomputeSession(this.currentSession);
  }

  /** Groupes chargés : même type, même repos et même nombre de séries partout (sans retirer de série). */
  private syncSessionGroups<T extends { exercises?: Exercise[] }>(session: T): T {
    const list = session.exercises || [];
    list.forEach((_, i) => {
      if (isGroupStart(list, i)) syncGroup(groupMembers(list, i));
    });
    return session;
  }

  /** Bloqué : déjà dans le superset / circuit qui reçoit l'ajout. Ailleurs, le doublon est permis. */
  isExerciseAdded(exercise: Exercise): boolean {
    const target = this.addTargetGroup;
    if (!target) return false;
    return this.inPool(exercise, this.exList.filter((e) => e.supersetGroupId === target.id));
  }

  /** Déjà quelque part dans la séance : la bibliothèque le signale, sans bloquer. */
  isExerciseInSession(exercise: Exercise): boolean {
    return this.inPool(exercise, this.exList);
  }

  private inPool(exercise: Exercise, pool: Exercise[]): boolean {
    const candidateId = this.getExerciseIdentity(exercise);
    const candidateName = this.clean(exercise?.name).toLowerCase();
    return pool.some((added) => {
      const addedId = this.getExerciseIdentity(added);
      if (candidateId && addedId && candidateId === addedId) return true;

      return !!candidateName &&
        this.clean(added?.name).toLowerCase() === candidateName &&
        this.clean(added?.type).toLowerCase() === this.clean(exercise?.type).toLowerCase();
    });
  }

  private getExerciseIdentity(exercise: any): string {
    const ref = this.getExerciseRef(exercise);
    return this.clean(
      exercise?.sourceExerciseId ||
      (typeof ref === 'string' ? ref : ref?.id) ||
      exercise?.exerciseRefId ||
      exercise?.id,
    );
  }

  addExerciseToSession() {
    const session = this.currentSession;

    if (!session || !this.selectedExercise) return;

    const ex = this.normalizeExerciseForSession(this.selectedExercise);

    session.exercises.push(ex);
    this.recomputeSession(session);
    this.closeExerciseModal();
  }

  setEditingExerciseDescription(exerciseId: string | null) {
    this.editingExerciseDescription = exerciseId;
  }

  handleExerciseDescriptionChange(exerciseId: string, value: string) {
    const session = this.currentSession;

    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);

    if (ex) {
      ex.coachNote = value;
    }
  }

  handleRemoveExercise(exerciseId: string) {
    const session = this.currentSession;

    if (!session) return;

    const list = session.exercises;
    const idx = list.findIndex((e) => e.id === exerciseId);

    if (idx === -1) return;

    const ex = list[idx];
    const groupId = ex.supersetGroupId;

    list.splice(idx, 1);
    this.setDetailOpen.delete(ex.id || '');

    // Le reste du groupe garde ses exercices ; un superset réduit à un seul exercice redevient un exercice simple.
    if (groupId) this.clearInvalidSingleExerciseGroup(groupId);
    this.recomputeSession(session);
  }

  handleAddSet(exerciseId: string) {
    const session = this.currentSession;

    if (!session) return;

    const list = session.exercises;
    const idx = list.findIndex((e) => e.id === exerciseId);

    if (idx === -1) return;

    if (this.isSecondOfSuperset(idx)) return;

    const ex = list[idx];

    if (!ex.sets) ex.sets = [];

    const isCardio = ex.type === 'CARDIO';

    // Un exercice d'échauffement reste un échauffement quand on lui ajoute une série.
    const warmup = isWarmupExercise(ex);
    const added = this.buildAdditionalSet(isCardio, ex.sets.length);
    if (warmup) added.type = 'WARM_UP';
    ex.sets.push(added);

    this.recomputeSession(session);
  }

  handleRemoveSet(exerciseId: string, setIndex: number) {
    const session = this.currentSession;

    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);

    if (!ex?.sets) return;

    ex.sets.splice(setIndex, 1);
    this.recomputeSession(session);
  }

  handleSetChange(
    exerciseId: string,
    setIndex: number,
    field: string,
    value: string | number | WorkoutSetType | null,
  ) {
    const session = this.currentSession;

    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);

    if (!ex?.sets?.[setIndex]) return;

    const set: ExerciseSet = ex.sets[setIndex];

    const nonNegativeNumber = (rawValue: unknown): number | null => {
      if (rawValue === '' || rawValue == null) return null;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
    };

    if (field === 'reps') {
      const normalized = nonNegativeNumber(value);
      set.reps = normalized == null ? '' : String(Math.trunc(normalized));
    }
    if (field === 'duration') {
      const normalized = nonNegativeNumber(value);
      set.duration = normalized == null ? 0 : normalized;
    }
    if (field === 'durationSec') {
      const normalized = nonNegativeNumber(value);
      set.durationSec = normalized == null ? null : Math.round(normalized);
    }
    if (field === 'weight') {
      if (!this.shouldShowWeightField()) return;
      set.weight = this.parseWeight(value);
    }
    if (field === 'restMin') set.restMin = nonNegativeNumber(value) ?? 0;
    if (field === 'restSec') set.restSec = nonNegativeNumber(value) ?? 0;
    if (field === 'type') set.type = value as WorkoutSetType;

    set.setNumber = setIndex + 1;
    this.recomputeSession(session);
  }

  isInSuperset(i: number): boolean {
    const ex = this.exList[i];

    return !!ex?.supersetGroupId;
  }

  isSupersetPair(i: number): boolean {
    if (i < 0 || i >= this.exList.length - 1) return false;

    const a = this.exList[i];
    const b = this.exList[i + 1];

    return !!a?.supersetGroupId && a.supersetGroupId === b?.supersetGroupId;
  }

  isSecondOfSuperset(i: number): boolean {
    if (i <= 0) return false;

    const up = this.exList[i - 1];
    const me = this.exList[i];

    return !!up?.supersetGroupId && up.supersetGroupId === me?.supersetGroupId;
  }

  private getSupersetRun(groupId: string | null | undefined): Exercise[] {
    if (!groupId) return [];

    return this.exList.filter((exercise) => exercise.supersetGroupId === groupId);
  }

  private getContiguousSupersetRun(index: number): { start: number; end: number; groupId: string | null } {
    const list = this.exList;
    const groupId = list[index]?.supersetGroupId || null;

    if (!groupId) {
      return { start: index, end: index, groupId: null };
    }

    let start = index;
    let end = index;

    while (start > 0 && list[start - 1]?.supersetGroupId === groupId) {
      start -= 1;
    }

    while (end < list.length - 1 && list[end + 1]?.supersetGroupId === groupId) {
      end += 1;
    }

    return { start, end, groupId };
  }

  private clearInvalidSingleExerciseGroup(groupId: string | null | undefined): void {
    if (!groupId) return;

    const group = this.getSupersetRun(groupId);

    // Un circuit peut n'avoir qu'un exercice (Tabata) ; un superset non.
    if (group.length === 1 && groupTypeOf(group[0]) === 'SUPERSET') {
      ungroup(group);
    }
  }

  private getNewSupersetGroupId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `superset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  toggleSuperset(i: number): void {
    const session = this.currentSession;

    if (!session) return;

    const list = session.exercises;

    if (i < 0 || i >= list.length - 1) return;

    const a = list[i];
    const b = list[i + 1];

    if (!a || !b) return;

    if (this.isSupersetPair(i)) {
      const groupId = a.supersetGroupId;
      const rightRun = this.getContiguousSupersetRun(i + 1);

      for (let idx = i + 1; idx <= rightRun.end; idx += 1) {
        if (list[idx]?.supersetGroupId === groupId) {
          list[idx].supersetGroupId = null;

          if (!list[idx].sets || list[idx].sets.length === 0) {
            list[idx].sets = this.buildInitialSets(list[idx].type === 'CARDIO');
          }
        }
      }

      this.clearInvalidSingleExerciseGroup(groupId);
      this.recomputeSession(session);
      return;
    }

    const groupId = a.supersetGroupId || b.supersetGroupId || this.getNewSupersetGroupId();
    const aGroup = a.supersetGroupId;
    const bGroup = b.supersetGroupId;
    const grouped = [a, b].find((e) => !!e.supersetGroupId);
    const type: GroupType = [a, b].some((e) => e.supersetGroupId && groupTypeOf(e) === 'CIRCUIT') ? 'CIRCUIT' : 'SUPERSET';
    const rest = grouped ? groupRest(groupMembers(list, list.indexOf(grouped))) : null;

    list.forEach((exercise) => {
      if (
        exercise === a ||
        exercise === b ||
        (aGroup && exercise.supersetGroupId === aGroup) ||
        (bGroup && exercise.supersetGroupId === bGroup)
      ) {
        exercise.supersetGroupId = groupId;
      }
    });

    const members = groupMembers(list, i);
    members.forEach((m) => {
      m.groupType = type;
      if (rest != null) m.groupRestSec = rest;
    });
    syncGroup(members, type);
    this.recomputeSession(session);
  }

  canShowSupersetButton(i: number): boolean {
    const session = this.currentSession;

    if (!session) return false;

    const list = session.exercises;
    const lastIdx = list.length - 1;

    if (i >= lastIdx) return false;

    const current = list[i];
    const next = list[i + 1];

    if (!current || !next) return false;

    // Active links are always displayed so the coach can split/remove the link.
    if (this.isSupersetPair(i)) return true;

    // A new link can be created between any adjacent exercises.
    // This allows Superset A+B+C+D by clicking:
    // A+B, then B+C, then C+D.
    return true;
  }

  private normalizeDaysFromApi(days: WorkoutDay[] = []): WorkoutDay[] {
    return days.map((d, idx) => {
      const isRest = (d as any).isRestDay ?? d.restDay ?? false;

      const sessions = isRest
        ? []
        : d.workoutSessions && d.workoutSessions.length > 0
          ? d.workoutSessions
          : [
              {
                name: 'Main Session',
                exercises: [],
                totalSets: 0,
                totalReps: 0,
                totalDurationMin: 0,
              },
            ];

      const normalizedSessions = sessions.map((s) => this.syncSessionGroups({
        ...s,

        exercises: (s.exercises || []).map((e) => {
          const videoLink = this.getExerciseVideoLink(e);
          const thumbnailUrl = this.getGeneratedThumbnail(e);

          return {
            ...(e as any),

            videoUrl: videoLink,
            videoLink,

            imageUrl: thumbnailUrl,
            image: thumbnailUrl,
            thumbnailUrl,
            photoUrl: thumbnailUrl,

            sets: (e.sets || []).map((st, si) => ({
              ...st,
              reps: st.reps != null ? String(st.reps) : measureOf(e) === 'TIME' ? '' : '8',
              // 0 = pas de poids (comme côté client) : le champ reste vide.
              weight: this.shouldShowWeightField() && Number(st.weight) > 0 ? st.weight : null,
              restMin: st.restMin ?? 0,
              restSec: st.restSec ?? 0,
              setNumber: st.setNumber ?? si + 1,
              type: st.type ?? 'REGULAR',
            })),
          };
        }),
      }));

      return {
        ...d,

        id: d.id || crypto.randomUUID(),
        dayNumber: d.dayNumber ?? idx + 1,
        title: d.title || `Day ${idx + 1}`,
        name: d.name || d.title || `Day ${idx + 1}`,

        isRestDay: isRest,
        restDay: isRest,
        showDescription: (d as any).showDescription ?? false,

        workoutSessions: normalizedSessions,
        session: normalizedSessions[0] ?? null,

        description: d.description ?? '',
        status: d.status ?? 'PENDING',
      };
    });
  }

  applyPlanForEdit(plan: WorkoutPlan) {
    this.setPlan({
      ...plan,
      isWorkoutPlanTemplate: Boolean(plan.isWorkoutPlanTemplate),
      coach: plan.coach ?? { id: this.userid },
    });

    // By day number: a day moved on the calendar may still be at its old rank in the list (program-days.ts).
    const normalized = this.normalizeDaysFromApi(daysInCalendarOrder(plan.workoutDays || []));

    this.days = normalized;
    this.selectedDay = normalized[0] || null;

    this.syncPlanDays();
  }

  /**
   * After a save of a client's program: the days the client did while the editor was open. The server kept them as
   * the client did them (never erased by a save); they replace ours, at the same place, so the editor shows them done
   * and locks them. Returns these days.
   */
  takeClientDays(saved: WorkoutDay[] | null | undefined): WorkoutDay[] {
    const stored = new Map((saved || []).filter((day) => day?.id).map((day) => [day.id, day]));
    const taken: WorkoutDay[] = [];
    this.days.forEach((day, index) => {
      const done = stored.get(day.id);
      if (!done || !workoutDayActive(done) || workoutDayActive(day)) return;
      const fresh = this.normalizeDaysFromApi([done])[0];
      // The place stays ours (number, date, « Day N »).
      fresh.dayNumber = day.dayNumber;
      fresh.date = day.date;
      fresh.dayOfWeek = day.dayOfWeek;
      fresh.title = day.title;
      fresh.name = day.name;
      this.days[index] = fresh;
      if (this.selectedDay === day) this.selectedDay = fresh;
      taken.push(fresh);
    });
    if (taken.length) this.syncPlanDays();
    return taken;
  }

  private parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
