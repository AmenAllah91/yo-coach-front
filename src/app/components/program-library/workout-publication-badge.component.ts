import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { WorkoutPlan } from '@shared/models/workout.models';

@Component({
  selector: 'app-workout-publication-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `<span class="publication-badge" [class.published]="publishedCount > 0">
    <ng-container *ngIf="publishedCount === 0">{{ 'WORKOUT_DRAFT' | translate }} · </ng-container>{{ 'WORKOUT_PUBLISHED_COUNT' | translate:{count: publishedCount, total: totalWeeks} }}
  </span>`,
  styles: [`
    .publication-badge{display:inline-flex;margin-top:6px;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600}
    .publication-badge.published{background:#e8f8f3;color:#087f5b}
  `],
})
export class WorkoutPublicationBadgeComponent {
  @Input() plan: WorkoutPlan | null = null;
  get publishedCount(): number { return this.plan?.publishedWeeks?.length || 0; }
  get totalWeeks(): number { return Math.max(1, Math.ceil((this.plan?.workoutDays?.length || 0) / 7)); }
}
