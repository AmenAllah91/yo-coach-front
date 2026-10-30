import { CheckinCardComponent } from '@shared/components/checkin-card/checkin-card.component';
import { ToastService } from 'app/service/toast.service';
import { NutritionService } from 'app/service/nutrition.service';
import { WorkoutService } from 'app/service/workout.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, HostListener, Input, ViewChild, forwardRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from 'app/service/client.service';
import { UsersService } from 'app/service/users.service';

import { ChoosePlanTypeModalComponent, NutritionPlanChoice } from 'app/components/nutrition/choose-plan-type-modal/choose-plan-type-modal.component';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { WorkoutsClientTabComponent } from './workouts-client-tab/workouts-client-tab.component';
import { NutritionClientTabComponent } from './nutrition-client-tab/nutrition-client-tab.component';
import { NutritionSelectionModalComponent } from './nutrition-selection-modal/nutrition-selection-modal.component';
import { WorkoutProgramSelectionModalComponent } from './workout-program-selection-modal/workout-program-selection-modal.component';
import { AssignSelectModalComponent } from './assign-select-modal/assign-select-modal.component';
import { FormSelectionModalComponent } from './form-selection-modal/form-selection-modal.component';
import { AssignmentsApiService, FormAssignment } from '../../forms/services/assignments-api.service';
import { Subject, takeUntil, from, of, Observable, forkJoin } from 'rxjs';
import { FormDetails, FormsApiService, Form } from '../../forms/services/forms-api.service';
import { Answer, QuestionType } from '../../../models/forms.model';
import { SubmissionsApiService } from '../../forms/services/submissions-api.service';
import { switchMap, finalize, map, mergeMap } from 'rxjs/operators';
import { ClientScheduleItemDto } from '../../../models/client-schedule.model';
import { CalendarClientsComponent } from '../../calendar/calendar-clients/calendar-clients.component';
import { ProgressPicturesComponent } from 'app/components/progress-pictures-module/progress-pictures/progress-pictures.component';
import { BodyMeasurementsComponent } from 'app/components/body-measurements/body-measurements.component';
import { BodyMeasurement, BodyMeasurementsService } from 'app/service/body-measurements.service';
import { FeatherModule } from 'angular-feather';
import { MyTasksComponent } from '../my-tasks/my-tasks.component';
import { MyAssignmentsComponent } from '../../forms/my-assignments-component/my-assignments.component';
import { ClientProfileCacheService } from 'app/service/client-profile-cache.service';
import { ChatService } from 'app/service/chat.service';
import { ChatComponent } from '../../chat/chat/chat.component';
import { ClientWorkoutsComponent } from '../client-workouts/client-workouts.component';
import { ClientNavPanelComponent } from '../client-nav-panel/client-nav-panel.component';
import { ClientTasksTabComponent } from './client-tasks-tab/client-tasks-tab.component';

const CLIENT_NAV_OPEN_KEY = 'clientNavPanelOpen';
import { ClientNutritionComponent } from '../client-nutrition/client-nutrition.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ClientSchedulePreview, ProgramOverview, changeSentence } from '@shared/models/program-schedule';
import { ClientHeaderStatus, ClientProfilePanelComponent } from '../shared/client-profile-panel.component';
import { ClientActivityDetailComponent } from './client-activity/client-activity-detail.component';
import {
  NutritionActivity,
  NutritionActivityStatus,
  WorkoutActivity,
  buildNutritionActivities,
  buildWorkoutActivities,
  nutritionDayStatusLabel,
  workoutActivityDuration,
  workoutActivityMode,
  workoutActivityStatusLabel,
} from './client-activity/client-activity';
import { clientObjectiveLabel } from '../../../models/client-objective';

type TabId =
  | 'dashboard'
  | 'workouts'
  | 'nutrition'
  | 'checkins'
  | 'chat'
  | 'measurements'
  | 'pictures'
  | 'tasks'
  | 'calendar';

/** Sections grouped under the "Overview" main tab. */
const OVERVIEW_TABS: readonly TabId[] = ['dashboard', 'measurements', 'pictures', 'checkins'];




interface Exercise {
  name: string;
  sets: string;
  rest: string;
}

interface TodaysWorkout {
  programName: string;
  currentWeek: number;
  totalWeeks: number;
  name: string;
  exercises: Exercise[];
}

interface NutritionMacroShares {
  items: { label: string; grams: number; color: string; percent: number }[];
  gradient: string;
}

interface ActiveNutritionPlan {
  name: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount?: number;
}

/** The « Toute l'activité » filters: OVERDUE is a past workout the client did not log (« Non renseignée »). */
type WorkoutActivityFilter = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'OVERDUE' | 'MISSED' | 'UPCOMING';

export interface ScheduledCheckIn {
  id: string;
  formName: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'onetime';
  selectedDays: string[];
  sendTime: string;
  endDate: string;
  status: 'active';
  nextSendDate: string;
  createdDate: string;
  description?: string;
  questions?: Array<{ id: string; label: string; type: string; required: boolean }>;
}
type ClientPreviewSection = 'workouts' | 'nutrition' | 'tasks' | 'chat' | 'checkins' | 'settings' | 'measurements' | 'pictures';

@Component({
  selector: 'app-profil-client',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SectionLoaderComponent,
    ChoosePlanTypeModalComponent,
    WorkoutsClientTabComponent,
    NutritionClientTabComponent,
    NutritionSelectionModalComponent,
    WorkoutProgramSelectionModalComponent,
    AssignSelectModalComponent,
    FormSelectionModalComponent,
    CalendarClientsComponent,
    ProgressPicturesComponent,
    BodyMeasurementsComponent,
    forwardRef(() => ChatComponent), // ChatComponent also imports this component: lazy reference breaks the cycle
    ClientWorkoutsComponent,
    ClientNutritionComponent,
    ClientNavPanelComponent,
    ClientTasksTabComponent,
    MyTasksComponent,
    MyAssignmentsComponent,
    CheckinCardComponent,
    FeatherModule,
    TranslateModule,
    AssignScheduleComponent,
    AssignConfirmComponent,
    ClientProfilePanelComponent,
    ClientActivityDetailComponent,
  ],
  templateUrl: './profil-client.component.html',
  styleUrls: ['./profil-client.component.scss', './client-activity/client-activity.scss'],
})
export class ProfilClientComponent {
  profileLoading = true;
  private seededClientId: string | null = null;
  private clientHeaderLoaded = false;
  private measurementsLoaded = false;
  private workoutDashboardLoaded = false;
  private nutritionDashboardLoaded = false;
  clientPickerOpen = false;
  clientSearch = '';
  coachClients: Client[] = [];
  loadingCoachClients = false;
  private coachClientsLoaded = false;
  clientNavOpen = this.readClientNavPreference();

  onClientNavOpenChange(open: boolean): void {
    this.clientNavOpen = open;
    try {
      localStorage.setItem(CLIENT_NAV_OPEN_KEY, String(open));
    } catch {}
    if (open) this.loadCoachClients();
  }

