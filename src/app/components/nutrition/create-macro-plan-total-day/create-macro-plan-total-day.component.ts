import { Component, OnInit } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
    DragDropModule,
    TranslateModule,
  ],
  templateUrl: './create-macro-plan-total-day.component.html',
  styleUrls: ['./create-macro-plan-total-day.component.scss', '../_nutrition-builder-template.scss'],
})
export class CreateMacroPlanTotalDayComponent implements OnInit {
  planName = '';
  planDescription = '';
  isMealPlanTemplate = false;
  showPlanDescription = false;

  days: MealDay[] = [];
  selectedDay: MealDay | null = null;

  showDayDescription = false;
  viewMode: 'total' | 'meals' = 'total';
  showModeModal = true;
  durationWeeks = 4;
  private scheduleStartDate = '';
  private scheduleEndDate = '';
  readonly durationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  collapsedWeeks = new Set<number>();

  isEditMode = false;
  userid = sessionStorage.getItem('userId');
  trackByDay = (_: number, d: MealDay) => d.id;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private translate: TranslateService
  ) {}

  dayLabel(index: number): string { return this.translate.instant('DAY_NUMBER', { number: index + 1 }); }


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
    const planId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    this.durationWeeks = this.normalizeDurationWeeks(
      Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || this.durationWeeks
    );
    this.planName = this.route.snapshot.queryParamMap.get('name') || '';
    this.scheduleStartDate = this.route.snapshot.queryParamMap.get('startDate') || '';
    this.scheduleEndDate = this.route.snapshot.queryParamMap.get('endDate') || '';
    this.isEditMode = !!planId;

    if (planId) {
      this.nutritionService.getNutritionPlanById(planId).subscribe((plan) => {
        this.planName = plan.name;
        this.planDescription = plan.details;
      this.isMealPlanTemplate = this.canCreateTemplate
        ? Boolean((plan as any).isMealPlanTemplate)
        : false;
      this.days = plan.mealDays;
      this.durationWeeks = this.normalizeDurationWeeks(
        Math.ceil((this.days.length || 28) / 7)
      );

        // Recalcul calories si nécessaire
        this.days.forEach((d) => this.updateCaloriesForDay(d));

        this.selectedDay = this.days[0] ?? null;
      });
    }

    if (planId) {
      this.showModeModal = false;
      this.viewMode = 'total';
    } else if (type === 'total' || type === 'each') {
      this.showModeModal = false;
      this.viewMode = type === 'total' ? 'total' : 'meals';
      this.createInitialDays();
    } else {
      this.showModeModal = true;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newDay as any).name = `Day ${index}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newDay as any).dayOfWeek = `Day ${index}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newDay as any).showDescription = false;


  this.days.push(newDay);
  this.selectedDay = newDay;
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
    (day as any).name = `Day ${index + 1}`;
    day.dayOfWeek = `Day ${index + 1}`;
    this.updateCaloriesForDay(day);
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
    (day as any).name = `Day ${index + 1}`;
    day.dayOfWeek = `Day ${index + 1}`;
    this.updateCaloriesForDay(day);
  });
  this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
}

cancelDurationReduction() {
  this.pendingDurationWeeks = null;
  this.pendingDurationRemovedDays = 0;
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

    // keep both fields aligned with the new day number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (duplicated as any).name = `Day ${index}`;
    duplicated.dayOfWeek = `Day ${index}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.days.forEach((d, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d as any).name = `Day ${i + 1}`;
        d.dayOfWeek = `Day ${i + 1}`;
      });

      if (this.selectedDay?.id === day.id) {
        this.selectedDay = this.days[Math.max(0, index - 1)];
      }
    }
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.days.forEach((d, i) => {
      (d as any).name = `Day ${i + 1}`;
      d.dayOfWeek = `Day ${i + 1}`;
    });
  }

  togglePlanDescription() {
    this.showPlanDescription = !this.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.selectedDay) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.selectedDay as any).showDescription =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      startDate: this.scheduleStartDate,
      endDate: this.scheduleEndDate,
      coach: { id: this.userid },
      client: undefined,
      isMealPlanTemplate: this.canCreateTemplate ? Boolean(this.isMealPlanTemplate) : false,
    } as MealPlan;

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    this.nutritionService.createNutritionPlan(mealPlan).subscribe({
      next: (createdPlan) => {
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl, {
            state: {
              assignAfterCreate: {
                type: 'nutrition',
                item: createdPlan,
              },
            },
          });
        } else {
          this.router.navigate(['/nutrition/plans']);
        }
      },
      error: (error) => console.error('Error creating nutrition plan:', error),
    });
  }

  updatePlan() {
    const mealPlan: MealPlan = {
      id: this.route.snapshot.paramMap.get('id'),
      name: this.planName,
      details: this.planDescription,
      mealDays: this.days,
      trackingMode: 'TOTAL_FOR_DAY',
      startDate: '',
      endDate: '',
      coach: { id: this.userid },
      client: undefined,
      isMealPlanTemplate: this.canCreateTemplate ? Boolean(this.isMealPlanTemplate) : false,
    } as MealPlan;

    this.nutritionService.updateNutritionPlan(mealPlan).subscribe({
      next: () => {
        console.log('Plan updated');
        this.router.navigate(['/nutrition/plans']);
      },
      error: (error) => console.error('Error updating nutrition plan:', error),
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
