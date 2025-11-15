import { Component } from '@angular/core';
import {CommonModule, DecimalPipe, NgForOf, NgIf} from "@angular/common";
import {FeatherModule} from "angular-feather";
import {FormsModule} from "@angular/forms";


export interface ExerciseSet {
  reps: string;       // "8", "8-10", "AMRAP", etc.
  restMinutes: number;
  restSeconds: number;
}


export interface Exercise {
  id: string;
  name: string;
  image?: string;
  videoUrl?: string;
  description?: string;
  sets?: ExerciseSet[];
  /** id du partenaire si en superset; null sinon */
  supersetWith?: string | null;
}

export interface WorkoutSession {
  name: string;
  totalSets?: number;
  totalReps?: number;
  totalDurationMin?: number;
  exercises: Exercise[];
}
export interface WorkoutDay {
  id: string;
  name: string;
  description?: string;
  showDescription?: boolean;
  isRestDay?: boolean;
  session: WorkoutSession;
}
@Component({
  selector: 'app-create-workout',
  standalone: true,
    imports: [
      CommonModule, FormsModule, FeatherModule
    ],
  templateUrl: './create-workout.component.html',
  styleUrl: './create-workout.component.scss'
})
export class CreateWorkoutComponent {
  days: WorkoutDay[] = [
    {
      id: crypto.randomUUID(),
      name: 'Day 1',
      isRestDay: false,
      showDescription: false,
      session: { name: 'Main Session', exercises: [] }
    }
  ];
  selectedDay: WorkoutDay | null = this.days[0];

  planDescription = '';          // pour [(ngModel)] du textarea "Plan Description"
  showPlanDescription = false;   // toggle du plan
  showRestNotes = false;         // toggle "Rest Day Notes"

  /* ---------- Exercices (catalogue simple pour sélection) ---------- */
  exerciseCatalog: Exercise[] = [
    { id: '1', name: 'Barbell Squat' },
    { id: '2', name: 'Bench Press' },
    { id: '3', name: 'Deadlift' },
    { id: '4', name: 'Pull-ups' },
    { id: '5', name: 'Plank' }
  ];
  filteredExercises: Exercise[] = [...this.exerciseCatalog];

  // état modal (si tu utilises encore le sélecteur latéral)
  isExerciseModalOpen = false;
  exerciseStep: 'list' | 'detail' = 'list';
  exerciseSearch = '';
  selectedExercise: Exercise | null = null;

  // édition des notes d’un exercice
  editingExerciseDescription: string | null = null;

  /* ================== Days utils ================== */
  trackByDay(index: number, d: WorkoutDay) { return d.id; }

  selectDay(d: WorkoutDay) { this.selectedDay = d; }

  addDay() {
    const newIdx = this.days.length + 1;
    const newDay: WorkoutDay = {
      id: crypto.randomUUID(),
      name: `Day ${newIdx}`,
      isRestDay: false,
      showDescription: false,
      session: { name: 'Main Session', exercises: [] }
    };
    this.days.push(newDay);
    this.selectedDay = newDay;
  }

  duplicateSelectedDay() {
    if (!this.selectedDay) return;
    const copy: WorkoutDay = JSON.parse(JSON.stringify(this.selectedDay));
    copy.id = crypto.randomUUID();
    copy.name = `Day ${this.days.length + 1}`;
    this.days.push(copy);
    this.selectedDay = copy;
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    if (this.days.length <= 1) return;
    const idx = this.days.indexOf(d);
    this.days.splice(idx, 1);
    if (this.selectedDay === d) {
      this.selectedDay = this.days[Math.max(0, idx - 1)] || null;
    }
  }

  togglePlanDescription() { this.showPlanDescription = !this.showPlanDescription; }
  toggleDayDescription() { if (this.selectedDay) this.selectedDay.showDescription = !this.selectedDay.showDescription; }
  toggleRestNotes() { this.showRestNotes = !this.showRestNotes; }

  /* ================== Exercises: search modal (optionnel) ================== */
  filterExercises() {
    const q = (this.exerciseSearch || '').toLowerCase();
    this.filteredExercises = this.exerciseCatalog.filter(e => e.name.toLowerCase().includes(q));
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
    // si tu veux des infos détaillées avant d'ajouter; ici on ne modifie pas la structure (compatible avec Exercise)
    this.selectedExercise = { ...ex };
    this.exerciseStep = 'detail';
  }

