import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';
import { Client, ClientService } from 'app/service/client.service';

@Component({
  selector: 'app-assign-macro-plan-total-day',
  standalone: true,
  imports: [
    DecimalPipe,
    FeatherModule,
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    DragDropModule,
  ],
  templateUrl: './assign-macro-plan-total-day.component.html',
  styleUrl: './assign-macro-plan-total-day.component.scss',
})
export class AssignMacroPlanTotalDayComponent implements OnInit {
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
  viewMode: 'total' | 'meals' = 'total';
  showModeModal = true;

  isEditMode = false;
  userid = sessionStorage.getItem('userId');
  trackByDay = (_: number, d: MealDay) => d.id;

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
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private clientService: ClientService
  ) {}

  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    const clientId = this.route.snapshot.paramMap.get('idClient');
    if (clientId) {
      this.getClientById(clientId);
      this.loadLatestAssignedPrograms(clientId);
    }
    this.isEditMode = !!planId;

    if (planId) {
      this.nutritionService.getNutritionPlanById(planId).subscribe((plan) => {
        this.planName = plan.name;
        this.planDescription = plan.details;
        this.days = plan.mealDays;
        this.startDate = new Date(plan.startDate).toISOString().split('T')[0];

        // Recalcul calories si nécessaire
        this.days.forEach((d) => this.updateCaloriesForDay(d));

        this.selectedDay = this.days[0] ?? null;
        this.updateAllDates();
      });
    }

    if (planId) {
      this.showModeModal = false;
      this.viewMode = 'total';
    } else if (type === 'total' || type === 'each') {
      this.showModeModal = false;
      this.viewMode = type === 'total' ? 'total' : 'meals';
      this.applyCreationQueryParams();
    } else {
      this.showModeModal = true;
      this.applyCreationQueryParams();
    }
  }

  getClientById(id: string) {
    this.clientService.getClientById(id).subscribe((res) => {
      this.client = res;
    });
  }

  private loadLatestAssignedPrograms(clientId: string): void {
    if (!this.userid) return;

    this.nutritionService.getNutritionPlanByCoachIdAndClient(this.userid, clientId, 0, 5, 'ALL', 'ALL', 'ALL', 'END_DESC').subscribe({
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
    console.log(start);
    console.log(this.days);
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

    this.updateAllDates();
  }

  private applyCreationQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    this.planName = params.get('name') || this.planName;
    this.startDate = params.get('startDate') || this.startDate;

    const durationWeeks = Math.max(1, Math.min(Number(params.get('durationWeeks')) || 1, 52));
    const totalDays = durationWeeks * 7;
    this.days = [];

    for (let i = 0; i < totalDays; i++) {
      this.addDay();
    }
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (duplicated as any).name = `Day ${index}`;
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
      this.days.forEach((d, i) => ((d as any).name = `Day ${i + 1}`));

      if (this.selectedDay?.id === day.id) {
        this.selectedDay = this.days[Math.max(0, index - 1)];
      }
    }
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.days.forEach((d, i) => ((d as any).name = `Day ${i + 1}`));
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
      startDate: this.startDate,
      endDate: this.endDate,
      coach: { id: this.userid },
      client: this.client,
    };

    this.nutritionService.createNutritionPlan(mealPlan).subscribe(() => {
      this.resetForm();
    });
  }

  updatePlan() {
    const mealPlan: MealPlan = {
      id: this.route.snapshot.paramMap.get('id'),
      name: this.planName,
      details: this.planDescription,
      mealDays: this.days,
      trackingMode: 'TOTAL_FOR_DAY',
      startDate: this.startDate,
      endDate: this.endDate,
      coach: { id: this.userid },
      client: this.client,
    };

    this.nutritionService.updateNutritionPlan(mealPlan).subscribe(() => {
      console.log('Plan updated');
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