  private readClientNavPreference(): boolean {
    try {
      return localStorage.getItem(CLIENT_NAV_OPEN_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  backToClients(): void {
    this.router.navigate(['/clients']);
  }

  @ViewChild(WorkoutsClientTabComponent) workoutsTab: WorkoutsClientTabComponent;
  @ViewChild(NutritionClientTabComponent) nutritionTab: NutritionClientTabComponent;

  activeTab: TabId = 'dashboard';
  /**
   * Tabs opened for the current client. A tab is created on its first visit, then kept (hidden) while the coach
   * stays on this client: coming back to it is instant, without loading again. `clientKey` changes with the client,
   * which creates the opened tabs again for the new one (the chat included: it marks the conversation as read).
   */
  private openedTabs = new Set<TabId>(['dashboard']);
  clientKey: string[] = [];
  /** First page of each check-ins list received for this client (the section loader shows before). */
  submissionsLoaded = false;
  assignedLoaded = false;
  /** Form names do not change while on the profile: each form is asked once. */
  private formNames = new Map<string, string>();
  showClientStats = false;
  clientPreviewOpen = false;
  clientPreviewDevice: 'desktop' | 'mobile' = 'desktop';
  clientPreviewSection: ClientPreviewSection = 'workouts';
  /** Same entries, order and icons as the client's own menu (sidebar items of ROLE_CLIENT). */
  readonly clientPreviewMenu: Array<{ key: ClientPreviewSection; title: string; icon: string }> = [
    { key: 'workouts', title: 'WORKOUTS', icon: 'dumbbell' },
    { key: 'nutrition', title: 'NUTRITION', icon: 'apple' },
    { key: 'tasks', title: 'TASKS', icon: 'check-square' },
    { key: 'chat', title: 'CHAT', icon: 'message-square' },
    { key: 'checkins', title: 'MY_CHECK_INS', icon: 'message-square' },
    { key: 'settings', title: 'SETTINGS', icon: 'settings' },
    { key: 'measurements', title: 'BODY_MEASUREMENTS', icon: 'activity' },
    { key: 'pictures', title: 'SIDEBAR_PROGRESS', icon: 'camera' },
  ];
  clientPreviewSidebarOpen = false;
  private checkinsLoaded = false;

  /** « Voir le suivi » of a tab: the calendar opens on that tab's calendar (workout or nutrition) and day. */
  calendarFocus: { type: 'workout' | 'nutrition'; date: string | null } | null = null;

  openCalendarAt(type: 'workout' | 'nutrition', date?: string | null): void {
    this.calendarFocus = { type, date: date || null };
    this.setTab('calendar');
  }

  /**
   * A PDF / Excel program clicked in the calendar: the same preview as « Ouvrir » in its tab (no copy of it), opened
   * in the click itself with the plan the calendar has (the file is read by the program's id), so the browser does
   * not block the window.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openCalendarFile(file: { type: 'workout' | 'nutrition'; programId: string; plan?: any }): void {
    const tab = file.type === 'workout' ? this.workoutsTab : this.nutritionTab;
    if (tab && file.plan?.id) {
      tab.previewFile(file.plan);
      return;
    }
    if (tab) {
      tab.onProgramAction({ type: 'open', programId: file.programId });
      return;
    }
    // The tab is not created yet (a few hundred ms after the profile opens): the coach opens it from there.
    this.setTab(file.type === 'workout' ? 'workouts' : 'nutrition');
  }

  /** From the calendar's day panel (lot C): « Envoyer un message » opens the Discussion tab, a check-in its answers. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCalendarAction(action: { type: 'chat' } | { type: 'checkin'; assignment: any }): void {
    if (action.type === 'chat') {
      this.openChatPanel();
      return;
    }
    this.openAssignmentModal(action.assignment as FormAssignment);
  }

  /** « Send message »: the header chat panel opens on this client's conversation, the page stays. */
  openChatPanel(): void {
    if (this.clientId) this.chatService.openPanelWithClient(this.clientId);
  }

  setTab(tab: TabId) {
    this.activeTab = tab;
    this.loadTabData(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** "Overview" is a main tab grouping these sections, shown as sub-tabs on a second row. */
  get isOverviewTab(): boolean {
    return OVERVIEW_TABS.includes(this.activeTab);
  }

  /** "Overview" opens on the dashboard; clicking it again keeps the current sub-tab. */
  openOverview(): void {
    if (!this.isOverviewTab) this.setTab('dashboard');
  }

  toggleClientStats(): void {
    this.showClientStats = !this.showClientStats;
    if (this.activeTab === 'chat') this.fitChatPane();
  }

  /** Height of the profile chat: it fills the window below the tabs, the message bar is visible without scrolling. */
  chatPaneHeight: number | null = null;

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.activeTab === 'chat') this.fitChatPane(false);
  }

  /**
   * Below the tabs when there is room (computer); on a short screen (phone, tall profile header) the chat takes the
   * screen under the app bar and the page scrolls to it. scroll=false on resize (a phone keyboard resizes the window).
   */
  private fitChatPane(scroll = true): void {
    const measure = (withScroll: boolean) => {
      // The chat box itself (it has a top margin inside the chat component).
      const chat = document.querySelector<HTMLElement>('app-profil-client .chat-profile-pane.active .chat-root')
        || document.querySelector<HTMLElement>('app-profil-client .chat-profile-pane.active app-chat');
      if (!chat) return;
      const top = chat.getBoundingClientRect().top + window.scrollY;
      const pane = chat.closest<HTMLElement>('.chat-profile-pane');
      // The pane top does not move while the chat loads; the chat box sits a fixed offset below it.
      const paneTop = pane ? pane.getBoundingClientRect().top + window.scrollY : top;
      const offset = Math.max(0, top - paneTop);
      const appBar = document.querySelector<HTMLElement>('app-header .navbar')?.getBoundingClientRect().height || 0;
      const roomBelow = Math.round(window.innerHeight - top - 12);
      if (roomBelow >= 420) {
        this.chatPaneHeight = roomBelow;
        return;
      }
      this.chatPaneHeight = Math.max(320, Math.round(window.innerHeight - appBar - offset - 12));
      if (withScroll) setTimeout(() => window.scrollTo({ top: Math.max(0, paneTop - appBar), behavior: 'smooth' }), 50);
    };
    // Once the tab is shown, and again when the page has settled (chat toolbar, smooth scroll back to the top).
    setTimeout(() => measure(false));
    setTimeout(() => measure(scroll), 450);
  }


  userid = sessionStorage.getItem('userId');
  clientId: string = '';
  client!: Client;
  private chatService = inject(ChatService);

  get fullName(): string {
    return `${this.client?.firstName} ${this.client?.lastName}`;
  }

  get filteredCoachClients(): Client[] {
    const search = this.clientSearch.trim().toLowerCase();
    if (!search) return this.coachClients;

    return this.coachClients.filter((client) =>
      `${client.firstName || ''} ${client.lastName || ''} ${client.email || ''}`
        .toLowerCase()
        .includes(search)
    );
  }

  get clientInitials(): string {
    return `${this.client?.firstName?.[0] || ''}${this.client?.lastName?.[0] || ''}`.toUpperCase() || '--';
  }

  get selectedClientPickerPhoto(): string {
    const selectedClient = this.coachClients.find((client) => client.id === this.clientId);
    return this.getClientPickerPhoto(selectedClient || this.client);
  }

  get profilePhotoUrl(): string {
    return this.getClientPickerPhoto(this.client);
  }

  /** Shown when the client has no photo (or the link of their photo does not answer). */
  readonly defaultAvatarUrl = 'assets/avatar.png';

  /** Age from the birth date, null when unknown. */
  get clientAge(): number | null {
    const birth = this.safeDate((this.client as any)?.birthDate);
    if (!birth) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age > 0 && age < 120 ? age : null;
  }

  get clientGenderKey(): string {
    const gender = String((this.client as any)?.gender || '').toUpperCase();
    if (gender.startsWith('M') || gender === 'HOMME') return 'GENDER_MALE';
    if (gender.startsWith('F')) return 'GENDER_FEMALE';
    return '';
  }


  /** Weight shown in the header: last measurement, else the weight given at onboarding. */
  get headerCurrentWeight(): number | null {
    if (this.currentWeight !== null) return this.currentWeight;
    const value = Number((this.client as any)?.currentWeight);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Last day with a workout up to today (client workout dates). */
  get lastWorkoutDate(): Date | null {
    const today = this.startOfDay(new Date()).getTime();
    const past = (this.client?.workoutDates || [])
      .map((value) => this.safeDate(value))
      .filter((date): date is Date => !!date && this.startOfDay(date).getTime() <= today)
      .sort((a, b) => b.getTime() - a.getTime());
    return past[0] || null;
  }

  /** Full text of the header info line (shown on hover when the line is cut). */
  get headerFactsTitle(): string {
    const parts: string[] = [];
    if (this.clientAge !== null) parts.push(this.translate.instant('PROFILE_AGE_YEARS', { age: this.clientAge }));
    if (this.clientGenderKey) parts.push(this.translate.instant(this.clientGenderKey));
    if (this.headerCurrentWeight !== null) parts.push(this.formatWeight(this.headerCurrentWeight));
    if (this.clientTargetWeight !== null) parts.push(`${this.translate.instant('GOAL_WEIGHT')} ${this.formatWeight(this.clientTargetWeight)}`);
    return parts.join(' · ');
  }

  get dateLocale(): string {
    return this.translate.currentLang === 'en' ? 'en-US' : 'fr-FR';
  }

  /* ---------- Header: status, current program, this week; the « Profil du client » panel ---------- */

  profilePanelOpen = false;
  heroPhotoFailed = false;
  headerWorkout: ProgramOverview | null = null;
  headerNutrition: ProgramOverview | null = null;

  get heroFr(): boolean {
    return this.translate.currentLang !== 'en';
  }

  /**
   * Same as the client list: Active or Archived. « Invited » is only a pending invitation, which has no profile yet:
   * `activated` is the account's block flag, not an invitation state.
   */
  get headerStatus(): ClientHeaderStatus {
    return this.clientArchived ? 'ARCHIVED' : 'ACTIVE';
  }

  get headerStatusLabel(): string {
    const fr = this.heroFr;
    switch (this.headerStatus) {
      case 'ARCHIVED': return fr ? 'Archivé' : 'Archived';
      default: return fr ? 'Actif' : 'Active';
    }
  }

  /** The training program going on (else the nutrition one) and its week. */
  get heroProgram(): { name: string; week: number; weeks: number } | null {
    const current = this.headerWorkout?.current || this.headerNutrition?.current;
    if (!current) return null;
    return { name: current.program.name, week: current.week, weeks: current.weeks };
  }

  /** The first weigh-in, else the weight given at onboarding. */
  get panelStartWeight(): string {
    const onboarding = Number((this.client as any)?.currentWeight);
    const start = this.startWeight ?? (Number.isFinite(onboarding) && onboarding > 0 ? onboarding : null);
    return start !== null ? this.formatWeight(start) : '--';
  }

  openProfilePanel(): void {
    this.profilePanelOpen = true;
  }

  /** Both « Programmes » tabs (shared with the prefetch): what the header and the profile panel show. */
  private loadHeaderOverviews(): void {
    const clientId = this.clientId;
    if (!clientId) return;
    this.headerWorkout = this.programSchedule.overviewSnapshot('WORKOUT', clientId);
    this.headerNutrition = this.programSchedule.overviewSnapshot('NUTRITION', clientId);
    this.programSchedule.overview('WORKOUT', clientId).subscribe({
      next: overview => { if (this.clientId === clientId) this.headerWorkout = overview; },
      error: () => {},
    });
    this.programSchedule.overview('NUTRITION', clientId).subscribe({
      next: overview => { if (this.clientId === clientId) this.headerNutrition = overview; },
      error: () => {},
    });
  }

  onHeaderPhotoError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(this.defaultAvatarUrl)) image.src = this.defaultAvatarUrl;
    this.onProfilePhotoError();
  }

  getClientInitials(client: Client): string {
    return `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase() || '--';
  }

  getClientPickerPhoto(client: Client): string {
    const url = String(client.avatarUrl || client.image || '').trim();
    return url && url.toLowerCase() !== 'not found' ? url : '';
  }

  onClientPickerPhotoError(client: Client): void {
    client.avatarUrl = '';
    client.image = '';
  }

  onSelectedClientPickerPhotoError(): void {
    const selectedClient = this.coachClients.find((client) => client.id === this.clientId);
    if (selectedClient) this.onClientPickerPhotoError(selectedClient);
    if (this.client) this.onClientPickerPhotoError(this.client);
  }

  onProfilePhotoError(): void {
    if (this.client) this.onClientPickerPhotoError(this.client);
  }

  isSelectedClient(client: Client): boolean {
    return !!client.id && client.id === this.clientId;
  }

  toggleClientPicker(event: Event): void {
    event.stopPropagation();
    this.clientPickerOpen = !this.clientPickerOpen;
    if (this.clientPickerOpen) {
      this.clientSearch = '';
      this.loadCoachClients();
    }
  }

  selectProfileClient(client: Client): void {
    if (!client.id || client.id === this.clientId) {
      this.clientPickerOpen = false;
      return;
    }

    this.clientPickerOpen = false;
    this.clientSearch = '';
    // Show the known identity right away; loadClientData refreshes it silently.
    this.client = client;
    this.seededClientId = String(client.id);
    this.router.navigate(['/clients/profil-client', client.id], {
      queryParams: { tab: this.activeTab === 'dashboard' ? null : this.activeTab },
    });
  }

  private loadCoachClients(): void {
    if (this.coachClientsLoaded || this.loadingCoachClients || !this.userid) return;
    // A list kept from a previous profile shows at once (even a few minutes old); a stale one is refreshed behind it.
    const known = this.profileCache.coachClientsSnapshot(this.userid);
    if (known) {
      this.coachClients = known.clients;
      this.coachClientsLoaded = true;
      if (known.fresh) return;
    }

    this.loadingCoachClients = !known;
    // The client panel fills in behind the profile: it never shows the page loader.
    this.clientService.getListClientsByCoachWithoutPagination(this.userid, true).subscribe({
      next: (response) => {
        const clients = Array.isArray(response) ? response : response?.content || [];
        const previous = new Map<string, Client>((known?.clients || []).map((c: Client) => [String(c.id), c]));
        // Keep the photos already fetched so the rows do not flash back to initials.
        const validClients: Client[] = clients
          .filter((client: Client) => !!client.id)
          .map((client: Client) => ({ ...client, avatarUrl: client.avatarUrl || previous.get(String(client.id))?.avatarUrl || '' }));

        this.coachClients = validClients;
        this.coachClientsLoaded = true;
        this.loadingCoachClients = false;
        this.profileCache.rememberCoachClients(this.userid!, validClients);

        // The clients endpoint does not include the account avatar. Fetch the missing ones a few at a time and
        // fill each row as its photo arrives (photos shared with the client list page): the list never waits for them.
        const missing = validClients.filter((client) => !client.avatarUrl && !client.image);
        from(missing)
          .pipe(
            mergeMap(
              (client) => this.usersService.getAvatarUrl(client.id!).pipe(map((avatarUrl) => ({ client, avatarUrl }))),
              4,
            ),
            takeUntil(this.destroy$),
          )
          .subscribe(({ client, avatarUrl }) => {
            client.avatarUrl = avatarUrl;
          });
      },
      error: () => {
        if (!known) this.coachClients = [];
        this.loadingCoachClients = false;
      },
    });
  }

  get clientTargetWeight(): number | null {
    const value = (this.client as any)?.targetWeight;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isNaN(parsed) ? null : parsed;
  }


  get bodyweightMeasurements(): BodyMeasurement[] {
    return this.bodyMeasurements
      .filter((item) => item.measurementType === 'BODYWEIGHT')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  get startWeight(): number | null {
    const items = this.bodyweightMeasurements;
    return items.length ? items[0].value : null;
  }

  get currentWeight(): number | null {
    const items = this.bodyweightMeasurements;
    return items.length ? items[items.length - 1].value : null;
  }

  get weightLost(): number | null {
    if (this.startWeight === null || this.currentWeight === null) {
      return null;
    }

    return Math.max(0, this.startWeight - this.currentWeight);
  }

  get weightToGoal(): number | null {
    if (this.currentWeight === null || this.clientTargetWeight === null) {
      return null;
    }

    return Math.max(0, this.currentWeight - this.clientTargetWeight);
  }

  get weightProgress(): number {
    if (
      this.startWeight === null ||
      this.currentWeight === null ||
      this.clientTargetWeight === null
    ) {
      return 0;
    }

    const total = this.startWeight - this.clientTargetWeight;
    if (total <= 0) {
      return 0;
    }

    const completed = this.startWeight - this.currentWeight;
    return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
  }

  get clientObjective(): string {
    return (
      clientObjectiveLabel((this.client as any)?.mainObjective, this.heroFr) ||
      (this.clientTargetWeight ? `Goal weight ${this.formatWeight(this.clientTargetWeight)}` : '')
    );
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '--';
    }

    return Number(value).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    });
  }

  formatWeight(valueKg: number | null | undefined): string {
    return this.coachSettingsService.formatWeight(valueKg);
  }

  loadBodyMeasurements(force = true): void {
    if (!this.clientId) {
      return;
    }
    const clientId = this.clientId;
    if (force) {
      this.profileCache.forget('measurements', clientId);
    } else {
      const known = this.profileCache.snapshot<BodyMeasurement[]>('measurements', clientId);
      if (known) {
        this.bodyMeasurements = known;
        this.measurementsLoaded = true;
        this.finishProfileLoading();
        if (this.profileCache.isFresh('measurements', clientId)) return;
      }
    }

    this.profileCache.load<BodyMeasurement[]>('measurements', this.userid || '', clientId).subscribe({
      next: (items) => {
        if (clientId !== this.clientId) return;
        this.bodyMeasurements = items || [];
        this.measurementsLoaded = true;
        this.finishProfileLoading();
      },
      error: (err) => {
        console.error('Failed to load body measurements:', err);
        this.bodyMeasurements = [];
        this.measurementsLoaded = true;
        this.finishProfileLoading();
      },
    });
  }

  showAssignSelectModal = false;
  assignType: 'WORKOUT' | 'NUTRITION' | 'CHECKIN' = 'WORKOUT';

  showProgramSelectionModal = false;
  showNutritionSelectionModal = false;
  showNutritionExistingTypeModal = false;
  nutritionSelectionMode: 'ALL' | 'APP' | 'FILES' = 'ALL';
  showChooseModal = false;
  showWorkoutTypeModal = false;
  workoutFileEnabled = true;
  nutritionFileEnabled = true;
  showFileWorkoutImportModal = false;
  showClientWorkoutCreateModal = false;
  clientWorkoutProgramName = '';
  clientWorkoutDurationWeeks = 4;
  clientWorkoutStartDate = '';
  /** A start proposed by the « Programmes » tab (the first day of a gap); none: today or the continuity. */
  assignPresetStart: string | null = null;
  readonly workoutDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  showClientNutritionCreateModal = false;
  clientNutritionProgramName = '';
  clientNutritionDurationWeeks = 4;
  clientNutritionStartDate = '';
  selectedClientNutritionPlanType: NutritionPlanChoice | null = null;

  /* Affectation (backlog-programmes.md A5/A6): what changes on the client's calendar before a creation or an import. */
  schedulePreviews: Record<string, ClientSchedulePreview> = {};
  scheduleChecking = false;
  scheduleConfirm: 'WORKOUT_CREATE' | 'NUTRITION_CREATE' | 'WORKOUT_FILE' | 'NUTRITION_FILE' | null = null;
  scheduleConfirmRows: AssignConfirmRow[] = [];
  scheduleConfirmName = '';
  scheduleConfirmStart = '';
  private scheduleConfirmed = false;
  private cachedClientIds: string[] = [];

  /** This client, as a stable list for the schedule (a new array at each check would ask the server again). */
  get profileClientIds(): string[] {
    const id = this.clientId ? String(this.clientId) : '';
    if ((this.cachedClientIds[0] || '') !== id) this.cachedClientIds = id ? [id] : [];
    return this.cachedClientIds;
  }

  /**
   * Before a creation or an import that changes the client's calendar: shows the confirmation and returns true (the
   * caller stops); once confirmed, the caller runs again and goes on.
   */
  private askScheduleConfirm(kind: 'WORKOUT_CREATE' | 'NUTRITION_CREATE' | 'WORKOUT_FILE' | 'NUTRITION_FILE',
                             programName: string, startDate: string): boolean {
    if (this.scheduleConfirmed) {
      this.scheduleConfirmed = false;
      this.scheduleConfirm = null;
      return false;
    }
    const lines = (this.schedulePreviews[String(this.clientId)]?.changes || [])
      .map(change => this.programSchedule.text(changeSentence(change, this.programSchedule.formatDate)));
    if (!lines.length) return false;
    this.scheduleConfirmRows = [{ id: String(this.clientId), name: this.fullName, lines }];
    this.scheduleConfirmName = programName;
    this.scheduleConfirmStart = startDate;
    this.scheduleConfirm = kind;
    return true;
  }

  onScheduleConfirmed(): void {
    const kind = this.scheduleConfirm;
    this.scheduleConfirmed = true;
    if (kind === 'WORKOUT_CREATE') this.createClientWorkoutProgram();
    else if (kind === 'NUTRITION_CREATE') this.createClientNutritionProgram();
    else if (kind === 'WORKOUT_FILE') this.saveAndAssignProfileFileWorkout();
    else if (kind === 'NUTRITION_FILE') this.saveAndAssignProfileFileNutrition();
  }

  onScheduleBack(): void {
    this.scheduleConfirm = null;
    this.scheduleConfirmed = false;
  }

  private resetScheduleState(): void {
    this.schedulePreviews = {};
    this.scheduleChecking = false;
    this.scheduleConfirm = null;
    this.scheduleConfirmed = false;
  }

  profileImportWorkoutFile: File | null = null;
  profileImportWorkoutName = '';
  profileImportWorkoutDetails = '';
  profileImportStartDate = '';
  profileImportEndDate = '';
  profileImportSaving = false;
  profileImportError = '';

  showNutritionFileImportModal = false;
  profileImportNutritionFile: File | null = null;
  profileImportNutritionName = '';
  profileImportNutritionDetails = '';
  profileImportNutritionStartDate = '';
  profileImportNutritionEndDate = '';
  profileImportNutritionSaving = false;
  profileImportNutritionError = '';

  nutritionSelectionList: any[] = [];
  nutritionSelectionPage = 0;
  nutritionSelectionTotalPages = 0;
  nutritionSelectionLoading = false;
  nutritionSelectionSearch = '';
  assignments: FormAssignment[] = [];
  submissionAssignments: FormAssignment[] = [];
  assignedAssignments: FormAssignment[] = [];
  loadingAssignments = false;
  assignmentsError: string | null = null;
  private readonly PAGE_SIZE = 5;

  submissionsPage = 0;
  submissionsTotalPages = 0;
  submissionsPagesArray: number[] = [];

  assignedPage = 0;
  assignedTotalPages = 0;
  assignedPagesArray: Array<number | 'ellipsis'> = [];

  scheduledPage = 0;
  scheduledPageSize = 5;
  scheduledTotalPages = 0;
  scheduledPagesArray: number[] = [];
  selectedAssignment: FormAssignment | null = null;
  private readonly destroy$ = new Subject<void>();

  isModalOpen = false;
  isViewMode = false;
  modalMode: 'preview' | 'view' = 'preview';
  reviewLoading = false;
  reviewError: string | null = null;

  modalLoading = false;
  modalError: string | null = null;

  currentForm: FormDetails | null = null;
  submittedAnswers: Answer[] = [];

  QuestionType = QuestionType;
  preselectFormId: string | null = null;
  scheduledItems: ClientScheduleItemDto[] = [];
  loadingScheduled = false;
  scheduledError: string | null = null;
  selectedSchedule: ClientScheduleItemDto | null = null;
  confirmScheduledDeleteOpen = false;
  deletingScheduled = false;
  selectedScheduledToDelete: ClientScheduleItemDto | null = null;

  todaysWorkout: TodaysWorkout | null = null;
  activeNutritionPlan: ActiveNutritionPlan | null = null;
  assignedWorkoutPrograms: any[] = [];
  workoutActivities: WorkoutActivity[] = [];
  workoutActivityFilter: WorkoutActivityFilter = 'ALL';
  readonly workoutActivityFilters: WorkoutActivityFilter[] = ['ALL', 'COMPLETED', 'IN_PROGRESS', 'OVERDUE', 'MISSED', 'UPCOMING'];
  readonly nutritionActivityFilters: ('ALL' | NutritionActivityStatus)[] = ['ALL', 'COMPLETED', 'IN_PROGRESS', 'NOT_LOGGED', 'OFF_PLAN'];
  workoutActivityVisibleCount = 10;
  showAllWorkoutActivity = false;
  selectedWorkoutActivity: WorkoutActivity | null = null;
  nutritionActivities: NutritionActivity[] = [];
  selectedNutritionActivity: NutritionActivity | null = null;
  showAllNutritionActivity = false;
  /** Day opened from a coach dashboard activity (?workoutDayId / ?nutritionDayId), once its plans are loaded. */
  private linkedWorkoutDayId: string | null = null;
  private linkedNutritionDayId: string | null = null;
  nutritionActivityFilter: 'ALL' | NutritionActivityStatus = 'ALL';
  nutritionActivityVisibleCount = 10;
  assignedNutritionPrograms: any[] = [];
  private pendingCreatedWorkoutToAssign: any | null = null;
  private pendingCreatedNutritionToAssign: any | null = null;
  loadingDashboardPrograms = false;
  dashboardProgramsError: string | null = null;

  get hasTodaysWorkout(): boolean {
    return !!this.todaysWorkout && this.todaysWorkout.exercises.length > 0;
  }

  get hasActiveNutritionPlan(): boolean {
    return !!this.activeNutritionPlan;
  }

  private macroSharesCache: { key: string; value: NutritionMacroShares } | null = null;

  /** Calorie share of each macro (protein/carbs 4 kcal/g, fat 9 kcal/g) for the dashboard donut; colors match the nutrition builder. */
  get nutritionMacroShares(): NutritionMacroShares | null {
    const plan = this.activeNutritionPlan;
    if (!plan) return null;
    const protein = Number(plan.protein) || 0;
    const carbs = Number(plan.carbs) || 0;
    const fat = Number(plan.fat) || 0;
    const key = `${protein}|${carbs}|${fat}`;
    if (this.macroSharesCache?.key === key) return this.macroSharesCache.value;

    const kcal = [protein * 4, carbs * 4, fat * 9];
    const total = kcal[0] + kcal[1] + kcal[2];
    const raw = total ? kcal.map((value) => (value / total) * 100) : [0, 0, 0];
    const percents = raw.map((value) => Math.round(value));
    if (total) {
      // Rounded shares must add up to 100: the rounding gap goes to the largest macro.
      const gap = 100 - percents.reduce((sum, value) => sum + value, 0);
      percents[percents.indexOf(Math.max(...percents))] += gap;
    }

    const defs = [
      { label: 'PROTEIN', grams: protein, color: '#44b4df' },
      { label: 'CARBS', grams: carbs, color: '#f59e0b' },
      { label: 'FAT', grams: fat, color: '#8b5cf6' },
    ];
    let start = 0;
    const stops = defs.map((def, index) => {
      const end = start + raw[index];
      const stop = `${def.color} ${start}% ${end}%`;
      start = end;
      return stop;
    });
    const value: NutritionMacroShares = {
      items: defs.map((def, index) => ({ ...def, percent: percents[index] })),
      gradient: total ? `conic-gradient(${stops.join(', ')})` : 'light-dark(#e5e7eb, #33393d)',
    };
    this.macroSharesCache = { key, value };
    return value;
  }

  get latestWorkoutActivities(): WorkoutActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    return this.workoutActivities
      .filter(activity =>
        activity.scheduledDate.getTime() <= today &&
        activity.status !== 'UPCOMING' &&
        activity.status !== 'NOT_STARTED'
      )
      .slice(0, 5);
  }

  get filteredWorkoutActivities(): WorkoutActivity[] {
    const filtered = this.workoutActivities.filter(activity => this.matchesWorkoutFilter(activity, this.workoutActivityFilter));
    // Upcoming: the next workout first (the others: the latest first).
    return this.workoutActivityFilter === 'UPCOMING' ? [...filtered].reverse() : filtered;
  }

  private matchesWorkoutFilter(activity: WorkoutActivity, filter: WorkoutActivityFilter): boolean {
    if (filter === 'ALL') return activity.status !== 'UPCOMING' && activity.status !== 'NOT_STARTED';
    if (filter === 'COMPLETED') return activity.status === 'COMPLETED' || activity.status === 'COMPLETED_AFTER_WORKOUT';
    if (filter === 'UPCOMING') return activity.status === 'UPCOMING' || activity.status === 'NOT_STARTED';
    return activity.status === filter;
  }

  /** The count shown on each filter of « Toute l'activité ». */
  workoutFilterCount(filter: WorkoutActivityFilter): number {
    return this.workoutActivities.filter(activity => this.matchesWorkoutFilter(activity, filter)).length;
  }

  nutritionFilterCount(filter: 'ALL' | NutritionActivityStatus): number {
    return filter === 'ALL'
      ? this.nutritionActivities.length
      : this.nutritionActivities.filter(activity => activity.status === filter).length;
  }

  workoutFilterLabel(filter: WorkoutActivityFilter): string {
    return this.translate.instant(`WORKOUT_ACTIVITY_STATUS_${filter === 'OVERDUE' ? 'NOT_LOGGED' : filter}`);
  }

  private lastSevenDays<T extends { scheduledDate: Date }>(items: T[]): T[] {
    const today = this.startOfDay(new Date()).getTime();
    // By the calendar, not 6 × 24 h: a day can last 23 or 25 hours when the clocks change.
    const fromDate = this.startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - 6);
    const from = fromDate.getTime();
    return items.filter(item => {
      const time = this.startOfDay(item.scheduledDate).getTime();
      return time >= from && time <= today;
    });
  }

  /** The last 7 days at a glance: workouts due (today's only once started), done, missed, not logged. */
  get workoutWeekSummary(): { done: number; total: number; missed: number; notLogged: number } {
    const due = this.lastSevenDays(this.workoutActivities)
      .filter(activity => activity.status !== 'UPCOMING' && activity.status !== 'NOT_STARTED');
    return {
      done: due.filter(activity => activity.status === 'COMPLETED' || activity.status === 'COMPLETED_AFTER_WORKOUT').length,
      total: due.length,
      missed: due.filter(activity => activity.status === 'MISSED').length,
      notLogged: due.filter(activity => activity.status === 'OVERDUE').length,
    };
  }

  /**
   * Nutrition days of the last 7 days: reported (at least one meal, or the whole day) out of those due. Today counts
   * only once something is reported (it is not over); « notLogged » is the days the « Non renseigné » filter shows.
   */
  get nutritionWeekSummary(): { logged: number; total: number; notLogged: number } {
    const today = this.startOfDay(new Date()).getTime();
    const days = this.lastSevenDays(this.nutritionActivities)
      .filter(activity => activity.scheduledDate.getTime() < today || activity.loggedMeals > 0 || activity.status !== 'IN_PROGRESS');
    const notLogged = days.filter(activity => activity.status === 'NOT_LOGGED').length;
    return { logged: days.length - notLogged, total: days.length, notLogged };
  }

  get visibleWorkoutActivities(): WorkoutActivity[] {
    return this.filteredWorkoutActivities.slice(0, this.workoutActivityVisibleCount);
  }

  get canViewMoreWorkoutActivities(): boolean {
    return this.workoutActivityVisibleCount < this.filteredWorkoutActivities.length;
  }

  get latestNutritionActivities(): NutritionActivity[] {
    const today = this.startOfDay(new Date()).getTime();
    return this.nutritionActivities
      .filter(activity => activity.scheduledDate.getTime() <= today)
      .slice(0, 5);
  }

  get filteredNutritionActivities(): NutritionActivity[] {
    return this.nutritionActivities.filter(activity =>
      this.nutritionActivityFilter === 'ALL' || activity.status === this.nutritionActivityFilter
    );
  }

  get visibleNutritionActivities(): NutritionActivity[] {
    return this.filteredNutritionActivities.slice(0, this.nutritionActivityVisibleCount);
  }

  get canViewMoreNutritionActivities(): boolean {
    return this.nutritionActivityVisibleCount < this.filteredNutritionActivities.length;
  }

  activeSubTab: 'submissions' | 'assigned' | 'scheduled' = 'submissions';
  submissionSearch = '';
  private notificationAssignmentId: string | null = null;
  assignedSearch = '';

  showCheckinModal = false;
  showFormSelectionModal = false;

  scheduledCheckIns: ScheduledCheckIn[] = [];
  bodyMeasurements: BodyMeasurement[] = [];

  @Input() set clientIdInput(id: string) {
    if (id && id !== this.clientId) {
      this.clientId = id;
      this.loadClientData();
    }
  }

  get clientArchived(): boolean { return !!this.client?.clientStatus && this.client.clientStatus !== 'ACTIVE'; }

  private canCoach(): boolean {
    if (!this.clientArchived) return true;
    this.toastService.error('This client is archived. Reactivate the client to continue coaching.');
    return false;
  }

  reactivateClient(): void {
    this.clientService.updateClientStatus(this.clientId, 'ACTIVE').subscribe(client => {
      this.client = client;
      this.profileCache.forget('client', this.clientId);
      this.loadClientData();
    });
  }

  constructor(
    public programSchedule: ProgramScheduleService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private clientService: ClientService,
    private usersService: UsersService,
    private workoutService: WorkoutService,
    private router: Router,
    private nutritionService: NutritionService,
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private bodyMeasurementsService: BodyMeasurementsService,
    public coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    private profileCache: ClientProfileCacheService,
  ) {
    // After an assignment or an « Annuler » (backlog-programmes.md A7): the programs shown are read again.
    this.programSchedule.changed$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.loadDashboardPrograms();
      this.loadHeaderOverviews();
      this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
      this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
    });
    const seededClient = history.state?.profileClient as Client | undefined;
    if (seededClient?.id) {
      this.client = seededClient;
      this.seededClientId = String(seededClient.id);
    }

    this.route.paramMap.subscribe((params) => {
      const routeId = params.get('id') || '';
      if (routeId && routeId !== this.clientId) {
        this.clientId = routeId;
        this.loadClientData();
      }
    });

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as TabId | undefined;
      if (tab) {
        this.activeTab = tab;
        this.loadTabData(tab);
      }
      this.notificationAssignmentId = params['assignmentId'] || null;
      if (params['workoutDayId']) this.linkedWorkoutDayId = params['workoutDayId'];
      if (params['nutritionDayId']) this.linkedNutritionDayId = params['nutritionDayId'];
      this.openLinkedActivity();

      const openAssign = params['openAssign'] === '1';
      const preselectFormId = params['preselectFormId'];

      if (openAssign) {
        this.assignType = 'CHECKIN';
        this.showAssignSelectModal = false;
        Promise.resolve().then(() => {
          this.showFormSelectionModal = true;
        });
      }

      // Coach dashboard "Assign": the profile's own assignment flow, this client already selected.
      const openProgramAssign = params['openAssign'] === 'workout' ? 'WORKOUT'
        : params['openAssign'] === 'nutrition' ? 'NUTRITION' : null;
      if (openProgramAssign) {
        Promise.resolve().then(() => this.openAssignProgramModal(openProgramAssign));
      }

      if (typeof preselectFormId === 'string' && preselectFormId.trim() !== '') {
        this.preselectFormId = preselectFormId;
      }

      if (openAssign || openProgramAssign || preselectFormId) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { openAssign: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });

    const assignAfterCreate = history.state?.assignAfterCreate;
    if (assignAfterCreate?.type === 'workout' && assignAfterCreate?.item) {
      this.pendingCreatedWorkoutToAssign = assignAfterCreate.item;
    }
    if (assignAfterCreate?.type === 'nutrition' && assignAfterCreate?.item) {
      this.pendingCreatedNutritionToAssign = assignAfterCreate.item;
    }

    this.loadWorkoutFileSetting();
    if (this.clientNavOpen) this.loadCoachClients();
  }


  private loadWorkoutFileSetting(): void {
    this.coachSettingsService.loadConfig(true).subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

        if (!this.workoutFileEnabled) {
          this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
        }

        if (!this.nutritionFileEnabled) {
          this.showNutritionFileImportModal = false;
          this.showNutritionExistingTypeModal = false;
          if (this.nutritionSelectionMode === 'FILES') {
            this.nutritionSelectionMode = 'APP';
          }
        }
      },
      error: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      },
    });
  }

  private loadClientData(): void {
    if (!this.clientId) return;
    // The « Entraînement » and « Nutrition » tabs: read now, shown at once when the coach opens them.
    this.programSchedule.prefetchOverviews(this.clientId);
    this.heroPhotoFailed = false;
    this.profilePanelOpen = false;
    this.loadHeaderOverviews();
    const cachedClient = this.profileCache.snapshot<Client>('client', this.clientId);
    if (cachedClient && this.seededClientId !== String(this.clientId)) {
      this.client = cachedClient;
      this.seededClientId = String(this.clientId);
    }
    const hasSeededClient = this.seededClientId === String(this.clientId);
    this.profileLoading = !hasSeededClient;
    this.clientHeaderLoaded = hasSeededClient;
    this.measurementsLoaded = false;
    this.workoutDashboardLoaded = false;
    this.nutritionDashboardLoaded = false;
    this.checkinsLoaded = false;
    this.submissionsLoaded = false;
    this.assignedLoaded = false;
    this.openedTabs = new Set<TabId>([this.activeTab]);
    this.clientKey = [this.clientId];
    if (!(hasSeededClient && this.profileCache.isFresh('client', this.clientId))) {
      this.getClientById(this.clientId, hasSeededClient);
    } else {
      this.applyClient(this.profileCache.snapshot<Client>('client', this.clientId)!, this.clientId);
    }
    this.loadBodyMeasurements(false);
    this.loadDashboardPrograms(false);
    this.loadTabData(this.activeTab);
  }

  isTabOpened(tab: TabId): boolean {
    return this.openedTabs.has(tab);
  }

  private loadTabData(tab: TabId): void {
    this.openedTabs.add(tab);
    if (tab === 'chat') this.fitChatPane();
    if (tab === 'checkins' && !this.checkinsLoaded) {
      this.checkinsLoaded = true;
      this.loadClientAssignments();
    }
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  getClientById(id: string, silent = false) {
    // Silent (identity already shown): shared with a prefetch from the list and kept for the next opening.
    // Kept for the next opening and shared with the tabs (measurements units) and a prefetch from the list.
    this.profileCache.load<Client>('client', this.userid || '', id).subscribe({
      next: (res) => {
        if (String(id) !== String(this.clientId)) return;
        this.applyClient(res, id);
      },
      error: (err) => {
        console.error('Failed to load client profile:', err);
        if (!silent) this.toastService.error(this.translate.instant('FAILED_TO_LOAD_CLIENT'));
        this.clientHeaderLoaded = true;
        this.finishProfileLoading();
      },
    });
  }

  private applyClient(res: Client, id: string): void {
    const avatarUrl = this.client && String(this.client.id) === String(id) ? this.client.avatarUrl : undefined;
    this.client = avatarUrl && !res.avatarUrl ? { ...res, avatarUrl } : res;
    this.enrichProfilePhoto(id);
    this.clientHeaderLoaded = true;
    this.finishProfileLoading();
    this.assignPendingCreatedWorkoutIfNeeded();
    this.assignPendingCreatedNutritionIfNeeded();
  }

  private enrichProfilePhoto(id: string): void {
    this.usersService.getAvatarUrl(id).subscribe((avatarUrl) => {
      if (!this.client || !avatarUrl || String(this.client.id) !== String(id)) return;
      this.client = { ...this.client, avatarUrl };
    });
  }

  private finishProfileLoading(): void {
    // Only the identity request blocks opening the profile. Measurements and
    // program details enrich the already visible dashboard in the background.
    this.profileLoading = !this.clientHeaderLoaded;
    this.warmUpMainTabs();
  }

  /** Workouts and nutrition tabs prepared once per client, after the dashboard. */
  private tabsWarmedFor = '';

  /**
   * The two most used tabs are created (hidden) once the dashboard is loaded: their lists load in the background
   * and the first click on them is instant. The tabs stay as they are when the coach already opened them.
   */
  private warmUpMainTabs(): void {
    const clientId = this.clientId;
    if (!clientId || this.tabsWarmedFor === clientId || !this.workoutDashboardLoaded || !this.nutritionDashboardLoaded) return;
    this.tabsWarmedFor = clientId;
    setTimeout(() => {
      if (this.clientId !== clientId) return;
      this.openedTabs.add('workouts');
      this.openedTabs.add('nutrition');
      this.openedTabs.add('tasks');
    }, 400);
  }


  private loadDashboardPrograms(force = true): void {
    if (!this.clientId || !this.userid) {
      this.workoutDashboardLoaded = true;
      this.nutritionDashboardLoaded = true;
      this.finishProfileLoading();
      return;
    }
    const clientId = this.clientId;

    // Plans changed (or another client): the calendar tab shows them, it is created again on its next visit.
    if (this.activeTab !== 'calendar') this.openedTabs.delete('calendar');

    this.dashboardProgramsError = null;
    if (force) {
      this.profileCache.forget('workouts', clientId);
      this.profileCache.forget('nutrition', clientId);
    }
    const knownWorkouts = force ? null : this.profileCache.snapshot<any[]>('workouts', clientId);
    const knownNutrition = force ? null : this.profileCache.snapshot<any[]>('nutrition', clientId);
    if (knownWorkouts) this.applyWorkoutPlans(knownWorkouts);
    else {
      this.todaysWorkout = null;
      this.workoutActivities = [];
    }
    if (knownNutrition) this.applyNutritionPlans(knownNutrition);
    else {
      this.activeNutritionPlan = null;
      this.nutritionActivities = [];
    }
    const workoutsFresh = !!knownWorkouts && this.profileCache.isFresh('workouts', clientId);
    const nutritionFresh = !!knownNutrition && this.profileCache.isFresh('nutrition', clientId);
    this.loadingDashboardPrograms = !nutritionFresh;

    // The assigned-plan lists already hold the full plans (days, sessions, meals and the client logs), with
    // the assignment dates computed by the server: the dashboard is built from them in one request each.
    if (!workoutsFresh) {
      this.profileCache.load<any[]>('workouts', this.userid, clientId).subscribe({
        next: (plans) => {
          if (clientId === this.clientId) this.applyWorkoutPlans(plans);
        },
        error: (err) => {
          if (clientId !== this.clientId) return;
          console.error('Failed to load today workout:', err);
          this.assignedWorkoutPrograms = [];
          this.todaysWorkout = null;
          this.workoutActivities = [];
          this.dashboardProgramsError = 'Failed to load today workout.';
          this.workoutDashboardLoaded = true;
          this.finishProfileLoading();
        },
      });
    }

    if (!nutritionFresh) {
      this.profileCache.load<any[]>('nutrition', this.userid, clientId).subscribe({
        next: (plans) => {
          if (clientId !== this.clientId) return;
          this.applyNutritionPlans(plans);
          this.loadingDashboardPrograms = false;
        },
        error: (err) => {
          if (clientId !== this.clientId) return;
          console.error('Failed to load active nutrition plan:', err);
          this.assignedNutritionPrograms = [];
          this.activeNutritionPlan = null;
          this.nutritionActivities = [];
          this.loadingDashboardPrograms = false;
          this.dashboardProgramsError = 'Failed to load active nutrition plan.';
          this.nutritionDashboardLoaded = true;
          this.finishProfileLoading();
        },
      });
    }
  }

  private applyWorkoutPlans(plans: any[]): void {
    this.assignedWorkoutPrograms = this.sortPlansByStartDate(plans);
    this.todaysWorkout = this.extractTodaysWorkout(plans);
    this.workoutActivities = buildWorkoutActivities(plans);
    this.workoutDashboardLoaded = true;
    this.finishProfileLoading();
    this.openLinkedActivity();
  }

  private applyNutritionPlans(plans: any[]): void {
    this.assignedNutritionPrograms = this.sortPlansByStartDate(plans);
    this.activeNutritionPlan = this.extractTodaysNutrition(plans);
    this.nutritionActivities = buildNutritionActivities(plans);
    this.nutritionDashboardLoaded = true;
    this.finishProfileLoading();
    this.openLinkedActivity();
  }

  /** Opens the day a coach dashboard link points to; a day no longer in the plans leaves the dashboard as is. */
  private openLinkedActivity(): void {
    let handled = false;
    if (this.linkedWorkoutDayId && this.workoutDashboardLoaded) {
      const activity = this.workoutActivities.find(item => item.id === this.linkedWorkoutDayId);
      this.linkedWorkoutDayId = null;
      handled = true;
      if (activity) this.openWorkoutActivity(activity);
    }
    if (this.linkedNutritionDayId && this.nutritionDashboardLoaded) {
      const activity = this.nutritionActivities.find(item => item.id === this.linkedNutritionDayId);
      this.linkedNutritionDayId = null;
      handled = true;
      if (activity) this.openNutritionActivity(activity);
    }
    if (handled) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { workoutDayId: null, nutritionDayId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private extractTodaysWorkout(plans: any[]): TodaysWorkout | null {
    const today = this.startOfDay(new Date());

    for (const plan of this.sortPlansByStartDate(plans)) {
      const days = plan?.workoutDays || [];
      const start = this.safeDate(plan?.startDate);

      for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const dayDate = this.resolveProgramDayDate(day, start, index);

        if (!dayDate || !this.isSameDate(dayDate, today)) continue;
        if (day?.restDay === true) return null;

        const exercises = this.extractWorkoutExercises(day);
        if (!exercises.length) return null;

        const currentDay = index + 1;
        const totalDays = days.length || currentDay;

        return {
          programName: plan?.name || 'Workout program',
          currentWeek: Math.max(1, Math.ceil(currentDay / 7)),
          totalWeeks: Math.max(1, Math.ceil(totalDays / 7)),
          name: day?.title || day?.name || day?.dayOfWeek || `Day ${currentDay}`,
          exercises,
        };
      }
    }

    return null;
  }

  private extractWorkoutExercises(day: any): Exercise[] {
    const sessions = day?.workoutSessions || [];
    const exercises = sessions.flatMap((session: any) => session?.exercises || []);

    return exercises.map((exercise: any) => ({
      name: exercise?.name || exercise?.exerciseRef?.name || 'Exercise',
      sets: this.formatExerciseSets(exercise),
      rest: this.formatExerciseRest(exercise),
    }));
  }

  private formatExerciseSets(exercise: any): string {
    const sets = exercise?.sets || [];
    if (!sets.length) {
      return exercise?.duration ? `${exercise.duration} min` : 'No sets';
    }

    const reps = sets
      .map((set: any) => set?.reps)
      .filter((value: any) => value !== null && value !== undefined && value !== '');

    if (!reps.length) return `${sets.length} sets`;

    const uniqueReps = Array.from(new Set(reps.map((value: any) => String(value))));
    const repsLabel = uniqueReps.length === 1 ? uniqueReps[0] : `${uniqueReps[0]}–${uniqueReps[uniqueReps.length - 1]}`;

    return `${sets.length} sets × ${repsLabel} reps`;
  }

  private formatExerciseRest(exercise: any): string {
    const firstSet = (exercise?.sets || []).find((set: any) =>
      set?.restMin !== null || set?.restSec !== null || set?.rest !== null
    );

    if (!firstSet) return '--';

    const min = Number(firstSet.restMin || 0);
    const sec = Number(firstSet.restSec || 0);

    if (min > 0 && sec > 0) return `${min}m ${sec}s`;
    if (min > 0) return `${min}m`;
    if (sec > 0) return `${sec}s`;

    return firstSet.rest ? String(firstSet.rest) : '--';
  }

  private extractTodaysNutrition(plans: any[]): ActiveNutritionPlan | null {
    const today = this.startOfDay(new Date());

    for (const plan of this.sortPlansByStartDate(plans)) {
      const days = plan?.mealDays || [];
      const start = this.safeDate(plan?.startDate);

      for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const dayDate = this.resolveProgramDayDate(day, start, index);

        if (!dayDate || !this.isSameDate(dayDate, today)) continue;

        const targets = day?.dayTargets || {};
        const meals = day?.meals || [];

        return {
          name: plan?.name || 'Nutrition plan',
          dailyCalories: Number(targets.calories || 0),
          protein: Number(targets.proteinG || 0),
          carbs: Number(targets.carbsG || 0),
          fat: Number(targets.fatG || 0),
          mealCount: meals.length,
        };
      }
    }

    return null;
  }

  private sortPlansByStartDate(plans: any[]): any[] {
    return [...(plans || [])].sort((a, b) => {
      const aDate = (this.safeDate(a?.endDate) || this.safeDate(a?.startDate))?.getTime() || 0;
      const bDate = (this.safeDate(b?.endDate) || this.safeDate(b?.startDate))?.getTime() || 0;
      return bDate - aDate;
    });
  }

  get latestWorkoutPrograms(): any[] {
    return (this.assignedWorkoutPrograms || []).slice(0, 3);
  }

  get latestNutritionPrograms(): any[] {
    return (this.assignedNutritionPrograms || []).slice(0, 3);
  }

  getProgramDisplayName(program: any): string {
    return program?.name || program?.programName || 'Program';
  }

  getProgramDateRange(program: any): string {
    const start = this.formatShortDate(program?.startDate);
    const end = this.formatShortDate(program?.endDate);

    if (start && end) return `${start} - ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;

    return 'No dates set';
  }

  private formatShortDate(value: any): string {
    const date = this.safeDate(value);
    if (!date) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private resolveProgramDayDate(day: any, planStart: Date | null, index: number): Date | null {
    const explicitDate = this.safeDate(day?.date);
    if (explicitDate) return explicitDate;
    if (!planStart) return null;

    const dayNumber = Number(day?.dayNumber || index + 1);
    const date = new Date(planStart);
    date.setDate(planStart.getDate() + Math.max(0, dayNumber - 1));
    return this.startOfDay(date);
  }

  private safeDate(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return this.startOfDay(date);
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private isSameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  get assignedList(): FormAssignment[] {
    return this.assignedAssignments;
  }

  get submissionsList(): FormAssignment[] {
    return this.submissionAssignments;
  }

  async loadClientAssignments(): Promise<void> {
    if (!this.clientId) return;

    this.loadSubmissionsPage(0);
    this.loadAssignedPage(0);
  }

  loadSubmissionsPage(page: number = this.submissionsPage): void {
    if (!this.clientId) return;

    this.loadingAssignments = true;
    this.assignmentsError = null;
    this.submissionsPage = Math.max(page, 0);

    this.assignmentsApi
      .pageOwnerAssignmentsByAssigneeIdStatuses(
        this.submissionsPage,
        this.PAGE_SIZE,
        'submittedAt',
        'DESC',
        this.clientId,
        ['SUBMITTED', 'REVIEWED'],
        this.submissionSearch,
        true // shown in place by the section loader
      )
      .subscribe({
        next: async (res) => {
          this.submissionAssignments = res.content || [];
          await this.attachFormNames(this.submissionAssignments);
          this.submissionsTotalPages = res.totalPages || 0;
          this.submissionsPage = res.number ?? this.submissionsPage;
          this.submissionsPagesArray = Array.from({ length: this.submissionsTotalPages }, (_, i) => i);
          this.syncAssignmentsCache();
          this.loadingAssignments = false;
          this.submissionsLoaded = true;
          if (this.notificationAssignmentId) {
            const assignment = this.submissionAssignments.find(item => item.id === this.notificationAssignmentId);
            if (assignment) {
              this.activeSubTab = 'submissions';
              this.openAssignmentModal(assignment);
              this.notificationAssignmentId = null;
              this.router.navigate([], { relativeTo: this.route, queryParams: { assignmentId: null }, queryParamsHandling: 'merge', replaceUrl: true });
            } else {
              this.openNotificationAssignmentById(this.notificationAssignmentId);
            }
          }
        },
        error: () => {
          this.assignmentsError = 'Failed to load submissions';
          this.loadingAssignments = false;
          this.submissionsLoaded = true;
        },
      });
  }

  openNutritionActivity(activity: NutritionActivity): void {
    this.selectedNutritionActivity = activity;
    this.syncActivityScrollLock();
  }

  closeNutritionActivity(): void {
    this.selectedNutritionActivity = null;
    this.syncActivityScrollLock();
  }

  openAllNutritionActivity(filter: 'ALL' | NutritionActivityStatus = 'ALL'): void {
    this.nutritionActivityFilter = filter;
    this.nutritionActivityVisibleCount = 10;
    this.showAllNutritionActivity = true;
    this.syncActivityScrollLock();
  }

  closeAllNutritionActivity(): void {
    this.showAllNutritionActivity = false;
    this.syncActivityScrollLock();
  }

  setNutritionActivityFilter(filter: 'ALL' | NutritionActivityStatus): void {
    this.nutritionActivityFilter = filter;
    this.nutritionActivityVisibleCount = 10;
  }

  viewMoreNutritionActivities(): void {
    this.nutritionActivityVisibleCount += 10;
  }

  nutritionDayStatusLabel(activity: NutritionActivity): string {
    return nutritionDayStatusLabel(this.translate, activity);
  }

  nutritionFilterLabel(filter: 'ALL' | NutritionActivityStatus): string {
    return this.translate.instant(filter === 'IN_PROGRESS' ? 'NUTRITION_FILTER_IN_PROGRESS' : `NUTRITION_ACTIVITY_STATUS_${filter}`);
  }

  nutritionActivityAction(status: NutritionActivityStatus): string {
    if (status === 'COMPLETED') return this.translate.instant('VIEW_REPORT');
    if (status === 'NOT_LOGGED') return this.translate.instant('VIEW_NUTRITION_DAY');
    return this.translate.instant('REVIEW_LOG');
  }

  nutritionActivityDescription(activity: NutritionActivity): string {
    if (activity.status === 'COMPLETED') return this.translate.instant('ALL_MEALS_LOGGED');
    if (activity.status === 'IN_PROGRESS') return this.translate.instant(activity.loggedMeals ? 'SOME_MEALS_LOGGED' : 'DAY_IN_PROGRESS');
    if (activity.status === 'OFF_PLAN') return this.translate.instant('LOGGED_AS_OFF_PLAN');
    return this.translate.instant('NO_MEALS_REPORTED');
  }

  openAllWorkoutActivity(filter: WorkoutActivityFilter = 'ALL'): void {
    this.workoutActivityFilter = filter;
    this.workoutActivityVisibleCount = 10;
    this.showAllWorkoutActivity = true;
    this.syncActivityScrollLock();
  }

  closeAllWorkoutActivity(): void {
    this.showAllWorkoutActivity = false;
    this.selectedWorkoutActivity = null;
    this.syncActivityScrollLock();
  }

  setWorkoutActivityFilter(filter: WorkoutActivityFilter): void {
    this.workoutActivityFilter = filter;
    this.workoutActivityVisibleCount = 10;
  }

  viewMoreWorkoutActivities(): void {
    this.workoutActivityVisibleCount += 10;
  }

  openWorkoutActivity(activity: WorkoutActivity): void {
    this.selectedWorkoutActivity = activity;
    this.syncActivityScrollLock();
  }

  closeWorkoutActivity(): void {
    this.selectedWorkoutActivity = null;
    this.syncActivityScrollLock();
  }

  /** Escape closes the activity window on top (detail, then report, then the lists). */
  @HostListener('document:keydown.escape')
  onActivityEscape(): void {
    if (this.selectedWorkoutActivity) this.closeWorkoutActivity();
    else if (this.selectedNutritionActivity) this.closeNutritionActivity();
    else if (this.showAllWorkoutActivity) this.closeAllWorkoutActivity();
    else if (this.showAllNutritionActivity) this.closeAllNutritionActivity();
  }

  /** While an activity window is open, the profile behind does not scroll (wheel or finger on the backdrop). */
  private syncActivityScrollLock(): void {
    const open = !!(this.selectedWorkoutActivity || this.selectedNutritionActivity
      || this.showAllWorkoutActivity || this.showAllNutritionActivity);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  workoutActivityAction(activity: WorkoutActivity): string {
    if (activity.status === 'COMPLETED' || activity.status === 'COMPLETED_AFTER_WORKOUT') {
      return this.translate.instant('VIEW_RESULTS');
    }
    if (activity.status === 'IN_PROGRESS') return this.translate.instant('VIEW_PROGRESS');
    if (activity.status === 'MISSED') return this.translate.instant('VIEW_DETAILS');
    // OVERDUE: the client did not log it; the coach cannot « resolve » it, only look and write to them.
    return this.translate.instant('VIEW_WORKOUT');
  }

  workoutActivityStatusLabel(activity: WorkoutActivity): string {
    return workoutActivityStatusLabel(this.translate, activity);
  }

  workoutActivityMode(activity: WorkoutActivity): string {
    return workoutActivityMode(this.translate, activity);
  }

  workoutActivityDuration(activity: WorkoutActivity): string {
    return workoutActivityDuration(this.translate, activity);
  }

  private openNotificationAssignmentById(assignmentId: string): void {
    this.assignmentsApi.getById(assignmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: assignment => {
          if (assignment.assigneeId !== this.clientId) return;
          this.activeTab = 'checkins';
          this.activeSubTab = 'submissions';
          this.openAssignmentModal(assignment);
          this.notificationAssignmentId = null;
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { assignmentId: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        },
        error: err => console.error('Failed to open notification check-in:', err)
      });
  }

  loadAssignedPage(page: number = this.assignedPage): void {
    if (!this.clientId) return;

    this.loadingAssignments = true;
    this.assignmentsError = null;
    this.assignedPage = Math.max(page, 0);

    this.assignmentsApi
      .pageOwnerAssignmentsByAssigneeIdStatuses(
        this.assignedPage,
        this.PAGE_SIZE,
        'assignedAt',
        'DESC',
        this.clientId,
        ['ASSIGNED', 'OPENED'],
        this.assignedSearch,
        true // shown in place by the section loader
      )
      .subscribe({
        next: async (res) => {
          this.assignedAssignments = res.content || [];
          await this.attachFormNames(this.assignedAssignments);
          this.assignedTotalPages = res.totalPages || 0;
          this.assignedPage = res.number ?? this.assignedPage;
          this.assignedPagesArray = this.buildCompactPages(this.assignedPage, this.assignedTotalPages);
          this.syncAssignmentsCache();
          this.loadingAssignments = false;
          this.assignedLoaded = true;
        },
        error: () => {
          this.assignmentsError = 'Failed to load assigned check-ins';
          this.loadingAssignments = false;
          this.assignedLoaded = true;
        },
      });
  }

  onSubmissionSearchChange(): void {
    this.loadSubmissionsPage(0);
  }

  onAssignedSearchChange(): void {
    this.loadAssignedPage(0);
  }

  changeSubmissionsPage(page: number): void {
    if (page < 0 || page >= this.submissionsTotalPages || page === this.submissionsPage) return;
    this.loadSubmissionsPage(page);
  }

  changeAssignedPage(page: number): void {
    if (page < 0 || page >= this.assignedTotalPages || page === this.assignedPage) return;
    this.loadAssignedPage(page);
  }

  private buildCompactPages(current: number, total: number): Array<number | 'ellipsis'> {
    if (total <= 5) return Array.from({ length: total }, (_, index) => index);

    const pages = new Set<number>([0, total - 1, current - 1, current, current + 1]);
    const visible = Array.from(pages)
      .filter(page => page >= 0 && page < total)
      .sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];

    visible.forEach((page, index) => {
      if (index > 0 && page - visible[index - 1] > 1) result.push('ellipsis');
      result.push(page);
    });

    return result;
  }

  private syncAssignmentsCache(): void {
    this.assignments = [...this.submissionAssignments, ...this.assignedAssignments];
  }

  private async attachFormNames(assignments: FormAssignment[]): Promise<void> {
    const missingFormIds = Array.from(new Set(assignments.map(a => a.formId)))
      .filter(formId => !this.formNames.has(formId));

    await Promise.all(
      missingFormIds.map(formId =>
        this.formsApi.getFormById(formId, true).toPromise().then((f: any) => {
          this.formNames.set(formId, f?.name ?? f?.title ?? formId);
        }).catch(() => {
          // Not remembered: the next list asks for this form again.
        })
      )
    );

    assignments.forEach(a => {
      a.formName = this.formNames.get(a.formId) ?? a.formId;
    });
  }

  markAsReviewed(): void {
    if (!this.selectedAssignment) return;

    this.reviewLoading = true;
    this.reviewError = null;

    this.assignmentsApi.reviewAssignment(this.selectedAssignment.id, null)
      .pipe(finalize(() => (this.reviewLoading = false)))
      .subscribe({
        next: (updated) => {
          const idx = this.assignments.findIndex(a => a.id === updated.id);
          if (idx >= 0) this.assignments[idx] = { ...this.assignments[idx], ...updated };

          this.selectedAssignment = { ...this.selectedAssignment, ...updated };

          this.closeModal();
          this.loadSubmissionsPage(this.submissionsPage);
          this.loadAssignedPage(this.assignedPage);
        },
        error: (err) => {
          console.error(err);
          this.reviewError = err?.error?.message ?? 'Failed to mark as reviewed.';
        }
      });
  }

  /** Language of the check-in date tiles. */
  get currentLang(): string {
    return this.translate.currentLang;
  }

  /** "Every week · Mon, Wed at 09:00", "Every month · day 15", "One time"… */
  scheduleFrequencyLabel(item: ClientScheduleItemDto): string {
    const schedule = item.schedule;
    const frequency = (schedule?.frequency || '').toUpperCase();
    const days = (schedule?.daysOfWeek || []).map((day) => this.translate.instant('DAY_' + day.toUpperCase())).join(', ');
    let label: string;
    switch (frequency) {
      case 'DAILY':
        label = this.translate.instant('SCHED.EVERY_DAY');
        break;
      case 'WEEKLY':
        label = this.translate.instant('SCHED.WEEKLY_ON', { days: days || '—' });
        break;
      case 'BIWEEKLY': {
        const weeks = schedule?.biweeklyWeeks ? ' (' + this.translate.instant('SCHED.BIWEEKLY_WEEKS_' + schedule.biweeklyWeeks) + ')' : '';
        label = this.translate.instant('SCHED.BIWEEKLY_ON', { days: days || '—' }) + weeks;
        break;
      }
      case 'MONTHLY':
        label = schedule?.monthlyMode === 'START'
          ? this.translate.instant('SCHED.MONTHLY_START')
          : schedule?.monthlyMode === 'END'
            ? this.translate.instant('SCHED.MONTHLY_END')
            : this.translate.instant('SCHED.MONTHLY_DAY', { day: schedule?.monthlyDay ?? '—' });
        break;
      default:
        return this.translate.instant('SCHED.ONE_TIME_DETAIL');
    }
    const time = this.shortTime(schedule?.time);
    return time ? label + ' ' + this.translate.instant('SCHED.AT_TIME', { time }) : label;
  }

  /** "09:00:00" → "09:00". */
  shortTime(value?: string | null): string {
    return value ? String(value).slice(0, 5) : '';
  }

  /** Assigned and not answered after its real due date. */
  isCheckinLate(a: FormAssignment): boolean {
    return !!a.dueAt && new Date(a.dueAt).getTime() < Date.now() && a.status !== 'SUBMITTED' && a.status !== 'REVIEWED';
  }

  openAssignmentModal(a: FormAssignment): void {
    this.closeAllOverlays();
    this.selectedAssignment = a;
    this.isModalOpen = true;

    const isSubmitted = a.status === 'SUBMITTED' || a.status === 'REVIEWED';
    this.modalMode = isSubmitted ? 'view' : 'preview';

    this.currentForm = null;
    this.submittedAnswers = [];
    this.modalError = null;
    this.modalLoading = true;

    this.formsApi.getFormById(a.formId, false, isSubmitted ? a.id : null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (form) => {
          this.currentForm = {
            ...form,
            questions: form.questions.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
          };

          if (this.modalMode === 'view') {
            this.submissionsApi.getByAssignmentId(a.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (submission) => {
                  this.submittedAnswers = submission.answers ?? [];
                  this.modalLoading = false;
                },
                error: () => {
                  this.modalLoading = false;
                  this.modalError = 'Impossible de charger les réponses.';
                }
              });
          } else {
            this.modalLoading = false;
          }
        },
        error: () => {
          this.modalLoading = false;
          this.modalError = 'Impossible de charger le formulaire.';
        }
      });
  }

  openAssignedAssignment(a: FormAssignment, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (this.isAnyOverlayOpen) return;
    this.openAssignmentModal(a);
  }

  openSubmissionAssignment(a: FormAssignment) {
    if (this.isAnyOverlayOpen) return;
    this.openAssignmentModal(a);
  }


  isFileNutritionPlan(plan: any): boolean {
    const mode = String(plan?.nutritionPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl
    );
  }

  get nutritionSelectionPrograms(): any[] {
    const baseList = this.nutritionFileEnabled === false
      ? this.nutritionSelectionList.filter((plan) => !this.isFileNutritionPlan(plan))
      : this.nutritionSelectionList;

    if (this.nutritionSelectionMode === 'APP') {
      return baseList.filter((plan) => !this.isFileNutritionPlan(plan));
    }

    if (this.nutritionSelectionMode === 'FILES') {
      return this.nutritionFileEnabled === false
        ? []
        : baseList.filter((plan) => this.isFileNutritionPlan(plan));
    }

    return baseList;
  }

  getAllNutrition(page = 0, search = this.nutritionSelectionSearch) {
    this.nutritionSelectionLoading = true;
    this.nutritionSelectionSearch = search;
    const apiPlanType = this.nutritionSelectionMode === 'APP'
      ? 'APP'
      : this.nutritionSelectionMode === 'FILES' ? 'FILES' : 'ALL';

    this.nutritionService.getNutritionPlans(page, 12, apiPlanType, search, true)
      .pipe(finalize(() => (this.nutritionSelectionLoading = false)))
      .subscribe((res: any) => {
        this.nutritionSelectionPage = Number(res?.number ?? page);
        this.nutritionSelectionTotalPages = Number(res?.totalPages ?? 0);
        this.nutritionSelectionList = (res?.content || [])
          .filter((plan: any) => !plan.client)
          .map((plan: any) => ({
            ...plan,
            status: 'upcoming',
            totalDays: this.isFileNutritionPlan(plan) ? 0 : (plan.mealDays?.length || 0),
            calories: this.isFileNutritionPlan(plan) ? null : (plan.mealDays?.[0]?.dayTargets?.calories ?? null),
          }));
      });
  }

  searchNutritionPrograms(search: string): void {
    this.getAllNutrition(0, search);
  }

  changeNutritionProgramsPage(page: number): void {
    this.getAllNutrition(page);
  }

  openDirectWorkoutSelection(): void {
    if (!this.canCoach()) return;
    this.assignType = 'WORKOUT';
    this.showAssignSelectModal = false;
    this.showProgramSelectionModal = true;
  }

  openClientPreview(): void {
    this.clientPreviewDevice = window.innerWidth <= 768 ? 'mobile' : 'desktop';
    this.clientPreviewSection = 'workouts';
    this.clientPreviewSidebarOpen = this.clientPreviewDevice === 'desktop';
    this.clientPreviewOpen = true;
    document.body.classList.add('client-preview-open');
  }

  closeClientPreview(): void {
    this.clientPreviewOpen = false;
    this.clientPreviewSidebarOpen = false;
    document.body.classList.remove('client-preview-open');
  }

  setClientPreviewDevice(device: 'desktop' | 'mobile'): void {
    this.clientPreviewDevice = device;
    this.clientPreviewSidebarOpen = device === 'desktop';
  }

  setClientPreviewSection(section: ClientPreviewSection): void {
    this.clientPreviewSection = section;
    // As in the client app: the menu stays on a computer, the drawer closes on a phone.
    if (this.clientPreviewDevice === 'mobile') this.clientPreviewSidebarOpen = false;
  }

  /** {@code start}: a start to propose (the first day of a gap, from the « Programmes » tab). */
  openAssignProgramModal(type: 'WORKOUT' | 'NUTRITION', start?: string | null): void {
    if (!this.canCoach()) return;
    this.assignPresetStart = start || null;
    this.assignType = type;
    this.showAssignSelectModal = true;
  }

  onExistingFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'WORKOUT') {
      this.showProgramSelectionModal = true;
      return;
    }

    if (this.assignType === 'NUTRITION') {
      this.nutritionSelectionMode = 'ALL';
      this.nutritionSelectionList = [];
      this.nutritionSelectionPage = 0;
      this.nutritionSelectionSearch = '';
      this.getAllNutrition(0, '');
      this.showNutritionSelectionModal = true;
      return;
    }

    this.showFormSelectionModal = true;
  }


