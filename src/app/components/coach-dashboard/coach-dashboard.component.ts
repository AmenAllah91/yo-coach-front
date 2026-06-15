import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { ClientService } from '../../service/client.service';
import { WorkoutService } from '../../service/workout.service';
import { NutritionService } from '../../service/nutrition.service';
import { CoachSettingsService } from '../../service/coach-settings.service';
import {
  AssignmentsApiService,
  FormAssignment,
} from '../forms/services/assignments-api.service';
import { FormsApiService } from '../forms/services/forms-api.service';
import { AddClientModalComponent } from '../clients/add-client-modal/add-client-modal.component';
import { ChoosePlanTypeModalComponent } from '../nutrition/choose-plan-type-modal/choose-plan-type-modal.component';

interface ClientDisplay {
  id: string;
  name: string;
  package: string;
  status: 'active' | 'inactive';
  lastCheckIn?: string;
}

interface CheckInDisplay {
  id: string;
  clientId: string;
  clientName: string;
  formName: string;
  status: string;
  overdue: boolean;
  submittedDate: string;
  answeredDate: string;
}

type AssignType = 'workout' | 'nutrition' | 'checkin';

interface PendingAssign {
  type: AssignType;
  item: any;
}

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    AddClientModalComponent,
    ChoosePlanTypeModalComponent,
  ],
  templateUrl: './coach-dashboard.component.html',
  styleUrl: './coach-dashboard.component.scss',
})
export class CoachDashboardComponent implements OnInit {
  showAddClientModal = false;
  showChoosePlanTypeModal = false;

  selectedTab: 'clients' | 'checkins' = 'clients';

  loading = false;
  error: string | null = null;

  clients: ClientDisplay[] = [];
  recentCheckIns: CheckInDisplay[] = [];

  checkInsPage = 1;
  readonly checkInsPageSize = 4;

  pendingAssign: PendingAssign | null = null;
  showPostCreatePrompt = false;
  showAssignModal = false;
  assignClientId = '';
  assignDate = this.todayInputValue();
  assignSaving = false;
  assignError: string | null = null;

  private assignments: FormAssignment[] = [];
  private coachId = '';

  get totalCheckInPages(): number {
    return Math.max(1, Math.ceil(this.recentCheckIns.length / this.checkInsPageSize));
  }

  get paginatedRecentCheckIns(): CheckInDisplay[] {
    const start = (this.checkInsPage - 1) * this.checkInsPageSize;
    return this.recentCheckIns.slice(start, start + this.checkInsPageSize);
  }

  get canGoPreviousCheckIns(): boolean {
    return this.checkInsPage > 1;
  }

  get canGoNextCheckIns(): boolean {
    return this.checkInsPage < this.totalCheckInPages;
  }

  get checkInsPageNumbers(): Array<number | '...'> {
    const total = this.totalCheckInPages;

    if (total <= 1) return [1];
    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    if (this.checkInsPage <= 3) {
      return [1, 2, 3, '...', total];
    }

    if (this.checkInsPage >= total - 2) {
      return [1, '...', total - 2, total - 1, total];
    }

    return [1, '...', this.checkInsPage - 1, this.checkInsPage, this.checkInsPage + 1, '...', total];
  }

  constructor(
    private router: Router,
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private coachSettingsService: CoachSettingsService,
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
  ) {}

  ngOnInit(): void {
    this.coachId = sessionStorage.getItem('userId') || '';

    this.coachSettingsService.loadConfig().subscribe({
      next: () => this.loadData(),
      error: () => this.loadData(),
    });
  }

  get assignAfterNutrition(): boolean {
    return this.coachSettingsService.getConfig().quickActions.assignAfterNutrition;
  }

  get assignAfterWorkout(): boolean {
    return this.coachSettingsService.getConfig().quickActions.assignAfterWorkout;
  }

  get assignAfterCheckIn(): boolean {
    return this.coachSettingsService.getConfig().quickActions.assignAfterCheckIn;
  }

