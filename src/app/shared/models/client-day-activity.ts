/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * What the client did on a day of their program, the server's rule (`ProgramScheduleService.active`): a status other
 * than PENDING, logs, a timer, a completion mode or a note. A program with such a day is « started »: its dates no
 * longer move (« Modifier les dates » refused with 409 PROGRAM_STARTED), and the day is never overwritten by a copy.
 */

function notBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function startedStatus(status: unknown): boolean {
  return !!status && String(status).toUpperCase() !== 'PENDING';
}

export function workoutDayActive(day: any): boolean {
  return !!day && (
    startedStatus(day.status)
    || (Array.isArray(day.clientExerciseLogs) && day.clientExerciseLogs.length > 0)
    || Number(day.workoutElapsedSeconds) > 0
    || day.clientCompletionMode != null
    || notBlank(day.overallWorkoutNote)
  );
}

export function mealDayActive(day: any): boolean {
  return !!day && (
    startedStatus(day.status)
    || (Array.isArray(day.clientMealLogs) && day.clientMealLogs.length > 0)
    || notBlank(day.hunger) || notBlank(day.energy) || notBlank(day.digestion) || notBlank(day.overallNote)
  );
}