  closeNutritionExistingTypeModal(): void {
    this.showNutritionExistingTypeModal = false;
  }


  createNormalNutritionFromProfile(): void {
    this.showNutritionExistingTypeModal = false;
    this.selectedClientNutritionPlanType = null;
    this.showChooseModal = true;
  }

  importFileNutritionFromProfile(): void {
    if (this.nutritionFileEnabled === false) {
      return;
    }

    this.showNutritionExistingTypeModal = false;
    this.openImportNutritionFileFromProfile();
  }

  openImportNutritionFileFromProfile(): void {
    if (!this.canCoach()) return;
    this.showNutritionFileImportModal = true;
    this.profileImportNutritionFile = null;
    this.profileImportNutritionName = '';
    this.profileImportNutritionDetails = '';
    this.profileImportNutritionStartDate = '';
    this.profileImportNutritionEndDate = '';
    this.profileImportNutritionError = '';
    this.profileImportNutritionSaving = false;
  }

  openExistingNutritionPrograms(mode: 'APP' | 'FILES'): void {
    if (!this.canCoach()) return;
    if (this.nutritionFileEnabled === false && mode === 'FILES') {
      return;
    }

    this.nutritionSelectionMode = mode;
    this.showNutritionExistingTypeModal = false;
    this.nutritionSelectionList = [];
    this.nutritionSelectionPage = 0;
    this.nutritionSelectionSearch = '';
    this.getAllNutrition(0, '');
    this.showNutritionSelectionModal = true;
  }

