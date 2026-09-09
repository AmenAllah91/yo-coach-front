import { Food, Meal, MealDay } from './MealPlan';

export type NutritionMealPublicationState = 'EMPTY_PLACEHOLDER' | 'VALID' | 'INCOMPLETE';
export type NutritionDayPublicationState = 'EMPTY' | 'READY' | 'INCOMPLETE' | 'CHEAT';

export function nutritionFoodValid(food: Partial<Food> | null | undefined): boolean {
  const name = food?.name?.trim() || food?.foodRef?.name?.trim();
  const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
  return !!name && Number(food?.quantity) > 0 && !!unit;
}


function nutritionFoodStarted(food: Partial<Food> | null | undefined): boolean {
  if (!food) return false;
  const name = food?.name?.trim() || food?.foodRef?.name?.trim();
  const unit = food?.unit?.trim() || food?.foodRef?.servingUnit?.trim();
  const q: any = food?.quantity;
  const hasQuantity = q != null && q !== '' && Number(q) !== 0;
  const numericStarted = ['calories', 'protein', 'carbs', 'fat'].some((key) => {
    const value = (food as any)[key];
    return value != null && value !== '' && Number(value) !== 0;
  });
  return !!name || !!unit || hasQuantity || numericStarted;
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

export function firstNutritionFoodValidationMessage(
  food: Partial<Food> | null | undefined,
): string | null {
  return nutritionFoodValidationMessages(food)[0] ?? null;
}

export function nutritionMealValid(meal: Meal | null | undefined): boolean {
  return nutritionMealState(meal) === 'VALID';
}

export function nutritionMealState(meal: Meal | null | undefined): NutritionMealPublicationState {
  if (!meal) return 'EMPTY_PLACEHOLDER';

  const foods = meal.foods || [];
  const startedFoods = foods.filter(nutritionFoodStarted);
  if (startedFoods.length > 0) {
    if (meal.template && meal.draft) return 'INCOMPLETE';
    const hasValidFood = startedFoods.some(nutritionFoodValid);
    const hasIncompleteFood = startedFoods.some(food => !nutritionFoodValid(food));
    return hasValidFood && !hasIncompleteFood ? 'VALID' : 'INCOMPLETE';
  }

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

export function nutritionMealValidationMessages(meal: Meal | null | undefined, mealIndex = 0): string[] {
  if (!meal || nutritionMealState(meal) === 'EMPTY_PLACEHOLDER') return [];

  const mealNumber = mealIndex + 1;
  const messages: string[] = [];
  const foods = meal.foods || [];

  if (meal.template && meal.draft) {
    messages.push(`Meal ${mealNumber}: finish the recipe before saving.`);
  }

  if (foods.length === 0) {
    messages.push(`Meal ${mealNumber}: add at least one valid food before saving.`);
    return [...new Set(messages)];
  }

  foods.forEach((food, foodIndex) => {
    if (!nutritionFoodStarted(food)) return;
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