import { Food, MacroTrackingMode, Meal, MealDay } from './MealPlan';
import { nutritionDayStatus, nutritionFoodLineValid, nutritionMealStatus } from './program-days';

/** Older names over the shared day rule (program-days.ts). */
export type NutritionMealPublicationState = 'EMPTY_PLACEHOLDER' | 'VALID' | 'INCOMPLETE';
export type NutritionDayPublicationState = 'EMPTY' | 'READY' | 'INCOMPLETE' | 'CHEAT';

export function nutritionFoodValid(food: Partial<Food> | null | undefined): boolean {
  return nutritionFoodLineValid(food);
}

export function nutritionFoodValidationMessages(
  food: Partial<Food> | null | undefined,
  options: { includeNutritionValues?: boolean } = {},
): string[] {
  const messages: string[] = [];
  if (!food) return ['Please select a food.'];

  const name = food?.name?.trim() || food?.foodRef?.name?.trim();
  const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
  const quantity = Number(food?.quantity);

  if (!name) messages.push('Please select a food.');
  if (!Number.isFinite(quantity) || quantity <= 0) {
    messages.push('Quantity must be greater than 0.');
  }
  if (!unit) messages.push('Serving size is required.');

  if (options.includeNutritionValues !== false) {
    const numericFields = [
      ['Calories', (food as any).calories],
      ['Protein', (food as any).protein],
      ['Carbs', (food as any).carbs],
      ['Fat', (food as any).fat],
    ] as const;

    numericFields.forEach(([label, value]) => {
      if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        messages.push(`${label} cannot be negative.`);
      }
    });
  }

  return [...new Set(messages)];
}

/** i18n key of the first thing missing on a food line (food, quantity, unit), or null (PRG-18: no English text). */
export function nutritionFoodValidationKey(food: Partial<Food> | null | undefined): string | null {
  if (!(food?.name?.trim() || food?.foodRef?.name?.trim())) return 'FOOD_LINE_SELECT_FOOD';
  const quantity = Number(food?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 'FOOD_LINE_QUANTITY';
  if (!(food?.unit?.trim() || food?.foodRef?.servingUnit?.trim())) return 'FOOD_LINE_UNIT';
  return null;
}

export function firstNutritionFoodValidationMessage(
  food: Partial<Food> | null | undefined,
): string | null {
  return nutritionFoodValidationMessages(food)[0] ?? null;
}

export function nutritionMealValid(meal: Meal | null | undefined): boolean {
  return nutritionMealState(meal) === 'VALID';
}

/**
 * A meal without food is empty whatever its name ("New Meal", or renamed "Lunch"): it never blocks the save and is
 * not shown to the client (backlog-programmes.md R3, PRG-13).
 */
export function nutritionMealState(meal: Meal | null | undefined, mode?: MacroTrackingMode | null): NutritionMealPublicationState {
  const state = nutritionMealStatus(meal, mode);
  return state === 'FILLED' ? 'VALID' : state === 'INVALID' ? 'INCOMPLETE' : 'EMPTY_PLACEHOLDER';
}

export function nutritionDayState(day: MealDay | null | undefined, mode?: MacroTrackingMode | null): NutritionDayPublicationState {
  const state = nutritionDayStatus(day, mode);
  return state === 'FILLED' ? 'READY' : state === 'REST' ? 'CHEAT' : state === 'INVALID' ? 'INCOMPLETE' : 'EMPTY';
}

export function nutritionMealValidationMessages(meal: Meal | null | undefined, mealIndex = 0): string[] {
  if (!meal || nutritionMealState(meal) !== 'INCOMPLETE') return [];

  const mealNumber = mealIndex + 1;
  const messages: string[] = [];
  const foods = meal.foods || [];

  if (meal.draft) {
    messages.push(`Meal ${mealNumber}: finish the recipe before saving.`);
  }
  if (meal.servings != null && Number(meal.servings) <= 0) {
    messages.push(`Meal ${mealNumber}: servings must be greater than 0.`);
  }

  foods.forEach((food, foodIndex) => {
    if (nutritionFoodLineValid(food)) return;
    const foodNumber = foodIndex + 1;
    const name = food?.name?.trim() || food?.foodRef?.name?.trim();
    const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
    const quantity = Number(food?.quantity);

    if (!name) messages.push(`Meal ${mealNumber}, food ${foodNumber}: select a food.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      messages.push(`Meal ${mealNumber}, food ${foodNumber}: quantity must be greater than 0.`);
    }
    if (!unit) messages.push(`Meal ${mealNumber}, food ${foodNumber}: choose a unit.`);

    const numericFields = [
      ['calories', (food as any).calories],
      ['protein', (food as any).protein],
      ['carbs', (food as any).carbs],
      ['fat', (food as any).fat],
    ] as const;
    numericFields.forEach(([label, value]) => {
      if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        messages.push(`Meal ${mealNumber}, food ${foodNumber}: ${label} cannot be negative.`);
      }
    });
  });

  return [...new Set(messages)];
}

export function nutritionDayValidationMessages(day: MealDay | null | undefined): string[] {
  if (!day || day.cheatMeal) return [];
  return (day.meals || [])
    .flatMap((meal, index) => nutritionMealValidationMessages(meal, index))
    .filter((message, index, all) => all.indexOf(message) === index);
}