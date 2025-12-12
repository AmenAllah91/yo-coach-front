import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ExerciseService } from 'app/service/exercise.service';
import { WorkoutService } from 'app/service/workout.service';
import { ActivatedRoute } from '@angular/router';
import { Client, ClientService } from 'app/service/client.service';

/* =========================================================
   MODELS / ENUMS
   ========================================================= */

export interface ExerciseSet {
  reps?: string;
  weight?: number;
  restMin?: number;
  restSec?: number;
  setNumber?: number;
}

export enum TypeExercise {
  SIMPLE = 'SIMPLE',
  SUPERSET = 'SUPERSET',
  WARMUP = 'WARMUP',
  CARDIO = 'CARDIO',
}

export interface ExerciseRef {
  id?: string;
  name?: string;
  videoUrl?: string;
  description?: string;
}

export interface Exercise {
  id?: string;
  name?: string;
  dayOfWeek?: string;
  restDay?: boolean;
  exerciseRef?: ExerciseRef;
  type?: TypeExercise;

  supersetGroupId?: string | null;
  sets?: ExerciseSet[];

  image?: string;
  videoUrl?: string;
  description?: string;
}

export interface WorkoutSession {
  name?: string;
  exercises: Exercise[];
  totalSets?: number;
  totalReps?: number;
  totalDurationMin?: number;
}

export enum TypeWorkoutPlan {
  STRENGTH_TRAINING = 'STRENGTH_TRAINING',
  CARDIOVASCULAR_TRAINING = 'CARDIOVASCULAR_TRAINING',
  FLEXIBILITY_MOBILITY = 'FLEXIBILITY_MOBILITY',
  FUNCTIONAL_FITNESS = 'FUNCTIONAL_FITNESS',
}

export interface WorkoutDay {
  id?: string;
  name?: string;
  date?: string;
  title?: string;
  description?: string;
  dayNumber?: number;
  dayOfWeek?: string;
  isRestDay?: boolean;
  restDay?: boolean;

  showDescription?: boolean;
  workoutSessions?: WorkoutSession[];
  session?: WorkoutSession;
}

export interface WorkoutPlan {
  id?: string;
  name: string;
  details: string;
  startDate?: string;
  endDate?: string;
  workoutDays: WorkoutDay[];
  coach?: any;
  client?: any;
  isWorkoutPlanTemplate?: boolean;
  typeWorkoutPlan?: TypeWorkoutPlan;
  createdBy?: string;
}
@Component({
  selector: 'app-create-and-assign',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-and-assign.component.html',
  styleUrl: './create-and-assign.component.scss',
})
export class CreateAndAssignComponent implements OnInit {
  userid = sessionStorage.getItem('userId');
  startDate = new Date().toISOString().split('T')[0];
  endDate: string = '';
  workoutPlan: WorkoutPlan = {
    name: '',
    details: '',
    workoutDays: [],
    typeWorkoutPlan: TypeWorkoutPlan.STRENGTH_TRAINING,
    isWorkoutPlanTemplate: false,
    coach: { id: this.userid },
  };

  /* ===== Drawer state ===== */
  showExerciseSelector = false;
  hoveringExerciseId: string | null = null;

  /* ===== Filters ===== */
  searchQuery = '';
  muscleFilter = '';
  equipmentFilter = '';
  typeFilter = '';

  /* ===== API data ===== */
  exerciseDatabase: Exercise[] = [];
  loading = false;

  /* ===== Pagination ===== */
  page = 0;
  size = 10;
  totalPages = 1;

  /* ===== Days & selected day ===== */
  days: WorkoutDay[] = [];
  selectedDay: WorkoutDay | null = null;

  /* ===== UI plan options ===== */
  showPlanDescription = false;
  showRestNotes = false;

  /* ===== Local exercise catalog (default) ===== */
  exerciseCatalog: Exercise[] = [
    { id: '1', name: 'Barbell Squat', sets: [] },
    { id: '2', name: 'Bench Press', sets: [] },
    { id: '3', name: 'Deadlift', sets: [] },
    { id: '4', name: 'Pull-ups', sets: [] },
    { id: '5', name: 'Plank', sets: [] },
  ];
  filteredExercises: Exercise[] = [...this.exerciseCatalog];

