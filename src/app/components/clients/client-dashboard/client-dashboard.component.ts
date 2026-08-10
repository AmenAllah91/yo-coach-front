import { Component, OnInit } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import { BodyMeasurementsComponent } from 'app/components/body-measurements/body-measurements.component';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  | { id: string; questionKey: string; type: 'number'; unit?: string }
  | { id: string; questionKey: string; type: 'scale'; min: number; max: number }
  | { id: string; questionKey: string; type: 'textarea' }
@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule, BodyMeasurementsComponent, TranslateModule],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss'
})
export class ClientDashboardComponent implements OnInit {
  constructor(
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService
  ) {}
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
    { id: 'weight', questionKey: 'CURRENT_WEIGHT_QUESTION', type: 'number', unit: this.coachSettingsService.getWeightUnit() },
    { id: 'energy', questionKey: 'ENERGY_LEVEL_QUESTION', type: 'scale', min: 1, max: 10 },
    { id: 'sleep', questionKey: 'SLEEP_QUALITY_QUESTION', type: 'scale', min: 1, max: 10 },
    { id: 'stress', questionKey: 'STRESS_LEVEL_QUESTION', type: 'scale', min: 1, max: 10 },
    { id: 'notes', questionKey: 'ADDITIONAL_NOTES_QUESTION', type: 'textarea' },
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


  loadingTodayData = false
  todayWorkout: any = null
  todayNutrition: any = null
  workoutDates: string[] = []

  ngOnInit(): void {
    this.loadTodayData()
  }

  loadTodayData(): void {
    if (!this.userId) return

    this.loadingTodayData = true
    this.workoutService.getWorkoutPlansByClient(this.userId).subscribe({
      next: (plans: any[]) => {
        this.todayWorkout = this.findWorkoutForDate(plans || [], this.currentDate)
        this.workoutDates = this.extractWorkoutDates(plans || [])
        this.loadingTodayData = false
      },
      error: () => {
        this.todayWorkout = null
        this.workoutDates = []
        this.loadingTodayData = false
      },
    })

    this.nutritionService.getNutritionPlanByClientId(this.userId).subscribe({
      next: (plans: any[]) => {
        this.todayNutrition = this.findNutritionForDate(plans || [], this.currentDate)
      },
      error: () => {
        this.todayNutrition = null
      },
    })
  }

  // ✅ getters (évite la logique dans le template)
  get dateKey(): string {
    return this.getDateKey(this.currentDate)
  }

  get currentTasks(): any {
    return {
      checkIn: this.tasksData[this.dateKey]?.checkIn || this.tasksData['2025-01-15'].checkIn,
      workout: this.toWorkoutTask(this.todayWorkout),
      nutrition: this.toNutritionTask(this.todayNutrition),
    }
  }

  get hasWorkoutToday(): boolean {
    return !!this.todayWorkout
  }

  get hasNutritionToday(): boolean {
    return !!this.todayNutrition
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
    return date.toLocaleDateString(this.dateLocale, { weekday: 'short' })
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString(this.dateLocale, { month: 'long', year: 'numeric' })
  }

  private get dateLocale(): string {
    return this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US'
  }

