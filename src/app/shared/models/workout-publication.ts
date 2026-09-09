import { WorkoutDay } from './workout.models';
import { ExerciseSet } from './exercice.models';

export type WorkoutDayPublicationState = 'EMPTY' | 'READY' | 'REST_DAY';

export function workoutSetValidationMessages(
  set: ExerciseSet | null | undefined,
  exerciseType?: string | null,
): string[] {
  if (!set) return ['Add at least one valid set.'];

  const messages: string[] = [];
  const weight = set.weight;
  const restMin = Number(set.restMin ?? 0);
  const restSec = Number(set.restSec ?? 0);

  if (weight != null && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
    messages.push('Weight must be 0 or greater.');
  }
  if (!Number.isFinite(restMin) || restMin < 0 || !Number.isFinite(restSec) || restSec < 0 || restSec >= 60) {
    messages.push('Rest time is invalid. Seconds must be between 0 and 59.');
  }

  if (exerciseType === 'CARDIO') {
    if (!Number.isFinite(Number(set.duration)) || Number(set.duration) <= 0) {
      messages.push('Cardio duration must be greater than 0.');
    }
  } else if (set.reps == null || set.reps === '' || !Number.isFinite(Number(set.reps)) || Number(set.reps) < 0) {
    messages.push('Reps must be 0 or greater.');
  }

  return [...new Set(messages)];
}

export function firstWorkoutSetValidationMessage(
  set: ExerciseSet | null | undefined,
  exerciseType?: string | null,
): string | null {
  return workoutSetValidationMessages(set, exerciseType)[0] ?? null;
}

export function workoutDayState(day: WorkoutDay | null | undefined): WorkoutDayPublicationState {
  if (!day) return 'EMPTY';
  if (day.isRestDay || day.restDay) return 'REST_DAY';

  const sessions = day.workoutSessions?.length
    ? day.workoutSessions
    : day.session
      ? [day.session]
      : [];

  if (!sessions.length) return 'EMPTY';

  const valid = sessions.every(session => {
    if (!session?.name?.trim() || !session.exercises?.length) return false;
    return session.exercises.every(exercise => {
      if (!exercise?.name?.trim() || !exercise.sets?.length) return false;
      return exercise.sets.some((set: ExerciseSet) => {
        const weight = set.weight;
        const restMin = Number(set.restMin ?? 0);
        const restSec = Number(set.restSec ?? 0);
        if (weight != null && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) return false;
        if (!Number.isFinite(restMin) || restMin < 0 || !Number.isFinite(restSec) || restSec < 0 || restSec >= 60) return false;
        if (exercise.type === 'CARDIO') {
          return Number.isFinite(Number(set.duration)) && Number(set.duration) > 0;
        }
        return set.reps != null && set.reps !== '' && Number.isFinite(Number(set.reps)) && Number(set.reps) >= 0;
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

export function workoutDayValidationMessages(
  day: WorkoutDay | null | undefined,
  dayIndex = 0,
): string[] {
  if (!day || day.isRestDay || day.restDay) return [];

  const sessions = day.workoutSessions?.length
    ? day.workoutSessions
    : day.session
      ? [day.session]
      : [];

  const dayNumber = day.dayNumber ?? dayIndex + 1;
  const messages: string[] = [];
  const started = sessions.length > 0 || !!day.description?.trim();
  if (!started) return [];

  if (!sessions.length) {
    messages.push(`Day ${dayNumber}: add at least one exercise before saving.`);
    return messages;
  }

  sessions.forEach((session, sessionIndex) => {
    if (!session?.name?.trim()) {
      messages.push(`Day ${dayNumber}: enter a workout name before saving.`);
    }
    if (!session?.exercises?.length) {
      messages.push(`Day ${dayNumber}: workout ${sessionIndex + 1} needs at least one exercise.`);
      return;
    }

    session.exercises.forEach((exercise, exerciseIndex) => {
      const exerciseNumber = exerciseIndex + 1;
      if (!exercise?.name?.trim()) {
        messages.push(`Day ${dayNumber}: exercise ${exerciseNumber} needs a name.`);
      }
      if (!exercise?.sets?.length) {
        messages.push(`Day ${dayNumber}: exercise ${exerciseNumber} needs at least one valid set.`);
        return;
      }

      const validSets = exercise.sets.filter((set: ExerciseSet) => workoutSetValidationMessages(set, exercise.type).length === 0);
      if (!validSets.length) {
        messages.push(`Day ${dayNumber}: exercise ${exerciseNumber} needs at least one valid set.`);
        exercise.sets.forEach((set: ExerciseSet, setIndex: number) => {
          const setNumber = setIndex + 1;
          workoutSetValidationMessages(set, exercise.type).forEach(message => {
            messages.push(`Day ${dayNumber}, exercise ${exerciseNumber}, set ${setNumber}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`);
          });
        });
      }
    });
  });

  return [...new Set(messages)];
}
