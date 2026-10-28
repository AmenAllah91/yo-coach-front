import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { of } from 'rxjs';
import { ClientActivity } from '../../../models/coach-dashboard.model';
import { ClientProfileCacheService } from 'app/service/client-profile-cache.service';
import { ClientActivityDetailComponent } from '../../clients/profil-client/client-activity/client-activity-detail.component';
import {
  NutritionActivity,
  WorkoutActivity,
  buildNutritionActivities,
  buildWorkoutActivities,
} from '../../clients/profil-client/client-activity/client-activity';
import {
  CATEGORY_ICONS,
  activityDetail,
  activityLink,
  activitySentence,
  avatarTone,
  clockTime,
  dayLabel,
  initials,
} from './dashboard-format';

interface ActivityRow {
  activity: ClientActivity;
  link: ReturnType<typeof activityLink>;
  sentence: ReturnType<typeof activitySentence>;
  detail: ReturnType<typeof activityDetail>;
  icon: string;
  initials: string;
  tone: number;
  time: string;
  /** A received check-in: "Review" button. */
  reviewable: boolean;
  /** A workout or nutrition day: opens its detail here instead of the profile. */
  opensDetail: boolean;
}

/** The workout or nutrition day open over the feed. */
interface OpenDetail {
  activity: ClientActivity;
  loading: boolean;
  notice: string | null;
  workout: WorkoutActivity | null;
  nutrition: NutritionActivity | null;
}

interface ActivityDay {
  label: string;
  rows: ActivityRow[];
}

/** Activity feed grouped by day (dashboard widget and "All activities" page). */
@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule, ClientActivityDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
})
export class ActivityListComponent implements OnDestroy {
  @Input() set activities(value: ClientActivity[] | null) {
    this.items = value || [];
    this.build();
  }
  @Input() set lang(value: string | undefined) {
    this.language = value;
    this.build();
  }

  readonly brokenAvatars = new Set<string>();
  days: ActivityDay[] = [];
  detail: OpenDetail | null = null;
  private items: ClientActivity[] = [];
  private language: string | undefined;

  constructor(
    private profileCache: ClientProfileCacheService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Plain click on a workout or nutrition day: its detail over the feed (Ctrl/middle click still opens the profile). */
  openRow(event: MouseEvent, row: ActivityRow): void {
    if (!row.opensDetail || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const activity = row.activity;
    const part = activity.category === 'WORKOUT' ? 'workouts' : 'nutrition';
    const detail: OpenDetail = { activity, loading: true, notice: null, workout: null, nutrition: null };
    this.detail = detail;
    document.body.style.overflow = 'hidden';
    // The client has just logged it: the plans are read again unless read in the last minute.
    const plans$ = this.profileCache.isFresh(part, activity.clientId)
      ? of(this.profileCache.snapshot<any[]>(part, activity.clientId) || [])
      : this.profileCache.load<any[]>(part, sessionStorage.getItem('userId') || '', activity.clientId);
    plans$.subscribe({
      next: (plans) => {
        if (this.detail !== detail) return;
        const workout = part === 'workouts' ? buildWorkoutActivities(plans).find((day) => day.id === activity.refId) || null : null;
        const nutrition = part === 'nutrition' ? buildNutritionActivities(plans).find((day) => day.id === activity.refId) || null : null;
        const notice = workout || nutrition ? null : 'CDASH.ACTIVITY_DETAIL_NOT_FOUND';
        this.detail = { ...detail, loading: false, notice, workout, nutrition };
        this.cdr.markForCheck();
      },
      error: () => {
        if (this.detail !== detail) return;
        this.detail = { ...detail, loading: false, notice: 'CDASH.ACTIVITY_DETAIL_ERROR' };
        this.cdr.markForCheck();
      },
    });
  }

  @HostListener('document:keydown.escape')
  closeDetail(): void {
    if (!this.detail) return;
    this.detail = null;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  messageClient(): void {
    const clientId = this.detail?.activity.clientId;
    this.closeDetail();
    if (clientId) void this.router.navigate(['/clients/profil-client', clientId], { queryParams: { tab: 'chat' } });
  }

  openProfile(): void {
    const clientId = this.detail?.activity.clientId;
    this.closeDetail();
    if (clientId) void this.router.navigate(['/clients/profil-client', clientId], { queryParams: { tab: 'dashboard' } });
  }

  ngOnDestroy(): void {
    if (this.detail) document.body.style.overflow = '';
  }

  trackByDay(_: number, day: ActivityDay): string {
    return day.label;
  }

  trackById(_: number, row: ActivityRow): string {
    return row.activity.id;
  }

  private build(): void {
    const days: ActivityDay[] = [];
    for (const activity of this.items) {
      const label = dayLabel(activity.occurredAt, this.language);
      let day = days[days.length - 1];
      if (!day || day.label !== label) {
        day = { label, rows: [] };
        days.push(day);
      }
      day.rows.push({
        activity,
        link: activityLink(activity),
        sentence: activitySentence(activity),
        detail: activityDetail(activity),
        icon: CATEGORY_ICONS[activity.category] || 'circle',
        initials: initials(activity.clientName),
        tone: avatarTone(activity.clientId),
        time: activity.dateOnly ? '' : clockTime(activity.occurredAt, this.language),
        reviewable: activity.category === 'CHECK_IN' && !!activity.refId,
        opensDetail: (activity.category === 'WORKOUT' || activity.category === 'NUTRITION') && !!activity.refId,
      });
    }
    this.days = days;
  }
}
