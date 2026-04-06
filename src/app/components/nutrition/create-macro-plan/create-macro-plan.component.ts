import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { MealDay, Meal, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';

@Component({
  selector: 'app-create-macro-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-macro-plan.component.html',
  styleUrls: ['./create-macro-plan.component.scss'],
})
export class CreateMacroPlanComponent implements OnInit {
  planName = '';
  planDescription = '';
  showPlanDescription = false;

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'meals';
  showModeModal = false;

  isEditMode = false;
  planId: string | null = null;

  userId = sessionStorage.getItem('userId');

  trackByDay = (_: number, d: MealDay) => d.id;
  trackByMeal = (_: number, m: Meal) => m.id;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService
  ) {}

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');

    if (this.planId) {
      this.isEditMode = true;
      this.loadPlanForEdit(this.planId);
    } else {
      this.addDay();
    }
  }

  /* ===================================================
        LOAD PLAN IN EDIT MODE
  ======================================================*/
  loadPlanForEdit(id: string) {
    this.nutritionService.getNutritionPlanById(id).subscribe((plan) => {
      this.planName = plan.name;
      this.planDescription = plan.details;
      this.days = plan.mealDays || [];

      // Fix IDs if backend returns null
      this.days.forEach((d) => {
        d.id = d.id ?? crypto.randomUUID();
        d.meals.forEach((m) => (m.id = m.id ?? crypto.randomUUID()));
      });

      this.days.forEach((d) => this.updateDayTotals(d));
      this.selectedDay = this.days[0];
    });
  }

  /* ===================================================
      CREATE / EDIT DAY
  ======================================================*/
  addDay() {
    const dayNumber = this.days.length + 1;
    const newDay: MealDay = {
      id: crypto.randomUUID(),
      date: '',
      dayOfWeek: `Day ${dayNumber}`,
      cheatMeal: false,
      refeedDay: false,
      description: '',
      showDescription: false,
      meals: [],
      dayTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
    };

    this.days.push(newDay);
    this.selectedDay = newDay;
    this.addMeal();
  }

  deleteDay(day: MealDay, event: Event) {
    event.stopPropagation();
    if (this.days.length <= 1) return;

    const i = this.days.findIndex((d) => d.id === day.id);
    this.days.splice(i, 1);

    this.days.forEach((d, idx) => (d.dayOfWeek = `Day ${idx + 1}`));
    this.selectedDay = this.days[Math.max(0, i - 1)];
  }

  selectDay(day: MealDay) {
    this.selectedDay = day;
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (!this.selectedDay) return;
    this.selectedDay.showDescription = !this.selectedDay.showDescription;
  }

  duplicateSelectedDay() {
    if (!this.selectedDay) return;

    const dup: MealDay = {
      ...this.selectedDay,
      id: crypto.randomUUID(),
      meals: this.selectedDay.meals.map((m) => ({
        ...m,
        id: crypto.randomUUID(),
      })),
    };

    this.days.push(dup);
    this.days.forEach((d, idx) => (d.dayOfWeek = `Day ${idx + 1}`));
    this.selectedDay = dup;
    this.updateDayTotals(dup);
  }

  /* ===================================================
      MEALS
  ======================================================*/
  addMeal() {
    if (!this.selectedDay) return;

    const meal: Meal = {
      id: crypto.randomUUID(),
      name: `Meal ${this.selectedDay.meals.length + 1}`,
      mealTargets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      foods: [],
    };

    this.selectedDay.meals.push(meal);
    this.updateDayTotals(this.selectedDay);
  }

  removeMeal(meal: Meal) {
    if (!this.selectedDay) return;
    this.selectedDay.meals = this.selectedDay.meals.filter(
      (m) => m.id !== meal.id
    );
    this.updateDayTotals(this.selectedDay);
  }

  renameMeal(meal: Meal, name: string) {
    meal.name = name || meal.name;
  }

  updateMealCalories(meal: Meal) {
    const { proteinG = 0, carbsG = 0, fatG = 0 } = meal.mealTargets;
    meal.mealTargets.calories = proteinG * 4 + carbsG * 4 + fatG * 9;

    if (this.selectedDay) this.updateDayTotals(this.selectedDay);
  }

  updateDayTotals(day: MealDay) {
    const totals = day.meals.reduce(
      (acc, m) => ({
        proteinG: acc.proteinG + (m.mealTargets.proteinG || 0),
        carbsG: acc.carbsG + (m.mealTargets.carbsG || 0),
        fatG: acc.fatG + (m.mealTargets.fatG || 0),
        calories: acc.calories + (m.mealTargets.calories || 0),
      }),
      { proteinG: 0, carbsG: 0, fatG: 0, calories: 0 }
    );

    day.dayTargets = totals;
  }

  /* ===================================================
      SAVE (CREATE OR UPDATE)
  ======================================================*/
  savePlan() {
    this.days.forEach((d) => this.updateDayTotals(d));

    const plan: MealPlan = {
      id: this.planId || undefined,
      name: this.planName,
      details: this.planDescription,
      trackingMode: 'EACH_MEAL',
      startDate: new Date().toISOString(),
      endDate: '',
      mealDays: this.days,
      coach: { id: this.userId },
      client: null,
    };

    if (this.isEditMode) {
      this.nutritionService.updateNutritionPlan(plan).subscribe(() => {
        console.log('Plan updated');
      });
    } else {
      this.nutritionService.createNutritionPlan(plan).subscribe(() => {
        console.log('Plan saved');
        this.resetForm();
      });
    }
  }

  resetForm() {
    this.planName = '';
    this.planDescription = '';
    this.days = [];
    this.selectedDay = null;
    this.addDay();
  }
}
