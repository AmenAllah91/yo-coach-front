import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutService } from 'app/service/workout.service';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';
import { WorkoutDayService } from 'app/service/workout-day.service';

type WorkoutStatus = 'COMPLETED' | 'MISSED' | 'PENDING';

interface ExerciseSet {
  setNumber?: number;
  reps: number;
  restMin: number;
  restSec: number;
}

interface RawExercise {
  id: string;
  name: string;
  type: 'CARDIO' | 'MUSCULATION';
  supersetGroupId: string | null;
  sets: ExerciseSet[];
}

interface WorkoutSession {
  name: string;
  exercises: RawExercise[];
}

interface Workout {
  id: string;
  planId: string;
  date: string;
  title: string;
  program: string;
  status: WorkoutStatus;
  rawSessions: WorkoutSession[]; // Sessions brutes pour le mapping
  groupedExercises: GroupedExercise[]; // Exercices groupés avec numérotation
}

interface GroupedExercise {
  groupIndex: number; // 1, 2, 3...
  subIndex?: number; // 1, 2 pour superset
  displayNumber: string; // "1", "1.1", "1.2", "2"
  label: string;
  name: string;
  type: string;
  sets: {
    reps: string;
    rest: string;
  }[];
  duration?: number;
}

@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [CommonModule, ModalConfirmComponent],
  templateUrl: './client-workouts.component.html',
  styleUrl: './client-workouts.component.scss',
})
export class ClientWorkoutsComponent implements OnInit {
  activeTab: 'upcoming' | 'past' = 'upcoming';
  currentMonthDate = new Date();
  userid = sessionStorage.getItem('userId');
  selectedWorkout: Workout | null = null;

  workouts: Workout[] = [];
  coaches: any[] = [];
  selectedCoachId: string | 'all' = 'all';
  constructor(
    private workoutService: WorkoutService,
    private workoutDayService: WorkoutDayService
  ) {}

  ngOnInit(): void {
    this.getWorkoutDay();
  }

  getWorkoutDay() {
    this.workoutService
      .getWorkoutPlansByClient(this.userid)
      .subscribe((plans: any[]) => {
        console.log('API Response:', plans);

        const coachMap = new Map<string, any>();
        plans.forEach((plan) => {
          if (plan.coach && plan.coach.id) {
            coachMap.set(plan.coach.id, {
              id: plan.coach.id,
              firstName: plan.coach.firstName || 'Coach',
              lastName: plan.coach.lastName || '',
              fullName: `${plan.coach.firstName || 'Coach'} ${
                plan.coach.lastName || ''
              }`.trim(),
            });
          }
        });

        this.coaches = Array.from(coachMap.values());

        if (this.coaches.length === 1) {
          this.selectedCoachId = this.coaches[0].id;
        } else {
          this.selectedCoachId = 'all';
        }
        this.applyCoachFilter();
      });
  }

  applyCoachFilter() {
    this.workoutService
      .getWorkoutPlansByClient(this.userid)
      .subscribe((plans: any[]) => {
        let filteredPlans = plans;

        if (this.selectedCoachId !== 'all') {
          filteredPlans = plans.filter(
            (plan) => plan.coach && plan.coach.id === this.selectedCoachId
          );
        }

        this.workouts = this.mapPlansToWorkouts(filteredPlans);
        this.selectedWorkout = null;
      });
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.applyCoachFilter();
  }

  get currentMonth(): string {
    return this.currentMonthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  get displayWorkouts(): Workout[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.workouts.filter((w) => {
      const workoutDate = new Date(w.date);
      workoutDate.setHours(0, 0, 0, 0);

      const sameMonth =
        workoutDate.getMonth() === this.currentMonthDate.getMonth() &&
        workoutDate.getFullYear() === this.currentMonthDate.getFullYear();

      if (!sameMonth) return false;

      return this.activeTab === 'upcoming'
        ? workoutDate >= today
        : workoutDate < today;
    });
  }

  mapPlansToWorkouts(plans: any[]): Workout[] {
    const workouts: Workout[] = [];

    plans.forEach((plan) => {
      if (!plan.startDate) return;

      const planStart = new Date(plan.startDate);

      plan.workoutDays.forEach((day: any) => {
        if (!day.dayNumber) return;

        const workoutDate = new Date(planStart);
        workoutDate.setDate(planStart.getDate() + (day.dayNumber - 1));
        const dateStr = workoutDate.toISOString().split('T')[0];

        const groupedExercises = this.groupExercisesBySuperset(
          day.workoutSessions || []
        );

        workouts.push({
          id: day.id,
          planId: plan.id,
          date: dateStr,
          title: day.title || `Day ${day.dayNumber}`,
          program: plan.name,
          status: day.status ?? 'PENDING',
          rawSessions: day.workoutSessions || [],
          groupedExercises,
        });
      });
    });

    return workouts;
  }

  private groupExercisesBySuperset(sessions: any[]): GroupedExercise[] {
    const allExercises: RawExercise[] = sessions.flatMap((s) => s.exercises);

    // Grouper par supersetGroupId
    const groups: { [key: string]: RawExercise[] } = {};
    allExercises.forEach((ex) => {
      const groupId = ex.supersetGroupId || `solo_${ex.id}`;
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(ex);
    });

    const groupedExercises: GroupedExercise[] = [];
    let globalIndex = 1;

    Object.values(groups).forEach((groupExercises: RawExercise[]) => {
      groupExercises.forEach((ex, subIndex) => {
        const isSuperset = groupExercises.length > 1;
        const displayNumber = isSuperset
          ? `${globalIndex}.${subIndex + 1}`
          : `${globalIndex}`;

        groupedExercises.push({
          groupIndex: globalIndex,
          subIndex: isSuperset ? subIndex + 1 : undefined,
          displayNumber,
          label: ex.type,
          name: ex.name,
          type : ex.type,
          sets:
            ex.sets?.map((s) => ({
              reps: `${s.reps}`,
              rest: `${s.restMin * 60 + s.restSec}`,
            })) || [],
          duration: ex.type === 'CARDIO' ? ex.sets?.[0]?.reps || 0 : 0,
        });
      });
      globalIndex++;
    });

    return groupedExercises;
  }

  getTotalExercises(workout: Workout): number {
    return workout.groupedExercises.length;
  }

  userName = 'Kolton';

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  setActiveTab(tab: 'upcoming' | 'past') {
    this.activeTab = tab;
    this.selectedWorkout = null;
  }

  prevMonth(): void {
    this.currentMonthDate = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() - 1,
      1
    );
  }

  nextMonth(): void {
    this.currentMonthDate = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() + 1,
      1
    );
  }

  onSelectWorkout(workout: Workout): void {
    this.selectedWorkout = { ...workout };
  }

  backToList() {
    this.selectedWorkout = null;
  }

  showConfirmModal = false;
  pendingStatus: WorkoutStatus | null = null;

  openConfirmModal(status: WorkoutStatus): void {
    this.pendingStatus = status;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingStatus = null;
  }

  confirmStatusUpdate(): void {
    if (this.selectedWorkout && this.pendingStatus) {
      this.updateWorkoutStatus(this.selectedWorkout, this.pendingStatus);
    }
    this.closeConfirmModal();
  }

  updateWorkoutStatus(workout: Workout, status: WorkoutStatus): void {
    workout.status = status;

    this.workoutDayService
      .updateWorkoutDay({ id: workout.id, status }, workout.planId)
      .subscribe({
        next: () => console.log('Status updated:', status),
        error: (err) => {
          console.error('Update failed:', err);
          workout.status = 'PENDING'; // Revert
        },
      });
  }
}
