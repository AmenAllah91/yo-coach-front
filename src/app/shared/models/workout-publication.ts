import { WorkoutDay, WorkoutPlan } from './workout.models';

export function workoutDayState(day: WorkoutDay): 'EMPTY' | 'READY' | 'REST_DAY' {
  if (day.isRestDay || day.restDay) return 'REST_DAY';
  const sessions = day.workoutSessions?.length ? day.workoutSessions : day.session ? [day.session] : [];
  const nonnegative = (v: unknown) => v == null || (v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0);
  return sessions.length > 0 && sessions.every(s => !!s.name?.trim() && s.exercises?.length > 0 && s.exercises.every(e =>
    !!e.name?.trim() && !!e.sets?.length && e.sets.every(set =>
      nonnegative(set.weight) && nonnegative(set.restMin) && nonnegative(set.restSec) && Number(set.restSec || 0) < 60
      && (e.type === 'CARDIO' ? Number(set.duration) > 0 : Number(set.reps) > 0)
    ))) ? 'READY' : 'EMPTY';
}
export function workoutWeekReady(days: WorkoutDay[], week: number): number {
  return days.slice((week - 1) * 7, week * 7).filter(day => workoutDayState(day) !== 'EMPTY').length;
}
export function workoutPublishedCount(plan: WorkoutPlan): number { return new Set(plan.publishedWeeks || []).size; }
export function emptyWorkoutDays(weeks: number): WorkoutDay[] {
  return Array.from({length: Math.max(1, Math.min(12, weeks)) * 7}, (_, i) => ({
    id: crypto.randomUUID(), title: `Day ${i % 7 + 1}`, dayNumber: i + 1, restDay: false, status: 'PENDING', workoutSessions: []
  }));
}
