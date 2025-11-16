import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";

type TabId =
  | 'dashboard'
  | 'workouts'
  | 'nutrition'
  | 'checkins'
  | 'pictures'
  | 'calendar';

type WorkoutStatus = 'active' | 'upcoming' | 'completed';
type PlanStatus = 'active' | 'upcoming' | 'completed';
interface Exercise {
  name: string;
  sets: string;   // ex: "4 sets × 8–12 reps"
  rest: string;   // ex: "90s"
}

interface TodaysWorkout {
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  name: string; // "Full Body Day 1"
  exercises: Exercise[];
}

interface ActiveNutritionPlan {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WorkoutProgram {
  id: number;
  name: string;
  status: WorkoutStatus;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  currentWeek?: number;
  daysPerWeek: number;
}

interface NutritionPlan {
  id: number;
  name: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-profil-client',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profil-client.component.html',
  styleUrl: './profil-client.component.scss',
})
export class ProfilClientComponent {
  activeTab: TabId = 'dashboard';

  client = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    photoUrl: 'assets/images/default-avatar.png',
    lastWorkout: '6 days ago',
  };

  // Données statiques pour le moment
  clientGoal = `Lose 5kg in 3 months
Train 3x per week
Improve conditioning`;

  clientNotes = `Prefers training in the morning.
Avoids heavy overhead movements.
Motivated but needs accountability.`;

  subscriptions = [
    { startDate: '2024-09-01', endDate: '2024-10-01', status: 'ACTIVE' },
    { startDate: '2024-08-01', endDate: '2024-09-01', status: 'EXPIRED' },
  ];

  latestWeight = 78.5; // kg

  // 👉 données pour l’onglet Workouts (comme sur la maquette React)
  workoutPrograms: WorkoutProgram[] = [
    {
      id: 1,
      name: 'Full Body x3',
      status: 'active',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
      totalWeeks: 12,
      currentWeek: 3,
      daysPerWeek: 3,
    },
    {
      id: 2,
      name: 'Advanced Strength Program',
      status: 'upcoming',
      startDate: '2024-04-16',
      endDate: '2024-07-16',
      totalWeeks: 12,
      daysPerWeek: 4,
    },
    {
      id: 3,
      name: 'Beginner Program',
      status: 'completed',
      startDate: '2023-10-01',
      endDate: '2024-01-14',
      totalWeeks: 8,
      currentWeek: 8,
      daysPerWeek: 3,
    },
  ];

  // 👉 données pour l’onglet Nutrition (comme la capture)
  nutritionPlans: NutritionPlan[] = [
    {
      id: 1,
      name: 'Weight Loss Plan - 2000kcal',
      status: 'active',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
    },
    {
      id: 2,
      name: 'Maintenance Plan - 2500kcal',
      status: 'upcoming',
      startDate: '2024-04-16',
      endDate: '2024-07-16',
    },
    {
      id: 3,
      name: 'Initial Plan - 2750kcal',
      status: 'completed',
      startDate: '2023-10-01',
      endDate: '2024-01-14',
    },
  ];

  setTab(tab: TabId) {
    this.activeTab = tab;
  }

  get fullName(): string {
    return `${this.client.firstName} ${this.client.lastName}`;
  }

  // utilisé dans le template pour afficher "91 days", etc.
  getDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  // Dashboard - Today's Workout
  todaysWorkout: TodaysWorkout = {
    programName: 'Full Body x3',
    currentWeek: 3,
    totalWeeks: 4,
    name: 'Full Body Day 1',
    exercises: [
      {
        name: 'Squat (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s'
      },
      {
        name: 'Bench Press (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s'
      },
      {
        name: 'Bent Over Row (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s'
      },
      {
        name: 'Overhead Press (Barbell)',
        sets: '4 sets × 8–12 reps',
        rest: '90s'
      },
      {
        name: 'Lat Pulldown (Cable)',
        sets: '3 sets × 10–15 reps',
        rest: '60s'
      },
      {
        name: 'Seated Leg Curl (Machine)',
        sets: '3 sets × 12–15 reps',
        rest: '60s'
      }
    ]
  };

  // Dashboard - Active Nutrition Plan
  activeNutritionPlan: ActiveNutritionPlan = {
    name: 'Weight Loss Plan - 2000kcal',
    dailyCalories: 2000,
    protein: 169,
    carbs: 180,
    fat: 60
  };

  // utilitaire pour la lettre A, B, C...
  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

}
