import { ActivatedRoute } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { Meal, MealDay, MealPlan, MacroTrackingMode } from '@shared/models/MealPlan';
import { nutritionDayStatus, nutritionMealStatus } from '@shared/models/nutrition-publication';

/** Shared publication state; meal editors keep ownership of their existing content. */
export class NutritionDraftState {
  id?: string;
  publishedWeeks: number[] = [];
  savedAt: Date | null = null;
  saving = false;
  error = '';
  settingsVisible = true;
  copyTargetIndex: number | null = null;
  collapsedWeeks = new Set<number>();
  private loadedPlan?: MealPlan;

  constructor(private service: NutritionService, private route: ActivatedRoute,
    readonly mode: MacroTrackingMode | null) {}

  load(plan: MealPlan): void {
    this.loadedPlan = plan;
    this.id = plan.id;
    // Existing plans predate the Draft workflow and remain visible.
    this.publishedWeeks = plan.publishedWeeks ?? Array.from(
      { length: Math.ceil((plan.mealDays?.length || 0) / 7) }, (_, i) => i + 1);
  }

  status(day: MealDay) { return nutritionDayStatus(day, this.mode); }
  dayState(day: MealDay): 'READY' | 'CHEAT' | 'EMPTY' {
    const status = this.status(day);
    if (status === 'Cheat meal') return 'CHEAT';
    if (status === 'Ready') return 'READY';
    return 'EMPTY';
  }
  mealStatus(meal: Meal) {
    const status = nutritionMealStatus(meal, this.mode);
    return status === 'Empty' ? 'Empty placeholder' : status === 'Ready' ? 'Valid meal' : status;
  }
  copyDay(days: MealDay[], source: MealDay | null): void {
    const target = this.copyTargetIndex == null ? null : days[this.copyTargetIndex];
    if (!source || !target || source === target) return;
    if (this.status(target) !== 'Empty' && !confirm('Replace the selected day’s nutrition content?')) return;
    const copy: MealDay = JSON.parse(JSON.stringify(source));
    target.meals = (copy.meals || []).map(meal => ({ ...meal, id: crypto.randomUUID(),
      foods: (meal.foods || []).map(food => ({ ...food, id: crypto.randomUUID() })),
    }));
    target.dayTargets = copy.dayTargets;
    target.cheatMeal = copy.cheatMeal;
    target.refeedDay = copy.refeedDay;
    target.description = copy.description;
    this.copyTargetIndex = null;
  }
  selectedWeek(days: MealDay[], day: MealDay | null): number {
    return Math.floor(Math.max(0, days.indexOf(day!)) / 7) + 1;
  }
  readyCount(days: MealDay[], week: number): number {
    return days.slice((week - 1) * 7, week * 7)
      .filter(day => ['Ready', 'Cheat meal'].includes(this.status(day))).length;
  }
  isPublished(week: number) { return this.publishedWeeks.includes(week); }
  toggleWeek(week: number) {
    if (this.collapsedWeeks.has(week)) this.collapsedWeeks.delete(week);
    else this.collapsedWeeks.add(week);
  }
  allWeeksExpanded(totalWeeks: number): boolean {
    return this.collapsedWeeks.size === 0;
  }
  toggleAllWeeks(totalWeeks: number) {
    if (this.collapsedWeeks.size === 0) {
      for (let i = 1; i <= totalWeeks; i++) this.collapsedWeeks.add(i);
    } else {
      this.collapsedWeeks.clear();
    }
  }
  dayDate(day: MealDay): string {
    if (!day.date) return '';
    return new Date(`${day.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US',
      { weekday: 'short', month: 'short', day: 'numeric' });
  }
  weekDates(days: MealDay[], week: number): string {
    const dates = days.slice((week - 1) * 7, week * 7);
    const format = (day: MealDay) => day?.date ? new Date(`${day.date.slice(0, 10)}T12:00:00`)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return dates[0]?.date ? `${format(dates[0])}–${format(dates[dates.length - 1])}` : '';
  }

  save(plan: MealPlan, publishWeek?: number): void {
    if (this.saving) return;
    this.error = '';
    if (!plan.name?.trim()) { this.error = 'Enter a program name.'; return; }
    if (publishWeek && this.readyCount(plan.mealDays, publishWeek) !== 7) return;
    const publishedWeeks = this.publishedWeeks.filter(week => week <= Math.ceil(plan.mealDays.length / 7));
    // Incomplete edits are always saveable, but must be published again when ready.
    const validPublished = publishedWeeks.filter(week => this.readyCount(plan.mealDays, week) === 7);
    if (publishWeek && !validPublished.includes(publishWeek)) validPublished.push(publishWeek);
    const payload: MealPlan = JSON.parse(JSON.stringify({ ...this.loadedPlan, ...plan,
      client: plan.client || this.loadedPlan?.client || null,
      id: this.id, publishedWeeks: validPublished.sort((a, b) => a - b),
      durationWeeks: Math.ceil(plan.mealDays.length / 7), publicationWorkflow: true,
    }));
    this.saving = true;
    const request = this.id ? this.service.updateNutritionPlan(payload) : this.service.createNutritionPlan(payload);
    request.subscribe({
      next: saved => {
        this.load(saved);
        this.savedAt = new Date();
        this.saving = false;
        // Keep the created ID on refresh without navigating away from the builder.
        if (!this.route.snapshot.paramMap.get('id')) {
          const url = new URL(window.location.href);
          url.searchParams.set('draftId', saved.id!);
          window.history.replaceState(window.history.state, '', url.toString());
        }
      },
      error: () => { this.saving = false; this.error = 'Could not save the plan. Please try again.'; },
    });
  }
}