  onCreateFromAssignModal() {
    this.showAssignSelectModal = false;

    if (this.assignType === 'CHECKIN') {
      this.router.navigate(['/forms/create-form'], {
        queryParams: {
          returnTo: 'client-profile',
          clientId: this.clientId,
          openAssign: 1,
        },
      });
      return;
    }

    if (this.assignType === 'WORKOUT') {
      if (!this.workoutFileEnabled) {
        this.createNormalWorkoutFromProfile();
        return;
      }

      // Create New Program / Build a custom program => open the same type chooser as Workout Library.
      this.showWorkoutTypeModal = true;
      return;
    }

    if (this.assignType === 'NUTRITION') {
      if (this.nutritionFileEnabled === false) {
        this.createNormalNutritionFromProfile();
        return;
      }
      this.showNutritionExistingTypeModal = true;
      return;
    }
  }


  closeWorkoutTypeModal(): void {
    this.showWorkoutTypeModal = false;
  }

  createNormalWorkoutFromProfile(): void {
    this.showWorkoutTypeModal = false;
    this.openClientWorkoutCreateModal();
  }

  openClientNutritionCreateModal(): void {
    if (!this.canCoach()) return;
    this.clientNutritionProgramName = '';
    this.clientNutritionDurationWeeks = 4;
    this.clientNutritionStartDate = this.assignPresetStart || ''; // else the schedule picks today or the continuity (A2)
    this.resetScheduleState();
    this.showClientNutritionCreateModal = true;
  }

