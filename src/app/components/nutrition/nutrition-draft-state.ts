import { ActivatedRoute } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { MacroTrackingMode, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { nutritionDayState, nutritionMealValid } from '@shared/models/nutrition-publication';

export class NutritionDraftState {
  collapsedWeeks = new Set<number>(Array.from({ length: 11 }, (_, i) => i + 2));
  publishedWeeks: number[] = [];
  settingsVisible = true;
  copyTargetIndex: number | null = null;
  saving = false;
  savedAt: Date | null = null;
  error = '';
  private planId: string | null = null;

  constructor(
    private service: NutritionService,
    private route: ActivatedRoute,
    private trackingMode: MacroTrackingMode | null,
  ) {}

  load(plan: MealPlan): void {
    this.planId = plan.id || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
    this.publishedWeeks = [...(plan.publishedWeeks || [])];
  }

  save(plan: MealPlan, publishWeek?: number): void {
    if (this.saving) return;
    const published = new Set(this.publishedWeeks);
    if (publishWeek && this.readyCount(plan.mealDays || [], publishWeek) === 7) published.add(publishWeek);
    const payload: MealPlan = { ...plan, id: this.planId || plan.id, trackingMode: this.trackingMode, publishedWeeks: [...published].sort((a, b) => a - b), publicationWorkflow: true, durationWeeks: Math.max(1, Math.min(12, Math.ceil((plan.mealDays?.length || 0) / 7))) };
    this.saving = true; this.error = '';
    const request = payload.id ? this.service.updateNutritionPlan(payload) : this.service.createNutritionPlan(payload);
    request.subscribe({
      next: saved => { this.planId = saved.id || this.planId; this.publishedWeeks = payload.publishedWeeks || []; this.savedAt = new Date(); this.saving = false; },
      error: err => { this.error = err?.error?.message || 'Unable to save the nutrition plan.'; this.saving = false; },
    });
  }

  toggleWeek(week: number): void { this.collapsedWeeks.has(week) ? this.collapsedWeeks.delete(week) : this.collapsedWeeks.add(week); }
  allWeeksExpanded(count: number): boolean { return Array.from({ length: count }, (_, i) => i + 1).every(w => !this.collapsedWeeks.has(w)); }
  toggleAllWeeks(count: number): void { if (this.allWeeksExpanded(count)) for (let w = 1; w <= count; w++) this.collapsedWeeks.add(w); else this.collapsedWeeks.clear(); }
  isPublished(week: number): boolean { return this.publishedWeeks.includes(week); }
  dayState(day: MealDay) { return nutritionDayState(day); }
  readyCount(days: MealDay[], week: number): number { return days.slice((week - 1) * 7, week * 7).filter(d => nutritionDayState(d) !== 'EMPTY').length; }
  selectedWeek(days: MealDay[], selected: MealDay | null): number { const index = selected ? days.indexOf(selected) : 0; return Math.max(1, Math.floor(Math.max(index, 0) / 7) + 1); }
  dayDate(day: MealDay): string { if (!day?.date) return ''; const date = new Date(`${day.date}T00:00:00`); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  weekDates(days: MealDay[], week: number): string { const slice = days.slice((week - 1) * 7, week * 7).filter(d => d.date); if (!slice.length) return ''; const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); return `${fmt(slice[0].date)} – ${fmt(slice[slice.length - 1].date)}`; }
  mealStatus(meal: Meal): string { return nutritionMealValid(meal) ? 'Ready' : 'Incomplete'; }
  copyDay(days: MealDay[], source: MealDay | null): void { if (!source || this.copyTargetIndex === null || !days[this.copyTargetIndex]) return; const target = days[this.copyTargetIndex]; const clone = JSON.parse(JSON.stringify(source)) as MealDay; Object.assign(target, clone, { id: target.id, date: target.date, dayOfWeek: target.dayOfWeek }); }
}
