import { Food, MacroTargets, Meal, MealDay, MacroTrackingMode } from './MealPlan';

export type NutritionStatus = 'Empty' | 'Incomplete' | 'Ready' | 'Cheat meal';

function nonNegative(values: unknown[]): boolean {
  return values.every(value => value == null || (Number.isFinite(Number(value)) && Number(value) >= 0));
}

export function nutritionFoodValid(food: Food): boolean {
  return !!food && (!!food.foodRef?.id?.trim() || (!!food.manual && !!food.name?.trim()))
    && Number.isFinite(Number(food.quantity)) && Number(food.quantity) > 0
    && !!food.unit?.trim()
    && nonNegative([food.calories, food.protein, food.carbohydrates, food.carbs, food.fat,
      food.foodRef?.energy, food.foodRef?.calories, food.foodRef?.protein,
      food.foodRef?.carbohydrates, food.foodRef?.fat]);
}

function targetStatus(target?: MacroTargets | null): NutritionStatus {
  const values = [target?.proteinG, target?.carbsG, target?.fatG, target?.calories];
  if (values.every(value => value == null || value === 0)) return 'Empty';
  return values.every(value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0)
    && values.some(value => Number(value) > 0) ? 'Ready' : 'Incomplete';
}

export function nutritionMealStatus(meal: Meal, mode: MacroTrackingMode | null): NutritionStatus {
  if (mode === 'EACH_MEAL') return targetStatus(meal.mealTargets);
  const foods = meal.foods || [];
  const recipeStarted = !!meal.template || !!meal.draft || !!meal.coverImage || !!meal.totalTimeMinutes
    || (meal.directions || []).some(line => !!line.trim()) || Number(meal.servings ?? 1) !== 1
    || (!!meal.name?.trim() && !/^(Meal \d+|New Meal)$/i.test(meal.name.trim()));
  if (!foods.length) return recipeStarted ? 'Incomplete' : 'Empty';
  if (meal.draft || (meal.template && !meal.name?.trim())
    || (meal.servings != null && (!Number.isFinite(Number(meal.servings)) || Number(meal.servings) <= 0))
    || !nonNegative([meal.totalTimeMinutes, meal.mealTargets?.calories, meal.mealTargets?.proteinG,
      meal.mealTargets?.carbsG, meal.mealTargets?.fatG])
    || !foods.every(nutritionFoodValid)) return 'Incomplete';
  return 'Ready';
}

export function nutritionDayStatus(day: MealDay, mode: MacroTrackingMode | null): NutritionStatus {
  if (day.cheatMeal) return 'Cheat meal';
  const statuses = (day.meals || []).map(meal => nutritionMealStatus(meal, mode));
  // Empty placeholders are harmless, but a meal the coach started configuring
  // must block readiness in every tracking mode until it becomes valid.
  if (statuses.includes('Incomplete')) return 'Incomplete';
  if (mode === 'TOTAL_FOR_DAY') return targetStatus(day.dayTargets);
  return statuses.includes('Ready') ? 'Ready' : 'Empty';
}
