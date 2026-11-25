import { ActivatedRoute, Router } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { MacroTrackingMode, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { nutritionDayState, nutritionMealState } from '@shared/models/nutrition-publication';
import { ProgramDayState, firstNutritionIssue, nutritionDayStatus, nutritionSummary, programDaysError, refusedDaysMessage } from '@shared/models/program-days';
import { isLockedError, isPlanLocked, todayIso } from '@shared/models/program-schedule';
import { ConfirmOptions } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { SavedContent } from '@config/guard/unsaved-changes.guard';

/** The builder's translation (TranslateService.instant). */
export type DraftTranslator = (key: string, params?: Record<string, unknown>) => string;

/**
 * Copy of the plan to send: without the signed photo links the editor adds to each food (a long URL per food line,
 * never stored: the server signs the photos again when it reads them).
 */
export function withoutDisplayOnlyFields(plan: MealPlan): MealPlan {
  return JSON.parse(JSON.stringify(plan, (key, value) => (key === 'imageUrl' ? undefined : value)));
}

/** Filled in by the editor itself (photo links, open descriptions, dates and labels of the days): not a change. */
const DISPLAY_ONLY_KEYS = new Set(['imageUrl', 'showDescription', 'date', 'dayOfWeek']);

/** What the coach edits (name, settings, days), as text: compared with the saved plan before leaving. */
export function nutritionContent(plan: Partial<MealPlan>): string {
  return JSON.stringify({
    name: plan.name || '',
    details: plan.details || '',
    template: Boolean((plan as any).isMealPlanTemplate),
    days: plan.mealDays || [],
  }, (key, value) => (DISPLAY_ONLY_KEYS.has(key) ? undefined : value));
}

/** A macro value other than empty or 0. */
function someTarget(targets: unknown): boolean {
  const t = (targets || {}) as Record<string, unknown>;
  return ['calories', 'proteinG', 'carbsG', 'fatG'].some((key) => Number(t[key]) > 0);
}

/** A meal with a food, macros above 0, steps or a photo: deleting it is asked first. */
export function nutritionMealHasContent(meal: Meal | null | undefined): boolean {
  return !!meal && (!!(meal.foods || []).length || someTarget(meal.mealTargets) || !!(meal.directions || []).length || !!meal.coverImage);
}

/**
 * A plan with nothing but its name (2026-11-23): no food, no macros, no free day, no description. « Continuer » on the
 * first screen creates the plan at once; left like this, the editor deletes it again (never a client's plan).
 */
export function isEmptyNutritionPlan(plan: { details?: string | null; mealDays?: MealDay[] | null; days?: MealDay[] | null } | null | undefined): boolean {
  if (!plan) return false;
  if (String(plan.details || '').trim()) return false;
  const days = plan.mealDays || plan.days || [];
  return days.every((day) => !day || (
    !day.cheatMeal && !day.refeedDay && !String(day.description || '').trim() && !someTarget(day.dayTargets)
    && (day.meals || []).every((meal) => !nutritionMealHasContent(meal))
  ));
}

/**
 * State shared by the six nutrition builders. No weekly publication any more (backlog-programmes.md): one save, the
 * client sees the filled days; empty days in the middle are marked as free days or filled first (R4).
 */
export class NutritionDraftState {
  collapsedWeeks = new Set<number>(Array.from({ length: 11 }, (_, i) => i + 2));
  /** Collapsed to one line by default, like the workout builder. */
  settingsVisible = false;
  copyTargetIndex: number | null = null;
  saving = false;
  savedAt: Date | null = null;
  error = '';
  private planId: string | null = null;
  private readonly localeProvider?: () => string;
  /** A stopped or finished client program: it opens, it is not saved (backlog-programmes.md A9). */
  readOnly = false;
  stoppedAt: string | null = null;
  /** Says what the save changed on the client's other programs (new dates, backlog-programmes.md A8). */
  scheduleAnnouncer?: (changes: any[] | null | undefined, undoId?: string | null) => void;
  /** The end saved on the server: a longer plan is checked against the next one (backlog-programmes.md P9). */
  savedEnd: string | null = null;
  /** The coach's choice for the next program, for the save being made (P9). */
  overlap: 'SHIFT' | 'REMOVE' | null = null;
  /** Opens the « Décaler / Retirer » window when the plan now reaches the next one; true when it did (P9). */
  overlapGuard?: () => boolean | Promise<boolean>;
  /** The guard answered « nothing to ask » for the save being made. */
  private overlapChecked = false;
  /** What the coach edits, given by the builder (the same fields as its save). */
  editedPlan?: () => Partial<MealPlan>;
  /**
   * After a save: the days the client did while the editor was open (the server kept them, a save never erases them)
   * are shown done. True when a day changed on the screen.
   */
  clientDaysKept?: (saved: MealPlan) => boolean;
  /** The plan as last loaded or saved: leaving with something else asks first. */
  private readonly savedContent = new SavedContent();
  /** The plan this visit of the editor created (« Continuer »), and what its last save sent. */
  private createdId: string | null = null;
  private lastSent: string | null = null;
  /** The editor was left: a save still on its way checks again when it comes back. */
  private left: { assigned: boolean } | null = null;

  constructor(
    private service: NutritionService,
    private route: ActivatedRoute,
    private trackingMode: MacroTrackingMode | null,
    localeProvider: (() => string) | undefined,
    private router: Router,
    private translator?: DraftTranslator,
  ) { this.localeProvider = localeProvider; }

  /** Translated text, or the English fallback when no translator is given (tests). */
  private tr(key: string, fallback: string, params?: Record<string, unknown>): string {
    const text = this.translator?.(key, params);
    return text && text !== key ? text : fallback;
  }

  /** The plan exists on the server (created, or opened for edit): the page title says "Edit". */
  get hasPlan(): boolean {
    return !!(this.planId || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId'));
  }

  /** The plan's id on the server, once created or opened. */
  get currentPlanId(): string | null {
    return this.planId || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
  }

  load(plan: MealPlan): void {
    this.planId = plan.id || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
    this.savedEnd = plan.endDate ? String(plan.endDate).slice(0, 10) : null;
    this.readOnly = isPlanLocked(plan as any, todayIso());
    this.stoppedAt = (plan as any)?.stoppedAt || null;
  }

  /** Once the plan is loaded (or the days of a new one created): what leaving the builder is compared with. */
  rememberContent(): void {
    const edited = this.editedPlan;
    if (edited) this.savedContent.rememberAfterDisplay(() => nutritionContent(edited()));
  }

  /** IA-54: a new plan filled by the AI: nothing saved yet, so leaving the builder asks first. */
  forgetContent(): void {
    this.savedContent.remember('');
  }

  hasUnsavedChanges(): boolean {
    return !this.readOnly && !!this.editedPlan && this.savedContent.changed(nutritionContent(this.editedPlan()));
  }

  /**
   * « Jour libre » on a day that has meals or targets: they are removed, so it is asked first (null: nothing to lose).
   */
  freeDayQuestion(days: MealDay[], day: MealDay): ConfirmOptions | null {
    if (day.cheatMeal || nutritionDayStatus(day, this.trackingMode) === 'EMPTY') return null;
    return {
      title: 'CONFIRM_ACTION.FREE_DAY_TITLE',
      text: 'CONFIRM_ACTION.FREE_DAY_TEXT',
      params: { label: this.tr('DAY_NUMBER', `Day ${days.indexOf(day) + 1}`, { number: days.indexOf(day) + 1 }) },
      confirm: 'CONFIRM_ACTION.FREE_DAY_CONFIRM',
    };
  }

  /** Empty days before the last filled one, shown by the "empty days" modal (null: closed). */
  emptyDaysPrompt: number[] | null = null;
  /** The save of the builder that opened the modal ("mark as free days" saves right after). */
  private pendingSave: (() => void) | null = null;
  private pendingDays: MealDay[] = [];

  /**
   * The "Save" button. A day with an error goes to the builder's save, which shows its message (R2); otherwise empty
   * days in the middle open the modal first (R4).
   */
  saveDraft(days: MealDay[], save: () => void): void {
    if (this.saving) return;
    const summary = nutritionSummary(days, this.trackingMode);
    if (summary.invalidDays.length || !summary.gaps.length) {
      save();
      return;
    }
    this.openEmptyDays(summary.gaps, days, save);
  }

  private openEmptyDays(gaps: number[], days: MealDay[], save: () => void): void {
    this.emptyDaysPrompt = [...gaps];
    this.pendingDays = days;
    this.pendingSave = save;
  }

  /** "Mark as free days" in the modal: the listed days become free days, then the plan is saved. */
  markEmptyDaysFree(): void {
    const save = this.pendingSave;
    (this.emptyDaysPrompt || []).forEach(dayNumber => {
      const day = this.pendingDays[dayNumber - 1];
      if (day) day.cheatMeal = true;
    });
    this.closeEmptyDays();
    save?.();
  }

  /** "Fill it" in the modal: the day to open (the builder selects it). */
  emptyDayToFill(dayNumber: number): MealDay | null {
    const day = this.pendingDays[dayNumber - 1] || null;
    this.closeEmptyDays();
    return day;
  }

  closeEmptyDays(): void {
    this.emptyDaysPrompt = null;
    this.pendingSave = null;
  }

  save(plan: MealPlan, retry?: () => void): void {
    if (this.saving || this.readOnly) return;
    // R2 for every builder (the macro ones had no check): a day started but wrong is not saved.
    const issue = this.firstIssue(plan.mealDays);
    if (issue) {
      this.error = issue;
      return;
    }
    // Full weeks only (the server refuses the others with an English message): the length is chosen in the settings.
    const weeks = this.weeksIssue(plan.mealDays);
    if (weeks) {
      this.error = weeks;
      this.settingsVisible = true;
      return;
    }
    const id = this.planId || plan.id || this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId');
    // publicationWorkflow now only marks a plan built week by week (7-day weeks, dates); publishedWeeks is not sent.
    const payload: MealPlan = { ...plan, id: id || undefined, trackingMode: this.trackingMode, publicationWorkflow: true, durationWeeks: Math.max(1, Math.min(12, Math.ceil((plan.mealDays?.length || 0) / 7))) };
    delete (payload as any).publishedWeeks;
    // Longer than saved and reaching the next program: the coach chooses first (P9).
    if (payload.id && !this.overlap && !this.overlapChecked && this.overlapGuard) {
      const asked = this.overlapGuard();
      if (typeof asked !== 'boolean') {
        // The check of the next programs had not come back: the save waits for it (it went without the question).
        this.saving = true;
        asked.then(open => {
          this.saving = false;
          if (open) return;
          this.overlapChecked = true;
          this.save(plan, retry);
        }, () => (this.saving = false));
        return;
      }
      if (asked) return;
    }
    this.overlapChecked = false;
    const overlap = this.overlap;
    this.overlap = null;
    const saveUrl = this.router.url;
    this.saving = true; this.error = '';
    const body = withoutDisplayOnlyFields(payload);
    // What the coach changes while the save is on its way stays unsaved.
    const sent = nutritionContent(plan);
    const request = payload.id ? this.service.updateNutritionPlan(body, true, overlap) : this.service.createNutritionPlan(body, true);
    request.subscribe({
      next: saved => {
        this.planId = saved.id || payload.id || this.planId;
        if (!payload.id && this.planId) this.createdId = this.planId;
        this.lastSent = sent;
        this.savedAt = new Date();
        const untouched = !!this.editedPlan && nutritionContent(this.editedPlan()) === sent;
        this.savedContent.remember(sent);
        this.saving = false;
        // What the client did meanwhile comes from the server: not a change of the coach.
        if (this.clientDaysKept?.(saved) && untouched && this.editedPlan) this.savedContent.remember(nutritionContent(this.editedPlan()));
        if (saved?.endDate) this.savedEnd = String(saved.endDate).slice(0, 10);
        this.scheduleAnnouncer?.((saved as any)?.scheduleChanges, (saved as any)?.scheduleUndoId);

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
        if (this.left) this.discardIfEmptyNew(this.left.assigned);
      },
      error: err => {
        this.saving = false;
        if (isLockedError(err)) {
          this.readOnly = true;
          this.error = this.tr('ASSIGN_FLOW.LOCKED_ERROR', 'This program is finished or was replaced: it can no longer be changed.');
          return;
        }
        // The client did, meanwhile, a day this save moves or removes: nothing is saved, the page must be read again.
        if (err?.error?.code === 'DAY_DONE') {
          this.error = this.tr('PROGRAM_SAVE_DAY_DONE',
            'Your client did a day that you moved or removed in the meantime. Nothing was saved: reload the page to see it, then make your change again.');
          return;
        }
        // A refusal on the day rules (another tab, an older version): same handling as before saving.
        const refused = programDaysError(err);
        if (refused?.code === 'PROGRAM_GAP' && retry) {
          this.openEmptyDays(refused.days, plan.mealDays || [], retry);
          return;
        }
        // Always what to fix and where (the day numbers at least), never a bare « Day 1 has an error ».
        this.error = refused
          ? refusedDaysMessage(refused, (key, params) => this.tr(key, refused.error, params), 'PROGRAM_SERVER_INVALID_DAYS_NUTRITION')
          : err?.error?.message || 'Unable to save the nutrition plan.';
      },
    });
  }

  /**
   * The editor is left (its ngOnDestroy): the plan this visit created with « Continuer » and saved with nothing but its
   * name is deleted again, without a message. Never a plan that existed before, has content, or belongs to a client.
   */
  discardIfEmptyNew(assigned: boolean): void {
    this.left = { assigned };
    // A save on its way: it checks again when it comes back (with what it sent).
    if (assigned || this.saving || !this.createdId || this.lastSent === null) return;
    let sent: { details?: string; days?: MealDay[] };
    try { sent = JSON.parse(this.lastSent); } catch { return; }
    if (!isEmptyNutritionPlan(sent)) return;
    const id = this.createdId;
    this.createdId = null;
    this.service.deleteNutritionPlan(id, true).subscribe({ error: () => undefined });
  }

  /** A nutrition program is 1 to 12 full weeks of 7 days; an older one can have, say, 8 days: what to do, or null. */
  weeksIssue(days: MealDay[] | null | undefined): string | null {
    const count = days?.length || 0;
    // No day at all: the builders never send it, the server answers.
    if (!count || (count % 7 === 0 && count <= 84)) return null;
    return count > 84
      ? this.tr('NUTRITION_WEEKS_TOO_MANY', `This program has ${count} days: 12 weeks (84 days) at most. Shorten it in the settings.`, { count })
      : this.tr('NUTRITION_WEEKS_INCOMPLETE', `This program has ${count} days: a nutrition program is made of full weeks of 7 days. Choose its length in weeks in the settings.`, { count });
  }

  toggleWeek(week: number): void { this.collapsedWeeks.has(week) ? this.collapsedWeeks.delete(week) : this.collapsedWeeks.add(week); }
  allWeeksExpanded(count: number): boolean { return Array.from({ length: count }, (_, i) => i + 1).every(w => !this.collapsedWeeks.has(w)); }
  toggleAllWeeks(count: number): void { if (this.allWeeksExpanded(count)) for (let w = 1; w <= count; w++) this.collapsedWeeks.add(w); else this.collapsedWeeks.clear(); }
  // With the plan's macro mode: a macro plan's day is ready by its targets, not by foods.
  dayState(day: MealDay) { return nutritionDayState(day, this.trackingMode); }
  /** Filled, free, to fix (an error), empty, or empty in the middle of the plan (backlog-programmes.md R3/R4). */
  dayRailState(days: MealDay[], day: MealDay): ProgramDayState | 'GAP' {
    const state = nutritionDayStatus(day, this.trackingMode);
    if (state !== 'EMPTY') return state;
    return days.indexOf(day) + 1 < nutritionSummary(days, this.trackingMode).lastNonEmpty ? 'GAP' : 'EMPTY';
  }
  /** Days the client sees once saved: the filled and free days up to the last filled one. */
  visibleDaysCount(days: MealDay[]): number { return nutritionSummary(days, this.trackingMode).lastNonEmpty; }
  readyCount(days: MealDay[], week: number): number { return days.slice((week - 1) * 7, week * 7).filter(d => ['READY', 'CHEAT'].includes(nutritionDayState(d, this.trackingMode))).length; }
  selectedWeek(days: MealDay[], selected: MealDay | null): number { const index = selected ? days.indexOf(selected) : 0; return Math.max(1, Math.floor(Math.max(index, 0) / 7) + 1); }
  dayDate(day: MealDay): string { if (!day?.date) return ''; const date = new Date(`${day.date}T00:00:00`); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(this.dateLocale(), { weekday: 'short', month: 'short', day: 'numeric' }); }
  weekDates(days: MealDay[], week: number): string { const slice = days.slice((week - 1) * 7, week * 7).filter(d => d.date); if (!slice.length) return ''; const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(this.dateLocale(), { month: 'short', day: 'numeric' }); return `${fmt(slice[0].date)} – ${fmt(slice[slice.length - 1].date)}`; }
  /** A meal without food (or targets) is not shown to the client: the coach is told on the meal itself. */
  mealStatus(meal: Meal): string {
    const state = nutritionMealState(meal, this.trackingMode);
    return state === 'VALID' ? this.tr('MEAL_STATUS_READY', 'Ready')
      : state === 'INCOMPLETE' ? this.tr('PROGRAM_DAY_TO_FIX', 'To fix')
        : this.tr('MEAL_STATUS_EMPTY_HIDDEN', 'Empty · not shown to the client');
  }

  mealHidden(meal: Meal): boolean { return nutritionMealState(meal, this.trackingMode) === 'EMPTY_PLACEHOLDER'; }
  mealToFix(meal: Meal): boolean { return nutritionMealState(meal, this.trackingMode) === 'INCOMPLETE'; }

  /** The first thing to fix in the plan, translated (the day, meal and food named), or null. */
  firstIssue(days: MealDay[] | null | undefined): string | null {
    const issue = firstNutritionIssue(days, this.trackingMode);
    return issue ? this.tr(issue.key, `Day ${issue.params.day} has an error: correct it before saving.`, issue.params) : null;
  }
  copyDay(days: MealDay[], source: MealDay | null): void { if (!source || this.copyTargetIndex === null || !days[this.copyTargetIndex]) return; const target = days[this.copyTargetIndex]; const clone = JSON.parse(JSON.stringify(source)) as MealDay; Object.assign(target, clone, { id: target.id, date: target.date, dayOfWeek: target.dayOfWeek }); }

  private dateLocale(): string {
    const language = this.localeProvider?.() || (typeof document !== 'undefined' ? document.documentElement.lang : '');
    return language.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
  }
}
