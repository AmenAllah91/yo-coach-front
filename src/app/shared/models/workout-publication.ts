import { WorkoutDay } from './workout.models';

export type WorkoutDayPublicationState = 'EMPTY' | 'READY' | 'REST_DAY';

export function workoutDayState(day: WorkoutDay | null | undefined): WorkoutDayPublicationState {
  if (!day) return 'EMPTY';
  if (day.isRestDay || day.restDay) return 'REST_DAY';
  const sessions = day.workoutSessions?.length ? day.workoutSessions : (day.session ? [day.session] : []);
  if (!sessions.length) return 'EMPTY';
  const valid = sessions.every(session => {
    if (!session?.name?.trim() || !session.exercises?.length) return false;
    return session.exercises.every(exercise => {
      if (!exercise?.name?.trim() || !exercise.sets?.length) return false;
      return exercise.sets.every(set => {
        const weight = set.weight;
        const restMin = Number(set.restMin ?? 0);
        const restSec = Number(set.restSec ?? 0);
        if (weight != null && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) return false;
        if (!Number.isFinite(restMin) || restMin < 0 || !Number.isFinite(restSec) || restSec < 0 || restSec >= 60) return false;
        if (exercise.type === 'CARDIO') return Number.isFinite(Number(set.duration)) && Number(set.duration) > 0;
        return set.reps != null && set.reps !== '' && Number.isFinite(Number(set.reps)) && Number(set.reps) > 0;
      });
    });
  });
  return valid ? 'READY' : 'EMPTY';
}

export function workoutWeekReady(days: WorkoutDay[], week: number): number {
  return (days || [])
    .slice((week - 1) * 7, week * 7)
    .filter(day => workoutDayState(day) !== 'EMPTY').length;
}
