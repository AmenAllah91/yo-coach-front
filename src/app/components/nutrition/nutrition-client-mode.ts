import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Client, ClientService } from 'app/service/client.service';
import { NutritionService } from 'app/service/nutrition.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ToastService } from 'app/service/toast.service';
import { MealDay, MealPlan } from '@shared/models/MealPlan';
import { addDaysIso, daysBetween, todayIso } from '@shared/models/program-schedule';
import { mealDayActive } from '@shared/models/client-day-activity';
import { NutritionDraftState } from './nutrition-draft-state';

/**
 * A client's nutrition plan opened in a library builder (backlog-programmes.md ED-02..04), when the route has the
 * client (`clients/create-…/:idClient`): each day has its date, the plan is saved with its client and its dates, the
 * changes on the client's calendar are said after the save, and « Back » returns to the client's nutrition tab.
 * Without the client in the route, nothing here does anything (a library plan).
 */
export class NutritionClientMode {
  readonly clientId: string | null;
  client: Client | null = null;
  startDate = todayIso();
  endDate = '';
  duplicating = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clients: ClientService,
    private schedule: ProgramScheduleService,
    private nutrition: NutritionService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {
    this.clientId = route.snapshot.paramMap.get('idClient');
  }

  get active(): boolean {
    return !!this.clientId;
  }

  get clientName(): string {
    return this.client ? `${this.client.firstName || ''} ${this.client.lastName || ''}`.trim() : '';
  }

  /** The client's name, the start chosen in the creation window (A2), and what the draft says after a save. */
  init(draft: NutritionDraftState, overlapGuard: () => boolean | Promise<boolean>): void {
    if (!this.clientId) return;
    this.startDate = this.route.snapshot.queryParamMap.get('startDate') || this.startDate;
    draft.scheduleAnnouncer = (changes, undoId) => this.schedule.announceChanges(changes, this.clientName, undoId);
    draft.overlapGuard = overlapGuard;
    this.clients.getClientById(this.clientId, true).subscribe({
      next: client => (this.client = client),
      error: () => (this.client = null),
    });
  }

  /** A loaded plan: its start, and empty days up to its saved end (older plans could have fewer days than dates). */
  load(plan: MealPlan, days: MealDay[], emptyDay: () => MealDay): void {
    if (!this.clientId) return;
    if (plan.startDate) this.startDate = String(plan.startDate).slice(0, 10);
    const end = plan.endDate ? String(plan.endDate).slice(0, 10) : '';
    const expected = end && end >= this.startDate ? daysBetween(this.startDate, end) + 1 : 0;
    while (days.length < expected) days.push(emptyDay());
    this.refreshDates(days);
  }

  /**
   * Each day's date from the start, in the order of the days. The other fields stay as the builder sets them: the
   * same days as a library plan assigned to the client.
   */
  refreshDates(days: MealDay[]): void {
    if (!this.clientId || !this.startDate) return;
    days.forEach((day, index) => {
      day.date = addDaysIso(this.startDate, index);
      (day as MealDay & { dayNumber?: number }).dayNumber = index + 1;
    });
    this.endDate = days.length ? addDaysIso(this.startDate, days.length - 1) : this.startDate;
  }

  /** The client did something in the plan: its dates no longer move (« Modifier les dates », rule D1). */
  started(days: MealDay[]): boolean {
    return this.active && days.some((day) => mealDayActive(day));
  }

  /** New dates from « Modifier les dates » (or its « Annuler »): the days follow, the server already has them. */
  moved(start: string, days: MealDay[], draft: NutritionDraftState): void {
    if (!this.clientId) return;
    this.startDate = start;
    this.refreshDates(days);
    draft.savedEnd = this.endDate || null;
  }

  /** What a client plan is saved with, on top of its days (never a library template). */
  planFields(): Partial<MealPlan> & { isMealPlanTemplate: boolean } {
    return {
      client: this.client ?? ({ id: this.clientId } as any),
      startDate: this.startDate,
      endDate: this.endDate,
      isMealPlanTemplate: false,
    };
  }

  /** The day asked by the address (`?day=N`, « Remplir » in the client's « Programmes » tab), if any. */
  requestedDay(days: MealDay[]): MealDay | null {
    const dayNumber = Number(this.route.snapshot.queryParamMap.get('day'));
    return dayNumber > 0 ? days[dayNumber - 1] || null : null;
  }

  /** « Back » of a client plan: where it was opened from, else the client's nutrition tab. False for a library plan. */
  goBack(): boolean {
    if (!this.clientId) return false;
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl?.startsWith('/')) void this.router.navigateByUrl(returnUrl);
    else void this.router.navigate(['/clients/profil-client', this.clientId], { queryParams: { tab: 'nutrition' } });
    return true;
  }

  /** « Dupliquer » from the read-only banner (A9): a full copy in the library, opened in its library builder. */
  duplicateLocked(planId: string | null | undefined, libraryPath: string): void {
    if (!planId || this.duplicating) return;
    this.duplicating = true;
    this.nutrition.duplicate(planId, true).subscribe({
      next: (copy: any) => {
        this.duplicating = false;
        this.toast.success(this.translate.instant('ASSIGN_FLOW.DUPLICATED'));
        if (copy?.id) void this.router.navigateByUrl(libraryPath + copy.id);
      },
      error: () => {
        this.duplicating = false;
        this.toast.error(this.translate.instant('ASSIGN_FLOW.DUPLICATE_FAILED'));
      },
    });
  }
}
