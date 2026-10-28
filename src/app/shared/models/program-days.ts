import { Food, MacroTargets, MacroTrackingMode, Meal, MealDay } from './MealPlan';
import { WorkoutDay } from './workout.models';
import { ExerciseSet } from './exercice.models';

/**
 * Programs without weekly publication (backlog-programmes.md, R3/R4), same rules as the server (coach-empire
 * ProgramDays.java) and the mobile app: the client sees the days the coach filled, up to the last one that is not
 * empty, and there may be no empty day before it.
 * - FILLED: something to follow (a valid exercise, a complete meal, day targets);
 * - REST: rest day (workout) or free day (nutrition, the `cheatMeal` flag);
 * - EMPTY: nothing yet. Empty sessions and meals without food are ignored, whatever their name;
 * - INVALID: started but wrong (a set without reps, a food without quantity…): the program cannot be saved.
 */
export type ProgramDayState = 'FILLED' | 'REST' | 'EMPTY' | 'INVALID';

/** Day numbers are 1-based, in the order of the list. */
export interface ProgramSummary {
  totalDays: number;
  /** The client sees days 1 to this one (0: nothing yet). */
  lastNonEmpty: number;
  /** Empty days before the last non-empty one: to fill or to mark as rest / free days. */
  gaps: number[];
  /** Days with an error. */
  invalidDays: number[];
  /** Filled and rest days. */
  readyDays: number;
}

const text = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;
const isSet = (value: unknown): boolean => value !== null && value !== undefined && value !== '';

/* ---------------- workout ---------------- */

/** D2: a strength set needs at least one rep; a cardio set a duration. */
export function workoutSetValid(set: ExerciseSet | null | undefined, exerciseType?: string | null): boolean {
  if (!set) return false;
  const weight = set.weight;
  if (isSet(weight) && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) return false;
  if (isSet(set.restMin) && (!Number.isFinite(Number(set.restMin)) || Number(set.restMin) < 0)) return false;
  if (isSet(set.restSec) && (!Number.isFinite(Number(set.restSec)) || Number(set.restSec) < 0 || Number(set.restSec) >= 60)) return false;
  if (exerciseType === 'CARDIO') return isSet(set.duration) && Number(set.duration) > 0;
  return isSet(set.reps) && Number.isFinite(Number(set.reps)) && Number(set.reps) > 0;
}

/** The sessions the server reads: the list when there is one (even empty), else the older single session. */
function sessionsOf(day: WorkoutDay): any[] {
  return Array.isArray(day.workoutSessions) ? day.workoutSessions : day.session ? [day.session] : [];
}

export function workoutDayStatus(day: WorkoutDay | null | undefined): ProgramDayState {
  if (!day) return 'EMPTY';
  if (day.isRestDay || day.restDay) return 'REST';
  const started = sessionsOf(day).filter((session) => !!session?.exercises?.length);
  if (!started.length) return 'EMPTY';
  const valid = started.every((session) => text(session.name)
    && session.exercises.every((exercise: any) => exercise && text(exercise.name) && exercise.sets?.length
      && exercise.sets.every((set: ExerciseSet) => workoutSetValid(set, exercise.type))));
  return valid ? 'FILLED' : 'INVALID';
}

export function workoutSummary(days: WorkoutDay[] | null | undefined): ProgramSummary {
  return programSummary((days || []).map(workoutDayStatus));
}

/* ---------------- nutrition ---------------- */

/** A food line: a food (picked, or typed by name) with a quantity above 0 and a unit. */
export function nutritionFoodLineValid(food: Partial<Food> | null | undefined): boolean {
  const name = food?.name?.trim() || food?.foodRef?.name?.trim();
  const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
  const quantity = Number(food?.quantity);
  return !!name && Number.isFinite(quantity) && quantity > 0 && !!unit;
}

function targetsStatus(targets: MacroTargets | null | undefined): ProgramDayState {
  if (!targets) return 'EMPTY';
  const values = [targets.proteinG, targets.carbsG, targets.fatG, targets.calories] as unknown[];
  if (values.every((value) => !isSet(value) || Number(value) === 0)) return 'EMPTY';
  return values.every((value) => isSet(value) && Number.isFinite(Number(value)) && Number(value) >= 0) ? 'FILLED' : 'INVALID';
}

/** A meal without food is empty whatever its name; with per-meal macros, the meal is its targets. */
export function nutritionMealStatus(meal: Meal | null | undefined, mode?: MacroTrackingMode | null): ProgramDayState {
  if (!meal) return 'EMPTY';
  if (mode === 'EACH_MEAL') return targetsStatus(meal.mealTargets);
  const foods = meal.foods || [];
  if (!foods.length) return 'EMPTY';
  if (meal.draft || (isSet(meal.servings) && Number(meal.servings) <= 0)) return 'INVALID';
  return foods.every(nutritionFoodLineValid) ? 'FILLED' : 'INVALID';
}

export function nutritionDayStatus(day: MealDay | null | undefined, mode?: MacroTrackingMode | null): ProgramDayState {
  if (!day) return 'EMPTY';
  if (day.cheatMeal) return 'REST';
  const meals = (day.meals || []).map((meal) => nutritionMealStatus(meal, mode));
  if (meals.includes('INVALID')) return 'INVALID';
  if (mode === 'TOTAL_FOR_DAY') return targetsStatus(day.dayTargets);
  return meals.includes('FILLED') ? 'FILLED' : 'EMPTY';
}

export function nutritionSummary(days: MealDay[] | null | undefined, mode?: MacroTrackingMode | null): ProgramSummary {
  return programSummary((days || []).map((day) => nutritionDayStatus(day, mode)));
}

/* ---------------- what to fix (translated messages) ---------------- */

