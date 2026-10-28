/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Copies between the days of a program (« Copier vers… », « Dupliquer la semaine », « Coller sur… »).
 * Only the content moves: each target day keeps its own id, date, number and status (the client follows its days
 * in order, its logs stay on its day).
 */

/** One copy: `from` is a day index of the program, null for the day in the clipboard. */
export interface DayCopy {
  from: number | null;
  to: number;
}

export const DAYS_PER_WEEK = 7;

const DEFAULT_DAY_TITLE = /^(day|jour)\s+\d+$/i;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A custom title (« Push », « Jambes ») is content; « Day 3 » is the place of the day and stays on the target. */
function copyTitle(source: any, target: any): void {
  const title = String(source?.title || source?.name || '').trim();
  if (!title || DEFAULT_DAY_TITLE.test(title)) return;
  target.title = source.title;
  target.name = source.name ?? source.title;
}

export function copyWorkoutDayContent(source: any, target: any): void {
  copyTitle(source, target);
  target.description = source?.description ?? '';
  target.isRestDay = !!(source?.isRestDay ?? source?.restDay);
  target.restDay = target.isRestDay;
  target.workoutSessions = clone(source?.workoutSessions || []);
  target.session = target.workoutSessions[0] ?? null;
}

export function copyMealDayContent(source: any, target: any): void {
  target.description = source?.description ?? '';
  target.cheatMeal = !!source?.cheatMeal;
  target.refeedDay = !!source?.refeedDay;
  target.dayTargets = source?.dayTargets ? clone(source.dayTargets) : source?.dayTargets ?? null;
  // New ids: the same meal must not appear twice in the plan.
  target.meals = clone(source?.meals || []).map((meal: any) => ({
    ...meal,
    id: newId(),
    foods: (meal?.foods || []).map((food: any) => ({ ...food, id: newId() })),
  }));
}

/** Days of week `sourceWeek` (1-based) onto the same weekday of each target week, for the days that exist. */
export function weekCopies(sourceWeek: number, targetWeeks: number[], dayCount: number): DayCopy[] {
  const copies: DayCopy[] = [];
  const start = (sourceWeek - 1) * DAYS_PER_WEEK;
  targetWeeks.forEach((week) => {
    for (let offset = 0; offset < DAYS_PER_WEEK; offset++) {
      const from = start + offset;
      const to = (week - 1) * DAYS_PER_WEEK + offset;
      if (from < dayCount && to < dayCount && from !== to) copies.push({ from, to });
    }
  });
  return copies;
}
