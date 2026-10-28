import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ProgramSummary, nutritionSummary, workoutSummary } from '@shared/models/program-days';

/**
 * Assignment of a program (backlog-programmes.md R5): tells the coach what the client will see. A program can be
 * assigned at any time, even incomplete; the client sees the filled days, the next ones as soon as they are filled.
 * Nothing is shown for a file program, or when the list did not bring the program's days.
 */
@Component({
  selector: 'app-assign-visibility-note',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <p class="avn" *ngIf="summary as s" [class.avn--warning]="s.readyDays === 0" [class.avn--complete]="s.readyDays > 0 && s.readyDays === s.totalDays" role="note">
      <span class="avn__icon" aria-hidden="true">{{ s.readyDays === 0 ? '!' : 'i' }}</span>
      <span>
        {{ (s.readyDays === 0 ? 'ASSIGN_VISIBLE_NONE' : s.readyDays === s.totalDays ? 'ASSIGN_VISIBLE_ALL' : 'ASSIGN_VISIBLE_SOME') | translate:{ count: s.readyDays, total: s.totalDays } }}
      </span>
    </p>
  `,
  styles: [`
    .avn { display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; padding: 10px 12px; border-radius: 10px;
      border: 1px solid light-dark(#bae6fd, #254d60); background: light-dark(#f0f9ff, #1f303b); color: light-dark(#075985, #81c6f8); font-size: 13px; line-height: 1.45; }
    .avn__icon { flex: 0 0 18px; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%;
      border: 1.5px solid currentColor; font-size: 11px; font-weight: 700; line-height: 1; margin-top: 1px; }
    .avn--complete { border-color: light-dark(#a7f3d0, #1b533e); background: light-dark(#ecfdf5, #173429); color: light-dark(#065f46, #85d0b2); }
    .avn--warning { border-color: #fcd34d; background: light-dark(#fffbeb, #332c12); color: light-dark(#92400e, #f4996c); }
  `],
})
export class AssignVisibilityNoteComponent {
  @Input() kind: 'workout' | 'nutrition' = 'workout';
  @Input() program: any = null;

  get summary(): ProgramSummary | null {
    const program = this.program;
    if (!program || this.isFile(program)) return null;
    const days = this.kind === 'nutrition' ? program.mealDays : program.workoutDays;
    if (!Array.isArray(days) || !days.length) return null;
    return this.kind === 'nutrition' ? nutritionSummary(days, program.trackingMode) : workoutSummary(days);
  }

  private isFile(program: any): boolean {
    const mode = String(program?.workoutPlanMode || program?.nutritionPlanMode || '').toUpperCase();
    return mode === 'FILE' || !!program?.isFile || !!program?.fileName || !!program?.fileUrl;
  }
}
