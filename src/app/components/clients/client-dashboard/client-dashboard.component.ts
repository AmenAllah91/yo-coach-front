import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { ChatService } from 'app/service/chat.service';
import { ChatUnreadService } from 'app/service/chat-unread.service';
import { ClientTasksService, TaskCalendarItem } from 'app/service/client-tasks.service';
import { CoachPublicProfile, CoachSettingsService } from 'app/service/coach-settings.service';
import { DocumentService } from 'app/service/document.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { PauseView, addDaysIso, parseIso, todayIso } from '@shared/models/program-schedule';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { AssignmentsApiService, FormAssignment } from 'app/components/forms/services/assignments-api.service';
import { ClientTaskRowComponent } from '../shared/client-task-row.component';
import { CoachProfileSheetComponent } from '../shared/coach-profile-sheet.component';
import { NutritionMacrosSummaryComponent } from '../shared/nutrition-macros-summary.component';
import { isHabit, isTaskDone, openClientTask } from '../shared/client-task-utils';
import {
  allExercises, capitalizeFirst, clientVisibleMeals, consumedTotals, dateKey, estimatedWorkoutMinutes, findPlanDay,
  initials, isMealReported, isRestDay, planDate, programWeek, targetTotals, titleCase, workoutDayTitle,
  workoutSetCount, workoutThumbnails,
} from '../shared/client-plan-utils';

interface PlanDayItem { plan: any; day: any; }
interface HomeCoach { id: string; name: string; }

/** Last dashboard of the session: a revisit shows it at once, the fresh answer replaces it. */
let HOME_SNAPSHOT: {
  clientId: string; workout: PlanDayItem | null; nutrition: PlanDayItem | null;
  checkIn: FormAssignment | null; coach: HomeCoach | null; tasks: TaskCalendarItem[];
} | null = null;

/**
 * Client Home, same content and logic as the mobile ClientHomeScreen: greeting, coach card, today's plan
 * (workout or rest day, nutrition), today's tasks and habits, and the check-in due today.
 */
