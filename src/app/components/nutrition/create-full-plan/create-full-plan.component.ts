import { MacroChartComponent } from '@shared/components/macro-chart/macro-chart.component';
import { CopyDaysModalComponent } from '@shared/program-copy/copy-days-modal.component';
import { ClientProgramDatesComponent } from '@shared/components/client-program-dates/client-program-dates.component';
import { CopiedDayBannerComponent } from '@shared/program-copy/copied-day-banner.component';
import { ProgramDayClipboardService } from '@shared/program-copy/program-day-clipboard.service';
import { nutritionCopyController } from '../nutrition-day-copy';
import { NutritionDraftState, nutritionMealHasContent } from '../nutrition-draft-state';
import { AfterViewChecked, Component, DoCheck, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActiveDayRail } from '@shared/program-calendar/active-day-rail';
import { ProgramStructureRailComponent } from '@shared/program-structure-rail/program-structure-rail.component';
import { nutritionRailWeeks } from '../nutrition-rail';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { LeavesUnsavedChanges, warnBeforeUnload } from '@config/guard/unsaved-changes.guard';
import { NutritionClientMode } from '../nutrition-client-mode';
import { OverlapChoice, ProgramOverflowComponent } from '@shared/components/program-overflow/program-overflow.component';
import { LockedProgramBannerComponent } from '@shared/components/locked-program-banner/locked-program-banner.component';
import { ClientService } from 'app/service/client.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { EmptyDaysModalComponent } from '@shared/components/empty-days-modal/empty-days-modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router, ActivatedRoute } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { ToastService } from 'app/service/toast.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { MealsService } from 'app/service/meals.service';
import { finalize } from 'rxjs/operators';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Food, FoodRef, Meal, MealDay, MealPlan } from '@shared/models/MealPlan';
import { NutritionAiDraft } from 'app/service/nutrition-ai.service';
import { MealTemplatePickerComponent, MealTemplateSelection } from '../meal-template-picker/meal-template-picker.component';
import { MealTimeFieldComponent } from '../meal-time-field/meal-time-field.component';
import { NutritionCalendar } from '../nutrition-calendar';
import { ProgramCalendarComponent } from '@shared/program-calendar/program-calendar.component';
import { DayWindowFootComponent, DayWindowHeadComponent, ViewSwitchComponent } from '@shared/program-calendar/day-window-bars.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { nutritionDayState, nutritionDayValidationMessages } from '@shared/models/nutrition-publication';
import { lineMacros, lineServing } from '@shared/models/nutrition-math';
import { ServingUnitPipe } from '../food-servings/serving-unit.pipe';
import { AddedFood, AddFoodModalComponent } from '../add-food-modal/add-food-modal.component';
import {
  linePortions,
  lineServingIndex,
  lineServingOptions,
  setLinePortions,
  setLineServing,
} from '../food-servings/plan-food-serving';
import { ScaleCaloriesDialogComponent } from '../scale-calories/scale-calories-dialog.component';

@Component({
  selector: 'app-create-full-plan',
  standalone: true,
  imports: [MacroChartComponent, ProgramStructureRailComponent, ProgramCalendarComponent, DayWindowHeadComponent, DayWindowFootComponent, ViewSwitchComponent, CommonModule, FormsModule, FeatherModule, DragDropModule, MealTemplatePickerComponent, MealTimeFieldComponent, TranslateModule, ServingUnitPipe, EmptyDaysModalComponent, AddFoodModalComponent, LockedProgramBannerComponent, ProgramOverflowComponent, CopyDaysModalComponent, CopiedDayBannerComponent, ClientProgramDatesComponent, ScaleCaloriesDialogComponent],
  templateUrl: './create-full-plan.component.html',
  styleUrls: ['./create-full-plan.component.scss', '../_nutrition-builder-template.scss', '../../program-library/_workout-builder-layout.scss', '../../program-library/_plan-edit-dialog.scss', '../_nutrition-rail-parity.scss', '../_nutrition-day-parity.scss', '../_nutrition-foods.scss', '../../program-library/_builder-rail-readable.scss', '../../../shared/program-calendar/_program-calendar-editor.scss', '../../program-library/_builder-rail-active.scss'],
})
export class CreateFullPlanComponent implements OnInit, OnDestroy, DoCheck, AfterViewChecked, LeavesUnsavedChanges {
  /** Phones: the week/day structure opens over the page (same as the workout builder). */
  mobileStructureOpen = false;
  /** Used by the toolbar "Save" (through the empty-days check of the draft state) and to retry after it. */
  readonly savePlanFn = () => this.savePlan();

