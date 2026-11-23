import { DestroyRef, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { closeDayOutlet, inDayOutlet, openFullEditor, startingEditorView } from '@shared/program-calendar/day-outlet';
import { dayWindowPlan, forgetDayWindowPlan } from '@shared/program-calendar/day-window-prefetch';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { mealDayActive } from '@shared/models/client-day-activity';
import { mealLines, plannedMeals } from '@shared/models/calendar-day';
import { MealDay } from '@shared/models/MealPlan';
import { todayIso } from '@shared/models/program-schedule';
import { CalendarDayWindow } from '@shared/program-calendar/day-window';
import { CALENDAR_PREFS } from '@shared/program-calendar/day-window-bars.component';
import { CalendarDayAction, ProgramCalendarComponent } from '@shared/program-calendar/program-calendar.component';
import { CalendarLine, CalendarWeek, buildCalendarWeeks, calendarColumns, isoOf, todayColumn } from '@shared/program-calendar/program-calendar.model';
import { ToastService } from 'app/service/toast.service';
import { nutritionContent, NutritionDraftState } from './nutrition-draft-state';
import { NutritionClientMode } from './nutrition-client-mode';

/** What the calendar needs from one of the three nutrition editors (full plan, macros per meal, macros per day). */
export interface NutritionCalendarEditor {
  days: MealDay[];
  selectedDay: MealDay | null;
  durationWeeks: number;
  readonly draft: NutritionDraftState;
  readonly clientMode: NutritionClientMode;
  readonly copy: { readOnly: boolean; modal: unknown; openDay(): void; openWeek(repeat?: boolean): void };
  readonly savePlanFn: () => void;
  planEditOpen: boolean;
  pendingDurationWeeks: number | null;
  mobileStructureOpen: boolean;
  selectDay(day: MealDay): void;
  onDurationWeeksChange(weeks: number): void;
  toggleCheatMeal(): void | Promise<void>;
  goBack(): void;
  /** After the days were replaced or moved: totals, `mealPlan.mealDays`… (the dates are refreshed here). */
  afterDaysChanged?(): void;
  /** A small window of the editor is open over the day window (food picker, meal templates…). */
  editorWindowOpen?(): boolean;
}

/**
 * The « Calendrier » mode of a nutrition editor, the same as the workout editor's (shared/program-calendar): the
 * weeks and cards, the day window, whole weeks, the ⋮ / ⋯ actions. One per editor, built in its constructor.
 */
export class NutritionCalendar {
  private static readonly COMPACT_KEY = 'yc.nutritionEditor.calendarCompact';
  readonly maxWeeks = 12;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly schedule = inject(ProgramScheduleService);
  /** Opened over the client's profile (outlet « day », day-outlet.ts): only the day window. */
  readonly embedded = inDayOutlet(this.route);
  /** On opening: the coach's choice in Settings › Preferences; the Liste | Calendrier switch is for this visit. */
  viewMode: 'list' | 'calendar' = startingEditorView(this.route, inject(CoachSettingsService));
  detailed = CALENDAR_PREFS.detailed(NutritionCalendar.COMPACT_KEY);
  calendar?: ProgramCalendarComponent<MealDay>;
  private weeksCache: CalendarWeek<MealDay>[] | null = null;
  private unsavedCache: boolean | null = null;

  readonly win: CalendarDayWindow<MealDay>;

  constructor(
    private readonly editor: NutritionCalendarEditor,
    private readonly host: { nativeElement: HTMLElement },
    private readonly translate: TranslateService,
    private readonly confirmDialog: ConfirmDialogService,
    private readonly toast: ToastService,
  ) {
    // Saved from the window over the profile: the next click reads the plan again (day-window-prefetch.ts).
    inject(DestroyRef).onDestroy(() => {
      if (this.embedded && this.editor.draft.savedAt) forgetDayWindowPlan(this.route.snapshot.paramMap.get('id'));
    });
    this.editor.draft.clientDaysKept = (saved) => this.takeClientDays(saved?.mealDays);
    this.win = new CalendarDayWindow<MealDay>({
      days: () => this.editor.days,
      selected: () => this.editor.selectedDay,
      select: (day) => this.select(day),
      content: () => this.content(),
      restore: (days) => this.restore(days),
      save: () => this.editor.draft.saveDraft(this.editor.days, this.editor.savePlanFn),
      saving: () => this.editor.draft.saving,
      unsaved: () => this.editor.draft.hasUnsavedChanges(),
      readOnly: () => this.editor.draft.readOnly,
      subWindowOpen: () => this.subWindowOpen(),
      closeSubPanels: () => undefined,
      goBack: () => (this.embedded ? this.closeEmbedded() : this.editor.goBack()),
      toList: () => this.showDayInList(),
      t: (key, params) => this.translate.instant(key, params),
      dateLabel: (day) => (this.editor.clientMode.active ? this.editor.draft.dayDate(day) : ''),
      scrollTop: () => setTimeout(() => this.host.nativeElement.querySelector('.np-card--day')?.scrollTo({ top: 0 })),
    });
  }

  ht(en: string, fr: string): string {
    return this.translate.currentLang === 'en' ? en : fr;
  }

  private locale(): string {
    return this.translate.currentLang?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
  }

  /** Once per change detection (the editor's ngDoCheck). */
  check(): void {
    this.weeksCache = null;
    this.unsavedCache = null;
    this.win.check(this.editor.draft.error);
  }

  get unsaved(): boolean {
    return this.unsavedCache ??= this.editor.draft.hasUnsavedChanges();
  }

  get editing(): boolean {
    return this.viewMode === 'calendar' && this.win.open;
  }

  private content(): string {
    return nutritionContent(this.editor.draft.editedPlan ? this.editor.draft.editedPlan() : { mealDays: this.editor.days });
  }

  private select(day: MealDay): void {
    this.editor.selectDay(day);
    this.editor.draft.collapsedWeeks.delete(this.editor.draft.selectedWeek(this.editor.days, day));
  }

  setViewMode(mode: 'list' | 'calendar'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.win.reset();
    this.editor.mobileStructureOpen = false;
  }

  setDetailed(on: boolean): void {
    this.detailed = on;
    CALENDAR_PREFS.setDetailed(NutritionCalendar.COMPACT_KEY, on);
  }

  /** The plan to edit: over the client's profile, the one its week card already read (shown at once). */
  readPlan<T>(id: string, read: () => Observable<T>): Observable<T> {
    return this.embedded ? dayWindowPlan(id, read) : read();
  }

  /** Over the client's profile: back to it as it was, read again if something was saved. */
  closeEmbedded(): void {
    if (this.editor.draft.savedAt) this.schedule.changed$.next();
    closeDayOutlet(this.router);
  }

  private showDayInList(): void {
    const day = this.editor.selectedDay;
    if (this.embedded) {
      openFullEditor(this.router, this.route, this.editor.days.indexOf(day as MealDay) + 1);
      return;
    }
    this.setViewMode('list');
    if (day) this.select(day);
    setTimeout(() => {
      window.scrollTo({ top: 0 });
      this.host.nativeElement.querySelector('.np-day.is-active')?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** Opened from the client's profile on a day (`?day=N&open=1`): its window at once, « Fermer » goes back there. */
  openFromRoute(open: string | null): void {
    if (open !== '1' && !this.embedded) return;
    const day = this.editor.selectedDay;
    if (!day) return;
    if (this.editor.draft.readOnly && !this.embedded) return;
    setTimeout(() => {
      this.viewMode = 'calendar'; // for this visit only: the coach's kept choice does not change
      this.win.returnOnClose = true;
      this.win.openDay(day);
    });
  }

  /** Escape: the day window's question, then the window (a small window over it first). */
  escape(): void {
    this.win.escape();
  }

  private subWindowOpen(): boolean {
    return !!this.editor.copy.modal || this.editor.planEditOpen || !!this.editor.draft.emptyDaysPrompt
      || this.editor.pendingDurationWeeks !== null || !!this.editor.editorWindowOpen?.()
      || !!document.querySelector('.cd-backdrop, .np-planedit');
  }

  /**
   * After a save of a client's plan: the days the client logged while the editor was open. The server kept them as
   * the client did them (never erased by a save); here they become done (and locked), and the coach is told.
   */
  private takeClientDays(saved: MealDay[] | null | undefined): boolean {
    if (!this.editor.clientMode.active) return false;
    const stored = new Map((saved || []).filter((day) => day?.id).map((day) => [day.id, day]));
    const labels: string[] = [];
    this.editor.days.forEach((day, index) => {
      const done = stored.get(day.id) as (MealDay & Record<string, unknown>) | undefined;
      if (!done || !mealDayActive(done) || mealDayActive(day)) return;
      const mine = day as MealDay & Record<string, unknown>;
      for (const field of ['status', 'clientMealLogs', 'hunger', 'energy', 'digestion', 'overallNote']) mine[field] = done[field];
      const date = this.editor.draft.dayDate(day);
      labels.push([this.translate.instant('WEEK_DAY_LABEL', { week: Math.floor(index / 7) + 1, day: (index % 7) + 1 }), date].filter(Boolean).join(' · '));
    });
    if (!labels.length) return false;
    const list = labels.join(', ');
    this.toast.show({
      type: 'info',
      title: this.ht('Your client logged meals while you were editing', 'Votre client a suivi son plan pendant votre modification'),
      message: this.ht(`${list}: kept as your client logged it.`, `${list} : gardé comme votre client l'a noté.`),
      duration: 10000,
    });
    return true;
  }

  // ---------- The weeks and the cards ----------

  get columns(): string[] {
    return calendarColumns({ days: this.editor.days, client: this.editor.clientMode.active, locale: this.locale(),
      iso: (day: MealDay) => isoOf(day.date), t: (k, p) => this.translate.instant(k, p) });
  }

  get todayColumn(): number {
    return todayColumn(this.weeks);
  }

  get weekCount(): number {
    return Math.ceil((this.editor.days.length || 0) / 7);
  }

  get weeks(): CalendarWeek<MealDay>[] {
    return this.weeksCache ??= buildCalendarWeeks<MealDay>({
      kind: 'NUTRITION',
      days: this.editor.days,
      client: this.editor.clientMode.active,
      readOnly: this.editor.draft.readOnly,
      detailed: this.detailed,
      today: todayIso(),
      locale: this.locale(),
      state: (day) => this.editor.draft.dayRailState(this.editor.days, day),
      started: (day) => mealDayActive(day),
      status: (day) => String((day as { status?: string }).status || ''),
      iso: (day) => isoOf(day.date),
      title: (day) => this.title(day),
      meta: (day) => this.meta(day),
      lines: (day) => this.lines(day),
      t: (key, params) => this.translate.instant(key, params),
      ht: (en, fr) => this.ht(en, fr),
    });
  }

  private kcal(value: unknown): string {
    const n = Math.round(Number(value) || 0);
    return n.toLocaleString(this.locale());
  }

  /** « 2 100 kcal », else « Repas ». */
  private title(day: MealDay): string {
    const kcal = Number(day.dayTargets?.calories) || 0;
    return kcal > 0 ? `${this.kcal(kcal)} kcal` : this.ht('Meals', 'Repas');
  }

  /** « 4 repas · P 150 g · G 200 g · L 70 g » */
  private meta(day: MealDay): string {
    const parts: string[] = [];
    // An empty meal is not counted: the client does not see it (backlog-programmes.md R3).
    const meals = plannedMeals(day).length;
    if (meals) parts.push(this.ht(`${meals} meal${meals > 1 ? 's' : ''}`, `${meals} repas`));
    const t = day.dayTargets;
    if (t && (t.proteinG || t.carbsG || t.fatG)) {
      parts.push(this.ht(`P ${Math.round(t.proteinG || 0)} g · C ${Math.round(t.carbsG || 0)} g · F ${Math.round(t.fatG || 0)} g`,
        `P ${Math.round(t.proteinG || 0)} g · G ${Math.round(t.carbsG || 0)} g · L ${Math.round(t.fatG || 0)} g`));
    }
    return parts.join(' · ');
  }

  /** One line per meal: its name, its calories, its foods. */
  private lines(day: MealDay): CalendarLine[] {
    return mealLines(day).map((meal) => ({
      label: '',
      name: (/^(Meal \d+|New Meal)$/.test(meal.name) || !meal.name ? this.translate.instant('MEAL_NUMBER', { number: meal.number }) : meal.name)
        + (meal.kcal ? ` · ${this.kcal(meal.kcal)} kcal` : ''),
      detail: meal.foods.join(', '),
    }));
  }

  // ---------- Actions of the calendar ----------

  onDayAction(event: { type: CalendarDayAction; day: MealDay }): void {
    this.select(event.day);
    if (event.type === 'copy') this.editor.copy.openDay();
    else if (event.type === 'rest') this.editor.toggleCheatMeal();
  }

  /** `repeat`: « Répéter sur les semaines suivantes » (the same window, every week after this one chosen). */
  onDuplicateWeek(week: CalendarWeek<MealDay>, repeat = false): void {
    if (!week.days.includes(this.editor.selectedDay as MealDay)) this.select(week.days[0]);
    this.editor.copy.openWeek(repeat);
  }

  /** The days moved or were replaced: numbers, dates and totals follow. */
  private renumber(): void {
    this.editor.days.forEach((day, index) => (day.dayOfWeek = `Day ${index + 1}`));
    this.editor.clientMode.refreshDates(this.editor.days);
    this.editor.afterDaysChanged?.();
  }

  /** « Ajouter une semaine »: 7 empty days at once, the duration follows (an incomplete week is completed first). */
  addWeek(): void {
    if (this.editor.draft.readOnly) return;
    const before = this.editor.days.length;
    const weeks = before % 7 ? this.weekCount : this.weekCount + 1;
    if (weeks > this.maxWeeks) return;
    const selected = this.editor.selectedDay;
    this.editor.onDurationWeeksChange(weeks);
    const first = this.editor.days[before];
    if (!first) {
      if (selected) this.editor.selectDay(selected);
      return;
    }
    this.select(first);
    if (this.viewMode === 'calendar') this.calendar?.scrollToWeek(Math.floor(before / 7) + 1);
    else setTimeout(() => this.host.nativeElement.querySelector('.np-day.is-active')?.scrollIntoView({ block: 'nearest' }));
  }

  /** « Supprimer la semaine »: its days go, the next weeks move up; always asked first. */
  async deleteWeek(weekNumber: number): Promise<void> {
    if (this.editor.draft.readOnly || this.weekCount <= 1) return;
    const start = (weekNumber - 1) * 7;
    const removed = this.editor.days.slice(start, start + 7);
    if (!removed.length) return;
    const week = this.weeks[weekNumber - 1];
    if (week?.cells.some((cell) => cell.locked)) {
      this.toast.show({
        type: 'warning',
        title: this.ht('This week cannot be deleted', 'Cette semaine ne peut pas être supprimée'),
        message: this.ht('It has past days or days the client already started.', 'Elle a des jours passés ou déjà commencés par le client.'),
      });
      return;
    }
    const filled = week?.filled ?? 0;
    const confirmed = await this.confirmDialog.ask({
      title: this.ht(`Delete week ${weekNumber}?`, `Supprimer la semaine ${weekNumber} ?`),
      text: filled
        ? this.ht(`Its ${filled} filled day(s) will be removed. The next weeks move up.`, `Ses ${filled} jour(s) rempli(s) seront retirés. Les semaines suivantes remontent.`)
        : this.ht('The next weeks move up.', 'Les semaines suivantes remontent.'),
      confirm: 'DELETE',
      icon: 'trash-2',
    });
    if (!confirmed || this.editor.days[start] !== removed[0]) return;
    this.editor.days.splice(start, removed.length);
    if (!this.editor.days.includes(this.editor.selectedDay as MealDay)) this.editor.selectDay(this.editor.days[Math.min(start, this.editor.days.length - 1)]);
    this.editor.durationWeeks = this.weekCount;
    this.renumber();
  }

  /** A card dropped on another day: the two days swap (« Annuler » puts them back). */
  onSwap(event: { from: MealDay; to: MealDay }): void {
    if (!this.swap(event.from, event.to)) return;
    this.toast.show({
      type: 'success',
      title: this.ht('Days swapped', 'Jours échangés'),
      message: this.ht('Not saved yet: click Save.', 'Pas encore enregistré : cliquez sur Enregistrer.'),
      duration: 8000,
      actions: [{ label: this.translate.instant('COPY_DAYS.UNDO'), run: () => this.swap(event.from, event.to), icon: 'fa-undo' }],
    });
  }

  private swap(a: MealDay, b: MealDay): boolean {
    const days = this.editor.days;
    const ia = days.indexOf(a);
    const ib = days.indexOf(b);
    if (ia < 0 || ib < 0 || ia === ib) return false;
    days[ia] = b;
    days[ib] = a;
    this.renumber();
    return true;
  }

  /** « Abandonner les changements »: the days as when the window opened. */
  private restore(days: MealDay[]): void {
    const index = Math.max(0, this.editor.days.indexOf(this.editor.selectedDay as MealDay));
    this.editor.days = days;
    this.editor.durationWeeks = this.editor.days.length % 7 ? 0 : this.weekCount;
    this.editor.selectDay(this.editor.days[Math.min(index, this.editor.days.length - 1)]);
    this.renumber();
  }
}
