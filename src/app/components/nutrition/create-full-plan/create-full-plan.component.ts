import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { MealsService } from 'app/service/meals.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Food, FoodRef, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { MealTemplatePickerComponent, MealTemplateSelection } from '../meal-template-picker/meal-template-picker.component';

@Component({
  selector: 'app-create-full-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule, MealTemplatePickerComponent],
  templateUrl: './create-full-plan.component.html',
  styleUrls: ['./create-full-plan.component.scss'],
})
export class CreateFullPlanComponent implements OnInit {
  userId = sessionStorage.getItem('userId');

  mealPlan: MealPlan = {
    id: undefined,
    name: '',
    details: '',
    startDate: '',
    endDate: '',
    trackingMode: null,
    mealDays: [],
    coach: null,
    client: null,
  };

  planName = '';
  planDescription = '';
  isMealPlanTemplate = false;

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showPlanDescription = false;
  durationWeeks = 4;
  private scheduleStartDate = '';
  private scheduleEndDate = '';
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  collapsedWeeks = new Set<number>();

  trackByDay = (_: number, d: MealDay) => d.id;
  trackByMeal = (_: number, m: Meal) => m.id;
  planId: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService,
    private mealsService: MealsService
  ) {}


  get canCreateTemplate(): boolean {
    const roles = this.getCurrentRoles();

    console.log('[ADMIN CHECK CURRENT ROLES]', roles);

    return roles.some((role) =>
      role === 'ROLE_ADMIN' ||
      role === 'ADMIN' ||
      role === 'ROLE_SUPER_ADMIN' ||
      role === 'SUPER_ADMIN'
    );
  }

  private getCurrentRoles(): string[] {
    const roles = new Set<string>();

    const cleanRole = (value: any): string => {
      return String(value)
        .replace(/\\/g, '')
        .replace(/"/g, '')
        .replace(/'/g, '')
        .trim()
        .toUpperCase();
    };

    const addRole = (value: any) => {
      if (!value) return;

      if (Array.isArray(value)) {
        value.forEach(addRole);
        return;
      }

      if (typeof value === 'object') {
        ['authority', 'name', 'role', 'value'].forEach((key) => {
          if (value[key]) addRole(value[key]);
        });
        return;
      }

      String(value)
        .replace('[', '')
        .replace(']', '')
        .replace(/"/g, '')
        .replace(/'/g, '')
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map(cleanRole)
        .filter(Boolean)
        .forEach((role) => roles.add(role));
    };

    const currentToken =
      sessionStorage.getItem('access_token') ||
      sessionStorage.getItem('accessToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('id_token') ||
      sessionStorage.getItem('idToken');

    const payload = this.decodeJwtPayload(currentToken);

    if (payload) {
      addRole(payload.authorities);
      addRole(payload.roles);
      addRole(payload.scope);
      addRole(payload.scp);
      addRole(payload.auth);
      addRole(payload.realm_access?.roles);

      const resourceAccess = payload.resource_access;
      if (resourceAccess && typeof resourceAccess === 'object') {
        Object.values(resourceAccess).forEach((entry: any) =>
          addRole(entry?.roles)
        );
      }
    }

    if (roles.size === 0) {
      try {
        addRole(JSON.parse(sessionStorage.getItem('roles') || '[]'));
      } catch {
        addRole(sessionStorage.getItem('roles'));
      }

      try {
        addRole(JSON.parse(sessionStorage.getItem('authorities') || '[]'));
      } catch {
        addRole(sessionStorage.getItem('authorities'));
      }
    }

    return Array.from(roles);
  }

  private decodeJwtPayload(token: string | null): any {
    if (!token || !token.includes('.')) return null;

    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );

      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    this.durationWeeks = this.normalizeDurationWeeks(
      Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || this.durationWeeks
    );
    this.planName = this.route.snapshot.queryParamMap.get('name') || '';
    this.scheduleStartDate = this.route.snapshot.queryParamMap.get('startDate') || '';
    this.scheduleEndDate = this.route.snapshot.queryParamMap.get('endDate') || '';

    if (this.planId) {
      this.loadPlanForEdit(this.planId);
    } else {
      this.createInitialDays();
    }
  }

  private normalizeDurationWeeks(value: number): number {
    return Math.max(1, Math.min(Number(value) || 4, 52));
  }

  private createInitialDays(): void {
    const totalDays = this.durationWeeks * 7;
    for (let index = 0; index < totalDays; index++) {
      this.addDay();
    }
    this.selectedDay = this.days[0] || null;
  }

  get nutritionWeeks(): Array<{ weekNumber: number; days: Array<{ day: MealDay; index: number }> }> {
    const weeks: Array<{ weekNumber: number; days: Array<{ day: MealDay; index: number }> }> = [];

    this.days.forEach((day, index) => {
      const weekIndex = Math.floor(index / 7);
      if (!weeks[weekIndex]) {
        weeks[weekIndex] = { weekNumber: weekIndex + 1, days: [] };
      }

      weeks[weekIndex].days.push({ day, index });
    });

    return weeks;
  }

  isWeekCollapsed(weekNumber: number): boolean {
    return this.collapsedWeeks.has(weekNumber);
  }

  toggleWeek(weekNumber: number): void {
    if (this.collapsedWeeks.has(weekNumber)) {
      this.collapsedWeeks.delete(weekNumber);
    } else {
      this.collapsedWeeks.add(weekNumber);
    }
  }

  loadPlanForEdit(id: string) {
    this.nutritionService
      .getNutritionPlanById(id)
      .subscribe((plan: MealPlan) => {
        this.mealPlan = plan;
        this.planName = plan.name;
        this.planDescription = plan.details || '';
        this.isMealPlanTemplate = this.canCreateTemplate
          ? Boolean((plan as any).isMealPlanTemplate)
          : false;
        this.days = plan.mealDays || [];
        this.days.forEach((day) => this.ensureMealUiDefaults(day));
        this.durationWeeks = this.normalizeDurationWeeks(
          Math.ceil((this.days.length || 28) / 7)
        );
        this.selectedDay = this.days[0] || null;

        this.recalcAllDays();
      });
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

  private makeEmptyMeal(index = 0): Meal {
    return {
      id: this.newLocalId(),
      name: 'New Meal',
      mealTime: this.defaultMealTime(index),
      mealTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      foods: [],
    };
  }

  private defaultMealTime(index: number): string {
    const times = ['08:00', '10:00', '12:30', '16:00', '19:30', '22:00'];
    return times[index] || times[times.length - 1];
  }

  private ensureMealUiDefaults(day: MealDay): void {
    day.meals = day.meals || [];
    day.meals.forEach((meal, index) => {
      meal.id = meal.id || this.newLocalId();
      meal.name = meal.name || `Meal ${index + 1}`;
      meal.mealTime = meal.mealTime || this.defaultMealTime(index);
      meal.foods = meal.foods || [];
      meal.directions = meal.directions || [];
      meal.mealTargets = meal.mealTargets || {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      };
    });
  }

  private newLocalId(): string {
    return globalThis.crypto?.randomUUID?.()
      || `meal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private makeEmptyDay(): MealDay {
    const defaultMealsCount = this.coachSettingsService.getDefaultMealsCount();
    const autoCreateMeals = this.coachSettingsService.getConfig().nutrition.autoCreateMeals;

    const meals = autoCreateMeals
      ? Array.from({ length: defaultMealsCount }, (_, index) => ({
          ...this.makeEmptyMeal(index),
          name: `Meal ${index + 1}`,
        }))
      : [this.makeEmptyMeal(0)];

    return {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      date: '',
      dayOfWeek: '',
      cheatMeal: false,
      refeedDay: false,
      description: '',
      showDescription: false,
      dayTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      meals,
    };
  }

  addDay() {
    const newDay = this.makeEmptyDay();
    newDay.dayOfWeek = `Day ${this.days.length + 1}`;
    this.days.push(newDay);
    this.selectedDay = newDay;
    this.mealPlan.mealDays = this.days;
    this.recalcDayTargets(newDay);
  }

  onDurationWeeksChange(value: number) {
    const nextWeeks = this.normalizeDurationWeeks(value);
    const currentWeeks = this.normalizeDurationWeeks(Math.ceil((this.days.length || 1) / 7));
    const targetDays = nextWeeks * 7;
    const selectedId = this.selectedDay?.id;

    if (targetDays < this.days.length) {
      this.pendingDurationWeeks = nextWeeks;
      this.pendingDurationRemovedDays = this.days.length - targetDays;
      this.durationWeeks = currentWeeks;
      return;
    } else {
      while (this.days.length < targetDays) {
        this.addDay();
      }
    }

    this.durationWeeks = nextWeeks;
    this.days.forEach((day, index) => (day.dayOfWeek = `Day ${index + 1}`));
    this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
    this.mealPlan.mealDays = this.days;
    this.recalcAllDays();
  }

  confirmDurationReduction() {
    if (!this.pendingDurationWeeks) return;
    const nextWeeks = this.pendingDurationWeeks;
    const targetDays = nextWeeks * 7;
    const selectedId = this.selectedDay?.id;

    this.days = this.days.slice(0, targetDays);
    this.durationWeeks = nextWeeks;
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
    this.days.forEach((day, index) => (day.dayOfWeek = `Day ${index + 1}`));
    this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
    this.mealPlan.mealDays = this.days;
    this.recalcAllDays();
  }

  cancelDurationReduction() {
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
  }

  selectDay(day: MealDay) {
    this.selectedDay = day;
  }

  deleteDay(day: MealDay, e: Event) {
    e.stopPropagation();
    if (this.days.length <= 1) return;

    const index = this.days.indexOf(day);
    this.days.splice(index, 1);
    this.selectedDay = this.days[Math.max(0, index - 1)] || null;

    this.recalcAllDays();
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
  }

  onDropMeal(event: CdkDragDrop<Meal[]>) {
    if (!this.selectedDay) return;
    moveItemInArray(this.selectedDay.meals, event.previousIndex, event.currentIndex);
    this.recalcDayTargets(this.selectedDay);
  }

  removeFood(food: Food, meal: Meal) {
    meal.foods = meal.foods.filter((f) => f.id !== food.id);

    this.recalcMealTargets(meal);

    if (this.selectedDay) {
      this.recalcDayTargets(this.selectedDay);
    }
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

    this.selectedDay.meals.push(this.makeEmptyMeal(this.selectedDay.meals.length));
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

  promptRenameMeal(meal: Meal): void {
    const nextName = window.prompt('Meal name', meal.name);
    if (nextName !== null) this.renameMeal(meal, nextName);
  }

  /* ============================================
            MEAL TEMPLATES / DUPLICATION
  ==============================================*/

  isTemplateModalOpen = false;
  activeMealMenuId: string | null = null;
  templateReplacementMealId: string | null = null;
  expandedRecipeMealIds = new Set<string>();

  openTemplateModal(replaceMeal?: Meal) {
    this.templateReplacementMealId = replaceMeal?.id || null;
    this.isTemplateModalOpen = true;
  }

  closeTemplateModal() {
    this.isTemplateModalOpen = false;
    this.templateReplacementMealId = null;
  }

  addMealFromTemplate(selection: MealTemplateSelection): void {
    if (!this.selectedDay || !selection?.meal) return;

    const source = selection.meal;
    const multiplier = Math.max(1, Math.floor(Number(selection.servings) || 1));
    const cloned: Meal = JSON.parse(JSON.stringify(source));
    cloned.id = this.newLocalId();
    cloned.servings = multiplier;
    cloned.draft = false;
    cloned.foods = (source.foods || []).map((food: any) => {
      const copy: any = JSON.parse(JSON.stringify(food));
      copy.id = this.newLocalId();
      copy.quantity = this.multiplyNumber(
        food.quantity ?? food.foodRef?.servingSize ?? 100,
        multiplier,
      );

      // Manual ingredient macros are stored as totals, so they must also scale.
      if (food.manual || !food.foodRef) {
        copy.calories = this.multiplyNullable(food.calories, multiplier);
        copy.protein = this.multiplyNullable(food.protein, multiplier);
        copy.carbohydrates = this.multiplyNullable(food.carbohydrates ?? food.carbs, multiplier);
        copy.fat = this.multiplyNullable(food.fat, multiplier);
      }
      return copy;
    });

    delete (cloned as any).mealPlanId;
    delete (cloned as any).mealDayId;

    let targetIndex = -1;
    if (this.templateReplacementMealId) {
      targetIndex = this.selectedDay.meals.findIndex(
        (meal) => meal.id === this.templateReplacementMealId,
      );
    }
    if (targetIndex < 0) {
      targetIndex = this.selectedDay.meals.findIndex((meal) => this.isEmptyMeal(meal));
    }

    if (targetIndex >= 0) {
      cloned.mealTime = this.selectedDay.meals[targetIndex].mealTime
        || this.defaultMealTime(targetIndex);
      this.selectedDay.meals.splice(targetIndex, 1, cloned);
    } else {
      cloned.mealTime = cloned.mealTime || this.defaultMealTime(this.selectedDay.meals.length);
      this.selectedDay.meals.push(cloned);
    }

    this.recalcMealTargets(cloned);
    this.recalcDayTargets(this.selectedDay);
    this.closeTemplateModal();
  }

  isEmptyMeal(meal: Meal): boolean {
    return !(meal.foods || []).length;
  }

  isRecipeMeal(meal: Meal): boolean {
    return Boolean(
      meal?.template
      || meal?.coverImage
      || meal?.totalTimeMinutes != null
      || (meal?.directions || []).length,
    );
  }

  toggleRecipeDetails(meal: Meal): void {
    const id = String(meal.id || '');
    if (!id) return;
    if (this.expandedRecipeMealIds.has(id)) this.expandedRecipeMealIds.delete(id);
    else this.expandedRecipeMealIds.add(id);
  }

  recipeDetailsVisible(meal: Meal): boolean {
    return this.expandedRecipeMealIds.has(String(meal.id || ''));
  }

  mealTypeLabel(meal: Meal): string {
    const value = String(meal.mealType || 'Meal').replace(/_/g, ' ').toLowerCase();
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  recipeDescription(meal: Meal): string {
    return (meal.foods || [])
      .map((food) => food.name || food.foodRef?.name)
      .filter(Boolean)
      .slice(0, 5)
      .join(', ');
  }

  saveMealAsTemplate(meal: Meal) {
    const payload = {
      name: meal.name,
      mealType: meal.mealType,
      servings: meal.servings || 1,
      totalTimeMinutes: meal.totalTimeMinutes,
      coverImage: meal.coverImage,
      directions: meal.directions || [],
      foods: meal.foods || [],
    };

    this.mealsService.saveTemplate(payload).subscribe(() => {
      alert('Template saved');
    });
  }

  duplicateMealInDay(meal: Meal) {
    if (!this.selectedDay) return;
    const clone: Meal = JSON.parse(JSON.stringify(meal));
    clone.id = this.newLocalId();
    clone.mealTime = this.defaultMealTime(this.selectedDay.meals.length);
    clone.foods = (clone.foods || []).map((food: any) => ({
      ...food,
      id: this.newLocalId(),
    }));
    this.selectedDay.meals.push(clone);
    this.recalcDayTargets(this.selectedDay);
  }

  private multiplyNumber(value: unknown, multiplier: number): number {
    const result = (Number(value) || 0) * multiplier;
    return Math.round(result * 1000) / 1000;
  }

  private multiplyNullable(value: unknown, multiplier: number): number | null {
    if (value === null || value === undefined || value === '') return null;
    return this.multiplyNumber(value, multiplier);
  }

  /* ============================================
                FOOD MODAL
  ==============================================*/

  isFoodModalOpen = false;
  mealForModal: Meal | null = null;

  filteredFoods: FoodRef[] = [];
  foodSearch = '';
  foodPage = 0;
  readonly foodPageSize = 3;
  foodTotalPages = 0;

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
    this.foodPage = 0;
    this.nutritionService
      .filteredFoods(0, 100, this.foodSearch || '')
      .subscribe((res) => {
        this.filteredFoods = [...res.content].sort((a, b) => Number(a.general) - Number(b.general));
        this.foodTotalPages = Math.ceil(this.filteredFoods.length / this.foodPageSize);
      });
  }

  get pagedModalFoods(): FoodRef[] { return this.filteredFoods.slice(this.foodPage * 3, this.foodPage * 3 + 3); }
  changeFoodPage(page: number) { if (page >= 0 && page < this.foodTotalPages) this.foodPage = page; }
  foodImage(food: FoodRef): string { return food.imageUrl || ''; }

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
    if (food.manual || !food.foodRef) {
      return {
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        carbs: Number(food.carbohydrates ?? food.carbs) || 0,
        fat: Number(food.fat) || 0,
      };
    }

    const servingSize = Number(food.foodRef.servingSize) || 100;
    const factor = (Number(food.quantity) || servingSize) / servingSize;
    const protein = (Number(food.foodRef.protein) || 0) * factor;
    const carbs = (Number(food.foodRef.carbohydrates) || 0) * factor;
    const fat = (Number(food.foodRef.fat) || 0) * factor;
    const declaredCalories = Number(food.foodRef.energy ?? food.foodRef.calories);

    return {
      calories: Number.isFinite(declaredCalories)
        ? declaredCalories * factor
        : protein * 4 + carbs * 4 + fat * 9,
      protein,
      carbs,
      fat,
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
    (day.meals || []).forEach((meal) => this.recalcMealTargets(meal));

    const totals = (day.meals || []).reduce(
      (acc, meal) => {
        return {
          calories: acc.calories + Number(meal.mealTargets?.calories ?? 0),
          protein: acc.protein + Number(meal.mealTargets?.proteinG ?? 0),
          carbs: acc.carbs + Number(meal.mealTargets?.carbsG ?? 0),
          fat: acc.fat + Number(meal.mealTargets?.fatG ?? 0),
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

  recalcAllDays() {
    this.days.forEach((day) => this.recalcDayTargets(day));
  }

  /* ============================================
                GETTERS
  ==============================================*/

  getMealCalories(m: Meal) {
    return Number(m.mealTargets?.calories) || 0;
  }

  getMealProtein(m: Meal) {
    return Number(m.mealTargets?.proteinG) || 0;
  }

  getMealCarbs(m: Meal) {
    return Number(m.mealTargets?.carbsG) || 0;
  }

  getMealFat(m: Meal) {
    return Number(m.mealTargets?.fatG) || 0;
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

  /* ============================================
                SAVE PLAN
  ==============================================*/

  savePlan() {
    this.recalcAllDays();

    this.mealPlan.name = this.planName;
    this.mealPlan.details = this.planDescription;
    this.mealPlan.mealDays = this.days;
    this.mealPlan.coach = { id: this.userId };
    this.mealPlan.startDate = this.scheduleStartDate;
    this.mealPlan.endDate = this.scheduleEndDate;
    (this.mealPlan as any).isMealPlanTemplate = this.canCreateTemplate
      ? Boolean(this.isMealPlanTemplate)
      : false;

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const navigateAfter = (createdPlan?: MealPlan) => {
      if (returnUrl) {
        this.router.navigateByUrl(returnUrl, createdPlan ? {
          state: {
            assignAfterCreate: {
              type: 'nutrition',
              item: createdPlan,
            },
          },
        } : undefined);
      } else {
        this.router.navigate(['/nutrition/plans']);
      }
    };

    if (this.planId) {
      this.mealPlan.id = this.planId;
      this.nutritionService.updateNutritionPlan(this.mealPlan).subscribe(() => {
        navigateAfter();
      });
    } else {
      this.nutritionService.createNutritionPlan(this.mealPlan).subscribe((createdPlan) => {
        navigateAfter(createdPlan);
      });
    }
  }
}