  get coachName(): string {
    const coach = this.todayWorkout?.plan?.coach || this.todayNutrition?.plan?.coach
    return `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim() || this.translate.instant('YOUR_COACH')
  }

  get coachImage(): string {
    const coach = this.todayWorkout?.plan?.coach || this.todayNutrition?.plan?.coach
    return coach?.profilePicture || coach?.image || 'assets/images/avatar-placeholder.png'
  }

  get coachSpecialty(): string {
    const coach = this.todayWorkout?.plan?.coach || this.todayNutrition?.plan?.coach
    return coach?.specialty || this.translate.instant('FITNESS_COACH')
  }

  getDateKey(date: Date): string {
    // local YYYY-MM-DD, same day as mobile calendar
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  changeWeek(direction: 'prev' | 'next'): void {
    const newDate = new Date(this.currentDate)
    newDate.setDate(this.currentDate.getDate() + (direction === 'next' ? 7 : -7))
    this.currentDate = newDate
    this.loadTodayData()
  }

  selectDay(date: Date): void {
    this.currentDate = date
    this.loadTodayData()
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


  private normalizeDate(date: any): Date | null {
    if (!date) return null
    const d = new Date(date)
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  private findWorkoutForDate(plans: any[], targetDate: Date): any | null {
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()

    for (const plan of plans) {
      const days = plan?.workoutDays || []
      for (const day of days) {
        const dayDate = this.normalizeDate(day?.date) || this.scheduledDateFromPlan(plan, day)
        if (dayDate && dayDate.getTime() === target) {
          return { plan, day }
        }
      }
    }

    return null
  }

  private findNutritionForDate(plans: any[], targetDate: Date): any | null {
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()

    for (const plan of plans) {
      const days = plan?.mealDays || []
      for (const day of days) {
        const dayDate = this.normalizeDate(day?.date) || this.scheduledDateFromPlan(plan, day)
        if (dayDate && dayDate.getTime() === target) {
          return { plan, day }
        }
      }
    }

    return null
  }


  private scheduledDateFromPlan(plan: any, day: any): Date | null {
    const start = this.normalizeDate(plan?.startDate)
    const dayNumber = Number(day?.dayNumber)
    if (!start || !Number.isFinite(dayNumber) || dayNumber <= 0) return null
    const d = new Date(start)
    d.setDate(start.getDate() + dayNumber - 1)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  private extractWorkoutDates(plans: any[]): string[] {
    const dates = new Set<string>()
    for (const plan of plans) {
      for (const day of plan?.workoutDays || []) {
        const d = this.normalizeDate(day?.date) || this.scheduledDateFromPlan(plan, day)
        if (d) dates.add(this.getDateKey(d))
      }
    }
    return Array.from(dates)
  }

  hasWorkoutOn(date: Date): boolean {
    return this.workoutDates.includes(this.getDateKey(date))
  }

  private toWorkoutTask(item: any): any {
    if (!item) {
      return {
        name: this.translate.instant('NO_WORKOUT_PLANNED_DAY'),
        program: this.translate.instant('NO_SESSION_SCHEDULED'),
        exercises: [],
        totalExercises: 0,
      }
    }

    const plan = item.plan || {}
    const day = item.day || {}
    const sessions = day.workoutSessions || []
    const exercises = sessions.flatMap((session: any) => session?.exercises || [])

    return {
      name: day.title || day.name || plan.name || this.translate.instant('WORKOUT'),
      program: plan.name || this.translate.instant('WORKOUT_PROGRAM'),
      exercises: exercises.map((ex: any, index: number) => ({
        label: ex?.type === 'CARDIO' ? '🔥' : String(index + 1),
        name: ex?.name || ex?.exerciseName || this.translate.instant('EXERCISE'),
      })),
      totalExercises: exercises.length,
    }
  }

  private toNutritionTask(item: any): any {
    if (!item) {
      return {
        planName: this.translate.instant('NO_NUTRITION_PLAN'),
        program: this.translate.instant('NO_ACTIVE_NUTRITION_DAY'),
        meals: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    }

    const plan = item.plan || {}
    const day = item.day || {}
    const targets = day.dayTargets || {}
    const meals = day.meals || []
    const sum = (field: string) => meals.reduce((total: number, meal: any) => total + Number(meal?.[field] || 0), 0)

    return {
      planName: day.name || plan.name || this.translate.instant('NUTRITION_PLAN'),
      program: plan.name || this.translate.instant('DAILY_NUTRITION_GOAL'),
      meals: meals.length,
      calories: day.totalCalories || sum('calories') || targets.calories || 0,
      protein: day.totalProtein || sum('protein') || targets.proteinG || 0,
      carbs: day.totalCarbs || sum('carbs') || targets.carbsG || 0,
      fat: day.totalFat || sum('fat') || targets.fatG || 0,
    }
  }

  // trackBy
  trackByDate = (_: number, d: Date) => d.toISOString()
  trackByQuestionId = (_: number, q: any) => q.id
  trackByExercise = (_: number, ex: any) => `${ex.label}-${ex.name}`
}
