/**
 * Titles of the days of a workout program (audit workouts 2026-11-23, M18). Pure functions: no Angular import, tested
 * by tests/workout-day-title.test.cjs.
 */

/** « Day 3 » / « Jour 3 »: a title the editor gave, not one the coach wrote. */
export function isDefaultDayTitle(title: string | null | undefined): boolean {
  const text = (title ?? '').trim();
  return !text || /^(day|jour)\s+\d+$/i.test(text);
}

/**
 * The « Day N » title follows the place of the day (N = 1 to 7 in its week); a title the coach wrote (« Push »,
 * « Jambes ») stays. Before, every save or change of duration put « Day N » back on every day.
 */
export function renumberDayTitle(day: { title?: string; name?: string }, index: number): void {
  if (!isDefaultDayTitle(day.title)) return;
  day.title = `Day ${(index % 7) + 1}`;
  day.name = day.title;
}

/** Weeks a list of days fills (a started week counts), at least 1. */
export function weeksOfDays(dayCount: number): number {
  return Math.max(1, Math.ceil((Number(dayCount) || 0) / 7));
}

/**
 * The duration asked, between 1 week and the cap; a program already longer than the cap keeps its length (it never
 * loses weeks without the coach confirming a shorter duration).
 */
export function clampProgramWeeks(weeks: number, currentDays: number, maxWeeks: number): number {
  const cap = Math.max(maxWeeks, Math.ceil((Number(currentDays) || 0) / 7));
  return Math.max(1, Math.min(Math.floor(Number(weeks)) || 1, cap));
}
