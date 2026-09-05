import { Food, Meal, MealDay } from './MealPlan';

export function nutritionFoodValid(food: Partial<Food> | null | undefined): boolean {
  return !!food?.name?.trim() && Number(food.quantity) > 0 && !!food.unit?.trim();
}

export function nutritionMealValid(meal: Meal | null | undefined): boolean {
  return !!meal?.name?.trim() && !!meal.foods?.length && meal.foods.every(nutritionFoodValid);
}

export function nutritionDayState(day: MealDay | null | undefined): 'EMPTY' | 'READY' | 'CHEAT' {
  if (!day) return 'EMPTY';
  if (day.cheatMeal) return 'CHEAT';
  return !!day.meals?.length && day.meals.every(nutritionMealValid) ? 'READY' : 'EMPTY';
}
