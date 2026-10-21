import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { ClientService } from '../../../service/client.service';
import { WorkoutService } from '../../../service/workout.service';
import { NutritionService } from '../../../service/nutrition.service';
import { CoachSettingsService } from '../../../service/coach-settings.service';
import { AssignmentsApiService } from '../../forms/services/assignments-api.service';
import { FormsApiService } from '../../forms/services/forms-api.service';
import { toDateInput } from '../shared/dashboard-format';

type AssignType = 'workout' | 'nutrition' | 'checkin';

interface PendingAssign {
  type: AssignType;
  item: any;
}

interface ClientOption {
  id: string;
  name: string;
}

/**
 * "Assign now?" after creating a workout, nutrition plan or check-in from the dashboard quick actions
 * (navigation state {@code assignAfterCreate}, behaviour of the previous dashboard kept as is).
 */
@Component({
  selector: 'app-post-create-assign',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './post-create-assign.component.html',
  styleUrl: './post-create-assign.component.scss',
})
export class PostCreateAssignComponent implements OnInit {
  @Output() assigned = new EventEmitter<void>();

  pendingAssign: PendingAssign | null = null;
  showPrompt = false;
  showForm = false;
  clients: ClientOption[] = [];
  clientId = '';
  date = toDateInput(new Date());
  saving = false;
  error: string | null = null;

  private coachId = '';

  constructor(
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService,
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.coachId = sessionStorage.getItem('userId') || '';
    const created = history.state?.assignAfterCreate;
    if (!created?.type || !created?.item) return;
    history.replaceState({}, document.title, window.location.pathname);

    // The coach's quick-action options decide whether to ask (cached settings are used when they cannot be read).
    this.coachSettingsService
      .loadConfig(true)
      .pipe(catchError(() => of(this.coachSettingsService.getConfig())))
      .subscribe((config) => {
        const quickActions = config.quickActions;
        const enabled =
          (created.type === 'workout' && quickActions.assignAfterWorkout) ||
          (created.type === 'nutrition' && quickActions.assignAfterNutrition) ||
          (created.type === 'checkin' && quickActions.assignAfterCheckIn);
        if (!enabled) return;
        this.pendingAssign = { type: created.type, item: created.item };
        this.showPrompt = true;
      });
  }

  get title(): string {
    if (!this.pendingAssign) return '';
    if (this.pendingAssign.type === 'checkin') {
      return this.pendingAssign.item?.title || this.translate.instant('CHECK_IN');
    }
    return this.pendingAssign.item?.name || this.translate.instant('PLAN');
  }

  get label(): string {
    switch (this.pendingAssign?.type) {
      case 'workout':
        return 'WORKOUT_CREATED';
      case 'nutrition':
        return 'NUTRITION_PLAN_CREATED';
      case 'checkin':
        return 'CHECK_IN_CREATED';
      default:
        return 'CREATED_STATUS';
    }
  }

  get icon(): string {
    switch (this.pendingAssign?.type) {
      case 'workout':
        return '🏋️';
      case 'nutrition':
        return '🍎';
      case 'checkin':
        return '✅';
      default:
        return '✓';
    }
  }

  get dateLabel(): string {
    return this.pendingAssign?.type === 'checkin' ? 'DUE_DATE' : 'START_DATE';
  }

  notNow(): void {
    this.showPrompt = false;
    this.showForm = false;
    this.pendingAssign = null;
    this.error = null;
  }

  openForm(): void {
    this.showPrompt = false;
    this.showForm = true;
    this.date = toDateInput(new Date());
    this.error = null;
    if (this.clients.length) return;
    this.clientService.getActiveClientsForAssignment(this.coachId, true).subscribe({
      next: (clients: any[]) => {
        this.clients = (clients || []).map((client) => ({
          id: String(client.id),
          name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
        }));
        this.clientId = this.clientId || this.clients[0]?.id || '';
      },
      error: () => (this.error = this.translate.instant('LOAD_DASHBOARD_ERROR')),
    });
  }

