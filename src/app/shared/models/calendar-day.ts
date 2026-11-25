/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * What the client did on a day of the calendar, as they noted it (backlog-programmes.md, calendar lot C, L2): the
 * workout's sets done or missed exercise by exercise, the nutrition day's meal reports and feelings, the day's tasks
 * and check-ins. Pure functions on the server's data (the logs written by the client app).
 */

/** The color of a day's cell: done, started, missed, to come, rest, to fill. */
export type DayTone = 'done' | 'partial' | 'missed' | 'planned' | 'today' | 'rest' | 'empty';

export type ExerciseState = 'DONE' | 'PARTIAL' | 'MISSED' | 'PENDING';

export interface SetLine {
  reps: number | null;
  weight: number | null;
  /** Minutes (cardio). */
  duration: number | null;
  /** Secondes (exercice au temps d'un circuit ou d'un superset). */
  seconds?: number | null;
}

/** One planned exercise and what the client logged for it. */
export interface ExerciseReport {
  name: string;
  cardio: boolean;
  /** Measured in seconds (exercise.measure = 'TIME'). */
  timed: boolean;
  planned: SetLine[];
  /** The sets the client did (in the planned order); the missed ones are counted apart. */
  done: SetLine[];
  missedSets: number;
  state: ExerciseState;
  note: string;
}

export interface WorkoutReport {
  exercises: ExerciseReport[];
  /** Exercises done (all their sets, or marked done). */
  doneExercises: number;
  /** Exercises started: done, partly done or missed (a log exists). */
  loggedExercises: number;
  minutes: number;
  note: string;
  /** Marked done afterwards, without following the workout in the app. */
  markedDone: boolean;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return value === null || value === undefined || value === '' || Number.isNaN(parsed) ? null : parsed;
}

function setLine(set: any): SetLine {
  return { reps: num(set?.reps), weight: num(set?.weight), duration: num(set?.duration), seconds: num(set?.durationSec) };
}

/**
 * The log of the exercise at `index`: by its id, else by its number in the day ("1", "2"...), else by position for an
 * old log that has neither (a log of another exercise is never taken).
 */
function logOf(logs: any[], exercise: any, index: number): any {
  const byPosition = logs[index];
  return logs.find((log) => !!exercise?.id && log?.exerciseId === exercise.id)
    || logs.find((log) => String(log?.displayNumber ?? '') === String(index + 1))
    || (byPosition && !byPosition.exerciseId && byPosition.displayNumber == null ? byPosition : null);
}

/** An exercise measured in seconds (exercise.measure = 'TIME'), as the editor and the player read it. */
function isTimed(exercise: any): boolean {
  return String(exercise?.measure || '').toUpperCase() === 'TIME';
}

function setStatus(actual: any): 'DONE' | 'MISSED' | 'PENDING' {
  if (!actual) return 'PENDING';
  const status = String(actual?.status || '').toUpperCase();
  if (status === 'MISSED' || actual?.missed === true) return 'MISSED';
  if (status === 'COMPLETED' || status === 'DONE' || actual?.completed === true) return 'DONE';
  return 'PENDING';
}

/** The planned exercises of a workout day face to what the client logged (L2). */
export function workoutReport(day: any): WorkoutReport {
  const logs: any[] = Array.isArray(day?.clientExerciseLogs) ? day.clientExerciseLogs : [];
  const exercises: any[] = (day?.workoutSessions || []).flatMap((session: any) => session?.exercises || []);
  const reports = exercises.map((exercise, index): ExerciseReport => {
    const log = logOf(logs, exercise, index);
    const plannedSets: any[] = exercise?.sets || [];
    const loggedSets: any[] = Array.isArray(log?.sets) ? log.sets : [];
    const done: SetLine[] = [];
    let missedSets = 0;
    plannedSets.forEach((set, setIndex) => {
      const number = Number(set?.setNumber || setIndex + 1);
      const actual = loggedSets.find((item) => Number(item?.setNumber) === number) || loggedSets[setIndex];
      const status = setStatus(actual);
      if (status === 'DONE') done.push(setLine(actual));
      else if (status === 'MISSED') missedSets++;
    });
    let state: ExerciseState = 'PENDING';
    if (log?.skipped === true) state = 'MISSED';
    else if (plannedSets.length && done.length === plannedSets.length) state = 'DONE';
    else if (done.length > 0) state = 'PARTIAL';
    else if (plannedSets.length && missedSets === plannedSets.length) state = 'MISSED';
    else if (log?.completed === true) state = 'DONE';
    return {
      name: String(exercise?.name || ''),
      cardio: String(exercise?.type || '').toUpperCase() === 'CARDIO',
      timed: isTimed(exercise),
      planned: plannedSets.map(setLine),
      done,
      missedSets,
      state,
      note: String(log?.note || '').trim(),
    };
  });
  return {
    exercises: reports,
    doneExercises: reports.filter((report) => report.state === 'DONE').length,
    loggedExercises: reports.filter((report) => report.state !== 'PENDING').length,
    minutes: Math.round((Number(day?.workoutElapsedSeconds) || 0) / 60),
    note: String(day?.overallWorkoutNote || '').trim(),
    markedDone: String(day?.clientCompletionMode || '').toUpperCase() === 'ALREADY_COMPLETED',
  };
}

