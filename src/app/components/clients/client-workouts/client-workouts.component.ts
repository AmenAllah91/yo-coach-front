import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";

type WorkoutStatus = 'completed' | 'missed' | 'pending';

interface ExerciseSet {
  reps: string;
  rest: string;
}

interface Exercise {
  id: string;
  label: string;
  name: string;
  type?: 'strength' | 'cardio';
  sets?: ExerciseSet[];
  duration?: number;
  videoUrl?: string;
  image?: string;
}

interface Workout {
  id: string;
  date: string;
  title: string;
  exercises: Exercise[];
  status?: WorkoutStatus;
  program?: string;
}
@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-workouts.component.html',
  styleUrl: './client-workouts.component.scss'
})
export class ClientWorkoutsComponent {
  activeTab: 'upcoming' | 'past' = 'upcoming';
  currentMonth = 'October 2022';

  selectedWorkout: Workout | null = null;
  showVideoForExercise: string | null = null;

  workouts: Workout[] = [
    {
      id: '1',
      date: 'Today',
      title: 'At-Home Workout',
      program: 'Full Body Program',
      status: 'pending',
      exercises: [
        {
          id: 'ex0',
          label: '🔥',
          name: 'Warm up',
          type: 'cardio',
          duration: 10,
        },
        {
          id: 'ex1',
          label: 'A1',
          name: 'Single Arm Dumbbell Row',
          type: 'strength',
          sets: [
            { reps: '8-12', rest: '60' },
            { reps: '8-12', rest: '60' },
            { reps: '8-12', rest: '60' },
          ],
          videoUrl: 'https://www.youtube.com/embed/dFzUjzfih8k',
        },
        {
          id: 'ex2',
          label: 'A2',
          name: 'Dumbbell Hex Press',
          type: 'strength',
          sets: [
            { reps: '10', rest: '45' },
            { reps: '10', rest: '45' },
            { reps: '10', rest: '45' },
          ],
          videoUrl: 'https://www.youtube.com/embed/PXMQmPaUwe8',
        },
        {
          id: 'ex3',
          label: 'A3',
          name: 'Kettlebell Sumo Wide Stance Roman Deadlift',
          type: 'strength',
          sets: [
            { reps: '12', rest: '60' },
            { reps: '12', rest: '60' },
            { reps: '12', rest: '90' },
          ],
        },
        {
          id: 'ex4',
          label: 'B',
          name: ':30 work / :30 rest for 30 min',
          type: 'cardio',
          duration: 30,
        },
        {
          id: 'ex5',
          label: 'C',
          name: 'Arch Hold',
          type: 'strength',
          sets: [
            { reps: '30 sec', rest: '30' },
            { reps: '30 sec', rest: '30' },
            { reps: '30 sec', rest: '0' },
          ],
        },
      ],
    },
    {
      id: '2',
      date: 'October 11, 2022',
      title: 'In-Gym Workout',
      program: 'Strength Building',
      status: 'completed',
      exercises: [
        {
          id: 'ex6',
          label: '🔥',
          name: 'Warm up',
          type: 'cardio',
          duration: 10,
        },
        {
          id: 'ex7',
          label: 'A',
          name: 'Front Squat',
          type: 'strength',
          sets: [
            { reps: '8', rest: '90' },
            { reps: '8', rest: '90' },
            { reps: '8', rest: '90' },
          ],
        },
        {
          id: 'ex8',
          label: 'B1',
          name: 'Goblet Lunge',
          type: 'strength',
          sets: [
            { reps: '10/leg', rest: '30' },
            { reps: '10/leg', rest: '30' },
            { reps: '10/leg', rest: '30' },
          ],
        },
        {
          id: 'ex9',
          label: 'B2',
          name: 'Burpee Pull Up',
          type: 'strength',
          sets: [
            { reps: '6', rest: '30' },
            { reps: '6', rest: '30' },
            { reps: '6', rest: '30' },
          ],
        },
        {
          id: 'ex10',
          label: 'B3',
          name: 'Side Plank',
          type: 'strength',
          sets: [
            { reps: '30 sec/side', rest: '30' },
            { reps: '30 sec/side', rest: '30' },
            { reps: '30 sec/side', rest: '30' },
          ],
        },
        {
          id: 'ex11',
          label: 'C',
          name: 'Cardio',
          type: 'cardio',
          duration: 20,
        },
      ],
    },
    {
      id: '3',
      date: 'October 9, 2022',
      title: 'Bike Workout',
      program: 'Cardio Program',
      status: 'completed',
      exercises: [
        { id: 'ex12', label: '🔥', name: 'Warm up', type: 'cardio', duration: 5 },
        { id: 'ex13', label: 'A', name: 'Mountain Bike', type: 'cardio', duration: 45 },
        { id: 'ex14', label: 'B', name: 'Cooldown', type: 'cardio', duration: 5 },
      ],
    },
  ];