  loadData(): void {
    if (!this.coachId) {
      this.error = 'Coach not found.';
      return;
    }

    this.loading = true;
    this.error = null;

    forkJoin({
      clients: this.clientService
        .getListClientsByCoachWithoutPagination(this.coachId)
        .pipe(catchError(() => of([]))),

      assignments: this.assignmentsApi
        .pageOwnerAssignments(0, 100, 'dueAt', 'DESC')
        .pipe(catchError(() => of({ content: [] }))),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (result) => {
          const rawClients: any[] = result.clients || [];

          this.clients = rawClients.map((client: any) => ({
            id: String(client.id),
            name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
            package: 'Online Coaching',
            status: 'active' as const,
            lastCheckIn: this.getLastCheckInDate(client),
          }));

          this.assignments = result.assignments?.content || [];
          this.checkInsPage = 1;
          this.enrichCheckIns(rawClients);
          this.clampCheckInsPage();
          this.openPendingAssignFromNavigationState();
        },

        error: () => {
          this.error = 'Failed to load dashboard data.';
        },
      });
  }

  private openPendingAssignFromNavigationState(): void {
    const state = history.state || {};
    const created = state.assignAfterCreate;

    if (!created?.type || !created?.item) return;

    const settings = this.coachSettingsService.getConfig();

    if (
      created.type === 'workout' &&
      !settings.quickActions.assignAfterWorkout
    ) {
      history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (
      created.type === 'nutrition' &&
      !settings.quickActions.assignAfterNutrition
    ) {
      history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (
      created.type === 'checkin' &&
      !settings.quickActions.assignAfterCheckIn
    ) {
      history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    this.pendingAssign = {
      type: created.type,
      item: created.item,
    };

    this.assignClientId = '';
    this.assignDate = this.todayInputValue();
    this.assignError = null;
    this.showAssignModal = false;
    this.showPostCreatePrompt = true;

    history.replaceState({}, document.title, window.location.pathname);
  }

  private enrichCheckIns(rawClients: any[]): void {
    const clientMap = new Map<string, any>();

    rawClients.forEach((client: any) => {
      if (client?.id) {
        clientMap.set(String(client.id), client);
      }
    });

    this.recentCheckIns = this.assignments.map((assignment) => {
      const client = clientMap.get(String(assignment.assigneeId));

      const fullName = client
        ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()
        : String(assignment.assigneeId);

      const status = assignment.status;
      const isSubmittedOrReviewed = status === 'SUBMITTED' || status === 'REVIEWED';

      return {
        id: String(assignment.id),
        clientId: String(assignment.assigneeId),
        clientName: fullName || String(assignment.assigneeId),
        formName: assignment.formName || 'Check-in',
        status: this.mapStatus(status),
        overdue: this.isOverdue(assignment),
        submittedDate: this.formatAssignmentDate(
          isSubmittedOrReviewed
            ? (assignment as any).submittedAt
            : (assignment as any).dueAt || (assignment as any).assignedAt,
        ),
        answeredDate: this.formatAssignmentDate(
          (assignment as any).reviewedAt,
        ),
      };
    });
  }

  private getLastCheckInDate(client: any): string {
    if (client.workoutDates?.length) {
      const dates = client.workoutDates.map((date: string) => new Date(date));

      const latest = new Date(
        Math.max(...dates.map((date: Date) => date.getTime())),
      );

      return this.formatDate(latest);
    }

    return 'Niveau';
  }

  private formatAssignmentDate(value?: string | Date | null): string {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return `${Math.floor(days / 7)} weeks ago`;
  }

  private mapStatus(status: string): string {
    switch (status) {
      case 'ASSIGNED':
        return 'Pending';
      case 'OPENED':
        return 'Opened';
      case 'SUBMITTED':
        return 'Submitted';
      case 'REVIEWED':
        return 'Reviewed';
      case 'CANCELED':
        return 'Canceled';
      default:
        return status || 'Pending';
    }
  }

  private isOverdue(assignment: FormAssignment): boolean {
    if (!assignment.dueAt) return false;

    const due = new Date(assignment.dueAt);
    const now = new Date();

    return (
      due < now &&
      assignment.status !== 'SUBMITTED' &&
      assignment.status !== 'REVIEWED'
    );
  }

  setTab(tab: 'clients' | 'checkins'): void {
    this.selectedTab = tab;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  previousCheckInsPage(event?: Event): void {
    event?.stopPropagation();

    if (this.canGoPreviousCheckIns) {
      this.checkInsPage -= 1;
      this.clampCheckInsPage();
    }
  }

  nextCheckInsPage(event?: Event): void {
    event?.stopPropagation();

    if (this.canGoNextCheckIns) {
      this.checkInsPage += 1;
      this.clampCheckInsPage();
    }
  }

  goToCheckInsPage(page: number | '...', event?: Event): void {
    event?.stopPropagation();

    if (page === '...') return;

    this.checkInsPage = page;
    this.clampCheckInsPage();
  }

  private clampCheckInsPage(): void {
    if (this.checkInsPage < 1) {
      this.checkInsPage = 1;
      return;
    }

    if (this.checkInsPage > this.totalCheckInPages) {
      this.checkInsPage = this.totalCheckInPages;
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Submitted':
        return 'status submitted';
      case 'Opened':
        return 'status opened';
      case 'Reviewed':
        return 'status reviewed';
      default:
        return 'status pending';
    }
  }

  formatCheckInDate(checkIn: CheckInDisplay): string {
    const assignment = this.assignments.find((item) => item.id === checkIn.id);

    if (!assignment?.dueAt) {
      return checkIn.overdue ? 'Overdue' : '';
    }

    const date = new Date(assignment.dueAt);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dueDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    const diff = Math.floor(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return `In ${diff} days`;

    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  addClient(): void {
    this.showAddClientModal = true;
  }

  closeAddClientModal(): void {
    this.showAddClientModal = false;
  }

  addWorkoutPlan(): void {
    this.router.navigate(['/workout/create-workout'], {
      queryParams: {
        returnUrl: '/coach-dashboard',
        assignAfterCreate: this.assignAfterWorkout,
      },
    });
  }

  addNutritionPlan(): void {
    this.showChoosePlanTypeModal = true;
  }

  closeChoosePlanTypeModal(): void {
    this.showChoosePlanTypeModal = false;
  }

  sendMessage(): void {
    this.router.navigate(['/chat']);
  }

  addCheckIn(): void {
    this.router.navigate(['/forms/create-form'], {
      queryParams: {
        returnTo: 'dashboard',
        assignAfterCreate: this.assignAfterCheckIn,
      },
    });
  }

  openClient(id: string): void {
    this.router.navigate([`/clients/profil-client/${id}`]);
  }

  get pendingAssignTitle(): string {
    if (!this.pendingAssign) return '';
    if (this.pendingAssign.type === 'checkin') {
      return this.pendingAssign.item?.title || 'Check-in';
    }

    return this.pendingAssign.item?.name || 'Plan';
  }

  get pendingAssignLabel(): string {
    switch (this.pendingAssign?.type) {
      case 'workout':
        return 'Workout created';
      case 'nutrition':
        return 'Nutrition plan created';
      case 'checkin':
        return 'Check-in created';
      default:
        return 'Created';
    }
  }

  get pendingAssignIcon(): string {
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

  get assignDateLabel(): string {
    return this.pendingAssign?.type === 'checkin' ? 'Due date' : 'Start date';
  }

  notNowAssign(): void {
    this.showPostCreatePrompt = false;
    this.showAssignModal = false;
    this.pendingAssign = null;
    this.assignError = null;
  }

  openAssignModal(): void {
    this.showPostCreatePrompt = false;
    this.showAssignModal = true;
    this.assignClientId = this.clients[0]?.id || '';
    this.assignDate = this.todayInputValue();
    this.assignError = null;
  }

  closeAssignModal(): void {
    if (this.assignSaving) return;

    this.showAssignModal = false;
    this.pendingAssign = null;
    this.assignError = null;
  }

  confirmAssign(): void {
    if (!this.pendingAssign || !this.assignClientId) {
      this.assignError = 'Please select a client.';
      return;
    }

    this.assignSaving = true;
    this.assignError = null;

    if (this.pendingAssign.type === 'workout') {
      this.assignWorkoutPlan();
      return;
    }

    if (this.pendingAssign.type === 'nutrition') {
      this.assignNutritionPlan();
      return;
    }

    this.assignCheckIn();
  }

  private assignWorkoutPlan(): void {
    const workout = this.pendingAssign!.item;

    if (!workout?.id) {
      this.assignSaving = false;
      this.assignError = 'Workout was created, but its id was not returned by the server.';
      return;
    }

    const startDate = this.parseInputDate(this.assignDate);
    const workoutDays = this.buildWorkoutDays(workout, startDate);
    const endDate = this.addDays(startDate, Math.max(workoutDays.length - 1, 0));
    const selectedClient = this.clients.find((client) => client.id === this.assignClientId);

    const payload: any = {
      ...workout,
      id: workout.id,
      name: workout.name,
      details: workout.details ?? '',
      isWorkoutPlanTemplate: false,
      isTemplate: false,
      startDate: this.toDateOnly(startDate),
      endDate: this.toDateOnly(endDate),
      workoutDays,
      coach: workout.coach || { id: this.coachId },
      client: {
        id: this.assignClientId,
        name: selectedClient?.name || '',
      },
    };

    this.workoutService
      .assignWorkout(workout.id, payload)
      .pipe(finalize(() => (this.assignSaving = false)))
      .subscribe({
        next: () => this.finishAssignSuccess(),
        error: (err) => {
          console.error('Workout assign failed:', err, payload);
          this.assignError = this.readBackendError(err, 'Failed to assign workout.');
        },
      });
  }

  private assignNutritionPlan(): void {
    const plan = this.pendingAssign!.item;

    if (!plan?.id) {
      this.assignSaving = false;
      this.assignError = 'Nutrition plan was created, but its id was not returned by the server.';
      return;
    }

    const startDate = this.parseInputDate(this.assignDate);
    const mealDays = this.buildMealDays(plan, startDate);
    const endDate = this.addDays(startDate, Math.max(mealDays.length - 1, 0));
    const selectedClient = this.clients.find((client) => client.id === this.assignClientId);

    const payload: any = {
      ...plan,
      id: plan.id,
      name: plan.name,
      details: plan.details ?? plan.description ?? '',
      description: plan.description ?? plan.details ?? '',
      trackingMode: plan.trackingMode ?? null,
      startDate: this.toDateOnly(startDate),
      endDate: this.toDateOnly(endDate),
      mealDays,
      coach: plan.coach || { id: this.coachId },
      coachId: plan.coachId || this.coachId,
      client: {
        id: this.assignClientId,
        name: selectedClient?.name || '',
      },
    };

    this.nutritionService
      .assignNutritionPlan(payload)
      .pipe(finalize(() => (this.assignSaving = false)))
      .subscribe({
        next: () => this.finishAssignSuccess(),
        error: (err) => {
          console.error('Nutrition assign failed:', err, payload);
          this.assignError = this.readBackendError(err, 'Failed to assign nutrition plan.');
        },
      });
  }

  private assignCheckIn(): void {
    const form = this.pendingAssign!.item;
    const formId = form?.id || form?.formId;

    if (!formId) {
      this.assignSaving = false;
      this.assignError = 'Form not found.';
      return;
    }

    this.formsApi
      .ensurePublished(formId)
      .pipe(
        switchMap(() =>
          this.assignmentsApi.bulkAssign(formId, {
            assigneeIds: [this.assignClientId],
            dueDate: this.assignDate || null,
            endDate: null,
          }),
        ),
        finalize(() => (this.assignSaving = false)),
      )
      .subscribe({
        next: () => this.finishAssignSuccess(),
        error: (err) => {
          console.error('Check-in assign failed:', err);
          this.assignError = this.readBackendError(err, 'Failed to assign check-in.');
        },
      });
  }

  private finishAssignSuccess(): void {
    this.showAssignModal = false;
    this.pendingAssign = null;
    this.assignError = null;
    this.loadData();
  }

  private readBackendError(err: any, fallback: string): string {
    return (
      err?.error?.message ||
      err?.error?.error ||
      err?.message ||
      fallback
    );
  }

  private buildWorkoutDays(workout: any, startDate: Date): any[] {
    const days = workout?.workoutDays || [];

    return days.map((day: any, index: number) => {
      const date = this.addDays(startDate, index);

      return {
        ...day,
        date: this.toDateOnly(date),
        dayOfWeek: this.weekday(date),
        dayNumber: day.dayNumber || index + 1,
      };
    });
  }

  private buildMealDays(plan: any, startDate: Date): any[] {
    const days = plan?.mealDays || [];

    return days.map((day: any, index: number) => {
      const date = this.addDays(startDate, index);

      return {
        ...day,
        date: this.toDateOnly(date),
        dayOfWeek: day.dayOfWeek || `Day ${index + 1}`,
        dayNumber: day.dayNumber || index + 1,
      };
    });
  }

  private todayInputValue(): string {
    return this.toDateOnly(new Date());
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

  private toDateOnly(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private weekday(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  trackByClientId(index: number, client: ClientDisplay): string {
    return client.id;
  }

  trackByCheckInId(index: number, checkIn: CheckInDisplay): string {
    return checkIn.id;
  }
}
