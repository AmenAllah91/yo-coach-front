import { MacroChartComponent } from '@shared/components/macro-chart/macro-chart.component';
import { CopyDaysModalComponent } from '@shared/program-copy/copy-days-modal.component';
import { ClientProgramDatesComponent } from '@shared/components/client-program-dates/client-program-dates.component';
import { CopiedDayBannerComponent } from '@shared/program-copy/copied-day-banner.component';
import { ProgramDayClipboardService } from '@shared/program-copy/program-day-clipboard.service';
import { nutritionCopyController } from '../nutrition-day-copy';
import { NutritionDraftState } from '../nutrition-draft-state';
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
import { ToastService } from 'app/service/toast.service';
import { EmptyDaysModalComponent } from '@shared/components/empty-days-modal/empty-days-modal.component';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { NutritionService } from 'app/service/nutrition.service';
import { NutritionCalendar } from '../nutrition-calendar';
import { ProgramCalendarComponent } from '@shared/program-calendar/program-calendar.component';
import { DayWindowFootComponent, DayWindowHeadComponent, ViewSwitchComponent } from '@shared/program-calendar/day-window-bars.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ScaleCaloriesDialogComponent } from '../scale-calories/scale-calories-dialog.component';

@Component({
  selector: 'app-create-macro-plan-total-day',
  standalone: true,
  imports: [MacroChartComponent, ProgramStructureRailComponent, ProgramCalendarComponent, DayWindowHeadComponent, DayWindowFootComponent, ViewSwitchComponent,
    ScaleCaloriesDialogComponent,
    FeatherModule,
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    DragDropModule,
    TranslateModule,
    EmptyDaysModalComponent, LockedProgramBannerComponent, ProgramOverflowComponent, CopyDaysModalComponent, CopiedDayBannerComponent, ClientProgramDatesComponent],
  templateUrl: './create-macro-plan-total-day.component.html',
  styleUrls: ['./create-macro-plan-total-day.component.scss', '../_nutrition-builder-template.scss', '../../program-library/_workout-builder-layout.scss', '../../program-library/_plan-edit-dialog.scss', '../_nutrition-rail-parity.scss', '../_nutrition-day-parity.scss', '../../program-library/_builder-rail-readable.scss', '../../../shared/program-calendar/_program-calendar-editor.scss', '../../program-library/_builder-rail-active.scss'],
})
export class CreateMacroPlanTotalDayComponent implements OnInit, OnDestroy, DoCheck, AfterViewChecked, LeavesUnsavedChanges {
  /** Phones: the week/day structure opens over the page (same as the workout builder). */
  mobileStructureOpen = false;
  /** Used by the toolbar "Save" (through the empty-days check of the draft state) and to retry after it. */
  readonly savePlanFn = () => this.savePlan();

