import { ActivatedRoute, Router } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { MacroTrackingMode, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { nutritionDayState, nutritionMealState } from '@shared/models/nutrition-publication';

export class NutritionDraftState {
  collapsedWeeks = new Set<number>(Array.from({ length: 11 }, (_, i) => i + 2));
  publishedWeeks: number[] = [];
  /** Collapsed to one line by default, like the workout builder. */
  settingsVisible = false;
  copyTargetIndex: number | null = null;
  saving = false;
  savedAt: Date | null = null;
  error = '';
  private planId: string | null = null;
  private readonly localeProvider?: () => string;

  constructor(
    private service: NutritionService,
    private route: ActivatedRoute,
    private trackingMode: MacroTrackingMode | null,
    localeProvider: (() => string) | undefined,
    private router: Router,
  ) { this.localeProvider = localeProvider; }

  /** The plan exists on the server (created, or opened for edit): the page title says "Edit". */
  get hasPlan(): boolean {
    return !!(this.planId || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId'));
  }

  load(plan: MealPlan): void {
    this.planId = plan.id || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
    this.publishedWeeks = [...(plan.publishedWeeks || [])];
  }

  /** Weeks shown by the "ready to publish" modal (null: closed). */
  readyWeeksPrompt: number[] | null = null;
  private readyWeeksKeptAsDraft = new Set<number>();
  private readyWeeksActions: { publish: (weeks: number[]) => void; keep: () => void } | null = null;

  /** Weeks whose 7 days are ready and which are not published yet. */
  readyUnpublishedWeeks(days: MealDay[]): number[] {
    const weeks = Math.ceil((days?.length || 0) / 7);
    return Array.from({ length: weeks }, (_, i) => i + 1)
      .filter(week => !this.isPublished(week) && this.readyCount(days, week) === 7);
  }

  /**
   * The "Save draft" button: when weeks are ready but not published, the coach may not know a draft week stays
   * hidden from the client, so the modal comes first (publish them, or keep them as drafts).
   */
  saveDraft(days: MealDay[], save: (publishWeeks?: number[]) => void): void {
    if (this.saving) return;
    const ready = this.readyUnpublishedWeeks(days).filter(week => !this.readyWeeksKeptAsDraft.has(week));
    if (!ready.length) {
      save();
      return;
    }
    this.readyWeeksPrompt = ready;
    this.readyWeeksActions = {
      publish: weeks => save(weeks),
      keep: () => { ready.forEach(week => this.readyWeeksKeptAsDraft.add(week)); save(); },
    };
  }

  publishReadyWeeks(weeks: number[]): void {
    const actions = this.readyWeeksActions;
    this.closeReadyWeeks();
    actions?.publish(weeks);
  }

  keepReadyWeeksAsDraft(): void {
    const actions = this.readyWeeksActions;
    this.closeReadyWeeks();
    actions?.keep();
  }

  closeReadyWeeks(): void {
    this.readyWeeksPrompt = null;
    this.readyWeeksActions = null;
  }

  save(plan: MealPlan, publishWeek?: number | number[]): void {
    if (this.saving) return;
    const published = new Set(this.publishedWeeks);
    const toPublish = Array.isArray(publishWeek) ? publishWeek : publishWeek ? [publishWeek] : [];
    toPublish.filter(week => this.readyCount(plan.mealDays || [], week) === 7).forEach(week => published.add(week));
    const id = this.planId || plan.id || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
    const payload: MealPlan = { ...plan, id: id || undefined, trackingMode: this.trackingMode, publishedWeeks: [...published].sort((a, b) => a - b), publicationWorkflow: true, durationWeeks: Math.max(1, Math.min(12, Math.ceil((plan.mealDays?.length || 0) / 7))) };
    const saveUrl = this.router.url;
    this.saving = true; this.error = '';
    const request = payload.id ? this.service.updateNutritionPlan(payload) : this.service.createNutritionPlan(payload);
    request.subscribe({
      next: saved => {
        this.planId = saved.id || payload.id || this.planId;
        this.publishedWeeks = payload.publishedWeeks || [];
        this.savedAt = new Date();
        this.saving = false;

        // Replace the creation history entry so refresh and Back resume this draft.
        // A late response must not bring a user who has left back into the editor.
        if (!payload.id && this.planId && this.router.url === saveUrl) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { draftId: this.planId },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      },
      error: err => { this.error = err?.error?.message || 'Unable to save the nutrition plan.'; this.saving = false; },
    });
  }

  toggleWeek(week: number): void { this.collapsedWeeks.has(week) ? this.collapsedWeeks.delete(week) : this.collapsedWeeks.add(week); }
  allWeeksExpanded(count: number): boolean { return Array.from({ length: count }, (_, i) => i + 1).every(w => !this.collapsedWeeks.has(w)); }
  toggleAllWeeks(count: number): void { if (this.allWeeksExpanded(count)) for (let w = 1; w <= count; w++) this.collapsedWeeks.add(w); else this.collapsedWeeks.clear(); }
  isPublished(week: number): boolean { return this.publishedWeeks.includes(week); }
  dayState(day: MealDay) { return nutritionDayState(day); }
  readyCount(days: MealDay[], week: number): number { return days.slice((week - 1) * 7, week * 7).filter(d => ['READY', 'CHEAT'].includes(nutritionDayState(d))).length; }
  selectedWeek(days: MealDay[], selected: MealDay | null): number { const index = selected ? days.indexOf(selected) : 0; return Math.max(1, Math.floor(Math.max(index, 0) / 7) + 1); }
  dayDate(day: MealDay): string { if (!day?.date) return ''; const date = new Date(`${day.date}T00:00:00`); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(this.dateLocale(), { weekday: 'short', month: 'short', day: 'numeric' }); }
  weekDates(days: MealDay[], week: number): string { const slice = days.slice((week - 1) * 7, week * 7).filter(d => d.date); if (!slice.length) return ''; const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(this.dateLocale(), { month: 'short', day: 'numeric' }); return `${fmt(slice[0].date)} – ${fmt(slice[slice.length - 1].date)}`; }
  mealStatus(meal: Meal): string {
    const state = nutritionMealState(meal);
    return state === 'VALID' ? 'Ready' : state === 'INCOMPLETE' ? 'Incomplete' : 'Empty';
  }
  copyDay(days: MealDay[], source: MealDay | null): void { if (!source || this.copyTargetIndex === null || !days[this.copyTargetIndex]) return; const target = days[this.copyTargetIndex]; const clone = JSON.parse(JSON.stringify(source)) as MealDay; Object.assign(target, clone, { id: target.id, date: target.date, dayOfWeek: target.dayOfWeek }); }

  private dateLocale(): string {
    const language = this.localeProvider?.() || (typeof document !== 'undefined' ? document.documentElement.lang : '');
    return language.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
  }
}
