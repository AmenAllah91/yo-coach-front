import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostBinding, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';
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
/** In a client's profile the card fills the column height: more rows at first, then 10 more per « Charger plus ». */
const PROFILE_ROWS = 10;

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
  /** One client's feed, in the client's profile (all the coach's clients otherwise). */
  @Input() clientId: string | null = null;
  /**
   * Client profile: the card takes the height it is given (same bottom as the right column), its list scrolls
   * inside, and « Charger plus » adds the next activities in place. « Tout voir » still opens the full page.
   */
  @Input() @HostBinding('class.is-fill') fill = false;

  readonly categories = ACTIVITY_CATEGORIES;
  category: ClientActivityCategory | null = null;
  status: WidgetStatus = 'loading';
  activities: ClientActivity[] = [];
  /** Next page of the feed (null: everything is shown). */
  nextCursor: string | null = null;
  loadingMore = false;
  moreFailed = false;

  private readonly loads = new Subject<ClientActivityCategory | null>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private cdr: ChangeDetectorRef,
  ) {
    this.loads
      .pipe(
        switchMap((category) =>
          this.dashboard.getActivities({ category, clientId: this.clientId, limit: this.fill ? PROFILE_ROWS : DASHBOARD_ROWS }).pipe(
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.status = page ? 'ready' : 'error';
        this.activities = page?.items || [];
        this.nextCursor = page?.nextCursor || null;
        this.loadingMore = false;
        this.moreFailed = false;
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshKey'] || changes['clientId']) this.load();
  }

  /** "See all" keeps the category and, in a profile, the client. */
  get allParams(): Record<string, string> {
    return { ...(this.category ? { category: this.category } : {}), ...(this.clientId ? { clientId: this.clientId } : {}) };
  }

  select(category: ClientActivityCategory | null): void {
    if (this.category === category) return;
    this.category = category;
    this.load();
  }

  load(): void {
    this.status = 'loading';
    this.nextCursor = null;
    this.loads.next(this.category);
  }

  /** « Charger plus »: the next activities are added under the list (same filter). */
  loadMore(): void {
    if (!this.nextCursor || this.loadingMore) return;
    const category = this.category;
    this.loadingMore = true;
    this.moreFailed = false;
    this.dashboard
      .getActivities({ category, clientId: this.clientId, limit: PROFILE_ROWS, cursor: this.nextCursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (category !== this.category) return;
          const known = new Set(this.activities.map((item) => item.id));
          this.activities = [...this.activities, ...page.items.filter((item) => !known.has(item.id))];
          this.nextCursor = page.nextCursor || null;
          this.loadingMore = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingMore = false;
          this.moreFailed = true;
          this.cdr.markForCheck();
        },
      });
  }
}