  onClientNutritionPlanTypeSelected(type: NutritionPlanChoice): void {
    this.selectedClientNutritionPlanType = type;
    this.showChooseModal = false;
    this.openClientNutritionCreateModal();
  }

  closeClientNutritionCreateModal(): void {
    this.showClientNutritionCreateModal = false;
    this.resetScheduleState();
    this.selectedClientNutritionPlanType = null;
  }

  get clientNutritionDurationDays(): number {
    return this.clientNutritionDurationWeeks * 7;
  }

  get clientNutritionEndDate(): string {
    return this.addDays(this.clientNutritionStartDate, this.clientNutritionDurationDays - 1);
  }

  get canCreateClientNutritionProgram(): boolean {
    return !!this.clientNutritionProgramName.trim()
      && !!this.clientNutritionStartDate
      && !this.scheduleChecking;
  }

  get profileNutritionReturnUrl(): string {
    return `${this.router.url.split('?')[0]}?tab=nutrition`;
  }

  createClientNutritionProgram(): void {
    const name = this.clientNutritionProgramName.trim();
    if (!name || !this.canCreateClientNutritionProgram || !this.selectedClientNutritionPlanType) return;

    // The server applies the rule when the program is saved (backlog-programmes.md A8); the coach sees it first.
    if (this.askScheduleConfirm('NUTRITION_CREATE', name, this.clientNutritionStartDate)) return;
    const resolvedStartDate = this.clientNutritionStartDate;

    this.showClientNutritionCreateModal = false;
    this.resetScheduleState();

    const queryParams = {
      name,
      durationWeeks: this.clientNutritionDurationWeeks,
      startDate: resolvedStartDate,
      endDate: this.clientNutritionEndDate,
      returnUrl: this.profileNutritionReturnUrl,
      assignAfterCreate: true,
    };

    if (this.selectedClientNutritionPlanType === 'full') {
      this.router.navigate([`/clients/create-full-plan/${this.clientId}`], { queryParams });
      return;
    }

    if (this.selectedClientNutritionPlanType === 'macro-total') {
      this.router.navigate([`/clients/create-macro-plan-total-day/${this.clientId}`], {
        queryParams: { ...queryParams, type: 'total' },
      });
      return;
    }

    this.router.navigate([`/clients/create-macro-plan/${this.clientId}`], {
      queryParams: { ...queryParams, type: 'each' },
    });
  }

