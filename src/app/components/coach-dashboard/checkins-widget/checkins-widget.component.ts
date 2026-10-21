import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { DashboardAlertItem, DashboardAlertType, WidgetStatus } from '../../../models/coach-dashboard.model';
import { WidgetStateComponent } from '../shared/widget-state.component';
import { CheckinCardComponent } from '@shared/components/checkin-card/checkin-card.component';
import { avatarTone, initials, relativeTime } from '../shared/dashboard-format';

type CheckInTab = 'toReview' | 'overdue';

const TAB_TYPES: Record<CheckInTab, DashboardAlertType> = {
  toReview: 'CHECK_INS_TO_REVIEW',
  overdue: 'CHECK_INS_OVERDUE',
};

/** Check-ins to review / overdue (real due dates only). Rows open the existing check-in review page. */
@Component({
  selector: 'app-checkins-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule, WidgetStateComponent, CheckinCardComponent],
  templateUrl: './checkins-widget.component.html',
  styleUrl: '../shared/widget-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckinsWidgetComponent implements OnChanges {
  @Input() counts: { toReview: number; overdue: number } | null = null;
  @Input() lang: string | undefined;
  /** Changes when the dashboard is refreshed. */
  @Input() refreshKey = 0;

  tab: CheckInTab = 'toReview';
  status: WidgetStatus = 'loading';
  items: DashboardAlertItem[] = [];
  readonly brokenAvatars = new Set<string>();

  private readonly loads = new Subject<CheckInTab>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private cdr: ChangeDetectorRef,
  ) {
    this.loads
      .pipe(
        switchMap((tab) =>
          this.dashboard.getAlerts(TAB_TYPES[tab], 0, 5).pipe(
            map((page) => page.items),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.status = items ? 'ready' : 'error';
        this.items = items || [];
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshKey']) this.load();
  }

  select(tab: CheckInTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.load();
  }

  load(): void {
    this.status = 'loading';
    this.loads.next(this.tab);
  }

  initialsOf = initials;

  tone(item: DashboardAlertItem): number {
    return avatarTone(item.clientId);
  }

  when(item: DashboardAlertItem): string {
    return relativeTime(this.tab === 'toReview' ? item.submittedAt : item.dueAt, this.lang);
  }

  trackById(_: number, item: DashboardAlertItem): string {
    return item.assignmentId || item.clientId;
  }
}
