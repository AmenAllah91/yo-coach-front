import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService } from 'app/service/client.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
  youtubeUrl?: string;
  showVideo?: boolean;
  videoUrl?: SafeResourceUrl;
  rawVideoUrl?: string;
}

interface WorkoutSession {
  id: string;
  exercises: Exercise[];
  notes?: string;
}

interface WorkoutProgram {
  id: string;
  title: string;
  date: string;
  clientId?: string;
  color?: string;
  sessions: WorkoutSession[];
  programId?: string;
  programName?: string;
  status?: 'COMPLETED' | 'MISSED' | 'PENDING';
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
  styleUrl: './calendar-clients.component.scss',
})
export class CalendarClientsComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  currentView: CalendarViewMode = 'month';
  calendarType: CalendarType = 'workout';
  selectedClient: string = 'all';
  copiedDate: string | null = null;
  userId = sessionStorage.getItem('userId');
  selectedWorkout: WorkoutProgram | null = null;
  selectedNutritionDay: NutritionProgram | null = null;
  showWorkoutDetails = false;
  showNutritionDetails = false;

  showAddWorkoutModal = false;
  isRestDay = false;
  selectedDateString: string | null = null;
  newWorkoutTitle = '';
  newWorkoutExercises: Exercise[] = [];
  showExerciseSelector = false;
  exerciseSearchTerm = '';
  showDeleteModal = false;
  workoutToDelete: WorkoutProgram | null = null;

  availableExercises: Exercise[] = [
    {
      id: 'lib-squat',
      name: 'Squat (Barbell)',
      type: 'strength',
      youtubeUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
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
      youtubeUrl: 'https://www.youtube.com/watch?v=SCVCLChPQFY',
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
      youtubeUrl: 'https://www.youtube.com/watch?v=kZDvg92tTMc',
      sets: [],
      duration: 30,
    },
  ];

  workoutPrograms: any[] = [];
  nutritionPrograms: NutritionProgram[] = [];
  clients: Client[] = [];
  monthEmptyCells: number[] = [];
  monthDates: Date[] = [];
  client: any;

  private storageListener = () => this.loadWorkoutPrograms();

  constructor(
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private clientService: ClientService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadWorkoutPrograms();
    window.addEventListener('storage', this.storageListener);
    this.updateMonthGrid();
    this.getAllLibrary();
    this.getWorkout();
    this.getClients();
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.storageListener);
  }

  onClientChange(clientId: string): void {
    this.selectedClient = clientId;
  }

  getClients(): void {
    this.clientService
      .getListClientsByCoachWithoutPagination(this.userId)
      .subscribe({
        next: (res) => {
          this.clients = res;
        },
        error: (err) => {
          console.error('Error loading clients', err);
        },
      });
  }

  getAllLibrary(): void {
    this.nutritionService.getNutritionPlans().subscribe((res) => {
      this.nutritionPrograms = this.mapBackendToNutritionPrograms(res.content);
    });
  }

  getWorkout(): void {
    this.workoutService.getAllLibrary().subscribe((res) => {
      this.workoutPrograms = this.mapBackendToWorkoutPrograms(res.content);
    });
  }

  mapBackendToWorkoutPrograms(plans: any[]): WorkoutProgram[] {
    const result: WorkoutProgram[] = [];

    plans.forEach((plan) => {
      const startDate = plan.startDate;

      plan.workoutDays.forEach((day: any) => {
        const date = this.addDays(startDate, day.dayNumber - 1);

        if (day.restDay) {
          result.push({
            id: `${plan.id}-rest-${day.dayNumber}`,
            title: 'Rest Day',
            date,
            clientId: plan.client?.id,
            programId: plan.id,
            programName: plan.name,
            sessions: [],
            status: day.status || 'PENDING',
          });
          return;
        }

        const sessions: WorkoutSession[] = (day.workoutSessions || []).map(
          (session: any, sIndex: number) => ({
            id: `${plan.id}-session-${sIndex}`,
            notes: session.name,
            exercises: (session.exercises || []).map(
              (ex: any, exIndex: number) => ({
                id: ex.id || `${plan.id}-ex-${exIndex}`,
                name: ex.name,
                type: ex.type === 'CARDIO' ? 'cardio' : 'strength',
                youtubeUrl: ex.youtubeUrl || ex.videoUrl || null,
                sets: (ex.sets || []).map((set: any, setIndex: number) => ({
                  id: `${plan.id}-set-${setIndex}`,
                  number: set.setNumber ?? setIndex + 1,
                  reps: String(set.reps),
                  rest: String((set.restMin ?? 0) * 60 + (set.restSec ?? 0)),
                })),
              })
            ),
          })
        );

        result.push({
          id: `${plan.id}-${day.dayNumber}`,
          title: day.title || plan.name,
          date,
          clientId: plan.client?.id,
          programId: plan.id,
          programName: plan.name,
          sessions,
          status: day.status,
        });
      });
    });

    return result;
  }

  mapBackendToNutritionPrograms(plans: any[]): NutritionProgram[] {
    const result: NutritionProgram[] = [];

    plans.forEach((plan) => {
      plan.mealDays.forEach((day: any) => {
        const isRestDay =
          (!day.meals || day.meals.length === 0) &&
          !day.cheatMeal &&
          !day.refeedDay;

        if (isRestDay) {
          result.push({
            id: `${plan.id}-rest-${day.date}`,
            title: 'Rest Day',
            date: day.date,
            clientId: plan.client?.id,
            programName: plan.name,
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            meals: [],
          });
          return;
        }

        const meals: NutritionMeal[] = (day.meals || []).map(
          (meal: any, i: number) => ({
            id: meal.id || `${plan.id}-meal-${i}`,
            name: meal.name || `Meal ${i + 1}`,
            foods: (meal.foods || []).map((food: any) => ({
              name: food.name,
              quantity: food.quantity,
              protein: food.protein ?? 0,
              carbs: food.carbs ?? 0,
              fat: food.fat ?? 0,
              calories: food.calories ?? 0,
            })),
          })
        );

        result.push({
          id: `${plan.id}-${day.date}`,
          title: plan.name,
          date: day.date,
          clientId: plan.client?.id,
          programName: plan.name,
          totalCalories: day.dayTargets?.calories ?? 0,
          totalProtein: day.dayTargets?.proteinG ?? 0,
          totalCarbs: day.dayTargets?.carbsG ?? 0,
          totalFat: day.dayTargets?.fatG ?? 0,
          meals,
        });
      });
    });

    return result;
  }

  // ---------- Utils ----------

  addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this.formatDateToYYYYMMDD(d);
  }

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

  getBadgeText(status: string): string {
    switch (status) {
      case 'COMPLETED': return '✓';
      case 'MISSED': return '✕';
      default: return 'P';
    }
  }

  private loadWorkoutPrograms(): void {
    this.workoutService.getWorkouts().subscribe();
  }

  private saveWorkoutPrograms(): void {
    localStorage.setItem('calendarWorkouts', JSON.stringify(this.workoutPrograms));
  }

  private updateMonthGrid(): void {}

  // ---------- Navigation ----------

  getMonthLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      month: 'long', year: 'numeric',
    });
  }

  getWeekLabel(): string {
    const days = this.getWeekDates();
    const first = days[0];
    const last = days[6];
    const startStr = first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = last.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric',
    });
    return `Semaine du ${startStr} au ${endStr}`;
  }

  getDayLabel(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  getWeekDates(): Date[] {
    const startOfWeek = new Date(this.currentDate);
    const day = this.currentDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(this.currentDate.getDate() + diff);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }

  onPrev(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 1);
      this.currentDate = d;
    }
  }

  onNext(): void {
    if (this.currentView === 'month') {
      this.currentDate = new Date(
        this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else if (this.currentView === 'week') {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 7);
      this.currentDate = d;
    } else {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 1);
      this.currentDate = d;
    }
  }

  setCalendarType(type: CalendarType): void { this.calendarType = type; }
  setView(view: CalendarViewMode): void { this.currentView = view; }

  // ---------- Getters template ----------

  get weekDays(): string[] {
    return ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  }

  get monthLeadingEmptyCells(): any[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = this.getFirstDayOfMonth(year, month);
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    return Array(adjustedFirstDay).fill(0);
  }

  get monthDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);
    const result: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateString = this.formatDateToYYYYMMDD(date);
      result.push({
        date, dateString, dayNumber: d,
        isToday: this.isToday(date),
        items: this.getItemsForDay(dateString),
      });
    }
    return result;
  }

  get weekDaysData() {
    return this.getWeekDates().map((date) => {
      const dateString = this.formatDateToYYYYMMDD(date);
      return {
        date, dateString,
        dayNumber: date.getDate(),
        isToday: this.isToday(date),
        weekdayLabel: date.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase(),
        items: this.getItemsForDay(dateString),
      };
    });
  }

  get currentDayString(): string { return this.formatDateToYYYYMMDD(this.currentDate); }
  get dayItems() { return this.getItemsForDay(this.currentDayString); }
  get dayLabelWeekday(): string {
    return this.currentDate.toLocaleDateString('fr-FR', { weekday: 'long' });
  }
  get dayLabelFull(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // ---------- Data ----------

  getItemsForDay(dateStr: string): (WorkoutProgram | NutritionProgram)[] {
    if (this.calendarType === 'workout') {
      return this.workoutPrograms.filter(
        (p) => p.date === dateStr &&
          (this.selectedClient === 'all' || p.clientId === this.selectedClient)
      );
    } else {
      return this.nutritionPrograms.filter(
        (p) => p.date === dateStr &&
          (this.selectedClient === 'all' || p.clientId === this.selectedClient)
      );
    }
  }

  // ---------- Details ----------

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

  // ---------- Copy/Paste ----------

  copyDay(dateStr: string): void { this.copiedDate = dateStr; }

  pasteDay(targetDate: string): void {
    if (!this.copiedDate) return;
    const programsToCopy = this.workoutPrograms.filter((p) => p.date === this.copiedDate);
    if (!programsToCopy.length) return;
    const now = Date.now();
    const newPrograms = programsToCopy.map((p, idx) => ({
      ...p, id: `${p.id}-copy-${now}-${idx}`, date: targetDate,
    }));
    this.workoutPrograms = [...this.workoutPrograms, ...newPrograms];
    this.saveWorkoutPrograms();
  }

  cancelCopy(): void { this.copiedDate = null; }

  // ---------- Modal ----------

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

  toggleRestDay(): void { this.isRestDay = !this.isRestDay; }

  getSelectedDateLabel(): string {
    if (!this.selectedDateString) return '';
    const date = new Date(this.selectedDateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // ---------- Exercise Selector ----------

  openExerciseSelector(): void { this.showExerciseSelector = true; }

  closeExerciseSelector(): void {
    this.showExerciseSelector = false;
    this.exerciseSearchTerm = '';
  }

  getFilteredExercises(): Exercise[] {
    const term = this.exerciseSearchTerm.trim().toLowerCase();
    if (!term) return this.availableExercises;
    return this.availableExercises.filter((e) =>
      e.name.toLowerCase().includes(term)
    );
  }

  handleAddExerciseToWorkout(exercise: Exercise): void {
    const copy: Exercise = {
      ...exercise,
      id: `new-ex-${Date.now()}-${Math.random()}`,
      showVideo: false,
      videoUrl: undefined,
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
    if (!exercise.sets) exercise.sets = [];
    const lastSet = exercise.sets[exercise.sets.length - 1];
    exercise.sets.push({
      id: `set-${Date.now()}`,
      number: exercise.sets.length + 1,
      reps: lastSet ? lastSet.reps : '8-12',
      rest: lastSet ? lastSet.rest : '60',
    });
  }

  removeSetFromExercise(exercise: Exercise, setIndex: number): void {
    if (!exercise.sets) return;
    exercise.sets.splice(setIndex, 1);
    exercise.sets.forEach((s, i) => (s.number = i + 1));
  }

  getRestMinutes(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    return isNaN(total) ? 0 : Math.floor(total / 60);
  }

  getRestSeconds(set: ExerciseSet): number {
    const total = parseInt(set.rest, 10);
    return isNaN(total) ? 0 : total % 60;
  }

  updateRestMinutes(set: ExerciseSet, minutes: number): void {
    const m = isNaN(minutes) ? 0 : minutes;
    set.rest = String(m * 60 + this.getRestSeconds(set));
  }

  updateRestSeconds(set: ExerciseSet, seconds: number): void {
    const s = isNaN(seconds) ? 0 : Math.min(Math.max(seconds, 0), 59);
    set.rest = String(this.getRestMinutes(set) * 60 + s);
  }

  // ---------- Video ----------

  toggleExerciseVideo(exercise: any): void {
    exercise.showVideo = !exercise.showVideo;
    if (exercise.showVideo && !exercise.videoUrl) {
      const videoId = this.extractYoutubeId(exercise.youtubeUrl);
      if (videoId) {
        exercise.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${videoId}`
        );
        exercise.rawVideoUrl = exercise.youtubeUrl;
      }
    }
  }

  extractYoutubeId(url: string): string | null {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  }

  // ---------- Save Workout ----------

  handleSaveWorkout(): void {
    if (!this.selectedDateString) return;
    const clientId = this.selectedClient === 'all' ? undefined : this.selectedClient;

    if (this.isRestDay) {
      this.workoutPrograms = [...this.workoutPrograms, {
        id: `rest-${Date.now()}`,
        title: 'Rest Day',
        date: this.selectedDateString,
        clientId,
        sessions: [],
      }];
      this.saveWorkoutPrograms();
      this.closeAddWorkoutModal();
      return;
    }

    if (!this.newWorkoutTitle.trim() || !this.newWorkoutExercises.length) return;

    const newProgram: WorkoutProgram = {
      id: `workout-${Date.now()}`,
      title: this.newWorkoutTitle.trim(),
      date: this.selectedDateString,
      clientId,
      programName: undefined,
      programId: undefined,
      sessions: [{
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
      }],
    };

    this.workoutPrograms = [...this.workoutPrograms, newProgram];
    this.saveWorkoutPrograms();
    this.closeAddWorkoutModal();
  }

  // ---------- Delete Workout ----------

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
    this.workoutPrograms = this.workoutPrograms.filter(
      (w) => w.id !== this.workoutToDelete!.id
    );
    this.saveWorkoutPrograms();
    this.closeDeleteModal();
  }
}