  draft = new NutritionDraftState(this.nutritionService, this.route, null, () => this.translate.currentLang, this.router, (key, params) => this.translate.instant(key, params));

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
  /** Toutes les durées de 1 à 12 semaines (« Ajouter une semaine » passe de 6 à 7…). */
  readonly durationOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  pendingDurationWeeks: number | null = null;
  pendingDurationRemovedDays = 0;
  collapsedWeeks = new Set<number>();

  trackByDay = (_: number, d: MealDay) => d.id;
  // nutritionWeeks is rebuilt on every change detection: without these, the day buttons were re-created between
  // mousedown and mouseup and a click on another day could be lost.
  trackByWeek = (_: number, week: { weekNumber: number }) => week.weekNumber;
  trackByWeekDay = (_: number, item: { day: MealDay; index: number }) => item.day.id ?? item.index;
  trackByMeal = (_: number, m: Meal) => m.id;
  planId: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService,
    private mealsService: MealsService,
    private translate: TranslateService,
    private toastService: ToastService,
    private dayClipboard: ProgramDayClipboardService,
    private clientService: ClientService,
    public programSchedule: ProgramScheduleService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  /** A client's plan (route `clients/create-full-plan/:idClient`): dates, client, read-only, P9 (ED-02). */
  readonly clientMode = new NutritionClientMode(this.route, this.router, this.clientService, this.programSchedule,
    this.nutritionService, this.toastService, this.translate);
  /** « Copier vers… », « Dupliquer la semaine », « Copier le jour » / « Coller sur… » of the day rail. */
  readonly copy = nutritionCopyController(this, 'nutrition:FOODS', (day) => this.recalcDayTargets(day), this.dayClipboard, this.toastService, this.translate);

  /** Le mode Calendrier, le même que l'éditeur de séances (nutrition-calendar.ts, shared/program-calendar). */
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  readonly cal = new NutritionCalendar(this, this.hostEl, this.translate, this.confirmDialog, this.toastService);
  @ViewChild(ProgramCalendarComponent) set calendarRef(calendar: ProgramCalendarComponent | undefined) {
    this.cal.calendar = calendar;
  }

  /** « Continuer » created the plan: left with nothing but its name, it is deleted again (nutrition-draft-state.ts). */
  ngOnDestroy(): void {
    this.draft.discardIfEmptyNew(this.clientMode.active);
  }

  ngDoCheck(): void {
    this.cal.check();
  }

  /** Le jour ouvert reste visible dans la liste de gauche (défile jusqu'à lui quand il change). */
  private readonly activeDayRail = new ActiveDayRail(() => this.hostEl.nativeElement);

  ngAfterViewChecked(): void {
    this.activeDayRail.follow(this.selectedDay, this.mobileStructureOpen);
  }

  /** La semaine qui contient le jour ouvert (son titre est mis en couleur). */
  weekHasSelectedDay(week: { days: Array<{ day: MealDay }> }): boolean {
    return !!this.selectedDay && week.days.some(item => item.day === this.selectedDay);
  }

  @HostListener('document:keydown.escape')
  onCalendarEscape(): void {
    this.cal.escape();
  }

  /** Les jours ont bougé ou ont été remplacés (calendrier) : les totaux suivent. */
  afterDaysChanged(): void {
    this.mealPlan.mealDays = this.days;
    this.recalcAllDays();
  }

  /** Une petite fenêtre de l'éditeur est ouverte par-dessus la fenêtre du jour. */
  editorWindowOpen(): boolean {
    return this.isTemplateModalOpen || this.isFoodModalOpen;
  }
  @ViewChild(ProgramOverflowComponent) overflow?: ProgramOverflowComponent;

  /** « Décaler » or « Retirer » chosen (P9): the save goes on with it. */
  onOverflowChosen(choice: OverlapChoice): void {
    this.draft.overlap = choice;
    this.savePlanFn();
  }


