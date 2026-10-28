import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { CoachDashboardService } from '../../service/coach-dashboard.service';
import { CoachSettingsService } from '../../service/coach-settings.service';
import { ChatUnreadService } from '../../service/chat-unread.service';
import {
  DASHBOARD_WIDGETS,
  DashboardAlertType,
  DashboardSummary,
  DashboardWidgetKey,
  TODO_ALERT_TYPES,
  WidgetStatus,
  alertWidgetKey,
} from '../../models/coach-dashboard.model';
import { AddClientModalComponent } from '../clients/add-client-modal/add-client-modal.component';
import { ChoosePlanTypeModalComponent } from '../nutrition/choose-plan-type-modal/choose-plan-type-modal.component';
import { WidgetStateComponent } from './shared/widget-state.component';
import { AlertDrawerComponent } from './alert-drawer/alert-drawer.component';
import { CheckinsWidgetComponent } from './checkins-widget/checkins-widget.component';
import { MessagesWidgetComponent } from './messages-widget/messages-widget.component';
import { RecentActivitiesComponent } from './recent-activities/recent-activities.component';
import { PostCreateAssignComponent } from './post-create-assign/post-create-assign.component';
import { FirstStepsComponent } from './first-steps/first-steps.component';
import { ALERT_ICONS, localeOf } from './shared/dashboard-format';