export type MealState = 'AS_PLANNED' | 'MODIFIED' | 'SKIPPED' | '';

export interface MealReport {
  name: string;
  state: MealState;
  note: string;
  /** Part of a « modified » meal eaten: « ¼ », « ½ », « ¾ »; '' for the whole meal (or no part given). */
  part: string;
}

/** « ¼ », « ½ », « ¾ » for the part of a « modified » meal the client ate; '' for all of it or none given. */
function mealPart(state: string, portion: unknown): string {
  const n = portion === null || portion === undefined || portion === '' ? NaN : Number(portion);
  if (state !== 'MODIFIED' || !Number.isFinite(n) || n <= 0 || n >= 1) return '';
  return n <= 0.25 ? '¼' : n <= 0.5 ? '½' : '¾';
}

export interface NutritionReport {
  meals: MealReport[];
  /** Meals the client reported (as planned, modified or skipped). */
  reported: number;
  hunger: string;
  energy: string;
  digestion: string;
  note: string;
}

/** The nutrition day's meals with the client's report of each, and how they felt (L2: the client notes no calories). */
/**
 * A meal with something planned in it: a food, or macros the coach typed (macros per meal). A meal without either
 * (« New Meal », even renamed « Déjeuner ») is empty: never shown to the client, never counted (backlog-programmes.md R3).
 * No tracking mode needed: the same test fits the three kinds of plan.
 */
export function mealPlanned(meal: any): boolean {
  if ((meal?.foods || []).length) return true;
  const targets = meal?.mealTargets || {};
  return [targets.calories, targets.proteinG, targets.carbsG, targets.fatG].some((value) => Number(value) > 0);
}

/** The meals of a day to show and count: the planned ones, and any the client reported (kept, whatever it holds). */
export function plannedMeals(day: any): any[] {
  const logs: any[] = Array.isArray(day?.clientMealLogs) ? day.clientMealLogs : [];
  return (day?.meals || []).filter((meal: any) => {
    const id = meal?.id ?? meal?._id;
    return mealPlanned(meal) || (id != null && logs.some((log) => String(log?.mealId) === String(id)));
  });
}

export function nutritionReport(day: any): NutritionReport {
  const logs: any[] = Array.isArray(day?.clientMealLogs) ? day.clientMealLogs : [];
  const meals = plannedMeals(day).map((meal: any): MealReport => {
    const id = meal?.id ?? meal?._id;
    const log = logs.find((item) => id != null && String(item?.mealId) === String(id));
    const state = String(log?.status || '').toUpperCase();
    return {
      name: String(meal?.name || '').trim(),
      state: (state === 'AS_PLANNED' || state === 'MODIFIED' || state === 'SKIPPED' ? state : '') as MealState,
      note: String(log?.note || '').trim(),
      part: mealPart(state, log?.portion),
    };
  });
  return {
    meals,
    reported: meals.filter((meal: MealReport) => !!meal.state).length,
    hunger: String(day?.hunger || '').trim(),
    energy: String(day?.energy || '').trim(),
    digestion: String(day?.digestion || '').trim(),
    note: String(day?.overallNote || '').trim(),
  };
}

/**
 * One planned exercise as a line of the day, as on a coach's program sheet (calendar lot C): « A1 » / « A2 » for the
 * exercises of a superset, « B » for one alone, its name, its sets (reps, minutes or weight) and its rest.
 */
