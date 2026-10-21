import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import {
  ACTIVITY_CATEGORIES,
  ClientActivity,
  ClientActivityCategory,
  WidgetStatus,
} from '../../../models/coach-dashboard.model';
import { WidgetStateComponent } from '../shared/widget-state.component';
import { ActivityListComponent } from '../shared/activity-list.component';

const DASHBOARD_ROWS = 6;

/** Latest client events on the dashboard, with the category filters and a link to the full page. */
@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule, WidgetStateComponent, ActivityListComponent],
  templateUrl: './recent-activities.component.html',
  styleUrl: '../shared/widget-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentActivitiesComponent implements OnChanges {
  @Input() lang: string | undefined;
  @Input() refreshKey = 0;

  readonly categories = ACTIVITY_CATEGORIES;
  category: ClientActivityCategory | null = null;
  status: WidgetStatus = 'loading';
  activities: ClientActivity[] = [];

  private readonly loads = new Subject<ClientActivityCategory | null>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private cdr: ChangeDetectorRef,
  ) {
    this.loads
      .pipe(
        switchMap((category) =>
          this.dashboard.getActivities({ category, limit: DASHBOARD_ROWS }).pipe(
            map((page) => page.items),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.status = items ? 'ready' : 'error';
        this.activities = items || [];
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshKey']) this.load();
  }

  select(category: ClientActivityCategory | null): void {
    if (this.category === category) return;
    this.category = category;
    this.load();
  }

  load(): void {
    this.status = 'loading';
    this.loads.next(this.category);
  }
}
