import { Food, MealDay } from './MealPlan';
import { WorkoutDay } from './workout.models';
import { ExerciseSet } from './exercice.models';
import {
  firstNutritionFoodValidationMessage,
  nutritionDayValidationMessages,
} from './nutrition-publication';
import {
  firstWorkoutSetValidationMessage,
  workoutDayValidationMessages,
} from './workout-publication';

/**
 * Front-only validation helpers for the Nutrition Builder / Workout Builder.
 * The caller supplies the project's existing toast/snackbar function.
 * These helpers never change builder state; they only block invalid actions and show a message.
 */
export type BuilderNotifier = (message: string) => void;

export function validateNutritionFoodBeforeAdd(
  food: Partial<Food> | null | undefined,
  notify: BuilderNotifier,
): boolean {
  const message = firstNutritionFoodValidationMessage(food);
  if (!message) return true;
  notify(message);
  return false;
}

export function validateNutritionDayBeforeSave(
  day: MealDay | null | undefined,
  notify: BuilderNotifier,
): boolean {
  const message = nutritionDayValidationMessages(day)[0];
  if (!message) return true;
  notify(message);
  return false;
}

export function validateWorkoutSetBeforeAdd(
  set: ExerciseSet | null | undefined,
  exerciseType: string | null | undefined,
  notify: BuilderNotifier,
): boolean {
  const message = firstWorkoutSetValidationMessage(set, exerciseType);
  if (!message) return true;
  notify(message);
  return false;
}

export function validateWorkoutDayBeforeSave(
  day: WorkoutDay | null | undefined,
  dayIndex: number,
  notify: BuilderNotifier,
): boolean {
  const message = workoutDayValidationMessages(day, dayIndex)[0];
  if (!message) return true;
  notify(message);
  return false;
}