  isFileWorkoutPlan(plan: any): boolean {
    const mode = String(plan?.workoutPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl
    );
  }

  openClientWorkoutCreateModal(): void {
    if (!this.canCoach()) return;
    this.clientWorkoutProgramName = '';
    this.clientWorkoutDurationWeeks = 4;
    this.clientWorkoutStartDate = this.assignPresetStart || ''; // else the schedule picks today or the continuity (A2)
    this.resetScheduleState();
    this.showClientWorkoutCreateModal = true;
  }

  closeClientWorkoutCreateModal(): void {
    this.showClientWorkoutCreateModal = false;
    this.resetScheduleState();
  }

  get clientWorkoutDurationDays(): number {
    return this.clientWorkoutDurationWeeks * 7;
  }

  get clientWorkoutEndDate(): string {
    return this.addDays(this.clientWorkoutStartDate, this.clientWorkoutDurationDays - 1);
  }

  get canCreateClientWorkoutProgram(): boolean {
    return !!this.clientWorkoutProgramName.trim()
      && !!this.clientWorkoutStartDate && !this.clientWorkoutSaving && !this.scheduleChecking;
  }

  clientWorkoutSaving = false;
  createClientWorkoutProgram(): void {
    const name = this.clientWorkoutProgramName.trim();
    if (!name || !this.canCreateClientWorkoutProgram || this.clientWorkoutSaving) return;
    if (this.askScheduleConfirm('WORKOUT_CREATE', name, this.clientWorkoutStartDate)) return;
    this.clientWorkoutSaving = true;
    const startDate = this.clientWorkoutStartDate;
    const workoutDays = Array.from({length: this.clientWorkoutDurationDays}, (_, index) => ({
      title: 'Day ' + (index % 7 + 1), dayNumber: index + 1, restDay: false,
      status: 'PENDING', workoutSessions: [], date: this.addDays(startDate, index)
    }));
    this.workoutService.createWorkout({name, details: '', startDate,
      endDate: this.addDays(startDate, this.clientWorkoutDurationDays - 1),
      client: {id: this.clientId}, workoutDays}).subscribe({
      next: created => {
        this.clientWorkoutSaving = false;
        // The server stopped or removed what was on those dates (backlog-programmes.md A8): say so.
        this.programSchedule.announceChanges((created as any)?.scheduleChanges, this.fullName);
        this.closeClientWorkoutCreateModal();
        void this.router.navigate(['/clients/create-workout', this.clientId, 'edit', created.id], {
          queryParams: {returnUrl: this.router.url.split('?')[0] + '?tab=workouts'}
        });
      },
      error: () => { this.clientWorkoutSaving = false; window.alert(this.translate.instant('WORKOUT_SAVE_ERROR')); }
    });
  }

