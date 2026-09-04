import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { WorkoutPlan } from '@shared/models/workout.models';
@Component({selector: 'app-workout-publication-badge', standalone: true, imports: [CommonModule, TranslateModule],
  template: `<span *ngIf="plan && plan.workoutPlanMode !== 'FILE'" class="publication"><span>{{ 'WORKOUT_PUBLISHED_COUNT' | translate:{count: count, total: total} }} · {{ percent }}%</span><progress [value]="count" [max]="total" [attr.aria-label]="'WORKOUT_PUBLISHED_COUNT' | translate:{count: count, total: total}"></progress></span>`,
  styles: [`.publication{display:inline-flex;flex-direction:column;gap:5px;font-size:12px;color:#64748b;margin:6px 0}progress{width:150px;height:5px;accent-color:#22a585}`]})
export class WorkoutPublicationBadgeComponent {
 @Input() plan!: WorkoutPlan;
 get count(){return new Set((this.plan.publishedWeeks || []).filter(week => Number.isInteger(week) && week > 0 && week <= this.total)).size;}
 get total(){return Math.max(1, Math.ceil((this.plan.workoutDays?.length || 7)/7));}
 get percent(){return Math.round(this.count / this.total * 100);}
}
