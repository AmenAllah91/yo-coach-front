import { Component, OnInit } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MealDay, MealPlan } from 'app/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';

@Component({
  selector: 'app-create-macro-plan-total-day',
  standalone: true,
  imports: [
    FeatherModule,
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
  ],
  templateUrl: './create-macro-plan-total-day.component.html',
  styleUrl: './create-macro-plan-total-day.component.scss',
})
export class CreateMacroPlanTotalDayComponent implements OnInit {
  planName = '';
  planDescription = '';
  showPlanDescription = false;

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'total';
  showModeModal = true;

  isEditMode = false;
  userid = sessionStorage.getItem('userId');
  trackByDay = (_: number, d: MealDay) => d.id;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService
  ) {}

  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isEditMode = !!planId;

    if (planId) {
      this.showModeModal = false;
      this.viewMode = 'total';
    } else if (type === 'total' || type === 'each') {
      this.showModeModal = false;
      this.viewMode = type === 'total' ? 'total' : 'meals';
      this.addDay();
    } else {
      this.showModeModal = true;
      this.addDay();
    }
  }

  /* ----------------------------------------------
      CALCUL AUTOMATIQUE DES CALORIES
  ------------------------------------------------*/
  updateCaloriesForDay(day: MealDay) {
    if (!day || !day.dayTargets) return;

    const p = day.dayTargets.proteinG || 0;
    const c = day.dayTargets.carbsG || 0;
    const f = day.dayTargets.fatG || 0;

    day.dayTargets.calories = p * 4 + c * 4 + f * 9;
  }

  /* ----------------------------------------------
      CRÉER UN JOUR
  ------------------------------------------------*/
  addDay() {
    const index = this.days.length + 1;

    const newDay: MealDay = {
      id: crypto.randomUUID(),
      date: '',
      dayOfWeek: '',
      cheatMeal: false,
      refeedDay: false,
      meals: [],
      dayTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
    };

    (newDay as any).name = `Day ${index}`;
    (newDay as any).showDescription = false;

    this.days.push(newDay);
    this.selectedDay = newDay;
  }

  selectDay(day: MealDay) {
    this.selectedDay = day;
  }

  /* ----------------------------------------------
      DUPLIQUER UN JOUR
  ------------------------------------------------*/
  duplicateDay(day: MealDay, event: Event) {
    event.stopPropagation();
    const index = this.days.length + 1;

    const duplicated: MealDay = {
      ...day,
      id: crypto.randomUUID(),
      meals: JSON.parse(JSON.stringify(day.meals)),
      dayTargets: { ...day.dayTargets },
      date: '',
    };

    (duplicated as any).name = `Day ${index}`;
    (duplicated as any).showDescription = false;

    this.updateCaloriesForDay(duplicated);

    this.days.push(duplicated);
    this.selectedDay = duplicated;
  }

  duplicateSelectedDay() {
    if (!this.selectedDay) return;
    this.duplicateDay(this.selectedDay, new Event('click'));
  }

  /* ----------------------------------------------
      SUPPRIMER UN JOUR
  ------------------------------------------------*/
  deleteDay(day: MealDay, event: Event) {
    event.stopPropagation();

    if (this.days.length > 1) {
      const index = this.days.findIndex((d) => d.id === day.id);
      this.days.splice(index, 1);

      this.days.forEach((d, i) => ((d as any).name = `Day ${i + 1}`));

      if (this.selectedDay?.id === day.id) {
        this.selectedDay = this.days[Math.max(0, index - 1)];
      }
    }
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.selectedDay) {
      (this.selectedDay as any).showDescription =
        !(this.selectedDay as any).showDescription;
    }
  }

  /* ----------------------------------------------
      SAVE PLAN
  ------------------------------------------------*/
  savePlan() {
    const mealPlan: MealPlan = {
      name: this.planName,
      details: this.planDescription,
      mealDays: this.days,
      trackingMode: 'TOTAL_FOR_DAY',
      startDate: '',
      endDate: '',
      coach: { id: this.userid },
      client: undefined,
    };

    this.nutritionService.createNutritionPlan(mealPlan).subscribe(() => {
      this.resetForm();
    });
  }

  /* ----------------------------------------------
      TOTALS DU JOUR SÉLECTIONNÉ
  ------------------------------------------------*/
  get selectedProtein() {
    return this.selectedDay?.dayTargets?.proteinG || 0;
  }

  get selectedCarbs() {
    return this.selectedDay?.dayTargets?.carbsG || 0;
  }

  get selectedFat() {
    return this.selectedDay?.dayTargets?.fatG || 0;
  }

  get selectedCalories() {
    return this.selectedDay?.dayTargets?.calories || 0;
  }

  /* ----------------------------------------------
      RESET FORM
  ------------------------------------------------*/
  resetForm() {
    this.planName = '';
    this.planDescription = '';
    this.showPlanDescription = false;

    this.days = [];
    this.selectedDay = null;

    this.addDay();
  }
}
