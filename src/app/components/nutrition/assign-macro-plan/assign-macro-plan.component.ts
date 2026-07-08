import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MealDay, Meal, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';
import { Client, ClientService } from 'app/service/client.service';

@Component({
  selector: 'app-assign-macro-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './assign-macro-plan.component.html',
  styleUrl: './assign-macro-plan.component.scss',
})
export class AssignMacroPlanComponent implements OnInit {
  startDate = new Date().toISOString().split('T')[0];
  endDate: string = '';
  client: Client;
  latestAssignedPrograms: any[] = [];
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

  constructor(
    private clientService: ClientService,
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

    const clientId = this.route.snapshot.paramMap.get('idClient');
    if (clientId) {
      this.getClientById(clientId);
      this.loadLatestAssignedPrograms(clientId);
    }
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  private loadLatestAssignedPrograms(clientId: string): void {
    if (!this.userId) return;

    this.nutritionService.getNutritionPlanByCoachIdAndClient(this.userId, clientId, 0, 5, 'ALL', 'ALL', 'ALL', 'END_DESC').subscribe({
      next: (res: any) => {
        const programs = Array.isArray(res) ? res : (res?.content || []);
        this.latestAssignedPrograms = this.sortProgramsByLatestDate(programs).slice(0, 3);
      },
      error: () => {
        this.latestAssignedPrograms = [];
      },
    });
  }

  getProgramDisplayName(program: any): string {
    return program?.name || program?.programName || 'Nutrition program';
  }

  getProgramDateRange(program: any): string {
    const start = this.formatProgramDate(program?.startDate);
    const end = this.formatProgramDate(program?.endDate);

    if (start && end) return `${start} - ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    return 'No dates set';
  }

  private sortProgramsByLatestDate(programs: any[]): any[] {
    return [...(programs || [])].sort((a, b) => {
      const aDate = this.toProgramTime(a?.endDate || a?.startDate);
      const bDate = this.toProgramTime(b?.endDate || b?.startDate);
      return bDate - aDate;
    });
  }

  private toProgramTime(value: any): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private formatProgramDate(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

      this.selectedDay = this.days[0];
      this.startDate = new Date(plan.startDate).toISOString().split('T')[0];
      this.updateAllDates();
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
    this.updateAllDates();
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
    this.updateAllDates();
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

  savePlan() {
    const plan: MealPlan = {
      id: this.planId || undefined,
      name: this.planName,
      details: this.planDescription,
      trackingMode: 'EACH_MEAL',
      startDate: this.startDate,
      endDate: this.endDate,
      mealDays: this.days,
      coach: { id: this.userId },
      client: this.client,
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
