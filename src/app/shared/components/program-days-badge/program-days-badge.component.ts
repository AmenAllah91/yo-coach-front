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
    .program-days-badge{display:inline-flex;margin-top:6px;padding:3px 8px;border-radius:999px;background:light-dark(#e0f2fe, #143446);color:light-dark(#0369a1, #68baf7);font-size:11px;font-weight:600;white-space:nowrap}
    .program-days-badge.is-complete{background:light-dark(#e8f8f3, #19352e);color:light-dark(#087f5b, #64c59d)}
    .program-days-badge.is-empty{background:light-dark(#f1f5f9, #15181d);color:light-dark(#64748b, #a5abb4)}
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