  pastWorkouts: Workout[] = [
    {
      id: '4',
      date: 'October 7, 2022',
      title: 'HIIT Workout',
      program: 'Fat Loss Program',
      status: 'completed',
      exercises: [
        { id: 'ex15', label: '🔥', name: 'Warm up', type: 'cardio', duration: 5 },
        { id: 'ex16', label: 'A', name: 'Jump Rope', type: 'cardio', duration: 15 },
        {
          id: 'ex17',
          label: 'B',
          name: 'Kettlebell Swings',
          type: 'strength',
          sets: [
            { reps: '15', rest: '30' },
            { reps: '15', rest: '30' },
            { reps: '15', rest: '30' },
            { reps: '15', rest: '30' },
          ],
        },
      ],
    },
    {
      id: '5',
      date: 'October 5, 2022',
      title: 'Rest Day',
      program: 'Recovery',
      status: 'completed',
      exercises: [],
    },
    {
      id: '6',
      date: 'October 3, 2022',
      title: 'Strength Training',
      program: 'Strength Building',
      status: 'missed',
      exercises: [
        { id: 'ex18', label: '🔥', name: 'Warm up', type: 'cardio', duration: 10 },
        {
          id: 'ex19',
          label: 'A1',
          name: 'Barbell Squat',
          type: 'strength',
          sets: [
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
          ],
        },
        {
          id: 'ex20',
          label: 'A2',
          name: 'Bench Press',
          type: 'strength',
          sets: [
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
            { reps: '5', rest: '90' },
          ],
        },
        {
          id: 'ex21',
          label: 'B',
          name: 'Deadlift',
          type: 'strength',
          sets: [
            { reps: '5', rest: '120' },
            { reps: '5', rest: '120' },
            { reps: '5', rest: '120' },
          ],
        },
      ],
    },
  ];

  get displayWorkouts(): Workout[] {
    return this.activeTab === 'upcoming' ? this.workouts : this.pastWorkouts;
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  userName = 'Kolton';

  setActiveTab(tab: 'upcoming' | 'past') {
    this.activeTab = tab;
    this.selectedWorkout = null;
  }

  prevMonth() {
    this.currentMonth = 'September 2022';
  }

  nextMonth() {
    this.currentMonth = 'November 2022';
  }

  selectWorkout(workout: Workout) {
    this.selectedWorkout = workout;
    this.showVideoForExercise = null;
  }

  backToList() {
    this.selectedWorkout = null;
    this.showVideoForExercise = null;
  }

  updateWorkoutStatus(workoutId: string, status: WorkoutStatus) {
    const list = this.activeTab === 'upcoming' ? this.workouts : this.pastWorkouts;
    list.forEach((w) => {
      if (w.id === workoutId) {
        w.status = status;
      }
    });

    if (this.selectedWorkout && this.selectedWorkout.id === workoutId) {
      this.selectedWorkout = { ...this.selectedWorkout, status };
    }
  }

  toggleVideo(exerciseId: string) {
    this.showVideoForExercise =
      this.showVideoForExercise === exerciseId ? null : exerciseId;
  }

  isWarmup(label: string): boolean {
    return label === '🔥';
  }
  onSelectWorkout(workout: Workout): void {
    this.selectedWorkout = workout;
  }
}
