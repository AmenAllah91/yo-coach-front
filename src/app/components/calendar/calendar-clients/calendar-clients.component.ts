import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
interface ExerciseSet {
  id: string;
  number: number;
  reps: string;
  rest: string;
}

interface Exercise {
  id: string;
  name: string;
  type: 'strength' | 'cardio';
  sets: ExerciseSet[];
  duration?: number;
  notes?: string;
  thumbnail?: string;
  videoUrl?: string;
}

interface WorkoutSession {
  id: string;
  exercises: Exercise[];
  notes?: string;
}

interface WorkoutProgram {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  clientId?: string;
  color?: string;
  sessions: WorkoutSession[];
  programId?: string;
  programName?: string;
}

interface Client {
  id: string;
  name: string;
}

interface NutritionMeal {
  id: string;
  name: string;
  foods: {
    name: string;
    quantity: string;
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  }[];
}

interface NutritionProgram {
  id: string;
  title: string;
  date: string;
  clientId?: string;
  programName?: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: NutritionMeal[];
}

type CalendarViewMode = 'month' | 'week' | 'day';
type CalendarType = 'workout' | 'nutrition';
@Component({
  selector: 'app-calendar-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-clients.component.html',
  styleUrl: './calendar-clients.component.scss'
})
export class CalendarClientsComponent {
  currentDate = new Date();
  currentView: CalendarViewMode = 'month';
  calendarType: CalendarType = 'workout';
  selectedClient: string = 'all';
  copiedDate: string | null = null;

  selectedWorkout: WorkoutProgram | null = null;
  selectedNutritionDay: NutritionProgram | null = null;
  showWorkoutDetails = false;
  showNutritionDetails = false;
  // ====== MODAL STATE ======
  showAddWorkoutModal = false;
  isRestDay = false;
  selectedDateString: string | null = null;

  newWorkoutTitle = '';
  newWorkoutExercises: Exercise[] = [];

  showExerciseSelector = false;
  exerciseSearchTerm = '';

  showDeleteModal = false;
  workoutToDelete: WorkoutProgram | null = null;