  draft = new NutritionDraftState(this.nutritionService, this.route, 'TOTAL_FOR_DAY', () => this.translate.currentLang, this.router, (key, params) => this.translate.instant(key, params));

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
  /** Toutes les durées de 1 à 12 semaines (« Ajouter une semaine » passe de 6 à 7…). */
  readonly durationOptions = Array.from({ length: 12 }, (_, i) => i + 1);
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
    private translate: TranslateService,
    private clientService: ClientService,
    private toastService: ToastService,
    private dayClipboard: ProgramDayClipboardService,
    public programSchedule: ProgramScheduleService,
    private confirmDialog: ConfirmDialogService,
  ) {}

  /** A client's plan (route `clients/create-macro-plan-total-day/:idClient`): dates, client, read-only, P9 (backlog-programmes.md ED). */
  readonly clientMode = new NutritionClientMode(this.route, this.router, this.clientService, this.programSchedule,
    this.nutritionService, this.toastService, this.translate);
  /** « Copier vers… », « Dupliquer la semaine », « Copier le jour » / « Coller sur… » of the day rail. */
  readonly copy = nutritionCopyController(this, 'nutrition:DAY_MACROS', (day) => this.updateCaloriesForDay(day), this.dayClipboard, this.toastService, this.translate);

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
    this.days.forEach((day) => this.updateCaloriesForDay(day));
  }

  /** Une petite fenêtre de l'éditeur est ouverte par-dessus la fenêtre du jour. */
  editorWindowOpen(): boolean {
    return false;
  }
  @ViewChild(ProgramOverflowComponent) overflow?: ProgramOverflowComponent;

  /** « Décaler » or « Retirer » chosen (P9): the save goes on with it. */
  onOverflowChosen(choice: OverlapChoice): void {
    this.draft.overlap = choice;
    this.savePlanFn();
  }

  duplicateLocked(): void {
    this.clientMode.duplicateLocked(this.draft.currentPlanId, 'nutrition/create-macro-plan-total-day/');
  }

  dayLabel(index: number): string { return this.translate.instant('DAY_NUMBER', { number: index + 1 }); }


  get canCreateTemplate(): boolean {
    const roles = this.getCurrentRoles();

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
    const planId = (this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('draftId'));
    const type = this.route.snapshot.queryParamMap.get('type');
    this.durationWeeks = this.normalizeDurationWeeks(
      Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || this.durationWeeks
    );
    this.planName = this.route.snapshot.queryParamMap.get('name') || '';
    this.scheduleStartDate = this.route.snapshot.queryParamMap.get('startDate') || '';
    this.scheduleEndDate = this.route.snapshot.queryParamMap.get('endDate') || '';
    this.isEditMode = !!planId;
    this.clientMode.init(this.draft, () => this.overflow ? this.overflow.askWhenChecked() : false);
    // The same fields as the save.
    this.draft.editedPlan = () => ({ name: this.planName, details: this.planDescription, mealDays: this.days,
      isMealPlanTemplate: this.canCreateTemplate && this.isMealPlanTemplate });

    if (planId) {
      this.cal.readPlan(planId, () => this.nutritionService.getNutritionPlanById(planId, this.cal.embedded)).subscribe((plan) => {
        this.draft.load(plan);
        this.planName = plan.name;
        this.planDescription = plan.details;
      this.isMealPlanTemplate = this.canCreateTemplate
        ? Boolean((plan as any).isMealPlanTemplate)
        : false;
      this.days = plan.mealDays || [];
      this.clientMode.load(plan, this.days, () => this.emptyClientDay());
      // Not full weeks (an older program): no length preselected, so that choosing one resizes it.
      this.durationWeeks = this.days.length % 7 ? 0 : this.normalizeDurationWeeks(Math.ceil((this.days.length || 28) / 7));

        // Recalcul calories si nécessaire
        this.days.forEach((d) => this.updateCaloriesForDay(d));

        this.selectedDay = this.clientMode.requestedDay(this.days) || this.days[0] || null;
        this.draft.collapsedWeeks.delete(this.draft.selectedWeek(this.days, this.selectedDay));
        this.draft.rememberContent();
        this.cal.openFromRoute(this.route.snapshot.queryParamMap.get('open'));
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

    if (!this.route.snapshot.paramMap.get('id') && !this.route.snapshot.queryParamMap.get('draftId')) {
      // Created from the « Modèles YoCoach » tab by an admin: a YoCoach template from the start (2026-11-20).
      if (this.route.snapshot.queryParamMap.get('template') === '1' && this.canCreateTemplate) this.isMealPlanTemplate = true;
      this.durationWeeks = Math.max(1, Math.min(12, Number(this.route.snapshot.queryParamMap.get('durationWeeks')) || 4));
      this.resizeDraftDays(this.durationWeeks, false);
      this.selectedDay = this.days[0] || null;
      this.clientMode.refreshDates(this.days);
      this.draft.rememberContent();
      this.cal.openFromRoute(this.route.snapshot.queryParamMap.get('open'));
      if (this.planName.trim()) this.savePlan();
    }
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

  /* ----------------------------------------------
      CALCUL AUTOMATIQUE DES CALORIES
  ------------------------------------------------*/
  /** « Jour libre »: no targets that day (the client sees a free day). */
  async toggleCheatMeal(): Promise<void> {
    const day = this.selectedDay;
    if (!day || this.draft.readOnly) return;
    const question = this.draft.freeDayQuestion(this.days, day);
    if (question && (!(await this.confirmDialog.ask(question)) || this.selectedDay !== day)) return;
    const cheatMeal = !day.cheatMeal;
    day.cheatMeal = cheatMeal;
    if (cheatMeal) {
      day.refeedDay = false;
      day.dayTargets = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    }
  }

  updateCaloriesForDay(day: MealDay) {
    if (!day || !day.dayTargets) return;

    const p = day.dayTargets.proteinG || 0;
    const c = day.dayTargets.carbsG || 0;
    const f = day.dayTargets.fatG || 0;

    day.dayTargets.calories = p * 4 + c * 4 + f * 9;
  }

  /** « Adapter les calories » window (nutrition-scale.ts). */
  scaleOpen = false;

  /** P/C/F scaled to the gram: the kcal of each day follow, as when the coach types them. */
  afterScale(days: MealDay[]): void {
    days.forEach((day) => this.updateCaloriesForDay(day));
    this.scaleOpen = false;
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
  this.clientMode.refreshDates(this.days);
}

  /** An empty day added to an older client plan, up to its saved end. */
  private emptyClientDay(): MealDay {
    const day: MealDay = { id: crypto.randomUUID(), date: '', dayOfWeek: `Day ${this.days.length + 1}`, cheatMeal: false, refeedDay: false,
      meals: [], dayTargets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } };
    (day as any).name = day.dayOfWeek;
    return day;
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
  this.days.forEach((day, index) => {
    (day as any).name = `Day ${index + 1}`;
    day.dayOfWeek = `Day ${index + 1}`;
    this.updateCaloriesForDay(day);
  });
  this.selectedDay = this.days.find((day) => day.id === selectedId) || this.days[0] || null;
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
    this.clientMode.refreshDates(this.days);
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
      this.clientMode.refreshDates(this.days);
    }
  }

  onDropDay(event: CdkDragDrop<MealDay[]>) {
    if (this.draft.readOnly) return;
    moveItemInArray(this.days, event.previousIndex, event.currentIndex);
    this.days.forEach((d, i) => {
      (d as any).name = `Day ${i + 1}`;
      d.dayOfWeek = `Day ${i + 1}`;
    });
    this.clientMode.refreshDates(this.days);
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
    this.draft.error = '';
    if (!this.planName.trim()) {
      this.draft.error = this.translate.instant('NUTRITION_PLAN_NAME_REQUIRED');
      return;
    }
    // The day and meal to fix, translated, before sending (R2), as the plan of foods does; an empty meal never blocks.
    const dayValidation = this.draft.firstIssue(this.days);
    if (dayValidation) {
      this.draft.error = dayValidation;
      return;
    }
    // Whole grams: MacroTargets is an Integer on CE (a typed 12.5 was cut to 12 by the server, not rounded).
    this.days.forEach(day => {
      const t = day.dayTargets;
      if (!t) return;
      t.proteinG = Math.round(Number(t.proteinG) || 0);
      t.carbsG = Math.round(Number(t.carbsG) || 0);
      t.fatG = Math.round(Number(t.fatG) || 0);
    });
    this.days.forEach(day => this.updateCaloriesForDay(day));
    this.clientMode.refreshDates(this.days);

    const plan = {
      name: this.planName, details: this.planDescription, mealDays: this.days,
      trackingMode: 'TOTAL_FOR_DAY', coach: { id: this.userid }, client: null,
      startDate: '', endDate: '',
      isMealPlanTemplate: this.canCreateTemplate && this.isMealPlanTemplate,
      ...(this.clientMode.active ? this.clientMode.planFields() : {}),
    } as MealPlan;
    this.draft.save(plan, this.savePlanFn);
  }

  updatePlan() { this.savePlan(); }

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
}
