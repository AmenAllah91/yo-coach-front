import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NutritionService } from 'app/service/nutrition.service';
import { Food, FoodRef, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { Client, ClientService } from 'app/service/client.service';

@Component({
  selector: 'app-assign-full-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './assign-full-plan.component.html',
  styleUrl: './assign-full-plan.component.scss',
})
export class AssignFullPlanComponent implements OnInit {
  userId = sessionStorage.getItem('userId');
  client: Client;
  startDate = new Date().toISOString().split('T')[0];
  endDate: string = '';
  mealPlan: MealPlan = {
    id: undefined,
    name: '',
    details: '',
    startDate: '',
    endDate: '',
    date: null,
    trackingMode: null,
    mealDays: [],
    coach: null,
    client: null,
  };

  planName = '';
  planDescription = '';

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showPlanDescription = false;

  trackByDay = (_: number, d: MealDay) => d.id;
  trackByMeal = (_: number, m: Meal) => m.id;
  planId: string | null = null;
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private clientService: ClientService
  ) {}

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    const clientId = this.route.snapshot.paramMap.get('idClient');
    if (this.planId) {
      this.loadPlanForEdit(this.planId);
    } else {
      this.addDay();
    }

    if (clientId) {
      this.getClientById(clientId);
    }
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  updateAllDates() {
    if (!this.startDate) return;

    const start = new Date(this.startDate);

    this.days.forEach((day, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);

      day.date = current.toISOString().split('T')[0];
      day.dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
      day.title = `Day ${index + 1}`;
    });

    // Calcule la date de fin
    const end = new Date(start);
    end.setDate(start.getDate() + (this.days.length - 1));
    this.endDate = end.toISOString().split('T')[0];
  }

  loadPlanForEdit(id: string) {
    this.nutritionService
      .getNutritionPlanById(id)
      .subscribe((plan: MealPlan) => {
        this.mealPlan = plan;
        this.planName = plan.name;
        this.planDescription = plan.details;
        this.days = plan.mealDays || [];
        this.selectedDay = this.days[0];

        // recalcul si les macros ne sont pas pré-calculées
        this.days.forEach((d) => this.recalcDayTargets(d));
        this.startDate = new Date(plan.startDate).toISOString().split('T')[0];
        this.updateAllDates();
      });
  }

  removeFood(food: Food, meal: Meal) {
    meal.foods = meal.foods.filter((f) => f.id !== food.id);

    this.recalcMealTargets(meal);

    if (this.selectedDay) {
      this.recalcDayTargets(this.selectedDay);
    }
  }

  /* ============================================
            DAY HANDLING
  ==============================================*/

  getDayLabel(day: MealDay, index: number) {
    return `Day ${index + 1}`;
  }

  getSelectedDayLabel() {
    if (!this.selectedDay) return 'Day 1';
    return this.getDayLabel(
      this.selectedDay,
      this.days.indexOf(this.selectedDay)
    );
  }

  private makeEmptyMeal(): Meal {
    return {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      name: 'New Meal',
      mealTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      foods: [],
    };
  }

  private makeEmptyDay(): MealDay {
    return {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      date: '',
      dayOfWeek: '',
      cheatMeal: false,
      refeedDay: false,
      description: '',
      title: '',
      showDescription: false,
      dayTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      meals: [this.makeEmptyMeal()],
    };
  }

  addDay() {
    const newDay = this.makeEmptyDay();
    this.days.push(newDay);
    this.selectedDay = newDay;
    this.mealPlan.mealDays = this.days;

    this.updateAllDates();
  }

  selectDay(day: MealDay) {
    this.selectedDay = day;
  }

  deleteDay(day: MealDay, e: Event) {
    e.stopPropagation();
    if (this.days.length <= 1) return;

    const index = this.days.indexOf(day);
    this.days.splice(index, 1);
    this.selectedDay = this.days[Math.max(0, index - 1)];
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.updateAllDates();
  }

  onDropMeal(event: CdkDragDrop<Meal[]>) {
    if (!this.selectedDay) return;
    moveItemInArray(this.selectedDay.meals, event.previousIndex, event.currentIndex);
    this.recalcDayTargets(this.selectedDay);
  }

  duplicateSelectedDay() {
    if (!this.selectedDay) return;

    const clone: MealDay = {
      ...this.selectedDay,
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      meals: this.selectedDay.meals.map((m) => ({
        ...m,
        id: crypto.randomUUID?.() ?? Date.now().toString(),
        foods: m.foods.map((f) => ({
          ...f,
          id: crypto.randomUUID?.() ?? Date.now().toString(),
        })),
      })),
    };

    this.days.push(clone);
    this.selectedDay = clone;
    this.recalcDayTargets(clone);
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (!this.selectedDay) return;
    this.selectedDay.showDescription = !this.selectedDay.showDescription;
  }

  /* ============================================
                MEALS
  ==============================================*/

  addMeal() {
    if (!this.selectedDay) return;

    this.selectedDay.meals.push(this.makeEmptyMeal());
    this.recalcDayTargets(this.selectedDay);
  }

  removeMeal(meal: Meal) {
    if (!this.selectedDay) return;
    this.selectedDay.meals = this.selectedDay.meals.filter(
      (m) => m.id !== meal.id
    );
    this.recalcDayTargets(this.selectedDay);
  }

  renameMeal(meal: Meal, newName: string) {
    meal.name = newName.trim() || meal.name;
  }

  /* ============================================
                FOOD MODAL
  ==============================================*/

  isFoodModalOpen = false;
  mealForModal: Meal | null = null;

  filteredFoods: FoodRef[] = [];
  foodSearch = '';

  foodStep: 'list' | 'detail' = 'list';
  selectedFood: FoodRef | null = null;

  foodQty = 100;
  adj = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };

  openFoodModal(meal: Meal) {
    this.mealForModal = meal;
    this.foodStep = 'list';
    this.isFoodModalOpen = true;
    this.filterFoods();
  }

  closeFoodModal() {
    this.isFoodModalOpen = false;
    this.mealForModal = null;
    this.selectedFood = null;
  }

  filterFoods() {
    this.nutritionService
      .filteredFoods(0, 3, this.foodSearch || '')
      .subscribe((res) => {
        this.filteredFoods = res.content;
      });
  }

  showFoodDetail(food: FoodRef) {
    this.selectedFood = food;
    this.foodStep = 'detail';
    this.foodQty = 100;
    this.recomputeAdjusted();
  }

  backToList() {
    this.foodStep = 'list';
    this.selectedFood = null;
  }

  recomputeAdjusted() {
    if (!this.selectedFood) return;
    const factor = this.foodQty / 100;

    const p = this.selectedFood.protein * factor;
    const c = this.selectedFood.carbohydrates * factor;
    const f = this.selectedFood.fat * factor;

    this.adj = {
      protein: p,
      carbohydrates: c,
      fat: f,
      calories: p * 4 + c * 4 + f * 9,
    };
  }

  addFoodToMeal() {
    if (!this.mealForModal || !this.selectedFood) return;

    const food: Food = {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      name: this.selectedFood.name,
      quantity: this.foodQty,
      unit: 'g',
      foodRef: this.selectedFood,
    };

    this.mealForModal.foods.push(food);
    this.recalcMealTargets(this.mealForModal);

    if (this.selectedDay) {
      this.recalcDayTargets(this.selectedDay);
    }

    this.closeFoodModal();
  }

  /* ============================================
                MACRO CALCULATIONS
  ==============================================*/

  computeFoodMacros(food: Food) {
    const factor = food.quantity / 100;

    const p = food.foodRef.protein * factor;
    const c = food.foodRef.carbohydrates * factor;
    const f = food.foodRef.fat * factor;

    return {
      calories: p * 4 + c * 4 + f * 9,
      protein: p,
      carbs: c,
      fat: f,
    };
  }

  computeMealMacros(meal: Meal) {
    return meal.foods.reduce(
      (acc, food) => {
        const m = this.computeFoodMacros(food);
        return {
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  recalcMealTargets(meal: Meal) {
    const m = this.computeMealMacros(meal);
    meal.mealTargets = {
      calories: Math.round(m.calories),
      proteinG: +m.protein.toFixed(1),
      carbsG: +m.carbs.toFixed(1),
      fatG: +m.fat.toFixed(1),
    };
  }

  recalcDayTargets(day: MealDay) {
    const totals = day.meals.reduce(
      (acc, meal) => {
        const m = this.computeMealMacros(meal);
        return {
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    day.dayTargets = {
      calories: Math.round(totals.calories),
      proteinG: +totals.protein.toFixed(1),
      carbsG: +totals.carbs.toFixed(1),
      fatG: +totals.fat.toFixed(1),
    };
  }

  /* ============================================
                GETTERS
  ==============================================*/

  getMealCalories(m: Meal) {
    return m.mealTargets.calories;
  }

  getMealProtein(m: Meal) {
    return m.mealTargets.proteinG;
  }

  getMealCarbs(m: Meal) {
    return m.mealTargets.carbsG;
  }

  getMealFat(m: Meal) {
    return m.mealTargets.fatG;
  }

  getFoodCalories(food: Food) {
    return Math.round(this.computeFoodMacros(food).calories);
  }

  getFoodProtein(food: Food) {
    return +this.computeFoodMacros(food).protein.toFixed(1);
  }

  getFoodCarbs(food: Food) {
    return +this.computeFoodMacros(food).carbs.toFixed(1);
  }

  getFoodFat(food: Food) {
    return +this.computeFoodMacros(food).fat.toFixed(1);
  }

  savePlan() {
    this.mealPlan.name = this.planName;
    this.mealPlan.details = this.planDescription;
    this.mealPlan.mealDays = this.days;
    this.mealPlan.coach = { id: this.userId };
    this.mealPlan.startDate = this.startDate;
    this.mealPlan.endDate = this.endDate;
    this.mealPlan.client = this.client;

    if (this.planId) {
      this.mealPlan.id = this.planId;

      this.nutritionService.updateNutritionPlan(this.mealPlan).subscribe(() => {
        this.router.navigate(['/nutrition/plans']);
      });
    } else {
      this.nutritionService.createNutritionPlan(this.mealPlan).subscribe(() => {
        this.router.navigate(['/nutrition/plans']);
      });
    }
  }
}
