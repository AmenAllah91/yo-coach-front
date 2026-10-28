import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProgramSummary, nutritionSummary, workoutSummary } from '@shared/models/program-days';

/**
 * Program progress in the lists (libraries, client tabs): "10/28 days filled" instead of the former weekly
 * publication (backlog-programmes.md). Green when complete, grey when nothing is filled yet.
 */
@Component({
  selector: 'app-program-days-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `<span class="program-days-badge" *ngIf="summary as s" [class.is-complete]="s.totalDays > 0 && s.readyDays === s.totalDays" [class.is-empty]="s.readyDays === 0">
    {{ 'PROGRAM_DAYS_FILLED' | translate:{ count: s.readyDays, total: s.totalDays } }}
  </span>`,
  styles: [`
    .program-days-badge{display:inline-flex;margin-top:6px;padding:3px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:11px;font-weight:600;white-space:nowrap}
    .program-days-badge.is-complete{background:#e8f8f3;color:#087f5b}
    .program-days-badge.is-empty{background:#f1f5f9;color:#64748b}
  `],
})
export class ProgramDaysBadgeComponent {
  @Input() plan: any = null;
  @Input() kind: 'workout' | 'nutrition' = 'workout';

  get summary(): ProgramSummary | null {
    const days = this.kind === 'nutrition' ? this.plan?.mealDays : this.plan?.workoutDays;
    if (!Array.isArray(days) || !days.length) return null; // a file program has no days
    return this.kind === 'nutrition' ? nutritionSummary(days, this.plan?.trackingMode) : workoutSummary(days);
  }
}