/** Data older than this is read again when the coach comes back to the tab. */
const STALE_AFTER_MS = 60_000;

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    FeatherModule,
    WriteActionDirective,
    AddClientModalComponent,
    ChoosePlanTypeModalComponent,
    WidgetStateComponent,
    AlertDrawerComponent,
    CheckinsWidgetComponent,
    MessagesWidgetComponent,
    RecentActivitiesComponent,
    PostCreateAssignComponent,
    FirstStepsComponent,
  ],
  templateUrl: './coach-dashboard.component.html',
  styleUrl: './coach-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachDashboardComponent implements OnInit {
  readonly widgets = DASHBOARD_WIDGETS;
  readonly alertTypes = TODO_ALERT_TYPES;
  readonly alertIcons = ALERT_ICONS;

  summary: DashboardSummary | null = null;
  summaryStatus: WidgetStatus = 'loading';
  /** Re-read the self-loading widgets when it changes. */
  refreshKey = 0;
  @ViewChild(FirstStepsComponent) firstSteps?: FirstStepsComponent;
  lang: string | undefined;

  hidden = new Set<string>();
  customizeOpen = false;
  quickActionsOpen = false;
  savingPreferences = false;
  preferencesError = false;

  drawerType: DashboardAlertType | null = null;

  unreadConversations = 0;
  unreadMessages = 0;
  unreadKnown = false;

  showAddClientModal = false;
  showChoosePlanTypeModal = false;

  private loadedAt = 0;
  private readonly summaryLoads = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private coachSettings: CoachSettingsService,
    private chatUnread: ChatUnreadService,
    private translate: TranslateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.lang = this.translate.currentLang;
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.lang = event.lang;
      this.cdr.markForCheck();
    });

    this.summaryLoads
      .pipe(
        switchMap(() =>
          this.dashboard.getSummary().pipe(
            map((summary) => ({ summary, failed: false })),
            catchError(() => of({ summary: null, failed: true })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ summary, failed }) => {
        if (failed || !summary) {
          this.summaryStatus = 'error';
        } else {
          this.summary = summary;
          this.summaryStatus = 'ready';
          if (!this.savingPreferences) this.hidden = new Set(summary.preferences?.hiddenWidgets || []);
          this.loadedAt = Date.now();
        }
        this.cdr.markForCheck();
      });

    this.chatUnread.unreadCounts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((counts) => {
      const unread = [...counts.values()].filter((count) => count > 0);
      this.unreadConversations = unread.length;
      this.unreadMessages = unread.reduce((sum, count) => sum + count, 0);
      this.cdr.markForCheck();
    });
    this.chatUnread.synced$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((synced) => {
      this.unreadKnown = synced === true;
      this.cdr.markForCheck();
    });

    // Quick actions read the "assign after creating" options.
    this.coachSettings.loadConfig(true).subscribe({ error: () => undefined });
    this.loadSummary();
  }

  // ---- loading

  loadSummary(): void {
    this.summaryStatus = this.summary ? this.summaryStatus : 'loading';
    this.summaryLoads.next();
  }

  refresh(): void {
    this.loadSummary();
    this.refreshKey++;
    this.chatUnread.refresh();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.loadedAt && Date.now() - this.loadedAt > STALE_AFTER_MS) {
      this.refresh();
    }
  }

  // ---- header

  get todayLabel(): string {
    const label = new Date().toLocaleDateString(localeOf(this.lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get firstName(): string {
    return this.summary?.coachFirstName || sessionStorage.getItem('firstName') || '';
  }

  // ---- KPIs and "To do"

  /** Main reason under "Clients to watch" (all reasons in the card tooltip). */
  get watchDetail(): { key: string; count: number } {
    const watch = this.summary?.clientsToWatch;
    if (!watch?.count) return { key: 'CDASH.KPI.ALL_GOOD', count: 0 };
    if (watch.expiredPrograms) return { key: 'CDASH.KPI.W_EXPIRED', count: watch.expiredPrograms };
    if (watch.noProgram) return { key: 'CDASH.KPI.W_NO_PROGRAM', count: watch.noProgram };
    if (watch.inactive) return { key: 'CDASH.KPI.W_INACTIVE', count: watch.inactive };
    return { key: 'CDASH.KPI.W_LATE', count: watch.overdueCheckIns };
  }

  get checkInsPending(): number {
    return (this.summary?.checkIns.toReview || 0) + (this.summary?.checkIns.overdue || 0);
  }

  alertCount(type: DashboardAlertType): number {
    return this.summary?.alerts?.[type] ?? 0;
  }

  get visibleAlertTypes(): DashboardAlertType[] {
    return this.alertTypes.filter((type) => !this.hidden.has(alertWidgetKey(type)));
  }

  get allClear(): boolean {
    return this.summaryStatus === 'ready' && this.visibleAlertTypes.every((type) => this.alertCount(type) === 0);
  }

  isVisible(widget: DashboardWidgetKey): boolean {
    return !this.hidden.has(widget);
  }

  openDrawer(type: DashboardAlertType): void {
    this.drawerType = type;
  }

  closeDrawer(): void {
    this.drawerType = null;
  }

  openCheckIns(): void {
    const checkIns = this.summary?.checkIns;
    this.openDrawer(checkIns && !checkIns.toReview && checkIns.overdue ? 'CHECK_INS_OVERDUE' : 'CHECK_INS_TO_REVIEW');
  }

  scrollToTodo(): void {
    document.getElementById('cdash-todo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- customize

  toggleCustomize(event: Event): void {
    event.stopPropagation();
    this.customizeOpen = !this.customizeOpen;
    this.quickActionsOpen = false;
    this.preferencesError = false;
  }

  toggleQuickActions(event: Event): void {
    event.stopPropagation();
    this.quickActionsOpen = !this.quickActionsOpen;
    this.customizeOpen = false;
  }

  @HostListener('document:click')
  closeMenus(): void {
    if (this.customizeOpen || this.quickActionsOpen) {
      this.customizeOpen = false;
      this.quickActionsOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenus();
  }

  toggleWidget(key: string): void {
    const previous = new Set(this.hidden);
    const next = new Set(this.hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.hidden = next;
    this.savingPreferences = true;
    this.preferencesError = false;
    this.dashboard.savePreferences({ hiddenWidgets: [...next] }).subscribe({
      next: () => {
        this.savingPreferences = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.hidden = previous;
        this.savingPreferences = false;
        this.preferencesError = true;
        this.cdr.markForCheck();
      },
    });
  }

  // ---- quick actions (previous dashboard behaviour)

  addClient(): void {
    this.quickActionsOpen = false;
    this.showAddClientModal = true;
  }

  addWorkoutPlan(): void {
    void this.router.navigate(['/workout/create-workout'], {
      queryParams: { returnUrl: '/coach-dashboard', assignAfterCreate: this.coachSettings.getConfig().quickActions.assignAfterWorkout },
    });
  }

  addNutritionPlan(): void {
    this.quickActionsOpen = false;
    this.showChoosePlanTypeModal = true;
  }

  get assignAfterNutrition(): boolean {
    return this.coachSettings.getConfig().quickActions.assignAfterNutrition;
  }

  addCheckIn(): void {
    void this.router.navigate(['/forms/create-form'], {
      queryParams: { returnTo: 'dashboard', assignAfterCreate: this.coachSettings.getConfig().quickActions.assignAfterCheckIn },
    });
  }
}
