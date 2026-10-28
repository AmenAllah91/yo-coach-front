import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TaskCalendarItem } from 'app/service/client-tasks.service';
import { capitalizeFirst } from './client-plan-utils';
import { isHabit, isTaskDone, taskActionLabel, taskColors, taskIcon, taskSubtitle } from './client-task-utils';

/**
 * One task / habit line of the client Home and Tasks pages (mobile ClientTaskRow): tinted icon tile,
 * title + subtitle and a trailing action that depends on the type (habit circle, "Fill in", "Log", "Add").
 */
@Component({
  selector: 'app-client-task-row',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <button type="button" class="task-row" (click)="activate()">
      <span class="task-row__tile" [style.background]="colors[1]" [style.color]="colors[0]">
        <i-feather [name]="icon"></i-feather>
      </span>
      <span class="task-row__copy">
        <strong [class.done]="done">{{ title }}</strong>
        <span>{{ subtitle }}</span>
      </span>
      <ng-container *ngIf="habit; else taskTrailing">
        <span *ngIf="toggling" class="task-row__spinner"><span class="yc-spinner"></span></span>
        <span *ngIf="!toggling" class="task-row__circle" [class.checked]="done">
          <i-feather *ngIf="done" name="check"></i-feather>
        </span>
      </ng-container>
      <ng-template #taskTrailing>
        <span *ngIf="done" class="task-row__circle checked"><i-feather name="check"></i-feather></span>
        <span *ngIf="!done && action" class="task-row__action">{{ action }}<i-feather name="chevron-right"></i-feather></span>
        <i-feather *ngIf="!done && !action" class="task-row__chevron" name="chevron-right"></i-feather>
      </ng-template>
    </button>
    <hr *ngIf="showDivider" class="yc-divider" />
  `,
  styles: [`
    :host { display: block; }
    .task-row {
      width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px;
      border: 0; background: transparent; text-align: left; cursor: pointer; color: inherit;
    }
    .task-row:hover { background: #fafbfc; }
    .task-row__tile {
      flex: none; width: 40px; height: 40px; border-radius: 11px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .task-row__tile i-feather { width: 19px; height: 19px; }
    .task-row__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .task-row__copy strong, .task-row__copy span {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .task-row__copy strong {
      font-size: 14.5px; line-height: 1.3; font-weight: 600; letter-spacing: -0.2px; color: var(--yc-text-primary);
    }
    .task-row__copy strong.done { color: var(--yc-text-hint); text-decoration: line-through; }
    .task-row__copy span { font-size: 12px; line-height: 1.3; font-weight: 500; color: var(--yc-text-secondary); }
    .task-row__circle {
      flex: none; width: 28px; height: 28px; border-radius: 50%; border: 1.6px solid #cbd2dc;
      display: inline-flex; align-items: center; justify-content: center; color: #fff;
      transition: background-color 0.16s ease, border-color 0.16s ease;
    }
    .task-row__circle.checked { background: #1e8e4e; border-color: #1e8e4e; }
    .task-row__circle i-feather { width: 15px; height: 15px; }
    .task-row__spinner { flex: none; width: 28px; height: 28px; padding: 5px; color: var(--yc-primary); }
    .task-row__spinner .yc-spinner { width: 18px; height: 18px; border-width: 2px; }
    .task-row__action {
      flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 7px 7px 7px 11px; border-radius: 9px;
      font-size: 12.5px; font-weight: 600; color: var(--yc-primary);
      background: color-mix(in srgb, var(--yc-primary) 9%, transparent);
    }
    .task-row__action i-feather { width: 14px; height: 14px; }
    .task-row__chevron { flex: none; width: 18px; height: 18px; color: var(--yc-text-hint); }
  `],
})
export class ClientTaskRowComponent {
  @Input({ required: true }) task!: TaskCalendarItem;
  @Input() fr = false;
  @Input() showDivider = false;
  @Input() toggling = false;
  /** False: the habit circle is shown but the row only opens the task. */
  @Input() canToggle = true;
  @Output() toggleHabit = new EventEmitter<TaskCalendarItem>();
  @Output() open = new EventEmitter<TaskCalendarItem>();

  get habit(): boolean { return isHabit(this.task); }
  get done(): boolean { return isTaskDone(this.task); }
  get title(): string { return capitalizeFirst(this.task.title); }
  get subtitle(): string { return taskSubtitle(this.task, this.fr); }
  get action(): string | null { return taskActionLabel(this.task, this.fr); }
  get icon(): string { return taskIcon(this.task); }
  get colors(): [string, string] { return taskColors(this.task); }

  activate(): void {
    if (this.habit && this.canToggle) this.toggleHabit.emit(this.task);
    else this.open.emit(this.task);
  }
}
