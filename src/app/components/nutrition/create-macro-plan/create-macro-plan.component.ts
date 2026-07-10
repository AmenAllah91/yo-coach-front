import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MealDay, Meal, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-create-macro-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './create-macro-plan.component.html',
  styleUrls: ['./create-macro-plan.component.scss'],
})
export class CreateMacroPlanComponent implements OnInit {
  planName = '';
  planDescription = '';
  isMealPlanTemplate = false;
  showPlanDescription = false;

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'meals';
  showModeModal = false;
  durationWeeks = 4;
  private scheduleStartDate = '';
  private scheduleEndDate = '';
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  collapsedWeeks = new Set<number>();

  isEditMode = false;
  planId: string | null = null;

  userId = sessionStorage.getItem('userId');

  trackByDay = (_: number, d: MealDay) => d.id;
  trackByMeal = (_: number, m: Meal) => m.id;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService
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
      this.isEditMode = true;
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

  /* ===================================================
        LOAD PLAN IN EDIT MODE
  ======================================================*/
  loadPlanForEdit(id: string) {
    this.nutritionService.getNutritionPlanById(id).subscribe((plan) => {
      this.planName = plan.name;
      this.planDescription = plan.details;
      this.isMealPlanTemplate = this.canCreateTemplate
        ? Boolean((plan as any).isMealPlanTemplate)
        : false;
      this.days = plan.mealDays || [];
      this.durationWeeks = this.normalizeDurationWeeks(
        Math.ceil((this.days.length || 28) / 7)
      );

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

    const defaultMealsCount = this.coachSettingsService.getDefaultMealsCount();
    const autoCreateMeals = this.coachSettingsService.getConfig().nutrition.autoCreateMeals;

    if (autoCreateMeals) {
      for (let i = 0; i < defaultMealsCount; i++) {
        this.addMeal();
      }
    } else {
      this.addMeal();
    }
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
    this.days.forEach((day, index) => {
      day.dayOfWeek = `Day ${index + 1}`;
      this.updateDayTotals(day);
    });
    this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
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
    this.days.forEach((day, index) => {
      day.dayOfWeek = `Day ${index + 1}`;
      this.updateDayTotals(day);
    });
    this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
  }

  cancelDurationReduction() {
    this.pendingDurationWeeks = null;
    this.pendingDurationRemovedDays = 0;
  }

  deleteDay(day: MealDay, event: Event) {
    event.stopPropagation();
    if (this.days.length <= 1) return;

    const i = this.days.findIndex((d) => d.id === day.id);
    this.days.splice(i, 1);

    this.days.forEach((d, idx) => (d.dayOfWeek = `Day ${idx + 1}`));
    this.selectedDay = this.days[Math.max(0, i - 1)];
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.days.forEach((d, idx) => (d.dayOfWeek = `Day ${idx + 1}`));
  }

  onDropMeal(event: CdkDragDrop<Meal[]>) {
    if (!this.selectedDay) return;
    moveItemInArray(this.selectedDay.meals, event.previousIndex, event.currentIndex);
    this.updateDayTotals(this.selectedDay);
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
      startDate: this.scheduleStartDate || new Date().toISOString().slice(0, 10),
      endDate: this.scheduleEndDate,
      mealDays: this.days,
      coach: { id: this.userId },
      client: null,
      isMealPlanTemplate: this.canCreateTemplate ? Boolean(this.isMealPlanTemplate) : false,
    } as MealPlan;

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

    if (this.isEditMode) {
      this.nutritionService.updateNutritionPlan(plan).subscribe({
        next: () => {
          console.log('Plan updated');
          navigateAfter();
        },
        error: (error) => console.error('Error updating nutrition plan:', error),
      });
    } else {
      this.nutritionService.createNutritionPlan(plan).subscribe({
        next: (createdPlan) => {
          console.log('Plan saved');
          navigateAfter(createdPlan);
        },
        error: (error) => console.error('Error creating nutrition plan:', error),
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