  get canCreateTemplate(): boolean {
    return this.getCurrentRoles().some((role) =>
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
    this.nutritionService.prefetchPickerFoods();
    this.planId = (this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId'));
    this.durationWeeks = this.normalizeDurationWeeks(
      Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || this.durationWeeks
    );
    this.planName = this.route.snapshot.queryParamMap.get('name') || '';
    this.scheduleStartDate = this.route.snapshot.queryParamMap.get('startDate') || '';
    this.scheduleEndDate = this.route.snapshot.queryParamMap.get('endDate') || '';
    this.clientMode.init(this.draft, () => this.overflow ? this.overflow.askWhenChecked() : false);
    // The same fields as the save.
    this.draft.editedPlan = () => ({ name: this.planName, details: this.planDescription, mealDays: this.days,
      isMealPlanTemplate: this.canCreateTemplate && this.isMealPlanTemplate });

    if (this.planId) {
      this.loadPlanForEdit(this.planId);
    } else {
      this.createInitialDays();
    }

    if (!this.route.snapshot.paramMap.get('id') && !this.route.snapshot.queryParamMap.get('draftId')) {
      // Created from the « Modèles YoCoach » tab by an admin: a YoCoach template from the start (2026-11-20).
      if (this.route.snapshot.queryParamMap.get('template') === '1' && this.canCreateTemplate) this.isMealPlanTemplate = true;
      this.durationWeeks = Math.max(1, Math.min(12, Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || 4));
      this.resizeDraftDays(this.durationWeeks, false);
      const aiDraft = history.state?.aiDraft as NutritionAiDraft | undefined;
      if (aiDraft?.plan?.mealDays?.length) {
        this.applyAiDraft(aiDraft);
      }
      this.selectedDay = this.days[0] || null;
      this.clientMode.refreshDates(this.days);
      if (aiDraft?.plan?.mealDays?.length) {
        // IA-54: an AI draft is not saved yet: leaving the page asks first, like any unsaved change.
        this.draft.forgetContent();
        return;
      }
      this.draft.rememberContent();
      this.cal.openFromRoute(this.route.snapshot.queryParamMap.get('open'));
      if (this.planName.trim()) this.savePlan();
    }
}

  /** IA-43 / IA-53: the plan comes from the AI, not saved yet (banner and warnings above it). */
  aiDraftShown = false;
  aiWarnings: string[] = [];

  /** IA-43: the AI days replace the empty ones; the first « Enregistrer » creates the plan. */
  private applyAiDraft(draft: NutritionAiDraft): void {
    // Not handed over again on a reload of this page (the draft was never saved).
    history.replaceState({ ...history.state, aiDraft: null }, '');
    this.planName = draft.plan.name || this.planName;
    this.planDescription = draft.plan.details || '';
    this.days = draft.plan.mealDays;
    this.days.forEach((day) => this.ensureMealUiDefaults(day));
    this.durationWeeks = this.normalizeDurationWeeks(Math.ceil(this.days.length / 7));
    this.aiDraftShown = true;
    this.aiWarnings = draft.warnings || [];
  }

  hasUnsavedChanges(): boolean {
    return this.draft.hasUnsavedChanges();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    warnBeforeUnload(event, this);
  }

  private normalizeDurationWeeks(value: number): number {
    return Math.max(1, Math.min(Number(value) || 4, 12));
  }

  private createInitialDays(): void {
    const totalDays = this.durationWeeks * 7;
    for (let index = 0; index < totalDays; index++) {
      this.addDay();
    }
    this.selectedDay = this.days[0] || null;
  }

  /** Semaines et jours de « Structure du programme » (même composant que l'éditeur de séances). */
  get railWeeks() {
    return nutritionRailWeeks(this.draft, this.days, this.nutritionWeeks, this.translate);
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
    this.cal
      .readPlan(id, () => this.nutritionService.getNutritionPlanById(id, this.cal.embedded))
      .subscribe((plan: MealPlan) => {
        this.draft.load(plan);
        this.mealPlan = plan;
        this.planName = plan.name;
        this.planDescription = plan.details || '';
        this.isMealPlanTemplate = this.canCreateTemplate
          ? Boolean((plan as any).isMealPlanTemplate)
          : false;
        this.days = plan.mealDays || [];
        this.clientMode.load(plan, this.days, () => this.makeEmptyDay());
        this.days.forEach((day) => this.ensureMealUiDefaults(day));
        this.hydrateMissingFoodImages();
        // Not full weeks (an older program): no length preselected, so that choosing one resizes it.
        this.durationWeeks = this.days.length % 7 ? 0 : this.normalizeDurationWeeks(Math.ceil((this.days.length || 28) / 7));
        this.selectedDay = this.clientMode.requestedDay(this.days) || this.days[0] || null;
        this.draft.collapsedWeeks.delete(this.draft.selectedWeek(this.days, this.selectedDay));

        this.recalcAllDays();
        this.draft.rememberContent();
        this.cal.openFromRoute(this.route.snapshot.queryParamMap.get('open'));
      });
  }

  /* ============================================
            DAY HANDLING
  ==============================================*/

  getDayLabel(day: MealDay, index: number) {
    return this.translate.instant('DAY_NUMBER', { number: index + 1 });
  }

  getSelectedDayLabel() {
    if (!this.selectedDay) return this.translate.instant('DAY_NUMBER', { number: 1 });
    return this.getDayLabel(
      this.selectedDay,
      this.days.indexOf(this.selectedDay)
    );
  }

  displayMealName(meal: Meal, index: number): string {
    return /^(Meal \d+|New Meal)$/.test(meal.name || '')
      ? this.translate.instant('MEAL_NUMBER', { number: index + 1 })
      : meal.name;
  }

  private makeEmptyMeal(index = 0): Meal {
    return {
      id: this.newLocalId(),
      name: 'New Meal',
      mealTime: '',
      mealTargets: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      foods: [],
    };
  }

  private ensureMealUiDefaults(day: MealDay): void {
    day.meals = day.meals || [];
    day.meals.forEach((meal, index) => {
      meal.id = meal.id || this.newLocalId();
      meal.name = meal.name || `Meal ${index + 1}`;
      meal.mealTime = meal.mealTime || '';
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
    this.clientMode.refreshDates(this.days);
  }

  onDurationWeeksChange(value: number) {
    const nextWeeks = this.normalizeDurationWeeks(value);
    const currentWeeks = this.normalizeDurationWeeks(Math.ceil((this.days.length || 1) / 7));
    const targetDays = nextWeeks * 7;
    const selectedId = this.selectedDay?.id;

    if (targetDays < this.days.length) {
      this.pendingDurationWeeks = nextWeeks;
      this.pendingDurationRemovedDays = this.days.length - targetDays;
      this.durationWeeks = this.days.length % 7 ? 0 : currentWeeks;
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

  // ---------- « Modifier le programme » (programme déjà créé : plus de carte de réglages) ----------

  planEditOpen = false;
  planEdit = { name: '', details: '', weeks: 1, visible: false };
  planEditError = '';
  /** La durée réduite attend la confirmation (jours retirés) avant l'enregistrement. */
  private saveAfterDuration = false;

  /** Ouvre la fenêtre avec les valeurs actuelles : rien ne change tant que le coach n'enregistre pas. */
  openPlanEdit() {
    this.planEdit = {
      name: this.planName || '',
      details: this.planDescription || '',
      weeks: this.durationWeeks,
      visible: !!this.isMealPlanTemplate,
    };
    this.planEditError = '';
    this.planEditOpen = true;
    setTimeout(() => document.getElementById('pePlanName')?.focus());
  }

  closePlanEdit() {
    this.planEditOpen = false;
  }

  savePlanEdit() {
    const name = (this.planEdit.name || '').trim();
    if (!name) {
      this.planEditError = 'PLAN_EDIT_NAME_REQUIRED';
      document.getElementById('pePlanName')?.focus();
      return;
    }
    this.planName = name;
    this.planDescription = (this.planEdit.details || '').trim();
    this.showPlanDescription = !!this.planDescription;
    if (this.canCreateTemplate && !this.clientMode.active) this.isMealPlanTemplate = this.planEdit.visible;
    this.planEditOpen = false;

    const weeks = Number(this.planEdit.weeks);
    if (weeks && weeks !== this.durationWeeks) {
      this.onDurationWeeksChange(weeks);
      // Moins de semaines : la confirmation des jours retirés s'affiche, l'enregistrement suit sa réponse.
      if (this.pendingDurationWeeks) {
        this.saveAfterDuration = true;
        return;
      }
    }
    this.draft.saveDraft(this.days, this.savePlanFn);
  }

  /** Après « Supprimer les jours » ou « Annuler » de la confirmation, le reste de la fenêtre est enregistré. */
  afterDurationChoice() {
    if (!this.saveAfterDuration) return;
    this.saveAfterDuration = false;
    this.draft.saveDraft(this.days, this.savePlanFn);
  }

  confirmDurationReduction() {
    if (!this.pendingDurationWeeks) return;
    const nextWeeks = this.pendingDurationWeeks;
    const targetDays = nextWeeks * 7;
    const selectedId = this.selectedDay?.id;

    this.days = this.days.slice(0, targetDays);
    this.clientMode.refreshDates(this.days);
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

  /** ⧉ d'une semaine (colonne de gauche) : elle devient la semaine choisie, puis la fenêtre « Dupliquer la semaine » s'ouvre. */
  duplicateWeek(week: { days: Array<{ day: MealDay }> }, ev?: Event) {
    ev?.stopPropagation();
    const days = (week?.days || []).map((item) => item.day);
    if (!days.length) return;
    if (!days.includes(this.selectedDay as MealDay)) this.selectDay(days[0]);
    this.copy.openWeek();
  }


  selectDay(day: MealDay) {
    this.selectedDay = day;
    // Sa semaine s'ouvre dans la liste de gauche, pour qu'on voie où on est.
    this.draft.collapsedWeeks.delete(this.draft.selectedWeek(this.days, day));
  }

  deleteDay(day: MealDay, e: Event) {
    e.stopPropagation();
    if (this.days.length <= 1) return;

    const index = this.days.indexOf(day);
    this.days.splice(index, 1);
    this.selectedDay = this.days[Math.max(0, index - 1)] || null;
    this.clientMode.refreshDates(this.days);

    this.recalcAllDays();
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    if (this.draft.readOnly) return;
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.clientMode.refreshDates(this.days);
  }

  onDropMeal(event: CdkDragDrop<Meal[]>) {
    if (!this.selectedDay) return;
    moveItemInArray(this.selectedDay.meals, event.previousIndex, event.currentIndex);
    this.recalcDayTargets(this.selectedDay);
  }

  /* A food of a meal: number of servings of one of its units, as in the Add Food modal (macros follow). */
  readonly servingOptions = lineServingOptions;
  readonly servingIndex = lineServingIndex;
  readonly foodPortions = linePortions;

  onFoodPortionsChange(food: Food, meal: Meal, portions: unknown): void {
    if (this.isRecipeMeal(meal)) return; // a recipe changes by its servings only
    if (setLinePortions(food, portions)) this.onFoodLineChange(meal);
  }

  onFoodServingChange(food: Food, meal: Meal, index: string): void {
    if (this.isRecipeMeal(meal)) return;
    const serving = lineServingOptions(food)[Number(index)];
    if (setLineServing(food, serving, this.translate.instant('FOOD_UNIT_PIECE'))) this.onFoodLineChange(meal);
  }

  private onFoodLineChange(meal: Meal): void {
    this.recalcMealTargets(meal);
    if (this.selectedDay) {
      this.recalcDayTargets(this.selectedDay);
    }
  }

  removeFood(food: Food, meal: Meal) {
    if (this.isRecipeMeal(meal)) return;
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
    this.clientMode.refreshDates(this.days);
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

  async removeMeal(meal: Meal) {
    const day = this.selectedDay;
    if (!day) return;
    // A meal with foods or macros: asked first; an empty one goes at once.
    if (nutritionMealHasContent(meal)) {
      const confirmed = await this.confirmDialog.ask({
        title: 'DELETE_MEAL_ASK_TITLE',
        text: 'DELETE_MEAL_ASK_TEXT',
        params: { name: this.displayMealName(meal, Math.max(day.meals.indexOf(meal), 0)) },
        confirm: 'DELETE',
        icon: 'trash-2',
      });
      if (!confirmed || !day.meals.includes(meal)) return;
    }
    day.meals = day.meals.filter(
      (m) => m.id !== meal.id
    );
    this.recalcDayTargets(day);
  }

  renameMeal(meal: Meal, newName: string) {
    meal.name = newName.trim() || meal.name;
  }

  renamingMeal: Meal | null = null;
  mealNameDraft = '';

  promptRenameMeal(meal: Meal): void {
    this.renamingMeal = meal;
    this.mealNameDraft = meal.name;
  }

  closeRenameMealModal(): void {
    this.renamingMeal = null;
    this.mealNameDraft = '';
  }

  confirmRenameMeal(): void {
    if (!this.renamingMeal || !this.mealNameDraft.trim()) return;
    this.renameMeal(this.renamingMeal, this.mealNameDraft);
    this.closeRenameMealModal();
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
    const multiplier = Math.max(1, Math.round((Number(selection.servings) || 1) * 2) / 2);
    // A library recipe lists its quantities for its own servings (its yield): scaled to the servings chosen.
    const yieldServings = Number(source.servings) > 0 ? Number(source.servings) : 1;
    const factor = multiplier / yieldServings;
    const cloned: Meal = JSON.parse(JSON.stringify(source));
    cloned.id = this.newLocalId();
    cloned.servings = multiplier;
    cloned.draft = false;
    cloned.foods = (source.foods || []).map((food: any) => {
      const copy: any = JSON.parse(JSON.stringify(food));
      copy.id = this.newLocalId();
      copy.quantity = this.multiplyNumber(
        food.quantity ?? lineServing(food)?.size ?? 100,
        factor,
      );

      // Manual ingredient macros are stored as totals, so they must also scale.
      if (food.manual || !food.foodRef) {
        copy.calories = this.multiplyNullable(food.calories, factor);
        copy.protein = this.multiplyNullable(food.protein, factor);
        copy.carbohydrates = this.multiplyNullable(food.carbohydrates ?? food.carbs, factor);
        copy.fat = this.multiplyNullable(food.fat, factor);
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
        || cloned.mealTime || '';
      this.selectedDay.meals.splice(targetIndex, 1, cloned);
    } else {
      cloned.mealTime = cloned.mealTime || '';
      this.selectedDay.meals.push(cloned);
    }

    this.recalcMealTargets(cloned);
    this.recalcDayTargets(this.selectedDay);
    this.hydrateMissingFoodImages(cloned.foods || []);
    // The picker stays open: the coach can add several meals. Only the first one replaces the meal it was opened on.
    this.templateReplacementMealId = null;
  }

  isEmptyMeal(meal: Meal): boolean {
    return !(meal.foods || []).length;
  }

  isRecipeMeal(meal: Meal): boolean {
    return Boolean(
      meal?.template
      || Number(meal?.totalTimeMinutes) > 0
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
    const type = String(meal.mealType || '').toUpperCase();
    if (type && this.translate.instant(type) !== type) return this.translate.instant(type);
    const value = String(meal.mealType || this.translate.instant('MEAL')).replace(/_/g, ' ').toLowerCase();
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  recipeDescription(meal: Meal): string {
    return (meal.foods || [])
      .map((food) => food.name || food.foodRef?.name)
      .filter(Boolean)
      .slice(0, 5)
      .join(', ');
  }

  /** Meals being saved to the library: a second click while the first save runs is ignored (one template, not two). */
  private readonly savingTemplateMealIds = new Set<string>();

  saveMealAsTemplate(meal: Meal) {
    const key = String(meal.id ?? '');
    if (this.savingTemplateMealIds.has(key)) return;
    // The meal can come from the calendar's day window, not only from the selected day.
    const day = this.days.find((d) => (d.meals || []).includes(meal));
    const index = Math.max(0, (day?.meals || []).indexOf(meal));
    const payload = {
      // « New Meal » / « Meal 1 » are placeholders: the template gets the translated name the coach sees.
      name: this.displayMealName(meal, index) || this.translate.instant('MEAL_NUMBER', { number: index + 1 }),
      mealType: meal.mealType,
      servings: meal.servings || 1,
      totalTimeMinutes: meal.totalTimeMinutes,
      coverImage: meal.coverImage,
      directions: meal.directions || [],
      foods: meal.foods || [],
    };

    this.savingTemplateMealIds.add(key);
    this.mealsService.saveTemplate(payload)
      .pipe(finalize(() => this.savingTemplateMealIds.delete(key)))
      .subscribe({
        next: () => this.toastService.success(this.translate.instant('TEMPLATE_SAVED')),
        error: () => this.toastService.error(this.translate.instant('MEAL_TEMPLATE_SAVE_ERROR')),
      });
  }

  duplicateMealInDay(meal: Meal) {
    if (!this.selectedDay) return;
    const clone: Meal = JSON.parse(JSON.stringify(meal));
    clone.id = this.newLocalId();
    clone.mealTime = '';
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

  /** A recipe keeps its ingredients: only its servings change, every quantity scaled with them. */
  changeRecipeServings(meal: Meal, delta: number): void {
    const from = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
    const to = Math.max(1, Math.min(99, Math.round((from + delta) * 2) / 2));
    if (to === from) return;
    const factor = to / from;
    meal.foods = (meal.foods || []).map((food: any) => {
      const copy: any = { ...food, quantity: this.multiplyNumber(food.quantity ?? lineServing(food)?.size ?? 100, factor) };
      // Manual ingredient macros are stored as totals, so they scale too.
      if (food.manual || !food.foodRef) {
        copy.calories = this.multiplyNullable(food.calories, factor);
        copy.protein = this.multiplyNullable(food.protein, factor);
        copy.carbohydrates = this.multiplyNullable(food.carbohydrates ?? food.carbs, factor);
        copy.fat = this.multiplyNullable(food.fat, factor);
      }
      return copy;
    });
    meal.servings = to;
    this.onFoodLineChange(meal);
  }

  /* ============================================
                FOOD MODAL
  ==============================================*/

  isFoodModalOpen = false;
  mealForModal: Meal | null = null;

  openFoodModal(meal: Meal) {
    if (this.isRecipeMeal(meal)) return;
    this.mealForModal = meal;
    this.isFoodModalOpen = true;
  }

  /** The meal under the Add Food modal's title, named as in the editor (« Repas 2 », not « Meal 2 »). */
  get mealForModalName(): string {
    const meal = this.mealForModal;
    if (!meal) return '';
    const index = (this.selectedDay?.meals || []).indexOf(meal);
    return this.displayMealName(meal, Math.max(index, 0));
  }

  closeFoodModal() {
    this.isFoodModalOpen = false;
    this.mealForModal = null;
  }

  foodImage(food: FoodRef | Food): string {
    const value = food as any;
    return value?.imageUrl
      || value?.image
      || value?.photoUrl
      || value?.foodRef?.imageUrl
      || value?.foodRef?.image
      || value?.foodRef?.photoUrl
      || '';
  }

  private readonly foodImageCache = new Map<string, string>();
  private readonly pendingFoodImages = new Set<string>();

  private hydrateMissingFoodImages(foods?: Food[]): void {
    const candidates = foods || this.days.flatMap((day) =>
      (day.meals || []).flatMap((meal) => meal.foods || [])
    );

    candidates.forEach((food: any) => {
      if (this.foodImage(food) || food?.manual) return;
      const ref = food?.foodRef;
      const foodId = String(food?.foodRefId || ref?.id || (typeof ref === 'string' ? ref : '')).trim();
      if (!foodId) return;

      const cached = this.foodImageCache.get(foodId);
      if (cached) {
        food.imageUrl = cached;
        return;
      }
      if (this.pendingFoodImages.has(foodId)) return;

      this.pendingFoodImages.add(foodId);
      this.nutritionService.getFoodForClient(foodId, true).subscribe({
        next: (detail: any) => {
          const imageUrl = detail?.imageUrl || detail?.image || detail?.photoUrl || '';
          if (imageUrl) {
            this.foodImageCache.set(foodId, imageUrl);
            this.applyFoodImage(foodId, imageUrl);
          }
          this.pendingFoodImages.delete(foodId);
        },
        error: () => {}, // kept as pending: a food without detail is not asked again
      });
    });
  }

  private applyFoodImage(foodId: string, imageUrl: string): void {
    this.days.forEach((day) => (day.meals || []).forEach((meal) =>
      (meal.foods || []).forEach((item: any) => {
        const ref = item?.foodRef;
        const itemId = String(item?.foodRefId || ref?.id || (typeof ref === 'string' ? ref : '')).trim();
        if (itemId === foodId) item.imageUrl = imageUrl;
      })
    ));
  }

  async toggleCheatMeal(): Promise<void> {
    const day = this.selectedDay;
    if (!day) return;
    const question = this.draft.freeDayQuestion(this.days, day);
    if (question && (!(await this.confirmDialog.ask(question)) || this.selectedDay !== day)) return;
    const cheatMeal = !day.cheatMeal;
    day.cheatMeal = cheatMeal;

    if (cheatMeal) {
      day.refeedDay = false;
      day.meals = [];
      day.dayTargets = {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      };
      this.activeMealMenuId = null;
      this.renamingMeal = null;
    }
  }

  /** A food chosen in the shared Add Food modal: added to the meal the modal was opened for. The modal stays open
   *  (keepOpen) for the next food; « Terminé » closes it. */
  onFoodAdded(line: AddedFood): void {
    const meal = this.mealForModal;
    if (!meal) return;
    meal.foods.push({ id: crypto.randomUUID?.() ?? Date.now().toString(), ...line } as Food);
    this.recalcMealTargets(meal);
    if (this.selectedDay) {
      this.recalcDayTargets(this.selectedDay);
    }
  }

  /* ============================================
                MACRO CALCULATIONS
  ==============================================*/

  computeFoodMacros(food: Food) {
    return lineMacros(food);
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
      proteinG: Math.round(m.protein),
      carbsG: Math.round(m.carbs),
      fatG: Math.round(m.fat),
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
      proteinG: Math.round(totals.protein),
      carbsG: Math.round(totals.carbs),
      fatG: Math.round(totals.fat),
    };
  }

  recalcAllDays() {
    this.days.forEach((day) => this.recalcDayTargets(day));
  }

  /** « Adapter les calories » window (nutrition-scale.ts). */
  scaleOpen = false;

  /** The quantities changed: each meal and day total is recomputed as after a quantity typed by the coach. */
  afterScale(days: MealDay[]): void {
    days.forEach((day) => this.recalcDayTargets(day));
    this.scaleOpen = false;
  }

  /* ============================================
                GETTERS
  ==============================================*/

  /** Recipe summary: a macro of the whole meal for one serving (rounded, 0.1 g for grams). */
  perServing(value: number, meal: Meal, decimals = 0): number {
    const servings = Number(meal.servings) > 0 ? Number(meal.servings) : 1;
    const factor = Math.pow(10, decimals);
    return Math.round(((Number(value) || 0) / servings) * factor) / factor;
  }

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

  /** 2026-11-23: « Riz 250 g »: what the coach had planned on a line the client swapped (CE replacedFrom). */
  replacedLabel(food: Food): string {
    const planned = (food as any)?.replacedFrom;
    if (!planned) return '';
    const quantity = Number(planned.quantity);
    const amount = Number.isFinite(quantity) && quantity > 0 ? String(Math.round(quantity * 100) / 100) : '';
    return [planned.name, amount, planned.unit].filter((part) => part !== null && part !== undefined && String(part).trim()).join(' ');
  }


  /* ============================================
                SAVE PLAN
  ==============================================*/

  savePlan() {
    this.draft.error = '';
    if (!this.planName.trim()) {
      this.draft.error = this.translate.instant('NUTRITION_PLAN_NAME_REQUIRED');
      return;
    }

    // The day, meal and food to fix, translated (R2).
    const dayValidation = this.draft.firstIssue(this.days);
    if (dayValidation) {
      this.draft.error = dayValidation;
      return;
    }


    this.days.forEach(day => this.recalcDayTargets(day));
    this.clientMode.refreshDates(this.days);

    const plan = {
      name: this.planName, details: this.planDescription, mealDays: this.days,
      trackingMode: null, coach: { id: this.userId }, client: null,
      startDate: '', endDate: '',
      isMealPlanTemplate: this.canCreateTemplate && this.isMealPlanTemplate,
      ...(this.clientMode.active ? this.clientMode.planFields() : {}),
    } as MealPlan;
    this.draft.save(plan, this.savePlanFn);
  }

  resizeDraftDays(value: number, confirmRemoval = true) {
    const weeks = Math.max(1, Math.min(12, Math.floor(Number(value) || 4)));
    const count = weeks * 7;
    if (count < this.days.length && confirmRemoval && !confirm('Shortening the program will remove the final days. Continue?')) return;
    while (this.days.length < count) this.addDay();
    this.days = this.days.slice(0, count);
    this.clientMode.refreshDates(this.days);
    this.durationWeeks = weeks;
    if (!this.days.includes(this.selectedDay!)) this.selectedDay = this.days[0];
  }

  /** Standard application back action used by the shared Workout/Nutrition header. */
  goBack(): void {
    if (!this.clientMode.goBack()) window.history.back();
  }

  duplicateLocked(): void {
    this.clientMode.duplicateLocked(this.draft.currentPlanId, 'nutrition/create-full-plan/');
  }
}