  importFileWorkoutFromProfile(): void {
    // Do not redirect to Program Library from profile.
    // Open the import modal and save+assign ONLY to this client.
    this.showWorkoutTypeModal = false;
    this.openFileWorkoutImportModal();
  }

  openFileWorkoutImportModal(): void {
    if (!this.canCoach()) return;
    this.showFileWorkoutImportModal = true;
    this.profileImportWorkoutFile = null;
    this.profileImportWorkoutName = '';
    this.profileImportWorkoutDetails = '';
    this.profileImportStartDate = '';
    this.profileImportEndDate = '';
    this.profileImportError = '';
    this.profileImportSaving = false;
  }

  closeFileWorkoutImportModal(): void {
    if (this.profileImportSaving) return;
    this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
    this.profileImportError = '';
  }

  browseProfileWorkoutFile(): void {
    const input = document.getElementById('profileWorkoutFileInput') as HTMLInputElement | null;
    input?.click();
  }

  onProfileWorkoutFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const valid = fileName.endsWith('.pdf') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

    if (!valid) {
      this.profileImportError = 'Only PDF, XLS, or XLSX files are accepted.';
      input.value = '';
      return;
    }

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      this.profileImportError = 'File size must be less than 25 MB.';
      input.value = '';
      return;
    }

    this.profileImportWorkoutFile = file;
    this.profileImportError = '';

    if (!this.profileImportWorkoutName) {
      this.profileImportWorkoutName = file.name.replace(/\.(pdf|xls|xlsx)$/i, '');
    }
  }

  clearProfileWorkoutFile(event?: Event): void {
    event?.stopPropagation();
    this.profileImportWorkoutFile = null;
    const input = document.getElementById('profileWorkoutFileInput') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  canSaveProfileFileWorkout(): boolean {
    return !!this.profileImportWorkoutFile
      && !!this.profileImportWorkoutName?.trim()
      && !!this.profileImportStartDate
      && !!this.profileImportEndDate
      && this.profileImportEndDate >= this.profileImportStartDate
      && !this.scheduleChecking
      && !this.profileImportSaving;
  }

  saveAndAssignProfileFileWorkout(): void {
    if (!this.canCoach()) return;
    if (!this.canSaveProfileFileWorkout() || !this.profileImportWorkoutFile || !this.clientId) return;
    if (this.askScheduleConfirm('WORKOUT_FILE', this.profileImportWorkoutName.trim(), this.profileImportStartDate)) return;

    this.profileImportSaving = true;
    this.profileImportError = '';

    this.workoutService.createAndAssignFileWorkoutOnly(
      this.profileImportWorkoutFile,
      this.profileImportWorkoutName.trim(),
      this.profileImportWorkoutDetails?.trim() || undefined,
      this.clientId,
      this.profileImportStartDate,
      this.profileImportEndDate
    ).subscribe({
      next: (created: any) => {
        this.profileImportSaving = false;
        this.programSchedule.announceChanges(created?.scheduleChanges, this.fullName);
        this.resetScheduleState();
        this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
        this.closeAssignFlow();
        this.loadDashboardPrograms();
        this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
      },
      error: (err) => {
        console.error('Failed to import and assign file workout:', err);
        this.profileImportSaving = false;
        this.profileImportError = 'Impossible d’importer et assigner ce programme. Vérifiez le fichier et les dates.';
      },
    });
  }



  closeNutritionFileImportModal(): void {
    if (this.profileImportNutritionSaving) return;
    this.showNutritionFileImportModal = false;
    this.profileImportNutritionError = '';
  }

  browseProfileNutritionFile(): void {
    const input = document.getElementById('profileNutritionFileInput') as HTMLInputElement | null;
    input?.click();
  }

  onProfileNutritionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const valid = fileName.endsWith('.pdf') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

    if (!valid) {
      this.profileImportNutritionError = 'Only PDF, XLS, or XLSX files are accepted.';
      input.value = '';
      return;
    }

    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
      this.profileImportNutritionError = 'File is too large. Maximum size is 25 MB.';
      input.value = '';
      return;
    }

    this.profileImportNutritionFile = file;
    this.profileImportNutritionError = '';

    if (!this.profileImportNutritionName) {
      this.profileImportNutritionName = file.name.replace(/\.(pdf|xls|xlsx)$/i, '');
    }
  }

  clearProfileNutritionFile(event?: Event): void {
    event?.stopPropagation();
    this.profileImportNutritionFile = null;
    const input = document.getElementById('profileNutritionFileInput') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  canSaveProfileFileNutrition(): boolean {
    return !!this.profileImportNutritionFile
      && !!this.profileImportNutritionName?.trim()
      && !!this.profileImportNutritionStartDate
      && !!this.profileImportNutritionEndDate
      && this.profileImportNutritionEndDate >= this.profileImportNutritionStartDate
      && !this.scheduleChecking
      && !this.profileImportNutritionSaving;
  }

  saveAndAssignProfileFileNutrition(): void {
    if (!this.canCoach()) return;
    if (!this.canSaveProfileFileNutrition() || !this.profileImportNutritionFile || !this.client) return;
    if (this.askScheduleConfirm('NUTRITION_FILE', this.profileImportNutritionName.trim(), this.profileImportNutritionStartDate)) return;

    this.profileImportNutritionSaving = true;
    this.profileImportNutritionError = '';

    this.nutritionService.createNutritionFilePlan(
      this.profileImportNutritionFile,
      this.profileImportNutritionName.trim(),
      this.profileImportNutritionDetails?.trim() || undefined,
      undefined,
      undefined
    ).subscribe({
      next: (createdPlan: any) => {
        const item = {
          ...createdPlan,
          client: this.client,
          startDate: this.profileImportNutritionStartDate,
          endDate: this.profileImportNutritionEndDate,
          mealDays: [],
          isMealPlanTemplate: false,
        };

        this.nutritionService.assignNutritionPlan(item).subscribe({
          next: (assigned: any) => {
            this.profileImportNutritionSaving = false;
            this.programSchedule.announceChanges(assigned?.scheduleChanges, this.fullName);
            this.resetScheduleState();
            this.showNutritionFileImportModal = false;
            this.closeAssignFlow();
            this.getAllNutrition();
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: (err) => {
            console.error('Failed to assign imported nutrition file:', err);
            this.profileImportNutritionSaving = false;
            this.profileImportNutritionError = 'File imported, but assignment failed. Please try assigning it from Existing Nutrition Programs.';
            this.getAllNutrition();
          },
        });
      },
      error: (err) => {
        console.error('Failed to import nutrition file:', err);
        this.profileImportNutritionSaving = false;
        this.profileImportNutritionError = 'Impossible d’importer et assigner ce programme nutrition. Vérifiez le fichier et les dates.';
      },
    });
  }


  backToAssignModal(): void {
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
    this.showNutritionExistingTypeModal = false;
    this.showNutritionFileImportModal = false;
    this.showFormSelectionModal = false;
    this.showChooseModal = false;
    this.showAssignSelectModal = true;
  }

  closeChooseModal() {
    this.showChooseModal = false;
  }

  /** The selection window assigned the program itself (backlog-programmes.md A7): close and read the lists again. */
  onAssignNutritionFromModal(_payload: { program: any; startDate: string; result: any }) {
    this.showNutritionSelectionModal = false;
    this.loadDashboardPrograms();
    this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
  }

  private daysBetweenInclusive(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.floor((end - start) / 86400000) + 1;
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setSubTab(tab: 'submissions' | 'assigned' | 'scheduled') {
    this.activeSubTab = tab;

    if (tab === 'submissions') this.loadSubmissionsPage(0);
    if (tab === 'assigned') this.loadAssignedPage(0);
    if (tab === 'scheduled') this.loadScheduledItems(0);

    this.closeModal();
    this.closeScheduleDetail();
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
  }

  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.submittedAnswers.find(a => a.questionId === questionId);
  }

  getOptionLabel(question: any, optionId: string): string {
    return question.options?.find((o: any) => o.id === optionId)?.label ?? optionId;
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isViewMode = false;
    this.selectedAssignment = null;
    this.currentForm = null;
    this.submittedAnswers = [];
    this.modalLoading = false;
    this.modalError = null;
  }

  getStars(max: number | undefined): number[] {
    const count = max || 5;
    return Array.from({ length: count }, (_, i) => i + 1);
  }


  private assignPendingCreatedWorkoutIfNeeded(): void {
    if (!this.pendingCreatedWorkoutToAssign || !this.client) return;

    const program = this.pendingCreatedWorkoutToAssign;
    this.pendingCreatedWorkoutToAssign = null;

    const startDate = program.startDate || new Date().toISOString().slice(0, 10);
    const workoutDays = program.workoutDays || [];
    let endDate = program.endDate || startDate;

    if (!program.endDate && workoutDays.length) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + workoutDays.length - 1);
      endDate = end.toISOString().slice(0, 10);
    }

    const item = {
      ...program,
      startDate,
      endDate,
      client: this.client,
      isWorkoutPlanTemplate: false,
    };

    this.workoutService.assignWorkout(item.id, item).subscribe({
      next: () => {
        // Created from the client profile only to assign it.
        // Remove the source from Workout Library after the assigned copy is saved.
        this.workoutService.deleteWorkout(program.id).subscribe({
          next: () => {
            this.loadDashboardPrograms();
            this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: () => {
            this.loadDashboardPrograms();
            this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
          },
        });
      },
      error: (err) => {
        console.error('Failed to assign newly created workout:', err);
      },
    });
  }

  private assignPendingCreatedNutritionIfNeeded(): void {
    if (!this.pendingCreatedNutritionToAssign || !this.client) return;

    const program = this.pendingCreatedNutritionToAssign;
    this.pendingCreatedNutritionToAssign = null;

    const startDate = program.startDate || this.clientNutritionStartDate || new Date().toISOString().slice(0, 10);
    const mealDays = (program.mealDays || []).map((day: any, index: number) => {
      const current = new Date(`${startDate}T00:00:00`);
      current.setDate(current.getDate() + index);

      return {
        ...day,
        date: current.toISOString().slice(0, 10),
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'long' }),
      };
    });

    let endDate = program.endDate || startDate;
    if (!program.endDate && mealDays.length) {
      endDate = this.addDays(startDate, mealDays.length - 1);
    }

    const item = {
      ...program,
      startDate,
      endDate,
      mealDays,
      client: this.client,
      isMealPlanTemplate: false,
    };

    this.nutritionService.assignNutritionPlan(item).subscribe({
      next: (assigned: any) => {
        this.programSchedule.announceChanges(assigned?.scheduleChanges, this.fullName);
        this.nutritionService.deleteNutritionPlan(program.id).subscribe({
          next: () => {
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
          error: () => {
            this.loadDashboardPrograms();
            this.nutritionTab?.getMealPlanByCoachAndClient(this.userid, this.clientId);
          },
        });
      },
      error: (err) => {
        console.error('Failed to assign newly created nutrition plan:', err);
      },
    });
  }

  onAssignWorkoutFromModal(payload: {
    program: any;
    startDate: string;
    endDate: string | null;
    result?: any;
  }) {
    // The selection modal performs the assign request itself.
    // If result exists, just close and refresh.
    if (payload?.result) {
      this.showProgramSelectionModal = false;
      this.loadDashboardPrograms();
      this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
      return;
    }

    const { program, startDate, endDate } = payload;

    const item = { ...program };
    item.startDate = startDate;
    item.endDate = endDate;
    item.client = this.client;

    this.workoutService.assignWorkout(item.id, item).subscribe(() => {
      this.showProgramSelectionModal = false;
      this.loadDashboardPrograms();
      this.workoutsTab?.getWorkOutPlanByCoachAndClient(this.userid, this.clientId);
    });
  }

  get isAnyOverlayOpen(): boolean {
    return (
      this.showAssignSelectModal ||
      this.showFormSelectionModal ||
      this.showProgramSelectionModal ||
      this.showNutritionSelectionModal ||
      this.showChooseModal ||
      this.showClientNutritionCreateModal ||
      this.isModalOpen ||
      !!this.selectedSchedule
    );
  }

  private closeAllOverlays(): void {
    this.closeModal();
    this.closeScheduleDetail();
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
  }

  closeAssignFlow(): void {
    this.assignPresetStart = null;
    this.showAssignSelectModal = false;
    this.showFormSelectionModal = false;
    this.showProgramSelectionModal = false;
    this.showNutritionSelectionModal = false;
    this.showChooseModal = false;
    this.showClientNutritionCreateModal = false;
    this.resetScheduleState();
    this.selectedClientNutritionPlanType = null;
    this.showWorkoutTypeModal = false;
    this.showFileWorkoutImportModal = false;
    this.showNutritionFileImportModal = false;
    this.preselectFormId = null;
  }

  openCheckinModal() {
    if (!this.canCoach()) return;
    this.closeAllOverlays();
    this.assignType = 'CHECKIN';
    this.showAssignSelectModal = true;
  }

  onAssignFormFromModal(payload: { form: Form; assignedDate: string; dueDate: string; endDate: string | null }) {
    const { form, dueDate, endDate } = payload;
    const hasSchedule = !!form.schedule;

    this.showFormSelectionModal = false;
    this.loadingAssignments = true;

    this.formsApi.ensurePublished(form.id).pipe(
      switchMap(() =>
        this.assignmentsApi.bulkAssign(form.id, {
          assigneeIds: [this.clientId],
          dueDate: hasSchedule ? null : (dueDate || null),
          endDate: hasSchedule ? (endDate || null) : null,
        })
      ),
      switchMap(() =>
        this.assignmentsApi.pageOwnerAssignmentsByAssigneeIdStatuses(
          0,
          this.PAGE_SIZE,
          'assignedAt',
          'DESC',
          this.clientId,
          ['ASSIGNED', 'OPENED'],
          this.assignedSearch
        )
      ),
      switchMap((res: any) =>
        from((async () => {
          const items: FormAssignment[] = res.content ?? [];
          await this.attachFormNames(items);
          this.assignedTotalPages = res.totalPages || 0;
          this.assignedPage = res.number ?? 0;
          this.assignedPagesArray = this.buildCompactPages(this.assignedPage, this.assignedTotalPages);
          return items;
        })())
      ),
      map((items: FormAssignment[]) => [...items]),
      finalize(() => {
        this.loadingAssignments = false;
      })
    ).subscribe({
      next: (items) => {
        this.assignedAssignments = items;
        this.syncAssignmentsCache();
        this.preselectFormId = null;
        this.activeTab = 'checkins';
        this.activeSubTab = 'assigned';
      },
      error: (err) => {
        console.error(err);
        this.loadingAssignments = false;
        alert(this.translate.instant('ASSIGN_FAILED'));
      }
    });
  }

  onCloseFormModal() {
    this.showFormSelectionModal = false;
    this.preselectFormId = null;
  }

  get activeSchedulesCount(): number {
    return this.scheduledCheckIns.length;
  }

  openScheduleDetail(item: ClientScheduleItemDto): void {
    this.closeScheduledDelete();
    this.closeAllOverlays();
    this.selectedSchedule = item;
  }

  closeScheduleDetail(): void {
    this.selectedSchedule = null;
  }

  openDeleteScheduled(item: ClientScheduleItemDto, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!item?.id) return;

    this.selectedScheduledToDelete = item;
    this.confirmScheduledDeleteOpen = true;
  }

  closeScheduledDelete(): void {
    if (this.deletingScheduled) return;
    this.confirmScheduledDeleteOpen = false;
    this.selectedScheduledToDelete = null;
  }

  confirmScheduledDelete(): void {
    const item = this.selectedScheduledToDelete;
    if (!item?.id) return;

    if (this.selectedSchedule?.id === item.id) {
      this.selectedSchedule = null;
    }

    this.deletingScheduled = true;
    this.scheduledError = null;

    const req$ =
      item.kind === 'ASSIGNED'
        ? this.assignmentsApi.hardDelete(item.id)
        : this.formsApi.deleteClientScheduleItem(item.id);

    req$
      .pipe(finalize(() => (this.deletingScheduled = false)))
      .subscribe({
        next: () => {
          this.confirmScheduledDeleteOpen = false;
          this.selectedScheduledToDelete = null;
          this.loadScheduledItems();

          if (item.kind === 'ASSIGNED') {
            this.loadClientAssignments();
          }
        },
        error: (err) => {
          console.error(err);
          this.scheduledError =
            err?.error?.message ??
            (item.kind === 'ASSIGNED'
              ? 'Failed to delete assignment'
              : 'Failed to delete scheduled item');
        }
      });
  }

  deleteSchedule(schedule: ScheduledCheckIn): void {
    this.scheduledCheckIns = this.scheduledCheckIns.filter(s => s.id !== schedule.id);
    if (this.selectedSchedule?.id === schedule.id) {
      this.selectedSchedule = null;
    }
  }

  loadScheduledItems(page: number = this.scheduledPage): void {
    if (!this.clientId) return;

    this.loadingScheduled = true;
    this.scheduledError = null;
    this.scheduledPage = Math.max(page, 0);

    this.formsApi.getClientScheduleItemsPage(this.clientId, this.scheduledPage, this.scheduledPageSize)
      .pipe(finalize(() => (this.loadingScheduled = false)))
      .subscribe({
        next: (res) => {
          this.scheduledItems = res.content ?? [];
          this.scheduledTotalPages = res.totalPages || 0;
          this.scheduledPage = res.number ?? this.scheduledPage;
          this.scheduledPagesArray = Array.from({ length: this.scheduledTotalPages }, (_, i) => i);
        },
        error: () => {
          // Fallback if backend page endpoint is not available yet.
          this.formsApi.getClientScheduleItems(this.clientId).subscribe({
            next: (items) => {
              const all = items ?? [];
              this.scheduledTotalPages = Math.ceil(all.length / this.scheduledPageSize);
              this.scheduledPagesArray = Array.from({ length: this.scheduledTotalPages }, (_, i) => i);
              const start = this.scheduledPage * this.scheduledPageSize;
              this.scheduledItems = all.slice(start, start + this.scheduledPageSize);
            },
            error: () => (this.scheduledError = 'Failed to load scheduled items'),
          });
        },
      });
  }

  changeScheduledPage(page: number): void {
    if (page < 0 || page >= this.scheduledTotalPages || page === this.scheduledPage) return;
    this.loadScheduledItems(page);
  }



}
