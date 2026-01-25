import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ExerciseService, PageResponse } from 'app/service/exercise.service';
import { WorkoutService } from 'app/service/workout.service';

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

  // ===== PLAN ROOT (state) =====
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

  // ===== UI PLAN STATE =====
  showPlanDescription = false;
  showRestNotes = false;

  // ===== DAYS STATE =====
  days: WorkoutDay[] = [];
  selectedDay: WorkoutDay | null = null;

  // ===== DRAWER STATE =====
  showExerciseSelector = false;
  hoveringExerciseId: string | null = null;

  // ===== FILTERS =====
  searchQuery = '';
  muscleFilter = '';
  equipmentFilter = '';
  typeFilter = '';

  // ===== API DATA =====
  exerciseDatabase: Exercise[] = [];
  loading = false;

  // ===== PAGINATION =====
  page = 0;
  size = 10;
  totalPages = 1;

  // ===== MODAL "COMMON EXERCISES" =====
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
  selectedExercise: Exercise | null = null; // garde "any" car ton modal utilise sets/reps/weight/restSec/durationMin

  // ===== EDIT NOTES =====
  editingExerciseDescription: string | null = null;

  constructor(
    private exerciseRefService: ExerciseService,
    private workoutService: WorkoutService
  ) {}

  // =========================================================
  // INIT
  // =========================================================

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

    // reset modal list
    this.filteredExercises = [...this.exerciseCatalog];
  }

  syncPlanDays() {
    this.setPlan({ ...this.plan, workoutDays: this.days });
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

  // =========================================================
  // API
  // =========================================================

  loadPlanForEdit(id: string) {
    return this.workoutService.getWorkoutById(id);
  }

  createPlan() {
    return this.workoutService.createWorkout(this.plan);
  }

  updatePlan() {
    return this.workoutService.updateWorkout(this.plan.id!, this.plan);
  }

  // =========================================================
  // API: EXERCISES LIST (Drawer)
  // =========================================================

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
          this.exerciseDatabase = (res.content || []).map((e: Exercise) => {
            const ex: Exercise = {
              id: e.id,
              name: e.name,
              type: e.type,
              exerciseRef: e.exerciseRef,
              videoUrl: e.exerciseRef?.videoUrl ?? e.videoUrl,
              sets: [{ reps: '8', restMin: 1, restSec: 0 }],
            };
            return ex;
          });

          this.totalPages = res.totalPages ?? 1;
          this.loading = false;
        },
        error: () => (this.loading = false),
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

  // =========================================================
  // DAYS CRUD
  // =========================================================

  trackByDay(index: number, d: WorkoutDay) {
    return d.id;
  }

  selectDay(d: WorkoutDay) {
    this.selectedDay = d;
  }

  addDay() {
    const newIdx = this.days.length + 1;

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

    const copy: WorkoutDay = JSON.parse(JSON.stringify(this.selectedDay));
    copy.id = crypto.randomUUID();
    copy.name = `Day ${this.days.length + 1}`;
    copy.title = copy.name;
    copy.dayNumber = this.days.length + 1;

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

    // si rest day => clear sessions
    this.selectedDay.workoutSessions = [];
    this.selectedDay.session = null;
  }

  // =========================================================
  // MODAL: COMMON EXERCISES
  // =========================================================

  filterExercises() {
    const q = (this.exerciseSearch || '').toLowerCase();
    this.filteredExercises = this.exerciseCatalog.filter((e) =>
      (e.name || '').toLowerCase().includes(q)
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
    // le modal utilise des champs (sets, reps, weight, restSec, durationMin)
    this.selectedExercise = { ...ex };
    this.exerciseStep = 'detail';
  }

  // =========================================================
  // SESSION HELPERS
  // =========================================================

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
        0
      );
      return acc + repsSum;
    }, 0);
    s.totalDurationMin = 0;
  }

  private get exList(): Exercise[] {
    return this.currentSession?.exercises ?? [];
  }

  trackByExercise = (_: number, ex: Exercise) => ex.id;

  // =========================================================
  // EXERCISES: ADD / REMOVE / NOTES
  // =========================================================

  handleSelectExercise(ex: Exercise) {
    const session = this.currentSession;
    if (!session) return;

    const copy: Exercise = {
      id: crypto.randomUUID(),
      name: ex.name,
      videoUrl: ex.videoUrl,
      exerciseRef: ex.exerciseRef,
      type: ex.type,
      sets: [{ reps: '8', restMin: 1, restSec: 0 }],
    };

    session.exercises.push(copy);
    this.recomputeSession(session);
    this.closeExerciseSelector();
  }

  addExerciseToSession() {
    const session = this.currentSession;
    if (!session || !this.selectedExercise) return;

    const ex: Exercise = {
      id: crypto.randomUUID(),
      name: this.selectedExercise.name,
      image: this.selectedExercise.image,
      videoUrl: this.selectedExercise.videoUrl,
      exerciseRef: this.selectedExercise.exerciseRef,
      type: this.selectedExercise.type,
      sets: [{ reps: '8', restMin: 1, restSec: 0 }],
    };

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
    if (ex) ex.description = value;
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
            e.sets = [{ reps: '8', restMin: 1, restSec: 0 }];
          }
        }
      });
    }

    list.splice(idx, 1);
    this.recomputeSession(session);
  }

  // =========================================================
  // SETS: ADD / REMOVE / CHANGE
  // =========================================================

  handleAddSet(exerciseId: string) {
    const session = this.currentSession;
    if (!session) return;

    const list = session.exercises;
    const idx = list.findIndex((e) => e.id === exerciseId);
    if (idx === -1) return;

    if (this.isSecondOfSuperset(idx)) return;

    const ex = list[idx];
    if (!ex.sets) ex.sets = [];
    ex.sets.push({ reps: '8', restMin: 1, restSec: 0 });

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

  // IMPORTANT: template utilise 'restMin' / 'restSec'
  handleSetChange(
    exerciseId: string,
    setIndex: number,
    field: string,
    value: string
  ) {
    const session = this.currentSession;
    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);
    if (!ex?.sets?.[setIndex]) return;

    const set: ExerciseSet = ex.sets[setIndex];

    if (field === 'reps') set.reps = value;
    if (field === 'restMin') set.restMin = Number(value);
    if (field === 'restSec') set.restSec = Number(value);

    set.setNumber = setIndex;
    this.recomputeSession(session);
  }

  // =========================================================
  // SUPERSET HELPERS
  // =========================================================

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
        b.sets = [{ reps: '8', restMin: 1, restSec: 0 }];
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
        exercises: (s.exercises || []).map((e) => ({
          ...e,
          sets: (e.sets || []).map((st, si) => ({
            ...st,
            reps: st.reps != null ? String(st.reps) : '8',
            restMin: st.restMin ?? 0,
            restSec: st.restSec ?? 0,
            setNumber: st.setNumber ?? si,
          })),
        })),
      }));

      return {
        ...d,
        id: d.id || crypto.randomUUID(),
        dayNumber: d.dayNumber ?? idx + 1,
        title: d.title || `Day ${idx + 1}`,
        name: d.name || d.title || `Day ${idx + 1}`,

        // UI fields
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
    this.setPlan(plan);

    const normalized = this.normalizeDaysFromApi(plan.workoutDays || []);
    this.days = normalized;
    this.selectedDay = normalized[0] || null;

    this.syncPlanDays();
  }
}
