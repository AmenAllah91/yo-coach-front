import { MealplanDayService } from './../../../service/mealplan-day.service';
import { NutritionService } from 'app/service/nutrition.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';

type PlanStatus = 'COMPLETED' | 'MISSED' | 'PENDING';

interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface Meal {
  id: string;
  name: string;
  foods: Food[];
  mealTargets?: {
    // ← Ajouté
    proteinG: number;
    carbsG: number;
    fatG: number;
    calories: number;
  };
}

interface NutritionDay {
  id: string;
  date: string;
  displayDate: string;
  planId: string;
  programName: string;
  programType: string;
  status: PlanStatus;
  mealCount: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
  meals: Meal[];
  dayTargets?: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    calories: number;
  };
}

@Component({
  selector: 'app-client-nutrition',
  standalone: true,
  imports: [CommonModule, ModalConfirmComponent],
  templateUrl: './client-nutrition.component.html',
  styleUrl: './client-nutrition.component.scss',
})
export class ClientNutritionComponent implements OnInit {
  userid = sessionStorage.getItem('userId');
  nutritionDays: NutritionDay[] = [];
  currentDate: Date = new Date();
  activeTab: 'upcoming' | 'past' = 'upcoming';
  selectedDay: NutritionDay | null = null;

  showConfirmModal = false;
  pendingStatus: PlanStatus | null = null;

  userName = 'Kolton';

  coaches: any[] = [];

  selectedCoachId: string | 'all' = 'all';

  constructor(
    private nutritionService: NutritionService,
    private mealplanDayService: MealplanDayService
  ) {}

  ngOnInit(): void {
    this.getMealPlan();
  }

  getMealPlan() {
    this.nutritionService
      .getNutritionPlanByClientId(this.userid)
      .subscribe((plans: any[]) => {
        // Extraire les coachs uniques
        const coachMap = new Map<string, any>();
        plans.forEach((plan) => {
          if (plan.coach && plan.coach.id) {
            const fullName = `${plan.coach.firstName || 'Coach'} ${
              plan.coach.lastName || ''
            }`.trim();
            coachMap.set(plan.coach.id, {
              id: plan.coach.id,
              firstName: plan.coach.firstName || 'Coach',
              lastName: plan.coach.lastName || '',
              fullName: fullName || 'Unknown Coach',
            });
          }
        });

        this.coaches = Array.from(coachMap.values());

        // Pré-sélection du coach
        if (this.coaches.length === 1) {
          this.selectedCoachId = this.coaches[0].id;
        } else {
          this.selectedCoachId = 'all';
        }

        // Appliquer le filtre initial
        this.applyCoachFilter(plans);
      });
  }

  private applyCoachFilter(plans?: any[]) {
    // Si plans non fourni, on recharge depuis le service
    if (!plans) {
      this.nutritionService
        .getNutritionPlanByClientId(this.userid)
        .subscribe((freshPlans: any[]) => {
          this.processPlansWithFilter(freshPlans);
        });
    } else {
      this.processPlansWithFilter(plans);
    }
  }

  private processPlansWithFilter(plans: any[]) {
    let filteredPlans = plans;

    if (this.selectedCoachId !== 'all') {
      filteredPlans = plans.filter(
        (plan) => plan.coach && plan.coach.id === this.selectedCoachId
      );
    }

    this.nutritionDays = this.mapApiResponseToNutritionDays(filteredPlans);
    this.setInitialMonth();
    this.selectedDay = null; // Retour à la liste
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.applyCoachFilter();
  }