  closeForm(): void {
    if (this.saving) return;
    this.notNow();
  }

  confirm(): void {
    if (!this.pendingAssign || !this.clientId) {
      this.error = this.translate.instant('PLEASE_SELECT_CLIENT');
      return;
    }
    this.saving = true;
    this.error = null;
    if (this.pendingAssign.type === 'workout') this.assignWorkout();
    else if (this.pendingAssign.type === 'nutrition') this.assignNutrition();
    else this.assignCheckIn();
  }

  private assignWorkout(): void {
    const workout = this.pendingAssign!.item;
    if (!workout?.id) return this.fail('WORKOUT_ID_NOT_RETURNED');
    const startDate = this.parseInputDate(this.date);
    const workoutDays = (workout.workoutDays || []).map((day: any, index: number) => {
      const date = this.addDays(startDate, index);
      return {
        ...day,
        date: toDateInput(date),
        dayOfWeek: date.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' }),
        dayNumber: day.dayNumber || index + 1,
      };
    });
    const payload: any = {
      ...workout,
      details: workout.details ?? '',
      isWorkoutPlanTemplate: false,
      isTemplate: false,
      startDate: toDateInput(startDate),
      endDate: toDateInput(this.addDays(startDate, Math.max(workoutDays.length - 1, 0))),
      workoutDays,
      coach: workout.coach || { id: this.coachId },
      client: { id: this.clientId, name: this.clientName() },
    };
    this.workoutService
      .assignWorkout(workout.id, payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({ next: () => this.done(), error: (err) => this.fail('ASSIGN_WORKOUT_ERROR', err) });
  }

  private assignNutrition(): void {
    const plan = this.pendingAssign!.item;
    if (!plan?.id) return this.fail('NUTRITION_ID_NOT_RETURNED');
    const startDate = this.parseInputDate(this.date);
    const mealDays = (plan.mealDays || []).map((day: any, index: number) => ({
      ...day,
      date: toDateInput(this.addDays(startDate, index)),
      dayOfWeek: day.dayOfWeek || `Day ${index + 1}`,
      dayNumber: day.dayNumber || index + 1,
    }));
    const payload: any = {
      ...plan,
      details: plan.details ?? plan.description ?? '',
      description: plan.description ?? plan.details ?? '',
      trackingMode: plan.trackingMode ?? null,
      startDate: toDateInput(startDate),
      endDate: toDateInput(this.addDays(startDate, Math.max(mealDays.length - 1, 0))),
      mealDays,
      coach: plan.coach || { id: this.coachId },
      coachId: plan.coachId || this.coachId,
      client: { id: this.clientId, name: this.clientName() },
    };
    this.nutritionService
      .assignNutritionPlan(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({ next: () => this.done(), error: (err) => this.fail('ASSIGN_NUTRITION_ERROR', err) });
  }

  private assignCheckIn(): void {
    const form = this.pendingAssign!.item;
    const formId = form?.id || form?.formId;
    if (!formId) return this.fail('FORM_NOT_FOUND');
    this.formsApi
      .ensurePublished(formId)
      .pipe(
        switchMap(() =>
          this.assignmentsApi.bulkAssign(formId, { assigneeIds: [this.clientId], dueDate: this.date || null, endDate: null }),
        ),
        finalize(() => (this.saving = false)),
      )
      .subscribe({ next: () => this.done(), error: (err) => this.fail('ASSIGN_CHECK_IN_ERROR', err) });
  }

  private done(): void {
    this.showForm = false;
    this.pendingAssign = null;
    this.error = null;
    this.assigned.emit();
  }

  private fail(key: string, err?: any): void {
    this.saving = false;
    this.error = err?.error?.message || err?.error?.error || err?.message || this.translate.instant(key);
  }

  private clientName(): string {
    return this.clients.find((client) => client.id === this.clientId)?.name || '';
  }

  private parseInputDate(value: string): Date {
    if (!value) return new Date();
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