  // Bibliothèque d'exercices pour le sélecteur
  availableExercises: Exercise[] = [
    {
      id: 'lib-squat',
      name: 'Squat (Barbell)',
      type: 'strength',
      sets: [
        { id: 'lib-squat-set-1', number: 1, reps: '8-12', rest: '90' },
        { id: 'lib-squat-set-2', number: 2, reps: '8-12', rest: '90' },
        { id: 'lib-squat-set-3', number: 3, reps: '8-12', rest: '90' },
      ],
    },
    {
      id: 'lib-bench',
      name: 'Bench Press (Barbell)',
      type: 'strength',
      sets: [
        { id: 'lib-bench-set-1', number: 1, reps: '8-12', rest: '90' },
        { id: 'lib-bench-set-2', number: 2, reps: '8-12', rest: '90' },
        { id: 'lib-bench-set-3', number: 3, reps: '8-12', rest: '90' },
      ],
    },
    {
      id: 'lib-cardio',
      name: 'Treadmill Run',
      type: 'cardio',
      sets: [],
      duration: 30,
    },
  ];
  workoutPrograms: WorkoutProgram[] = [];
  nutritionPrograms: NutritionProgram[] = [];
  clients: Client[] = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Sarah Smith' },
    { id: '3', name: 'Michael Johnson' },
    { id: '4', name: 'Emily Wilson' },
  ];

  // anciens champs (plus vraiment utilisés par le HTML, mais pas gênant)
  monthEmptyCells: number[] = [];
  monthDates: Date[] = [];

  private storageListener = () => this.loadWorkoutPrograms();

  ngOnInit(): void {
    this.buildMockNutrition();
    this.loadWorkoutPrograms();
    window.addEventListener('storage', this.storageListener);
    this.updateMonthGrid();
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.storageListener);
  }

  // ---------- Utils dates ----------

  formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.formatDateToYYYYMMDD(today) === this.formatDateToYYYYMMDD(date);
  }

  // ---------- Mock nutrition ----------

  private buildMockNutrition(): void {
    const todayStr = this.formatDateToYYYYMMDD(new Date());
    this.nutritionPrograms = [
      {
        id: 'nutrition-1',
        title: 'High Protein Day',
        date: todayStr,
        clientId: '2',
        programName: 'Muscle Building',
        totalCalories: 2200,
        totalProtein: 200,
        totalCarbs: 150,
        totalFat: 70,
        meals: [
          {
            id: 'meal-1',
            name: 'Breakfast',
            foods: [
              {
                name: 'Eggs',
                quantity: '4 large',
                protein: 25,
                carbs: 1.4,
                fat: 20,
                calories: 280,
              },
              {
                name: 'Oatmeal',
                quantity: '100g',
                protein: 13.2,
                carbs: 66.3,
                fat: 6.9,
                calories: 389,
              },
            ],
          },
          {
            id: 'meal-2',
            name: 'Lunch',
            foods: [
              {
                name: 'Chicken Breast',
                quantity: '200g',
                protein: 62,
                carbs: 0,
                fat: 7.6,
                calories: 330,
              },
              {
                name: 'Brown Rice',
                quantity: '150g',
                protein: 7.5,
                carbs: 77.2,
                fat: 2.7,
                calories: 370,
              },
            ],
          },
          {
            id: 'meal-3',
            name: 'Dinner',
            foods: [
              {
                name: 'Salmon',
                quantity: '150g',
                protein: 37.5,
                carbs: 0,
                fat: 20.3,
                calories: 344,
              },
              {
                name: 'Sweet Potato',
                quantity: '200g',
                protein: 4,
                carbs: 40,
                fat: 0.3,
                calories: 180,
              },
            ],
          },
        ],
      },
    ];
  }

  // ---------- Workouts / localStorage ----------

  private createExampleWorkouts(): WorkoutProgram[] {
    const today = new Date();
    const getDateString = (daysOffset: number) => {
      const date = new Date(today);
      date.setDate(today.getDate() + daysOffset);
      return this.formatDateToYYYYMMDD(date);
    };

    const workouts: WorkoutProgram[] = [
      {
        id: 'workout-sarah-1',
        title: 'Full Body Day 1',
        date: getDateString(0),
        clientId: '2',
        programName: 'Strength Building Program',
        programId: 'program-strength-1',
        sessions: [
          {
            id: 'session-1',
            exercises: [
              {
                id: 'ex-1',
                name: 'Squat (Barbell)',
                type: 'strength',
                sets: [
                  { id: 'set-1', number: 1, reps: '8-12', rest: '90' },
                  { id: 'set-2', number: 2, reps: '8-12', rest: '90' },
                  { id: 'set-3', number: 3, reps: '8-12', rest: '90' },
                  { id: 'set-4', number: 4, reps: '8-12', rest: '90' },
                ],
              },
              {
                id: 'ex-2',
                name: 'Bench Press (Barbell)',
                type: 'strength',
                sets: [
                  { id: 'set-5', number: 1, reps: '8-12', rest: '90' },
                  { id: 'set-6', number: 2, reps: '8-12', rest: '90' },
                  { id: 'set-7', number: 3, reps: '8-12', rest: '90' },
                  { id: 'set-8', number: 4, reps: '8-12', rest: '90' },
                ],
              },
              {
                id: 'ex-3',
                name: 'Bent Over Row (Barbell)',
                type: 'strength',
                sets: [
                  { id: 'set-9', number: 1, reps: '8-12', rest: '90' },
                  { id: 'set-10', number: 2, reps: '8-12', rest: '90' },
                  { id: 'set-11', number: 3, reps: '8-12', rest: '90' },
                  { id: 'set-12', number: 4, reps: '8-12', rest: '90' },
                ],
              },
              {
                id: 'ex-4',
                name: 'Overhead Press (Barbell)',
                type: 'strength',
                sets: [
                  { id: 'set-13', number: 1, reps: '8-12', rest: '90' },
                  { id: 'set-14', number: 2, reps: '8-12', rest: '90' },
                  { id: 'set-15', number: 3, reps: '8-12', rest: '90' },
                  { id: 'set-16', number: 4, reps: '8-12', rest: '90' },
                ],
              },
            ],
            notes: 'Focus on proper form and controlled movements',
          },
        ],
      },
      {
        id: 'workout-sarah-2',
        title: 'Upper Body Focus',
        date: getDateString(1),
        clientId: '2',
        programName: 'Strength Building Program',
        programId: 'program-strength-1',
        sessions: [
          {
            id: 'session-2',
            exercises: [
              {
                id: 'ex-7',
                name: 'Incline Dumbbell Press',
                type: 'strength',
                sets: [
                  { id: 'set-23', number: 1, reps: '10-12', rest: '75' },
                  { id: 'set-24', number: 2, reps: '10-12', rest: '75' },
                  { id: 'set-25', number: 3, reps: '10-12', rest: '75' },
                ],
              },
              {
                id: 'ex-8',
                name: 'Cable Fly',
                type: 'strength',
                sets: [
                  { id: 'set-26', number: 1, reps: '12-15', rest: '60' },
                  { id: 'set-27', number: 2, reps: '12-15', rest: '60' },
                  { id: 'set-28', number: 3, reps: '12-15', rest: '60' },
                ],
              },
            ],
            notes: 'Superset bicep and tricep exercises for efficiency',
          },
        ],
      },
      {
        id: 'workout-sarah-3',
        title: 'Lower Body Power',
        date: getDateString(2),
        clientId: '2',
        programName: 'Strength Building Program',
        programId: 'program-strength-1',
        sessions: [
          {
            id: 'session-3',
            exercises: [
              {
                id: 'ex-12',
                name: 'Romanian Deadlift',
                type: 'strength',
                sets: [
                  { id: 'set-38', number: 1, reps: '8-10', rest: '90' },
                  { id: 'set-39', number: 2, reps: '8-10', rest: '90' },
                  { id: 'set-40', number: 3, reps: '8-10', rest: '90' },
                  { id: 'set-41', number: 4, reps: '8-10', rest: '90' },
                ],
              },
            ],
            notes:
              'Focus on full range of motion and mind-muscle connection',
          },
        ],
      },
    ];

    return workouts;
  }

  private loadWorkoutPrograms(): void {
    try {
      const saved = localStorage.getItem('calendarWorkouts');
      if (saved) {
        this.workoutPrograms = JSON.parse(saved);
      } else {
        const examples = this.createExampleWorkouts();
        this.workoutPrograms = examples;
        localStorage.setItem('calendarWorkouts', JSON.stringify(examples));
      }
      this.updateMonthGrid();
    } catch (e) {
      console.error('Error loading workouts', e);
    }
  }

  private saveWorkoutPrograms(): void {
    localStorage.setItem('calendarWorkouts', JSON.stringify(this.workoutPrograms));
  }

  // ---------- Navigation ----------

  getMonthLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  getWeekLabel(): string {
    const days = this.getWeekDates();
    const first = days[0];
    const last = days[6];

    const startStr = first.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
    const endStr = last.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric',
    });

    return `Semaine du ${startStr} au ${endStr}`;
  }

  getDayLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  getWeekDates(): Date[] {
    const startOfWeek = new Date(this.currentDate);
    const day = this.currentDate.getDay();
    const diff = day === 0 ? -6 : 1 - day; // semaine commence lundi
    startOfWeek.setDate(this.currentDate.getDate() + diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }

  goPrev(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() - 1,
        1,
      );
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 1);
      this.currentDate = d;
    }
    this.updateMonthGrid();
  }

  goNext(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
        1,
      );
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 1);
      this.currentDate = d;
    }
    this.updateMonthGrid();
  }

  // ---------- Month grid (ancienne version, gardée vide) ----------
  private updateMonthGrid(): void {
    // plus utilisé par le HTML, mais on laisse pour compat
  }

  // ---------- Copy / paste ----------




  // ---------- Data per day ----------

  getItemsForDay(dateStr: string): (WorkoutProgram | NutritionProgram)[] {
    if (this.calendarType === 'workout') {
      return this.workoutPrograms.filter(
        (p) =>
          p.date === dateStr &&
          (this.selectedClient === 'all' || p.clientId === this.selectedClient),
      );
    } else {
      return this.nutritionPrograms.filter(
        (p) =>
          p.date === dateStr &&
          (this.selectedClient === 'all' || p.clientId === this.selectedClient),
      );
    }
  }

  // ---------- Détails ----------

  viewWorkout(w: WorkoutProgram): void {
    this.selectedWorkout = w;
    this.showWorkoutDetails = true;
  }

  closeWorkoutDetails(): void {
    this.showWorkoutDetails = false;
    this.selectedWorkout = null;
  }

  viewNutrition(n: NutritionProgram): void {
    this.selectedNutritionDay = n;
    this.showNutritionDetails = true;
  }

  closeNutritionDetails(): void {
    this.showNutritionDetails = false;
    this.selectedNutritionDay = null;
  }

  formatRestTime(seconds: string): string {
    const total = parseInt(seconds, 10);
    if (isNaN(total)) return seconds;
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    if (minutes > 0 && secs > 0) return `${minutes}min ${secs}sec`;
    if (minutes > 0) return `${minutes}min`;
    return `${secs}sec`;
  }

  // méthodes appelées par le HTML (navigation + filtres)

  onPrev(): void {
    this.goPrev();
  }

  onNext(): void {
    this.goNext();
  }

  setCalendarType(type: CalendarType): void {
    this.calendarType = type;
  }

  setView(view: CalendarViewMode): void {
    this.currentView = view;
  }

  // ---------- Données pour le template (getters simples) ----------

  // En-tête des jours (LUN, MAR, ...)
  get weekDays(): string[] {
    return ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  }

  // Cases vides avant le 1er jour du mois
  get monthLeadingEmptyCells(): any[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = this.getFirstDayOfMonth(year, month);
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // lundi = 0
    return Array(adjustedFirstDay).fill(0);
  }

  // Données pour chaque jour du mois
  get monthDays(): {
    date: Date;
    dateString: string;
    dayNumber: number;
    isToday: boolean;
    items: (WorkoutProgram | NutritionProgram)[];
  }[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);
    const result: any[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateString = this.formatDateToYYYYMMDD(date);
      result.push({
        date,
        dateString,
        dayNumber: d,
        isToday: this.isToday(date),
        items: this.getItemsForDay(dateString),
      });
    }

    return result;
  }

  // Données pour la vue semaine
  get weekDaysData(): {
    date: Date;
    dateString: string;
    dayNumber: number;
    isToday: boolean;
    weekdayLabel: string;
    items: (WorkoutProgram | NutritionProgram)[];
  }[] {
    const dates = this.getWeekDates();
    return dates.map((date) => {
      const dateString = this.formatDateToYYYYMMDD(date);
      return {
        date,
        dateString,
        dayNumber: date.getDate(),
        isToday: this.isToday(date),
        weekdayLabel: date
          .toLocaleDateString('fr-FR', { weekday: 'short' })
          .toUpperCase(),
        items: this.getItemsForDay(dateString),
      };
    });
  }

  // Vue jour

  get currentDayString(): string {
    return this.formatDateToYYYYMMDD(this.currentDate);
  }

  get dayItems(): (WorkoutProgram | NutritionProgram)[] {
    return this.getItemsForDay(this.currentDayString);
  }

  get dayLabelWeekday(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
    });
  }

  get dayLabelFull(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // Bouton "Add ..." dans le HTML – pour l’instant simple console.log

  copyDay(dateStr: string): void {
    this.copiedDate = dateStr;
  }

  pasteDay(targetDate: string): void {
    if (!this.copiedDate) return;

    const programsToCopy = this.workoutPrograms.filter(
      p => p.date === this.copiedDate
    );
    if (!programsToCopy.length) return;

    const now = Date.now();
    const newPrograms = programsToCopy.map((p, idx) => ({
      ...p,
      id: `${p.id}-copy-${now}-${idx}`,
      date: targetDate,
    }));

    this.workoutPrograms = [...this.workoutPrograms, ...newPrograms];
    this.saveWorkoutPrograms();
  }

  cancelCopy(): void {
    this.copiedDate = null;
  }
  // Ouvrir le modal d'ajout pour un jour donné
  addItem(dateStr: string): void {
    this.selectedDateString = dateStr;
    this.isRestDay = false;
    this.newWorkoutTitle = '';
    this.newWorkoutExercises = [];
    this.exerciseSearchTerm = '';
    this.showExerciseSelector = false;
    this.showAddWorkoutModal = true;
  }


  closeAddWorkoutModal(): void {
    this.showAddWorkoutModal = false;
    this.showExerciseSelector = false;
    this.isRestDay = false;
    this.newWorkoutTitle = '';
    this.newWorkoutExercises = [];
  }

  toggleRestDay(): void {
    this.isRestDay = !this.isRestDay;
  }

  getSelectedDateLabel(): string {
    if (!this.selectedDateString) {
      return '';
    }
    const date = new Date(this.selectedDateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // ====== EXERCISES SELECTOR ======

  openExerciseSelector(): void {
    this.showExerciseSelector = true;
  }

  closeExerciseSelector(): void {
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  getFilteredExercises(): Exercise[] {
    const term = this.exerciseSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    return this.availableExercises.filter((e) =>
      e.name.toLowerCase().includes(term)
    );
  }

  handleAddExerciseToWorkout(exercise: Exercise): void {
    // copie profonde pour ne pas modifier la librairie
    const copy: Exercise = {
      ...exercise,
      id: `new-ex-${Date.now()}-${Math.random()}`,
      sets: exercise.sets
        ? exercise.sets.map((s, index) => ({
          ...s,
          id: `new-set-${Date.now()}-${index}`,
        }))
        : [],
    };
    this.newWorkoutExercises.push(copy);
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  handleRemoveExerciseFromWorkout(exerciseId: string): void {
    this.newWorkoutExercises = this.newWorkoutExercises.filter(
      (e) => e.id !== exerciseId
    );
  }

  addSetToExercise(exercise: Exercise): void {
    if (!exercise.sets) {
      exercise.sets = [];
    }
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const nextNumber = exercise.sets.length + 1;
    exercise.sets.push({
      id: `set-${Date.now()}`,
      number: nextNumber,
      reps: lastSet ? lastSet.reps : '8-12',
      rest: lastSet ? lastSet.rest : '60',
    });
  }

  removeSetFromExercise(exercise: Exercise, setIndex: number): void {
    if (!exercise.sets) {
      return;
    }
    exercise.sets.splice(setIndex, 1);
    exercise.sets.forEach((s, i) => (s.number = i + 1));
  }

  // gestion rest en minutes/secondes
  getRestMinutes(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    if (isNaN(total)) return 0;
    return Math.floor(total / 60);
  }

  getRestSeconds(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    if (isNaN(total)) return 0;
    return total % 60;
  }

  updateRestMinutes(set: ExerciseSet, minutes: number): void {
    const m = isNaN(minutes) ? 0 : minutes;
    const s = this.getRestSeconds(set);
    set.rest = String(m * 60 + s);
  }

  updateRestSeconds(set: ExerciseSet, seconds: number): void {
    const s = isNaN(seconds) ? 0 : seconds;
    const m = this.getRestMinutes(set);
    const sec = Math.min(Math.max(s, 0), 59);
    set.rest = String(m * 60 + sec);
  }

  // ====== SAVE WORKOUT ======

  handleSaveWorkout(): void {
    if (!this.selectedDateString) {
      return;
    }

    const clientId =
      this.selectedClient === 'all' ? undefined : this.selectedClient;

    if (this.isRestDay) {
      const restProgram: WorkoutProgram = {
        id: `rest-${Date.now()}`,
        title: 'Rest Day',
        date: this.selectedDateString,
        clientId,
        sessions: [],
      };
      this.workoutPrograms = [...this.workoutPrograms, restProgram];
      this.saveWorkoutPrograms();
      this.closeAddWorkoutModal();
      return;
    }

    if (!this.newWorkoutTitle.trim() || !this.newWorkoutExercises.length) {
      return;
    }

    const newProgram: WorkoutProgram = {
      id: `workout-${Date.now()}`,
      title: this.newWorkoutTitle.trim(),
      date: this.selectedDateString,
      clientId,
      programName: undefined,
      programId: undefined,
      sessions: [
        {
          id: `session-${Date.now()}`,
          exercises: this.newWorkoutExercises.map((ex, exIndex) => ({
            ...ex,
            id: ex.id || `ex-${Date.now()}-${exIndex}`,
            sets: ex.sets
              ? ex.sets.map((s, sIndex) => ({
                ...s,
                id: s.id || `set-${Date.now()}-${exIndex}-${sIndex}`,
              }))
              : [],
          })),
          notes: '',
        },
      ],
    };

    this.workoutPrograms = [...this.workoutPrograms, newProgram];
    this.saveWorkoutPrograms();
    this.closeAddWorkoutModal();
  }

  // ====== DELETE WORKOUT ======

  openDeleteModal(workout: WorkoutProgram): void {
    this.workoutToDelete = workout;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.workoutToDelete = null;
  }

  handleDeleteWorkout(): void {
    if (!this.workoutToDelete) return;

    const idToDelete = this.workoutToDelete.id;
    this.workoutPrograms = this.workoutPrograms.filter(
      (w) => w.id !== idToDelete
    );
    this.saveWorkoutPrograms();
    this.closeDeleteModal();
  }

}
