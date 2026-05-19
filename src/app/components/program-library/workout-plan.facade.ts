import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ExerciseService, PageResponse } from 'app/service/exercise.service';
import { WorkoutService } from 'app/service/workout.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
  TypeWorkoutPlan,
} from '@shared/models/workout.models';
import { Exercise, ExerciseSet } from '@shared/models/exercice.models';

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

  searchQuery = '';
  muscleFilter = '';
  equipmentFilter = '';
  typeFilter = '';

  exerciseDatabase: Exercise[] = [];
  loading = false;

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
    this.hoveringExerciseId = null;

    this.searchQuery = '';
    this.muscleFilter = '';
    this.equipmentFilter = '';
    this.typeFilter = '';

    this.page = 0;
    this.size = 10;
    this.totalPages = 1;

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
      workoutDays: this.days,
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

  loadPlanForEdit(id: string) {
    return this.workoutService.getWorkoutById(id);
  }

  private buildSavePayload(): WorkoutPlan {
    const payload: WorkoutPlan = {
      ...this.plan,
      workoutDays: this.days,
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
    return this.workoutService.createWorkout(payload);
  }

  updatePlan() {
    const payload = this.buildSavePayload();
    return this.workoutService.updateWorkout(payload.id!, payload);
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
        ? [{ duration: 30, restMin: 1, restSec: 0 }]
        : [{ reps: '8', restMin: 1, restSec: 0 }];
    }

    const count = isCardio
      ? this.coachSettingsService.getCardioSets()
      : this.coachSettingsService.getWorkoutSets();

    return Array.from({ length: count }, (_, index) => {
      if (isCardio) {
        return {
          setNumber: index,
          duration: this.coachSettingsService.getCardioMinutes(),
          restMin: 1,
          restSec: 0,
        };
      }

      return {
        setNumber: index,
        reps: this.coachSettingsService.getWorkoutReps(),
        restMin: 1,
        restSec: 0,
      };
    });
  }

  private buildAdditionalSet(isCardio: boolean, setNumber: number): ExerciseSet {
    const autoFill = this.coachSettingsService.shouldAutoFillWorkoutDefaults();

    if (!autoFill) {
      return isCardio
        ? { setNumber, duration: 10, restMin: 1, restSec: 0 }
        : { setNumber, reps: '8', restMin: 1, restSec: 0 };
    }

    return isCardio
      ? {
          setNumber,
          duration: this.coachSettingsService.getCardioMinutes(),
          restMin: 1,
          restSec: 0,
        }
      : {
          setNumber,
          reps: this.coachSettingsService.getWorkoutReps(),
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

    this.exerciseRefService
      .getExercises(this.page, this.size, filters)
      .subscribe({
        next: (res: PageResponse<Exercise>) => {
          this.exerciseDatabase = (res.content || []).map((e: Exercise) =>
            this.normalizeExerciseForDrawer(e),
          );

          this.totalPages = res.totalPages ?? 1;
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

  openExerciseSelector() {
    this.showExerciseSelector = true;
    this.loadExercisesFromAPI();
  }

  closeExerciseSelector() {
    this.showExerciseSelector = false;
  }

  trackByDay(index: number, d: WorkoutDay) {
    return d.id;
  }

  selectDay(d: WorkoutDay) {
    this.selectedDay = d;
  }

  addDay() {
    const sortedDays = [...this.days].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return aTime - bTime;
    });

    let nextDate = new Date();

    if (sortedDays.length > 0) {
      const lastDay = sortedDays[sortedDays.length - 1];
      nextDate = lastDay.date ? new Date(lastDay.date) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);
    }

    const newIdx = this.days.length + 1;
    const nextDateStr = nextDate.toISOString().split('T')[0];

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
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return aTime - bTime;
    });

    let nextDate = new Date();

    if (sortedDays.length > 0) {
      const lastDay = sortedDays[sortedDays.length - 1];
      nextDate = lastDay.date ? new Date(lastDay.date) : new Date();
      nextDate.setDate(nextDate.getDate() + 1);
    }

    const copy: WorkoutDay = JSON.parse(JSON.stringify(this.selectedDay));
    copy.id = crypto.randomUUID();
    copy.date = nextDate.toISOString().split('T')[0];
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

    if (!session) return;

    const copy = this.normalizeExerciseForSession(ex);

    session.exercises.push(copy);
    this.recomputeSession(session);
    this.closeExerciseSelector();
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
      ex.description = value;
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

    if (groupId) {
      list.forEach((e) => {
        if (e !== ex && e.supersetGroupId === groupId) {
          e.supersetGroupId = null;

          if (!e.sets || e.sets.length === 0) {
            e.sets = this.buildInitialSets(e.type === 'CARDIO');
          }
        }
      });
    }

    list.splice(idx, 1);
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

    ex.sets.push(this.buildAdditionalSet(isCardio, ex.sets.length));

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
    value: string,
  ) {
    const session = this.currentSession;

    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);

    if (!ex?.sets?.[setIndex]) return;

    const set: ExerciseSet = ex.sets[setIndex];

    if (field === 'reps') set.reps = value;
    if (field === 'duration') set.duration = Number(value);
    if (field === 'restMin') set.restMin = Number(value);
    if (field === 'restSec') set.restSec = Number(value);

    set.setNumber = setIndex;
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

  toggleSuperset(i: number): void {
    const session = this.currentSession;

    if (!session) return;

    const list = session.exercises;

    if (i < 0 || i >= list.length - 1) return;

    const a = list[i];
    const b = list[i + 1];

    if (!a || !b) return;

    if (this.isSupersetPair(i)) {
      a.supersetGroupId = null;
      b.supersetGroupId = null;

      if (!b.sets || b.sets.length === 0) {
        b.sets = this.buildInitialSets(b.type === 'CARDIO');
      }
    } else {
      const groupId =
        a.supersetGroupId || b.supersetGroupId || crypto.randomUUID();

      a.supersetGroupId = groupId;
      b.supersetGroupId = groupId;
    }

    this.recomputeSession(session);
  }

  canShowSupersetButton(i: number): boolean {
    const session = this.currentSession;

    if (!session) return false;

    const lastIdx = session.exercises.length - 1;

    if (i >= lastIdx) return false;

    const isCurrentPair = this.isSupersetPair(i);
    const isPrevPair = i > 0 ? this.isSupersetPair(i - 1) : false;

    return isCurrentPair || !isPrevPair;
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

      const normalizedSessions = sessions.map((s) => ({
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
              reps: st.reps != null ? String(st.reps) : '8',
              restMin: st.restMin ?? 0,
              restSec: st.restSec ?? 0,
              setNumber: st.setNumber ?? si,
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

    const normalized = this.normalizeDaysFromApi(plan.workoutDays || []);

    this.days = normalized;
    this.selectedDay = normalized[0] || null;

    this.syncPlanDays();
  }
}
