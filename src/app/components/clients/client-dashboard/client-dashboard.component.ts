import { Component } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import { BodyMeasurementsComponent } from 'app/components/body-measurements/body-measurements.component';
type Direction = 'prev' | 'next';
interface Coach {
  name: string;
  image: string;
  specialty: string;
}

interface WorkoutExercise {
  label: string;
  name: string;
}

interface TasksDayData {
  checkIn: {
    date: string;
    weight: number;
    energy: number;
    sleep: number;
    stress: number;
    notes: string;
    photos: any[];
    responded: boolean;
    coachResponse?: string;
  };
  nutrition: {
    planName: string;
    program: string;
    meals: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  workout: {
    name: string;
    program: string;
    exercises: WorkoutExercise[];
    totalExercises: number;
  };
}

type CheckInQuestion =
  | { id: string; question: string; type: 'number'; unit?: string }
  | { id: string; question: string; type: 'scale'; min: number; max: number }
  | { id: string; question: string; type: 'textarea' }
@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule, BodyMeasurementsComponent],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss'
})
export class ClientDashboardComponent {
  today = new Date()
  currentDate = new Date()
  userId = sessionStorage.getItem('userId') || ''

  showCheckInModal = false
  showWorkoutModal = false
  showNutritionModal = false

  checkInAnswers: Record<string, any> = {}

  coach = {
    name: 'John Smith',
    image:
      'https://uploadthingy.s3.us-west-1.amazonaws.com/ebTntKycKC49WQn1hoxmG4/image.png',
    specialty: 'Strength & Conditioning Coach',
  }

  checkInQuestions: CheckInQuestion[] = [
    { id: 'weight', question: 'What is your current weight?', type: 'number', unit: 'kg' },
    { id: 'energy', question: 'How would you rate your energy level today?', type: 'scale', min: 1, max: 10 },
    { id: 'sleep', question: 'How would you rate your sleep quality?', type: 'scale', min: 1, max: 10 },
    { id: 'stress', question: 'How would you rate your stress level?', type: 'scale', min: 1, max: 10 },
    { id: 'notes', question: 'Any additional notes or comments?', type: 'textarea' },
  ]

  tasksData: Record<string, any> = {
    '2025-01-15': {
      checkIn: {
        date: 'January 15, 2025',
        weight: 207,
        energy: 8,
        sleep: 7,
        stress: 4,
        notes: 'Feeling good today, ready for the workout. Had a great sleep last night.',
        photos: [],
        responded: false,
      },
      nutrition: {
        planName: 'Balanced Diet Plan',
        program: 'Weight Loss Program',
        meals: 4,
        calories: 2000,
        protein: 169,
        carbs: 180,
        fat: 60,
      },
      workout: {
        name: 'At-Home Workout',
        program: 'Full Body Program',
        exercises: [
          { label: '🔥', name: 'Warm up' },
          { label: 'A1', name: 'Single Arm Dumbbell Row' },
          { label: 'A2', name: 'Dumbbell Hex Press' },
          { label: 'A3', name: 'Kettlebell Sumo Wide Stance Roman Deadlift' },
          { label: 'B', name: ':30 work / :30 rest for 30 min' },
          { label: 'C', name: 'Arch Hold' },
        ],
        totalExercises: 6,
      },
    },
    '2025-01-16': {
      checkIn: {
        date: 'January 16, 2025',
        weight: 206.5,
        energy: 9,
        sleep: 8,
        stress: 3,
        notes: 'Great progress! Feeling stronger each day.',
        photos: [],
        responded: true,
        coachResponse: 'Excellent work! Keep up the great progress. Your consistency is paying off.',
      },
      nutrition: {
        planName: 'High Protein Plan',
        program: 'Muscle Gain Program',
        meals: 5,
        calories: 2500,
        protein: 200,
        carbs: 220,
        fat: 70,
      },
      workout: {
        name: 'Upper Body Focus',
        program: 'Strength Program',
        exercises: [
          { label: '🔥', name: 'Dynamic Stretching' },
          { label: 'A1', name: 'Bench Press' },
          { label: 'A2', name: 'Pull Ups' },
          { label: 'B1', name: 'Dumbbell Rows' },
          { label: 'B2', name: 'Shoulder Press' },
        ],
        totalExercises: 5,
      },
    },
  }

  // ✅ getters (évite la logique dans le template)
  get dateKey(): string {
    return this.getDateKey(this.currentDate)
  }

  get currentTasks(): any {
    return this.tasksData[this.dateKey] || this.tasksData['2025-01-15']
  }

  get weekDays(): Date[] {
    const days: Date[] = []
    const startOfWeek = new Date(this.currentDate)
    startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay())
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push(d)
    }
    return days
  }

  // helpers
  isToday(date: Date): boolean {
    return this.isSameDay(date, this.today)
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    )
  }

  formatDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  getDateKey(date: Date): string {
    // YYYY-MM-DD
    return date.toISOString().split('T')[0]
  }

  changeWeek(direction: 'prev' | 'next'): void {
    const newDate = new Date(this.currentDate)
    newDate.setDate(this.currentDate.getDate() + (direction === 'next' ? 7 : -7))
    this.currentDate = newDate
  }

  selectDay(date: Date): void {
    this.currentDate = date
  }

  openCheckIn(): void {
    this.showCheckInModal = true
  }
  openWorkout(): void {
    this.showWorkoutModal = true
  }
  openNutrition(): void {
    this.showNutritionModal = true
  }

  closeModals(): void {
    this.showCheckInModal = false
    this.showWorkoutModal = false
    this.showNutritionModal = false
  }

  answerChange(questionId: string, value: any): void {
    this.checkInAnswers = { ...this.checkInAnswers, [questionId]: value }
  }

  toNumber(v: any): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  submitCheckIn(): void {
    console.log('Submitting check-in:', this.checkInAnswers)
    this.showCheckInModal = false
    this.checkInAnswers = {}
  }

  // trackBy
  trackByDate = (_: number, d: Date) => d.toISOString()
  trackByQuestionId = (_: number, q: any) => q.id
  trackByExercise = (_: number, ex: any) => `${ex.label}-${ex.name}`
}