  private setInitialMonth(): void {
    if (this.nutritionDays.length === 0) return;
    const firstDate = this.nutritionDays
      .map((d) => new Date(d.date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    this.currentDate = new Date(
      firstDate.getFullYear(),
      firstDate.getMonth(),
      1
    );
  }

  private mapApiResponseToNutritionDays(plans: any[]): NutritionDay[] {
    const days: NutritionDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    plans.forEach((plan) => {
      const planStart = new Date(plan.startDate);

      plan.mealDays.forEach((mealDay: any) => {
        // Correction : dayNumber probablement présent comme dans workout
        const dayOffset = mealDay.dayNumber ? mealDay.dayNumber - 1 : 0;
        const mealDate = new Date(planStart);
        mealDate.setDate(planStart.getDate() + dayOffset);

        const totals = mealDay.dayTargets || {};

        const dateStr = mealDate.toISOString().split('T')[0];
        const status: PlanStatus =
          mealDate < today
            ? 'PENDING'
            : mealDate > today
            ? 'PENDING'
            : 'PENDING';
        // Tu peux garder un statut persistant si l'API le renvoie : mealDay.status ?? calculé

        days.push({
          id: mealDay.id,
          date: dateStr,
          displayDate: this.getDisplayDate(dateStr),
          planId: plan.id,
          programName: plan.name,
          programType: 'Nutrition Program',
          status: mealDay.status ?? this.calculateStatus(dateStr),
          mealCount: mealDay.meals?.length || 0,
          totalProtein: totals.proteinG || 0,
          totalCarbs: totals.carbsG || 0,
          totalFat: totals.fatG || 0,
          totalCalories: totals.calories || 0,
          dayTargets: totals,
          meals: this.mapMeals(mealDay.meals || []),
        });
      });
    });

    return days;
  }

  private calculateStatus(dateStr: string): PlanStatus {
    const dayDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate < today) return 'MISSED'; // par défaut si passé
    return 'PENDING';
  }

  private getDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  private mapMeals(meals: any[]): Meal[] {
    return meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      foods: (meal.foods || []).map((food: any) => ({
        id: food.id,
        name: food.name,
        quantity: food.quantity || '',
        protein: food.proteinG || 0,
        carbs: food.carbsG || 0,
        fat: food.fatG || 0,
        calories: food.calories || 0,
      })),
      mealTargets: meal.mealTargets || {
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        calories: 0,
      },
    }));
  }

  get filteredDays(): NutritionDay[] {
    return this.nutritionDays
      .filter((day) => this.isSameMonthAndYear(day.date, this.currentDate))
      .filter((day) => {
        if (this.activeTab === 'upcoming') {
          return day.status === 'PENDING';
        }
        return day.status === 'COMPLETED' || day.status === 'MISSED';
      });
  }

  private isSameMonthAndYear(dateStr: string, reference: Date): boolean {
    const date = new Date(dateStr);
    return (
      date.getMonth() === reference.getMonth() &&
      date.getFullYear() === reference.getFullYear()
    );
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get emptyStateMessage(): string {
    const month = this.formatMonthYear(this.currentDate);
    return this.activeTab === 'upcoming'
      ? `No upcoming nutrition plans for ${month}`
      : `No past nutrition plans for ${month}`;
  }

  handlePrevMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1
    );
  }

  handleNextMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1
    );
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
    this.selectedDay = null;
  }

  selectDay(day: NutritionDay): void {
    this.selectedDay = { ...day };
  }

  backToList(): void {
    this.selectedDay = null;
  }

  calculateMealTotals(meal: Meal) {
    return meal.foods.reduce(
      (acc, food) => ({
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
        calories: acc.calories + food.calories,
      }),
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  openConfirmModal(status: PlanStatus): void {
    this.pendingStatus = status;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingStatus = null;
  }

  confirmStatusUpdate(): void {
    if (this.selectedDay && this.pendingStatus) {
      this.updatePlanStatus(this.selectedDay, this.pendingStatus);
    }
    this.closeConfirmModal();
  }

  updatePlanStatus(day: NutritionDay, status: PlanStatus): void {
    // Mise à jour immédiate UI
    day.status = status;

    // Mise à jour dans le tableau global
    this.nutritionDays = this.nutritionDays.map((d) =>
      d.id === day.id ? { ...d, status } : d
    );

    // Appel API
    this.mealplanDayService
      .updatePlanDay({ id: day.id, status }, day.planId)
      .subscribe({
        next: () => {},
        error: () => {
          // Revert en cas d'erreur
          day.status = 'PENDING';
          this.nutritionDays = [...this.nutritionDays];
        },
      });
  }
}