export interface ExerciseLine {
  label: string;
  name: string;
  cardio: boolean;
  /** Measured in seconds (exercise.measure = 'TIME'). */
  timed: boolean;
  sets: SetLine[];
  /** Rest after a set (the first set's), in seconds; null when none. */
  restSeconds: number | null;
  /** Place in a superset / circuit (linked exercises, drawn joined); null for an exercise on its own. */
  link: 'start' | 'middle' | 'end' | null;
  /** On the group's first line only: what the group is. */
  groupKind: 'SUPERSET' | 'CIRCUIT' | null;
}

function blockLetter(index: number): string {
  let label = '';
  let value = index;
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

/** The planned exercises of a workout day, in order, each with its block label (A1, A2 for a superset; B alone). */
export function exerciseLines(day: any): ExerciseLine[] {
  const exercises: any[] = (day?.workoutSessions || []).flatMap((session: any) => session?.exercises || []);
  const lines: ExerciseLine[] = [];
  let block = -1;
  let inBlock = 0;
  exercises.forEach((exercise, index) => {
    const group = exercise?.supersetGroupId || null;
    const previous = index > 0 ? exercises[index - 1]?.supersetGroupId || null : null;
    const next = index < exercises.length - 1 ? exercises[index + 1]?.supersetGroupId || null : null;
    const continues = !!group && group === previous;
    if (!continues) {
      block++;
      inBlock = 0;
    }
    inBlock++;
    const grouped = !!group && (group === previous || group === next);
    const sets: any[] = exercise?.sets || [];
    const withRest = sets.find((set) => Number(set?.restMin) > 0 || Number(set?.restSec) > 0);
    const endsHere = !group || group !== next;
    lines.push({
      link: !grouped ? null : !continues ? 'start' : endsHere ? 'end' : 'middle',
      groupKind: grouped && !continues
        ? (String(exercise?.groupType || '').toUpperCase() === 'CIRCUIT' ? 'CIRCUIT' : 'SUPERSET')
        : null,
      label: grouped ? `${blockLetter(block)}${inBlock}` : blockLetter(block),
      name: String(exercise?.name || '').trim(),
      cardio: String(exercise?.type || '').toUpperCase() === 'CARDIO',
      timed: isTimed(exercise),
      sets: sets.map(setLine),
      restSeconds: withRest ? (Number(withRest.restMin) || 0) * 60 + (Number(withRest.restSec) || 0) : null,
    });
  });
  return lines;
}

/** One meal of a nutrition day: its name, its foods with their quantity, its calories target when it has one. */
export interface MealLine {
  /** Its place in the day (1-based), empty meals included: « Repas 3 » stays « Repas 3 ». */
  number: number;
  name: string;
  foods: string[];
  kcal: number | null;
}

export function mealLines(day: any): MealLine[] {
  const all: any[] = day?.meals || [];
  // The same meals as nutritionReport (the day panel reads both side by side).
  return plannedMeals(day).map((meal: any): MealLine => {
    const kcal = Number(meal?.mealTargets?.calories);
    return {
      number: all.indexOf(meal) + 1,
      name: String(meal?.name || '').trim(),
      foods: (meal?.foods || [])
        .map((food: any) => {
          const name = String(food?.name || '').trim();
          const quantity = Number(food?.quantity);
          const unit = String(food?.unit || '').trim();
          return name && quantity > 0 ? `${name} ${Math.round(quantity * 10) / 10}${unit ? ` ${unit}` : ''}` : name;
        })
        .filter(Boolean),
      kcal: kcal > 0 ? Math.round(kcal) : null,
    };
  });
}

/** The color of a day's tasks: all done, some missed, all missed, or still to do. */
export function tasksTone(items: { status?: string }[]): DayTone | null {
  if (!items.length) return null;
  const done = items.filter((item) => item.status === 'DONE').length;
  const missed = items.filter((item) => item.status === 'MISSED').length;
  if (done === items.length) return 'done';
  if (missed === items.length) return 'missed';
  if (missed > 0) return 'partial';
  return 'planned';
}

/** A check-in: received (done), late (missed) or to come (L3). */
export function checkInTone(state: string): DayTone {
  if (state === 'RECEIVED') return 'done';
  if (state === 'LATE') return 'missed';
  return 'planned';
}
