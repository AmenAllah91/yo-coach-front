import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { ClientService } from '../../../service/client.service';
import {
  ACTIVITY_CATEGORIES,
  ActivityQuery,
  ClientActivity,
  ClientActivityCategory,
  WidgetStatus,
} from '../../../models/coach-dashboard.model';
import { WidgetStateComponent } from '../shared/widget-state.component';
import { ActivityListComponent } from '../shared/activity-list.component';
import { toDateInput } from '../shared/dashboard-format';
import { ActivityFeedStateService, ActivityFilters } from './activity-feed-state.service';

const PAGE_SIZE = 20;
const PERIODS = ['all', '7', '30', '90', 'custom'] as const;

interface ClientOption {
  id: string;
  name: string;
}

/** "All activities": category, client and period filters, 20 events per page with a stable cursor. */
@Component({
  selector: 'app-all-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, FeatherModule, WidgetStateComponent, ActivityListComponent],
  templateUrl: './all-activities.component.html',
  styleUrl: './all-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllActivitiesComponent implements OnInit, OnDestroy {
  readonly categories = ACTIVITY_CATEGORIES;
  readonly periods = PERIODS;

  filters: ActivityFilters = { category: null, clientId: null, period: 'all', from: null, to: null };
  clients: ClientOption[] = [];
  items: ClientActivity[] = [];
  nextCursor: string | null = null;
  status: WidgetStatus = 'loading';
  loadingMore = false;
  loadMoreFailed = false;
  lang: string | undefined;

  private request?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private clientService: ClientService,
    private state: ActivityFeedStateService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.lang = this.translate.currentLang;
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.lang = event.lang;
      this.cdr.markForCheck();
    });

    const coachId = sessionStorage.getItem('userId') || '';
    if (coachId) {
      this.clientService.getActiveClientsForAssignment(coachId, true).subscribe({
        next: (clients) => {
          this.clients = (clients || [])
            .map((client: any) => ({ id: String(client.id), name: `${client.firstName || ''} ${client.lastName || ''}`.trim() || '—' }))
            .sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.markForCheck();
        },
        error: () => undefined, // the client filter stays empty; the feed still works
      });
    }

    let first = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.filters = this.readFilters(params);
      const restored = first ? this.state.restore(this.filters) : null;
      first = false;
      if (restored) {
        this.items = restored.items;
        this.nextCursor = restored.nextCursor;
        this.status = 'ready';
        this.cdr.markForCheck();
        // After the rows are drawn.
        setTimeout(() => window.scrollTo({ top: restored.scrollY }));
      } else {
        this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    if (this.status === 'ready') this.state.save(this.filters, this.items, this.nextCursor, window.scrollY);
  }

  // ---- filters (kept in the URL: shareable, and back/forward restore them)

  setCategory(category: ClientActivityCategory | null): void {
    this.applyFilters({ ...this.filters, category });
  }

  setClient(clientId: string | null): void {
    this.applyFilters({ ...this.filters, clientId: clientId || null });
  }

  setPeriod(period: string): void {
    if (period === 'custom') {
      const today = toDateInput(new Date());
      this.applyFilters({ ...this.filters, period, from: this.filters.from || today, to: this.filters.to || today });
    } else {
      this.applyFilters({ ...this.filters, period, from: null, to: null });
    }
  }

  setRange(from: string | null, to: string | null): void {
    if (from && to && from > to) return;
    this.applyFilters({ ...this.filters, period: 'custom', from: from || null, to: to || null });
  }

  resetFilters(): void {
    this.applyFilters({ category: null, clientId: null, period: 'all', from: null, to: null });
  }

  get hasFilters(): boolean {
    return !!(this.filters.category || this.filters.clientId || this.filters.period !== 'all');
  }

  private applyFilters(filters: ActivityFilters): void {
    this.state.clear();
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        category: filters.category || null,
        clientId: filters.clientId || null,
        period: filters.period === 'all' ? null : filters.period,
        from: filters.period === 'custom' ? filters.from : null,
        to: filters.period === 'custom' ? filters.to : null,
      },
    });
  }

  private readFilters(params: ParamMap): ActivityFilters {
    const category = params.get('category');
    const period = params.get('period');
    return {
      category: ACTIVITY_CATEGORIES.includes(category as ClientActivityCategory) ? category : null,
      clientId: params.get('clientId'),
      period: PERIODS.includes(period as (typeof PERIODS)[number]) ? (period as string) : 'all',
      from: params.get('from'),
      to: params.get('to'),
    };
  }

  // ---- loading

  load(): void {
    this.request?.unsubscribe();
    this.status = 'loading';
    this.items = [];
    this.nextCursor = null;
    this.loadMoreFailed = false;
    this.cdr.markForCheck();
    this.request = this.dashboard.getActivities(this.query(null)).subscribe({
      next: (page) => {
        this.items = page.items;
        this.nextCursor = page.nextCursor;
        this.status = 'ready';
        this.cdr.markForCheck();
      },
      error: () => {
        this.status = 'error';
        this.cdr.markForCheck();
      },
    });
  }

  loadMore(): void {
    if (!this.nextCursor || this.loadingMore) return;
    this.loadingMore = true;
    this.loadMoreFailed = false;
    this.request = this.dashboard.getActivities(this.query(this.nextCursor)).subscribe({
      next: (page) => {
        this.items = [...this.items, ...page.items];
        this.nextCursor = page.nextCursor;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingMore = false;
        this.loadMoreFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  private query(cursor: string | null): ActivityQuery {
    const range = this.range();
    return {
      category: this.filters.category as ClientActivityCategory | null,
      clientId: this.filters.clientId,
      from: range.from,
      to: range.to,
      cursor,
      limit: PAGE_SIZE,
    };
  }

  /** Period → dates of the coach's calendar (the backend reads them in the platform time zone). */
  private range(): { from: string | null; to: string | null } {
    const period = this.filters.period;
    if (period === 'custom') return { from: this.filters.from, to: this.filters.to };
    const days = Number(period);
    if (!days) return { from: null, to: null };
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    return { from: toDateInput(from), to: toDateInput(today) };
  }
}
