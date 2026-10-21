import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, of, map } from 'rxjs';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { DashboardAlertItem, DashboardAlertType, WidgetStatus } from '../../../models/coach-dashboard.model';
import { WidgetStateComponent } from '../shared/widget-state.component';
import { ALERT_ICONS, avatarTone, initials, relativeTime, shortDate } from '../shared/dashboard-format';

const PAGE_SIZE = 20;

/** Common right drawer of the "To do" categories: loaded on demand, 20 rows at a time. */
@Component({
  selector: 'app-alert-drawer',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, WidgetStateComponent],
  templateUrl: './alert-drawer.component.html',
  styleUrl: './alert-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDrawerComponent implements OnChanges {
  @Input() type: DashboardAlertType | null = null;
  @Input() lang: string | undefined;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  status: WidgetStatus = 'loading';
  items: DashboardAlertItem[] = [];
  total = 0;
  loadingMore = false;
  loadMoreFailed = false;
  readonly brokenAvatars = new Set<string>();

  private page = 0;
  private readonly requests = new Subject<{ type: DashboardAlertType; page: number }>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dashboard: CoachDashboardService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    // switchMap: changing category cancels the previous request.
    this.requests
      .pipe(
        switchMap(({ type, page }) =>
          this.dashboard.getAlerts(type, page, PAGE_SIZE).pipe(
            map((result) => ({ result, page, failed: false })),
            catchError(() => of({ result: null, page, failed: true })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ result, page, failed }) => {
        this.loadingMore = false;
        if (failed || !result) {
          if (page === 0) this.status = 'error';
          else this.loadMoreFailed = true;
        } else {
          this.items = page === 0 ? result.items : [...this.items, ...result.items];
          this.total = result.total;
          this.page = page;
          this.status = 'ready';
        }
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['type'] && this.type) {
      this.reload();
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  get open(): boolean {
    return !!this.type;
  }

  get icon(): string {
    return this.type ? ALERT_ICONS[this.type] : 'list';
  }

  get hasMore(): boolean {
    return this.items.length < this.total;
  }

  reload(): void {
    if (!this.type) return;
    this.status = 'loading';
    this.items = [];
    this.total = 0;
    this.loadMoreFailed = false;
    this.requests.next({ type: this.type, page: 0 });
  }

  loadMore(): void {
    if (!this.type || this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    this.loadMoreFailed = false;
    this.requests.next({ type: this.type, page: this.page + 1 });
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  // ---- row content

  initialsOf = initials;

  tone(item: DashboardAlertItem): number {
    return avatarTone(item.clientId);
  }

  date(value?: string): string {
    return shortDate(value, this.lang);
  }

  ago(value?: string): string {
    return relativeTime(value, this.lang);
  }

  // ---- actions (existing pages and processes)

  /** Same assignment process as the client profile, client already selected. */
  assignProgram(item: DashboardAlertItem): void {
    this.go(['/clients/profil-client', item.clientId], { tab: 'workouts', openAssign: 'workout' });
  }

  assignNutrition(item: DashboardAlertItem): void {
    this.go(['/clients/profil-client', item.clientId], { tab: 'nutrition', openAssign: 'nutrition' });
  }

  viewProgram(item: DashboardAlertItem): void {
    this.go(['/clients/profil-client', item.clientId], { tab: 'workouts' });
  }

  viewProfile(item: DashboardAlertItem): void {
    this.go(['/clients/profil-client', item.clientId]);
  }

  review(item: DashboardAlertItem): void {
    this.go(['/forms/manage-checkins'], { assignmentId: item.assignmentId! });
  }

  message(item: DashboardAlertItem): void {
    this.go(['/chat'], item.conversationId ? { conversationId: item.conversationId } : { clientId: item.clientId });
  }

  trackByRow(_: number, item: DashboardAlertItem): string {
    return item.assignmentId || item.clientId;
  }

  private go(commands: string[], queryParams?: Record<string, string>): void {
    this.close();
    void this.router.navigate(commands, { queryParams });
  }
}
