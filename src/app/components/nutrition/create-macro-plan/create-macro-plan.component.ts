import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { MealDay, Meal, MealPlan } from 'app/models/MealPlan';
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

  userId = sessionStorage.getItem('userId'); // ✔ ajout userID

  trackByDay = (_: number, d: MealDay) => d.id;
  trackByMeal = (_: number, m: Meal) => m.id;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService
  ) {}

  ngOnInit() {
    this.addDay();
  }

  /* ===================================================
      CREATE DAY — AVEC Day 1, Day 2, Day 3 ...
  ======================================================*/
  addDay() {
    const dayNumber = this.days.length + 1;

    const newDay: MealDay = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      date: '',
      dayOfWeek: `Day ${dayNumber}`, // ✔ Day 1, Day 2...
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

    // Ajout d’un meal par défaut
    this.addMeal();
  }

  /* ===================================================
       DELETE DAY + RENUMÉRATION Day 1, Day 2...
  ======================================================*/
  deleteDay(day: MealDay, event: Event) {
    event.stopPropagation();
    if (this.days.length <= 1) return;

    const i = this.days.findIndex((d) => d.id === day.id);
    this.days.splice(i, 1);

    // ✔ Renommer les days
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

  /* ===================================================
      DUPLICATE DAY
  ======================================================*/
  duplicateSelectedDay() {
    if (!this.selectedDay) return;

    const dup: MealDay = {
      ...this.selectedDay,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      meals: this.selectedDay.meals.map((m) => ({
        ...m,
        id: crypto.randomUUID?.() ?? String(Date.now()),
      })),
    };

    this.days.push(dup);

    // ✔ Renommer
    this.days.forEach((d, idx) => (d.dayOfWeek = `Day ${idx + 1}`));

    this.selectedDay = dup;

    // Recalcule automatique
    this.updateDayTotals(dup);
  }

  /* ===================================================
      ADD MEAL
  ======================================================*/
  addMeal() {
    if (!this.selectedDay) return;

    const meal: Meal = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: `Meal ${this.selectedDay.meals.length + 1}`,
      mealTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      foods: [],
    };

    this.selectedDay.meals.push(meal);
  }

  removeMeal(meal: Meal) {
    if (!this.selectedDay) return;
    this.selectedDay.meals = this.selectedDay.meals.filter((m) => m.id !== meal.id);
    this.updateDayTotals(this.selectedDay);
  }

  renameMeal(meal: Meal, name: string) {
    meal.name = name || meal.name;
  }

  /* ===================================================
      AUTO CALCUL — CALORIES MEAL = p4 + c4 + f9
  ======================================================*/
  updateMealCalories(meal: Meal) {
    const p = meal.mealTargets.proteinG || 0;
    const c = meal.mealTargets.carbsG || 0;
    const f = meal.mealTargets.fatG || 0;

    meal.mealTargets.calories = p * 4 + c * 4 + f * 9;

    if (this.selectedDay) this.updateDayTotals(this.selectedDay);
  }

  /* ===================================================
      AUTO CALCUL — TOTAL DAY (somme des meals)
  ======================================================*/
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
       SAVE PLAN — AVEC COACH ID
  ======================================================*/
  savePlan() {
    const plan: MealPlan = {
      name: this.planName,
      details: this.planDescription,
      trackingMode: 'EACH_MEAL',
      startDate: new Date().toISOString(),
      endDate: '',
      mealDays: this.days,
      coach: { id: this.userId }, // ✔ ajout du coach
      client: null,
    };

    this.nutritionService.createNutritionPlan(plan).subscribe(() => {
      console.log('Plan saved');
      this.resetForm();
    });
  }

  resetForm() {
    this.planName = '';
    this.planDescription = '';
    this.days = [];
    this.selectedDay = null;

    this.addDay();
  }
}