@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, FeatherModule, ClientTaskRowComponent, CoachProfileSheetComponent, NutritionMacrosSummaryComponent],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss',
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  status: 'loading' | 'loaded' | 'error' = 'loading';
  errorMessage = '';
  firstName = '';
  clientId = '';

  todayWorkoutItem: PlanDayItem | null = null;
  todayNutritionItem: PlanDayItem | null = null;
  todayCheckIn: FormAssignment | null = null;
  coach: HomeCoach | null = null;
  todayHabits: TaskCalendarItem[] = [];
  todayTasks: TaskCalendarItem[] = [];
  toggling = new Set<string>();
  unreadMessages = 0;

  /** A pause of the follow-up going on or to come (backlog-programmes.md DS-03). */
  pause: PauseView | null = null;
  coachProfile: CoachPublicProfile | null = null;
  coachPhotoUrl = '';
  coachPhotoFailed = false;
  showCoachProfile = false;
  coachProfileLoading = false;
  toast = '';

  private loadRequest = 0;
  private subscriptions = new Subscription();
  private loadSubscriptions = new Subscription();
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private auth: AuthService,
    private translate: TranslateService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private chatService: ChatService,
    private chatUnread: ChatUnreadService,
    private tasksApi: ClientTasksService,
    private coachSettings: CoachSettingsService,
    private documents: DocumentService,
    private assignments: AssignmentsApiService,
    private theme: ClientThemeService,
    private schedule: ProgramScheduleService,
  ) {}

  /** « Pause jusqu'au … » instead of empty days (DS-03); a pause to come is announced. */
  get pauseLabel(): string {
    const pause = this.pause;
    if (!pause) return '';
    const day = (iso: string) => parseIso(iso).toLocaleDateString(this.locale, { weekday: 'long', day: 'numeric', month: 'long' });
    const resume = day(addDaysIso(pause.toDate, 1));
    if (pause.fromDate <= todayIso()) {
      return this.fr ? `Votre suivi est en pause jusqu'au ${day(pause.toDate)} : reprise le ${resume}.`
        : `Your follow-up is paused until ${day(pause.toDate)}: it resumes on ${resume}.`;
    }
    return this.fr ? `Pause prévue du ${day(pause.fromDate)} au ${day(pause.toDate)} : reprise le ${resume}.`
      : `Pause planned from ${day(pause.fromDate)} to ${day(pause.toDate)}: it resumes on ${resume}.`;
  }

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }

  async ngOnInit(): Promise<void> {
    this.theme.ensureLoaded();
    this.subscriptions.add(this.chatUnread.unreadCounts$.subscribe(counts => {
      this.unreadMessages = Array.from(counts.values()).reduce((total, count) => total + count, 0);
    }));
    const user = await this.auth.getCurrentUserDetails();
    this.firstName = (user?.firstName || '').trim();
    this.clientId = user?.id || sessionStorage.getItem('userId') || '';
    if (!this.clientId) { this.status = 'error'; this.errorMessage = this.somethingWentWrong; return; }
    if (HOME_SNAPSHOT?.clientId === this.clientId) {
      this.todayWorkoutItem = HOME_SNAPSHOT.workout; this.todayNutritionItem = HOME_SNAPSHOT.nutrition;
      this.todayCheckIn = HOME_SNAPSHOT.checkIn; this.coach = HOME_SNAPSHOT.coach;
      this.splitTasks(HOME_SNAPSHOT.tasks);
      this.status = 'loaded';
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.loadSubscriptions.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // -------------------------------------------------------------------------
  // Loading (mobile ClientHomeProvider.load)
  // -------------------------------------------------------------------------
  load(): void {
    const request = ++this.loadRequest;
    this.loadSubscriptions.unsubscribe();
    this.loadSubscriptions = new Subscription();
    if (this.status !== 'loaded') this.status = 'loading';
    this.errorMessage = '';
    const today = new Date();

    // Tasks are requested in parallel but applied after the main dashboard: a slow task endpoint must never
    // keep Home on a spinner, and a failure leaves the rest usable.
    // The pause is read on its own: a failure never keeps Home from showing.
    this.loadSubscriptions.add(this.schedule.currentPause(this.clientId).pipe(catchError(() => of(null)))
      .subscribe(pause => (this.pause = pause)));
    const tasks$ = this.tasksApi.calendar(this.clientId, dateKey(today), dateKey(today), true).pipe(
      timeout(10_000), map(response => response.items || []), catchError(() => of([] as TaskCalendarItem[])));

    const workout$ = this.workoutService.getWorkoutPlansByClient(this.clientId).pipe(
      map(plans => findPlanDay(plans as any[], 'workoutDays', today)));
    const nutrition$ = this.nutritionService.getNutritionPlanByClientId(this.clientId).pipe(
      map(plans => findPlanDay(Array.isArray(plans) ? plans : [], 'mealDays', today)));
    const checkIn$ = this.assignments.pageMyAssignments(0, 20, 'assignedAt', 'DESC', undefined, true).pipe(map(page => this.checkInDueToday(page?.content || [])));
    const coach$ = this.chatService.getConversations(0, 10).pipe(
      map(page => {
        const conversation = page?.content?.[0];
        const name = conversation?.name?.trim() || '';
        return name ? { id: conversation!.coachId || '', name } as HomeCoach : null;
      }),
      catchError(() => of(null)));

    // The plan services answer from their cache first, then fresh: forkJoin keeps the last answer of each.
    this.loadSubscriptions.add(forkJoin({ workout: workout$, nutrition: nutrition$, checkIn: checkIn$, coach: coach$ })
      .pipe(timeout(20_000)).subscribe({
      next: result => {
        if (request !== this.loadRequest) return;
        this.todayWorkoutItem = result.workout;
        this.todayNutritionItem = result.nutrition;
        this.todayCheckIn = result.checkIn;
        this.coach = result.coach ?? this.coachFromPlans();
        this.status = 'loaded';
        this.saveSnapshot();
        this.loadCoachProfile();
        this.loadSubscriptions.add(tasks$.subscribe(items => {
          if (request !== this.loadRequest) return;
          this.splitTasks(items);
          this.saveSnapshot();
        }));
      },
      error: error => {
        if (request !== this.loadRequest) return;
        this.status = 'error';
        this.errorMessage = error?.message || this.somethingWentWrong;
      },
    }));
  }

  private splitTasks(items: TaskCalendarItem[]): void {
    this.todayHabits = items.filter(item => isHabit(item));
    this.todayTasks = items.filter(item => !isHabit(item));
  }

  private saveSnapshot(): void {
    HOME_SNAPSHOT = {
      clientId: this.clientId, workout: this.todayWorkoutItem, nutrition: this.todayNutritionItem,
      checkIn: this.todayCheckIn, coach: this.coach, tasks: [...this.todayHabits, ...this.todayTasks],
    };
  }

  /** Mobile getLatestCheckInIfDueToday: the first open assignment due today. */
  private checkInDueToday(items: FormAssignment[]): FormAssignment | null {
    const today = dateKey(new Date());
    return items.find(item => item.status !== 'SUBMITTED' && item.status !== 'CANCELED' && item.status !== 'REVIEWED'
      && !!item.dueAt && dateKey(planDate(item.dueAt) || new Date(0)) === today) || null;
  }

  private coachFromPlans(): HomeCoach | null {
    const coach = this.todayWorkoutItem?.plan?.coach || this.todayNutritionItem?.plan?.coach;
    const name = `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim();
    return name ? { id: coach?.id || '', name } : null;
  }

  get coachId(): string {
    return this.coach?.id || this.todayWorkoutItem?.plan?.coach?.id || this.todayWorkoutItem?.plan?.clientCoachId
      || this.todayNutritionItem?.plan?.coach?.id || '';
  }

  get displayCoachName(): string {
    if (this.coach?.name.trim()) return titleCase(this.coach.name);
    const coach = this.todayWorkoutItem?.plan?.coach;
    const name = `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim();
    return name ? titleCase(name) : (this.fr ? 'Votre coach' : 'Your Coach');
  }

  get coachInitials(): string { return initials(this.displayCoachName); }

  /** Public profile with a fresh photo url (mobile loadCoachPublicProfile). */
  private loadCoachProfile(): void {
    const coachId = this.coachId.trim();
    if (!coachId || this.coachProfile) return;
    this.loadSubscriptions.add(this.coachSettings.getConfigForCoach(coachId, true).subscribe({
      next: config => {
        const profile = config?.publicProfile || null;
        this.coachProfile = profile;
        const stored = profile?.photoVisible ? (profile.photoUrl || '').trim() : '';
        this.coachPhotoUrl = stored;
        if (stored) {
          this.loadSubscriptions.add(this.documents.refreshStoredFileUrl(stored).subscribe({
            next: fresh => {
              const url = (fresh || '').trim();
              if (url && this.coachProfile) { this.coachPhotoUrl = url; this.coachProfile = { ...this.coachProfile, photoUrl: url }; }
            },
            error: () => {},
          }));
        }
      },
      error: () => {},
    }));
  }

  // -------------------------------------------------------------------------
  // Greeting
  // -------------------------------------------------------------------------
  get greeting(): string {
    const hour = new Date().getHours();
    const word = hour < 12 ? (this.fr ? 'Bonjour' : 'Good morning')
      : hour < 18 ? (this.fr ? 'Bon après-midi' : 'Good afternoon') : (this.fr ? 'Bonsoir' : 'Good evening');
    return this.firstName ? `${word}, ${this.firstName}` : word;
  }

  get todayLabel(): string {
    const text = new Intl.DateTimeFormat(this.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
    return text ? text[0].toUpperCase() + text.slice(1) : text;
  }

  // -------------------------------------------------------------------------
  // Today's workout
  // -------------------------------------------------------------------------
  get hasWorkout(): boolean {
    const day = this.todayWorkoutItem?.day;
    return !!day && !isRestDay(day) && allExercises(day).length > 0;
  }

  get workoutStatus(): string { return String(this.todayWorkoutItem?.day?.status || 'PENDING').toUpperCase(); }
  get workoutCompleted(): boolean { return this.workoutStatus === 'COMPLETED'; }
  get workoutInProgress(): boolean { return this.workoutStatus === 'IN_PROGRESS' || this.workoutStatus === 'PAUSED'; }
  get workoutMinutes(): number { return estimatedWorkoutMinutes(this.todayWorkoutItem?.day); }
  get workoutTitle(): string { return workoutDayTitle(this.todayWorkoutItem?.day, this.fr); }
  get workoutThumbs(): string[] { return workoutThumbnails(this.todayWorkoutItem?.day); }
  get workoutSubtitle(): string {
    const item = this.todayWorkoutItem!;
    const week = programWeek(item.plan?.startDate, planDate(item.day?.date) || new Date());
    return `${capitalizeFirst(item.plan?.name)} · ${this.fr ? 'Semaine' : 'Week'} ${week}`;
  }
  get workoutCounts(): string {
    const exercises = allExercises(this.todayWorkoutItem?.day).length;
    const sets = workoutSetCount(this.todayWorkoutItem?.day);
    const plural = exercises > 1 ? 's' : '';
    return this.fr ? `${exercises} exercice${plural} · ${sets} séries` : `${exercises} exercise${plural} · ${sets} sets`;
  }
  get workoutButtonLabel(): string {
    if (this.workoutCompleted) return this.fr ? 'Voir la séance' : 'View workout';
    if (this.workoutInProgress) return this.fr ? 'Reprendre la séance' : 'Continue workout';
    return this.fr ? 'Commencer la séance' : 'Start workout';
  }

  openWorkout(): void {
    const item = this.todayWorkoutItem;
    this.router.navigate(['/clients/client-workouts'], {
      queryParams: { dayId: item?.day?.id || null, planId: item?.plan?.id || null },
    });
  }

  // -------------------------------------------------------------------------
  // Today's nutrition
  // -------------------------------------------------------------------------
  get hasNutrition(): boolean {
    return !!this.todayNutritionItem && clientVisibleMeals(this.todayNutritionItem.day).length > 0;
  }

  get nutritionPlanLabel(): string { return capitalizeFirst(this.todayNutritionItem?.plan?.description); }
  get meals(): any[] { return clientVisibleMeals(this.todayNutritionItem?.day); }
  get consumed() { return consumedTotals(this.todayNutritionItem?.day); }
  get target() { return targetTotals(this.todayNutritionItem?.day); }
  get reportedMeals(): number { return this.meals.filter(meal => isMealReported(this.todayNutritionItem?.day, meal)).length; }
  get nextMealName(): string {
    const next = this.meals.find(meal => !isMealReported(this.todayNutritionItem?.day, meal));
    return next ? capitalizeFirst(next.name) : '';
  }

  openNutrition(): void {
    const item = this.todayNutritionItem;
    this.router.navigate(['/clients/client-nutrition'], {
      queryParams: { dayId: item?.day?.id || null, planId: item?.plan?.id || null },
    });
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  get tasks(): TaskCalendarItem[] { return [...this.todayHabits, ...this.todayTasks]; }
  get doneTasks(): number { return this.tasks.filter(task => isTaskDone(task)).length; }
  get checkInRepresentedByTask(): boolean {
    const id = this.todayCheckIn?.id;
    return !!id && this.todayTasks.some(task => task.formAssignmentId === id);
  }
  get showCheckInRow(): boolean { return !!this.todayCheckIn && !this.checkInRepresentedByTask; }

  /** Optimistic: the checkmark flips at once, the request runs after, and the previous state comes back on failure. */
  toggleHabit(habit: TaskCalendarItem): void {
    if (this.toggling.has(habit.occurrenceId)) return;
    this.toggling.add(habit.occurrenceId);
    const done = isTaskDone(habit);
    const index = this.todayHabits.findIndex(item => item.occurrenceId === habit.occurrenceId);
    const previous = index >= 0 ? this.todayHabits[index] : null;
    if (previous) {
      this.todayHabits = this.todayHabits.map((item, i) => i === index
        ? { ...item, status: done ? 'UPCOMING' : 'DONE', completedValue: done ? undefined : item.goalValue } : item);
    }
    this.subscriptions.add(this.tasksApi.setHabitCompletion(habit.id, habit.date, !done, done ? undefined : habit.goalValue).subscribe({
      next: () => { this.toggling.delete(habit.occurrenceId); this.saveSnapshot(); },
      error: () => {
        this.toggling.delete(habit.occurrenceId);
        if (previous) this.todayHabits = this.todayHabits.map(item => item.occurrenceId === habit.occurrenceId ? previous : item);
        this.showToast(this.fr ? "Impossible de mettre à jour l'habitude." : 'Could not update the habit.');
      },
    }));
  }

  openTask(task: TaskCalendarItem): void { void openClientTask(this.router, task); }
  seeAllTasks(): void { void this.router.navigate(['/tasks']); }

  openCheckIn(): void {
    void this.router.navigate(['/assignments/me'], { queryParams: { assignmentId: this.todayCheckIn?.id || null } });
  }

  // -------------------------------------------------------------------------
  // Coach
  // -------------------------------------------------------------------------
  openCoachProfile(): void {
    if (!this.coachId) return;
    this.showCoachProfile = true;
    this.coachProfileLoading = !this.coachProfile;
    if (this.coachProfile) return;
    this.subscriptions.add(this.coachSettings.getConfigForCoach(this.coachId, true).subscribe({
      next: config => { this.coachProfile = config?.publicProfile || null; this.coachProfileLoading = false; },
      error: () => { this.coachProfileLoading = false; },
    }));
  }

  /** Like the mobile Home: straight into the conversation with the coach (back leaves the chat). */
  openCoachConversation(): void {
    this.showCoachProfile = false;
    void this.router.navigate(['/chat'], { queryParams: { coach: 1 } });
  }

  // -------------------------------------------------------------------------
  private get somethingWentWrong(): string { return this.fr ? 'Une erreur est survenue' : 'Something went wrong'; }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }

  trackByOccurrence = (_: number, task: TaskCalendarItem) => task.occurrenceId;
}
