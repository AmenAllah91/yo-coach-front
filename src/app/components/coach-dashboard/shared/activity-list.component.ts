import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { ClientActivity } from '../../../models/coach-dashboard.model';
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
}

interface ActivityDay {
  label: string;
  rows: ActivityRow[];
}

/** Activity feed grouped by day (dashboard widget and "All activities" page). */
@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
})
export class ActivityListComponent {
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
  private items: ClientActivity[] = [];
  private language: string | undefined;

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
      });
    }
    this.days = days;
  }
}