  /* ===== Modal state ===== */
  isExerciseModalOpen = false;
  exerciseStep: 'list' | 'detail' = 'list';
  exerciseSearch = '';
  selectedExercise: Exercise | null = null;

  /* ===== Editing exercise notes ===== */
  editingExerciseDescription: string | null = null;

  isEditMode = false;

  client: Client;

  constructor(
    private exerciseRefService: ExerciseService,
    private workoutService: WorkoutService,
    private route: ActivatedRoute,
    private clientService: ClientService
  ) {}

  /* =========================================================
       LIFECYCLE
       ========================================================= */

  ngOnInit() {
    // recalcul des jours

    const planId = this.route.snapshot.paramMap.get('id');
    const clientId = this.route.snapshot.paramMap.get('idClient');
    if (planId) {
      this.isEditMode = true;
      this.loadPlanForEdit(planId);
    } else {
      this.isEditMode = false;
      this.initDefaultDay();
      this.updateAllDates();
    }
    if (clientId) {
      this.getClientById(clientId);
    }
    this.loadExercisesFromAPI();
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  updateAllDates() {
    if (!this.startDate) return;

    const start = new Date(this.startDate);

    this.days.forEach((day, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);

      day.date = current.toISOString().split('T')[0];
      day.dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
      day.title = `Day ${index + 1}`;
    });

    // Calcule la date de fin
    const end = new Date(start);
    end.setDate(start.getDate() + (this.days.length - 1));
    this.endDate = end.toISOString().split('T')[0];
  }

