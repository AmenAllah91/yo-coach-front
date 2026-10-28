import { Router } from '@angular/router';
import { TaskCalendarItem } from 'app/service/client-tasks.service';
import { capitalizeFirst } from './client-plan-utils';

/**
 * Labels, colors and navigation of the client tasks, as in the mobile app
 * (yo-coach-mobile lib/screens/tasks/client_task_widgets.dart).
 */

/** Same labels as the mobile measurementTypes list. */
const MEASUREMENT_LABELS: Record<string, string> = {
  BODYWEIGHT: 'Body Weight', BMI: 'BMI', BODY_FAT_INDEX: 'Body Fat %', WAIST: 'Waist', CHEST: 'Chest',
  SHOULDERS: 'Shoulders', BICEPS_RIGHT: 'Biceps (R)', BICEPS_LEFT: 'Biceps (L)', QUADRICEPS_RIGHT: 'Quadriceps (R)',
  QUADRICEPS_LEFT: 'Quadriceps (L)', NECK: 'Neck',
};

const HABIT_UNITS: Record<string, string> = {
  TIMES: 'times', MINUTES: 'min', HOURS: 'h', LITERS: 'L', SERVINGS: 'servings', STEPS: 'steps',
};

export function isHabit(task: TaskCalendarItem): boolean {
  return task.itemType === 'HABIT';
}

export function isTaskDone(task: TaskCalendarItem): boolean {
  return task.status === 'DONE';
}

function underscoreTitle(value: string): string {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function taskTypeLabel(task: TaskCalendarItem, fr: boolean): string {
  if (isHabit(task)) return fr ? 'Habitude' : 'Habit';
  switch (task.taskType) {
    case 'FORM': return fr ? 'Formulaire de check-in' : 'Check-in form';
    case 'CLIENT_PROGRESS': return 'Photos';
    case 'BODY_METRICS': return fr ? 'Mensurations' : 'Measurements';
    default: return fr ? 'Tâche' : 'Task';
  }
}

function habitUnit(task: TaskCalendarItem): string {
  return task.unit === 'CUSTOM' ? (task.customUnit || '').trim() : HABIT_UNITS[task.unit || ''] || '';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function taskSubtitle(task: TaskCalendarItem, fr: boolean): string {
  const parts = [taskTypeLabel(task, fr)];
  if (task.taskType === 'CLIENT_PROGRESS' && task.requestedPoses?.length) {
    parts.push(task.requestedPoses.map(underscoreTitle).join(', '));
  } else if (task.taskType === 'BODY_METRICS' && task.requestedMeasurements?.length) {
    parts.push(task.requestedMeasurements.map(value => MEASUREMENT_LABELS[value] || underscoreTitle(value)).join(', '));
  } else if (isHabit(task)) {
    const unit = habitUnit(task);
    const value = task.goalValue == null ? unit : `${formatNumber(task.goalValue)} ${unit}`.trim();
    if (value) parts.push(value);
  } else if (task.instructions?.trim()) {
    parts.push(capitalizeFirst(task.instructions));
  }
  return parts.join(' · ');
}

/** Label of the trailing action button, or null when the whole row is simply a link. */
export function taskActionLabel(task: TaskCalendarItem, fr: boolean): string | null {
  if (isHabit(task)) return null;
  switch (task.taskType) {
    case 'FORM': return fr ? 'Remplir' : 'Fill in';
    case 'BODY_METRICS': return fr ? 'Saisir' : 'Log';
    case 'CLIENT_PROGRESS': return fr ? 'Ajouter' : 'Add';
    default: return null;
  }
}

/** Feather icon of the task tile. */
export function taskIcon(task: TaskCalendarItem): string {
  if (isHabit(task)) return 'repeat';
  switch (task.taskType) {
    case 'FORM': return 'clipboard-list';
    case 'CLIENT_PROGRESS': return 'camera';
    case 'BODY_METRICS': return 'maximize-2';
    default: return 'list-checks';
  }
}

/** [icon color, tile background] of a task type. */
export function taskColors(task: TaskCalendarItem): [string, string] {
  // [icon color, tile background]; in dark mode the tile is a deep tint of the same color.
  const tone = (fg: string, light: string): [string, string] =>
    [fg, `light-dark(${light}, color-mix(in srgb, ${fg} 22%, var(--yc-surface)))`];
  if (isHabit(task)) return tone('#0C86C8', '#E8F3FA');
  switch (task.taskType) {
    case 'CLIENT_PROGRESS': return tone('#D9761A', '#FDF1E3');
    case 'BODY_METRICS': return tone('#1E9E63', '#E6F6EE');
    case 'FORM': return tone('#7455D9', '#EFEBFB');
    default: return tone('#0C86C8', '#E8F3FA');
  }
}

/** Mobile openClientTask: the screen that completes the task. */
export function openClientTask(router: Router, task: TaskCalendarItem): Promise<boolean> {
  switch (task.taskType) {
    case 'FORM':
      if (task.formAssignmentId?.trim()) {
        return router.navigate(['/assignments/me'], { queryParams: { assignmentId: task.formAssignmentId.trim() } });
      }
      break;
    case 'CLIENT_PROGRESS':
      return router.navigate(['/progress-pictures'], {
        queryParams: { taskDate: task.date, poses: (task.requestedPoses || []).join(',') || null },
      });
    case 'BODY_METRICS':
      return router.navigate(['/body-measurements'], {
        queryParams: { taskDate: task.date, measurements: (task.requestedMeasurements || []).join(',') || null },
      });
  }
  return router.navigate(['/tasks'], { queryParams: { itemId: task.id, date: task.date, itemType: task.itemType } });
}