  /* ================== Exercises: actions (SECTION PRINCIPALE) ================== */
  handleAddExercise = () => {
    if (!this.selectedDay) return;
    const ex: Exercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      image: '',
      sets: [
        { reps: '8', restMinutes: 1, restSeconds: 0 }
      ]
    };
    this.selectedDay.session.exercises.push(ex);
    this.recomputeSession(this.selectedDay.session);
  };



  setEditingExerciseDescription = (exerciseId: string | null) => {
    this.editingExerciseDescription = exerciseId;
  };

  handleExerciseDescriptionChange = (exerciseId: string, value: string) => {
    if (!this.selectedDay) return;
    const ex = this.selectedDay.session.exercises.find(e => e.id === exerciseId);
    if (ex) ex.description = value;
  };



  handleRemoveSet = (exerciseId: string, setIndex: number) => {
    if (!this.selectedDay) return;
    const ex = this.selectedDay.session.exercises.find(e => e.id === exerciseId);
    if (!ex?.sets) return;
    ex.sets.splice(setIndex, 1);
    this.recomputeSession(this.selectedDay.session);
  };

  handleSetChange = (
    exerciseId: string,
    setIndex: number,
    field: 'reps' | 'restMinutes' | 'restSeconds',
    value: any
  ) => {
    if (!this.selectedDay) return;
    const ex = this.selectedDay.session.exercises.find(e => e.id === exerciseId);
    if (!ex?.sets?.[setIndex]) return;
    const set = ex.sets[setIndex];
    if (field === 'reps') set.reps = value;
    if (field === 'restMinutes') set.restMinutes = Number(value);
    if (field === 'restSeconds') set.restSeconds = Number(value);
    this.recomputeSession(this.selectedDay.session);
  };

  /* ================== Totaux (badges) ================== */
  private parseFirstInt(s: string): number {
    if (!s) return 0;
    const m = String(s).match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  recomputeSession(s: WorkoutSession) {
    s.totalSets = s.exercises.reduce((a, e) => a + (e.sets?.length || 0), 0);
    s.totalReps = s.exercises.reduce((acc, e) => {
      const repsSum = (e.sets || []).reduce((rAcc, st) => rAcc + this.parseFirstInt(st.reps), 0);
      return acc + repsSum;
    }, 0);
    // si tu veux gérer la durée, ajoute une propriété durationMin par set et somme ici.
    s.totalDurationMin = 0;
  }

  /* ================== Ajouter depuis le modal (optionnel) ================== */
  addExerciseToSession() {
    if (!this.selectedDay || !this.selectedExercise) return;
    // on crée une entrée avec un set par défaut
    const ex: Exercise = {
      id: crypto.randomUUID(),
      name: this.selectedExercise.name,
      image: this.selectedExercise.image,
      videoUrl: this.selectedExercise.videoUrl,
      sets: [{ reps: '8', restMinutes: 1, restSeconds: 0 }]
    };
    this.selectedDay.session.exercises.push(ex);
    this.recomputeSession(this.selectedDay.session);
    this.closeExerciseModal();
  }
  /* ====== Drawer (Exercise Selector) state ====== */
  showExerciseSelector = false;
  hoveringExerciseId: string | null = null;

  searchQuery = '';
  muscleFilter = '';
  equipmentFilter = '';

  /* Petit catalogue pour le sélecteur (image/vidéo factices) */
  exerciseDatabase: Exercise[] = [
    { id: 'db1', name: '3-4 Sit-up', image: '', videoUrl: '', sets: [{ reps: '8', restMinutes: 1, restSeconds: 0 }] },
    { id: 'db2', name: '4 Corners Curtsy', image: '', videoUrl: '', sets: [{ reps: '10', restMinutes: 1, restSeconds: 0 }] },
    { id: 'db3', name: '4 Punches Side Squat', image: '', videoUrl: '', sets: [{ reps: '12', restMinutes: 1, restSeconds: 0 }] },
    { id: 'db4', name: 'Wide Grip Pull Ups', image: '', videoUrl: '', sets: [{ reps: 'AMRAP', restMinutes: 2, restSeconds: 0 }] },
  ];

  /* Getter filtré (recherche + filtres) */
  get filteredDatabase(): Exercise[] {
    const q = this.searchQuery.trim().toLowerCase();
    // pour la démo on ignore réellement muscle/equipment: branche tes données si tu veux filtrer par attributs
    return this.exerciseDatabase.filter(e =>
      e.name.toLowerCase().includes(q)
    );
  }

  /* Ouvrir/fermer */
  openExerciseSelector() { this.showExerciseSelector = true; }
  closeExerciseSelector() { this.showExerciseSelector = false; }

  /* Clic sur + dans la liste */
  handleSelectExercise(ex: Exercise) {
    if (!this.selectedDay) return;
    // on clone et on met un set par défaut si absent
    const copy: Exercise = {
      id: crypto.randomUUID(),
      name: ex.name,
      image: ex.image,
      videoUrl: ex.videoUrl,
      sets: ex.sets && ex.sets.length ? JSON.parse(JSON.stringify(ex.sets)) : [{ reps: '8', restMinutes: 1, restSeconds: 0 }]
    };
    this.selectedDay.session.exercises.push(copy);
    this.recomputeSession(this.selectedDay.session);
    this.closeExerciseSelector();
  }

  private get exList(): Exercise[] {
    return this.selectedDay?.session.exercises ?? [];
  }

  trackByExercise = (_: number, ex: Exercise) => ex.id;

  /** vrai si l'exercice i a un lien superset (peu importe s'il est 1er ou 2e) */
  isInSuperset(i: number): boolean {
    const ex = this.exList[i];
    return !!ex?.supersetWith;
  }

  /** vrai si (i, i+1) sont liés ensemble */
  isSupersetPair(i: number): boolean {
    if (i < 0 || i >= this.exList.length - 1) return false;
    const a = this.exList[i];
    const b = this.exList[i + 1];
    return !!a?.supersetWith && a.supersetWith === b?.id && b?.supersetWith === a?.id;
  }

  /** vrai si l'exercice i est le 2e du duo (celui du bas) */
  isSecondOfSuperset(i: number): boolean {
    if (i <= 0) return false;
    const up = this.exList[i - 1];
    const me = this.exList[i];
    return !!up?.supersetWith && up.supersetWith === me?.id && me?.supersetWith === up?.id;
  }

  /** lie i avec i+1 ou casse le lien s'il existe */
  toggleSuperset(i: number): void {
    if (!this.selectedDay) return;
    if (i < 0 || i >= this.exList.length - 1) return;
    const a = this.exList[i];
    const b = this.exList[i + 1];

    if (!a || !b) return;

    // si déjà pair → on casse
    if (this.isSupersetPair(i)) {
      a.supersetWith = null;
      b.supersetWith = null;
      // si le 2e n'a aucun set (on l'avait vidé), on lui remet un set par défaut
      if (!b.sets || b.sets.length === 0) {
        b.sets = [{ reps: '8', restMinutes: 1, restSeconds: 0 }];
      }
    } else {
      // créer la paire
      a.supersetWith = b.id;
      b.supersetWith = a.id;
      // IMPORTANT: on vide les sets du 2e (l’UI les masque et on veut des totaux justes)
      b.sets = [];
    }
    this.recomputeSession(this.selectedDay.session);
  }

  /** quand on supprime un exercice, nettoie l'autre du duo si besoin */
  handleRemoveExercise = (exerciseId: string) => {
    if (!this.selectedDay) return;
    const list = this.selectedDay.session.exercises;
    const idx = list.findIndex(e => e.id === exerciseId);
    if (idx === -1) return;

    const ex = list[idx];
    if (ex.supersetWith) {
      const partnerIdx = list.findIndex(e => e.id === ex.supersetWith);
      if (partnerIdx !== -1) {
        list[partnerIdx].supersetWith = null;
        // remet un set si son tableau était vide
        if (!list[partnerIdx].sets || list[partnerIdx].sets!.length === 0) {
          list[partnerIdx].sets = [{ reps: '8', restMinutes: 1, restSeconds: 0 }];
        }
      }
    }
    list.splice(idx, 1);
    this.recomputeSession(this.selectedDay.session);
  };

  /** empêcher d’ajouter des sets sur le 2e du superset */
  handleAddSet = (exerciseId: string) => {
    if (!this.selectedDay) return;
    const list = this.selectedDay.session.exercises;
    const idx = list.findIndex(e => e.id === exerciseId);
    if (idx === -1) return;

    if (this.isSecondOfSuperset(idx)) return; // on bloque pour le second

    const ex = list[idx];
    if (!ex.sets) ex.sets = [];
    ex.sets.push({ reps: '8', restMinutes: 1, restSeconds: 0 });
    this.recomputeSession(this.selectedDay.session);
  };
// Already have isSupersetPair(i: number): boolean

  canShowSupersetButton(i: number): boolean {
    const lastIdx = this.selectedDay!.session.exercises.length - 1;
    if (i >= lastIdx) return false;                 // never after the last item

    const isCurrentPair = this.isSupersetPair(i);   // boundary i (between i and i+1)
    const isPrevPair    = i > 0 ? this.isSupersetPair(i - 1) : false; // boundary i-1 (between i-1 and i)

    // Show if this boundary is an active pair (to display "− Superset"),
    // otherwise only show if the *previous* boundary is NOT already a pair.
    return isCurrentPair || !isPrevPair;
  }

}