/** First thing to fix in a day: an i18n key (PROGRAM_ISSUE_*) and its parameters (1-based numbers). */
export interface ProgramIssue {
  key: string;
  params: { day: number; meal?: number; food?: number; exercise?: number; set?: number };
}

function setIssueKey(set: ExerciseSet | null | undefined, exerciseType?: string | null): string {
  if (!set) return 'PROGRAM_ISSUE_SET_REPS';
  if (isSet(set.weight) && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)) return 'PROGRAM_ISSUE_SET_WEIGHT';
  const restMin = set.restMin, restSec = set.restSec;
  if ((isSet(restMin) && (!Number.isFinite(Number(restMin)) || Number(restMin) < 0))
    || (isSet(restSec) && (!Number.isFinite(Number(restSec)) || Number(restSec) < 0 || Number(restSec) >= 60))) return 'PROGRAM_ISSUE_SET_REST';
  return exerciseType === 'CARDIO' ? 'PROGRAM_ISSUE_SET_DURATION' : 'PROGRAM_ISSUE_SET_REPS';
}

export function workoutDayIssue(day: WorkoutDay | null | undefined, dayNumber: number): ProgramIssue | null {
  if (workoutDayStatus(day) !== 'INVALID') return null;
  for (const session of sessionsOf(day!).filter((s) => !!s?.exercises?.length)) {
    if (!text(session.name)) return { key: 'PROGRAM_ISSUE_SESSION_NAME', params: { day: dayNumber } };
    for (let e = 0; e < session.exercises.length; e++) {
      const exercise = session.exercises[e];
      if (!exercise || !text(exercise.name)) return { key: 'PROGRAM_ISSUE_EXERCISE_NAME', params: { day: dayNumber, exercise: e + 1 } };
      if (!exercise.sets?.length) return { key: 'PROGRAM_ISSUE_NO_SET', params: { day: dayNumber, exercise: e + 1 } };
      const s = exercise.sets.findIndex((set: ExerciseSet) => !workoutSetValid(set, exercise.type));
      if (s >= 0) return { key: setIssueKey(exercise.sets[s], exercise.type), params: { day: dayNumber, exercise: e + 1, set: s + 1 } };
    }
  }
  return null;
}

export function nutritionDayIssue(day: MealDay | null | undefined, dayNumber: number, mode?: MacroTrackingMode | null): ProgramIssue | null {
  if (nutritionDayStatus(day, mode) !== 'INVALID') return null;
  const meals = day!.meals || [];
  for (let m = 0; m < meals.length; m++) {
    const meal = meals[m];
    if (nutritionMealStatus(meal, mode) !== 'INVALID') continue;
    const params = { day: dayNumber, meal: m + 1 };
    if (mode === 'EACH_MEAL') return { key: 'PROGRAM_ISSUE_MEAL_TARGETS', params };
    if (meal.draft) return { key: 'PROGRAM_ISSUE_RECIPE_DRAFT', params };
    if (isSet(meal.servings) && Number(meal.servings) <= 0) return { key: 'PROGRAM_ISSUE_SERVINGS', params };
    const foods = meal.foods || [];
    const f = foods.findIndex((food) => !nutritionFoodLineValid(food));
    const food = foods[f];
    const foodParams = { ...params, food: f + 1 };
    if (!(food?.name?.trim() || food?.foodRef?.name?.trim())) return { key: 'PROGRAM_ISSUE_FOOD_NAME', params: foodParams };
    if (!(Number(food?.quantity) > 0)) return { key: 'PROGRAM_ISSUE_FOOD_QUANTITY', params: foodParams };
    return { key: 'PROGRAM_ISSUE_FOOD_UNIT', params: foodParams };
  }
  return mode === 'TOTAL_FOR_DAY' ? { key: 'PROGRAM_ISSUE_DAY_TARGETS', params: { day: dayNumber } } : null;
}

export function firstWorkoutIssue(days: WorkoutDay[] | null | undefined): ProgramIssue | null {
  const list = days || [];
  for (let i = 0; i < list.length; i++) {
    const issue = workoutDayIssue(list[i], i + 1);
    if (issue) return issue;
  }
  return null;
}

export function firstNutritionIssue(days: MealDay[] | null | undefined, mode?: MacroTrackingMode | null): ProgramIssue | null {
  const list = days || [];
  for (let i = 0; i < list.length; i++) {
    const issue = nutritionDayIssue(list[i], i + 1, mode);
    if (issue) return issue;
  }
  return null;
}

/* ---------------- shared ---------------- */

export function programSummary(states: ProgramDayState[]): ProgramSummary {
  let lastNonEmpty = 0;
  let readyDays = 0;
  const invalidDays: number[] = [];
  states.forEach((state, index) => {
    if (state !== 'EMPTY') lastNonEmpty = index + 1;
    if (state === 'INVALID') invalidDays.push(index + 1);
    if (state === 'FILLED' || state === 'REST') readyDays++;
  });
  const gaps = states.slice(0, lastNonEmpty)
    .map((state, index) => (state === 'EMPTY' ? index + 1 : 0))
    .filter((day) => day > 0);
  return { totalDays: states.length, lastNonEmpty, gaps, invalidDays, readyDays };
}

/** Body of a server refusal on the day rules (400): {code, error, days}. */
export interface ProgramDaysError {
  code: 'PROGRAM_GAP' | 'PROGRAM_INVALID_DAYS';
  error: string;
  days: number[];
}

export function programDaysError(httpError: any): ProgramDaysError | null {
  const body = httpError?.error;
  return body && (body.code === 'PROGRAM_GAP' || body.code === 'PROGRAM_INVALID_DAYS') && Array.isArray(body.days)
    ? (body as ProgramDaysError) : null;
}