  loadPlanForEdit(id: string) {
    this.workoutService.getWorkoutById(id).subscribe({
      next: (plan: any) => {
        console.log(plan);
        this.workoutPlan = plan;

        // Synchroniser les jours utilisés par l’UI
        this.days = plan.workoutDays;
        this.selectedDay = this.days[0] || null;
        console.log(this.days);
      },
      error: (err) => {
        console.error('Erreur lors du chargement du plan :', err);
      },
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
    };

    this.days.push(firstDay);
    this.selectedDay = firstDay;

    // 🔥 IMPORTANT : synchroniser avec le plan
    this.workoutPlan.workoutDays = this.days;
  }

  /* =========================================================
       API Loader
       ========================================================= */

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
        next: (res) => {
          this.exerciseDatabase = res.content.map((e: any) => {
            const ex: Exercise = {
              id: e.id,
              name: e.name,
              type: e.type,
              exerciseRef: e.exerciseRef,
              videoUrl: e.exerciseRef?.videoUrl ?? e.videoLink,
              sets: [{ reps: '8', restMin: 1, restSec: 0 }],
            };
            return ex;
          });

          this.totalPages = res.totalPages;
          this.loading = false;
        },
        error: () => (this.loading = false),
      });
  }

  /* =========================================================
       Filters & Pagination
       ========================================================= */

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

  /* =========================================================
       Drawer toggle
       ========================================================= */

  openExerciseSelector() {
    this.showExerciseSelector = true;
    this.loadExercisesFromAPI();
  }

  closeExerciseSelector() {
    this.showExerciseSelector = false;
  }

  /* =========================================================
       Days utils
       ========================================================= */

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
      session: session,
    };

    this.days.push(newDay);
    this.selectedDay = newDay;

    // 🔥 synchro avec plan
    this.workoutPlan.workoutDays = this.days;

    this.updateAllDates();
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

    // 🔥 synchro avec plan
    this.workoutPlan.workoutDays = this.days;

    this.updateAllDates();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    if (this.days.length <= 1) return;

    const idx = this.days.indexOf(d);
    this.days.splice(idx, 1);

    if (this.selectedDay === d) {
      this.selectedDay = this.days[Math.max(0, idx - 1)] || null;
    }

    // 🔥 synchro avec plan
    this.workoutPlan.workoutDays = this.days;

    this.updateAllDates();
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

  /* =========================================================
       Exercise selection modal
       ========================================================= */

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
    this.selectedExercise = { ...ex };
    this.exerciseStep = 'detail';
  }

  /* =========================================================
       Getter filtré
       ========================================================= */

  get filteredDatabase(): Exercise[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.exerciseDatabase.filter((e) =>
      (e.name || '').toLowerCase().includes(q)
    );
  }

  /* =========================================================
       Exercises: actions
       ========================================================= */

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

  handleAddExercise = () => {
    const session = this.currentSession;
    if (!session) return;

    const ex: Exercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      sets: [{ reps: '8', restMin: 1, restSec: 0 }],
    };

    session.exercises.push(ex);
    this.recomputeSession(session);
  };

  setEditingExerciseDescription = (exerciseId: string | null) => {
    this.editingExerciseDescription = exerciseId;
  };

  handleExerciseDescriptionChange = (exerciseId: string, value: string) => {
    const session = this.currentSession;
    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);
    if (ex) ex.description = value;
  };

  handleRemoveSet = (exerciseId: string, setIndex: number) => {
    const session = this.currentSession;
    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);
    if (!ex?.sets) return;

    ex.sets.splice(setIndex, 1);
    this.recomputeSession(session);
  };

  handleSetChange = (
    exerciseId: string,
    setIndex: number,
    field: 'reps' | 'restMinutes' | 'restSeconds',
    value: any
  ) => {
    const session = this.currentSession;
    if (!session) return;

    const ex = session.exercises.find((e) => e.id === exerciseId);
    if (!ex?.sets?.[setIndex]) return;

    const set = ex.sets[setIndex];
    if (field === 'reps') set.reps = value;
    if (field === 'restMinutes') set.restMin = Number(value);
    if (field === 'restSeconds') set.restSec = Number(value);
    set.setNumber = setIndex;

    this.recomputeSession(session);
  };

  /* =========================================================
       Totals (badges)
       ========================================================= */

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

  /* =========================================================
       Modal add
       ========================================================= */

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

  /* =========================================================
       Superset helpers
       ========================================================= */

  private get exList(): Exercise[] {
    return this.currentSession?.exercises ?? [];
  }

  trackByExercise = (_: number, ex: Exercise) => ex.id;

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

      b.sets = [];
    }

    this.recomputeSession(session);
  }

  handleRemoveExercise = (exerciseId: string) => {
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
  };

  handleAddSet = (exerciseId: string) => {
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
  };

  canShowSupersetButton(i: number): boolean {
    const session = this.currentSession;
    if (!session) return false;

    const lastIdx = session.exercises.length - 1;
    if (i >= lastIdx) return false;

    const isCurrentPair = this.isSupersetPair(i);
    const isPrevPair = i > 0 ? this.isSupersetPair(i - 1) : false;

    return isCurrentPair || !isPrevPair;
  }

  /* =========================================================
       SAVE PLAN
       ========================================================= */

  savePlan() {
    this.workoutPlan.workoutDays = this.days;
    this.workoutPlan.client = this.client;
    console.log(this.workoutPlan);
    if (this.workoutPlan.id) {
      // MODE EDIT
      this.updatePlan();
    } else {
      // MODE CREATE
      this.createPlan();
    }
  }

  createPlan() {
    this.workoutService.createWorkout(this.workoutPlan).subscribe({
      next: (res) => {
        console.log('Workout plan created:', res);
        this.resetForm();
      },
      error: (err) => console.error('Error creating workout plan:', err),
    });
  }

  updatePlan() {
    this.workoutService
      .updateWorkout(this.workoutPlan.id!, this.workoutPlan)
      .subscribe({
        next: (res) => {
          console.log('Workout plan updated:', res);
        },
        error: (err) => console.error('Error updating workout plan:', err),
      });
  }

  resetForm() {
    /** Reset du plan */
    this.workoutPlan = {
      name: '',
      details: '',
      workoutDays: [],
      typeWorkoutPlan: TypeWorkoutPlan.STRENGTH_TRAINING,
      isWorkoutPlanTemplate: false,
    };

    /** Reset des days */
    this.days = [];
    this.selectedDay = null;

    /** Réinitialiser l’UI des toggles */
    this.showPlanDescription = false;
    this.showRestNotes = false;

    /** Réinitialiser les catalogues/modals */
    this.isExerciseModalOpen = false;
    this.showExerciseSelector = false;
    this.exerciseSearch = '';
    this.selectedExercise = null;

    /** Et recréer le premier Day */
    this.initDefaultDay();
  }

  toggleRestDay() {
    if (!this.selectedDay) return;

    this.selectedDay.isRestDay = !this.selectedDay.isRestDay;
    this.selectedDay.restDay = this.selectedDay.isRestDay;
    this.selectedDay.workoutSessions = [];
    this.selectedDay.session = null;
  }
}
