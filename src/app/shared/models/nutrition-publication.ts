import { Food, Meal, MealDay } from './MealPlan';

export type NutritionMealPublicationState = 'EMPTY_PLACEHOLDER' | 'VALID' | 'INCOMPLETE';
export type NutritionDayPublicationState = 'EMPTY' | 'READY' | 'INCOMPLETE' | 'CHEAT';

export function nutritionFoodValid(food: Partial<Food> | null | undefined): boolean {
  const name = food?.name?.trim() || food?.foodRef?.name?.trim();
  const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
  return !!name && Number(food?.quantity) > 0 && !!unit;
}

export function nutritionMealValid(meal: Meal | null | undefined): boolean {
  return nutritionMealState(meal) === 'VALID';
}

export function nutritionMealState(meal: Meal | null | undefined): NutritionMealPublicationState {
  if (!meal) return 'EMPTY_PLACEHOLDER';

  const foods = meal.foods || [];
  if (foods.length > 0) {
    if (meal.template && meal.draft) return 'INCOMPLETE';
    return foods.every(nutritionFoodValid) ? 'VALID' : 'INCOMPLETE';
  }

  // Automatically generated Meal 1/2/... rows may contain display-only
  // defaults (name, type, time and zero targets). They are placeholders until
  // a food or recipe is actually added and must not invalidate their day.
  const recipeStarted = Boolean(
    meal.template
    || meal.draft
    || meal.coverImage
    || meal.totalTimeMinutes
    || meal.directions?.some((step) => step?.trim())
    || (meal.name?.trim() && !/^meal\s+\d+$/i.test(meal.name.trim()))
  );

  return recipeStarted ? 'INCOMPLETE' : 'EMPTY_PLACEHOLDER';
}

export function nutritionDayState(day: MealDay | null | undefined): NutritionDayPublicationState {
  if (!day) return 'EMPTY';
  if (day.cheatMeal) return 'CHEAT';

  const mealStates = (day.meals || []).map(nutritionMealState);
  if (mealStates.includes('INCOMPLETE')) return 'INCOMPLETE';
  return mealStates.includes('VALID') ? 'READY' : 'EMPTY';
}
