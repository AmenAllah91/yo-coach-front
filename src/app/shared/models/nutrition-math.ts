import { FoodServing } from './MealPlan';

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const INITIAL_SERVING_ID = 'initial';
export const LEGACY_UNIT = 'Grams';

const NUTRIENTS = [
  'energy', 'protein', 'carbohydrates', 'fat', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat',
  'tranFat', 'cholesterol', 'sodium', 'potassium', 'fiber', 'sugar', 'polyols', 'vitaminA', 'vitaminC',
  'calcium', 'iron', 'omega3', 'zinc',
] as const;

export function zeroMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function present(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function legacyServing(ref: any): FoodServing {
  const serving: any = {
    id: INITIAL_SERVING_ID,
    size: Number(ref?.servingSize) > 0 ? Number(ref.servingSize) : 100,
    unit: String(ref?.servingDescription || ref?.servingUnit || LEGACY_UNIT).trim(),
  };
  for (const key of NUTRIENTS) serving[key] = ref?.[key] ?? null;
  serving.energy = ref?.energy ?? ref?.calories ?? null;
  serving.carbohydrates = ref?.carbohydrates ?? ref?.carbs ?? null;
  return serving;
}

export function servingsOf(ref: any): FoodServing[] {
  return Array.isArray(ref?.servings) && ref.servings.length ? ref.servings : [legacyServing(ref)];
}

export function defaultServingOf(ref: any): FoodServing {
  const servings = servingsOf(ref);
  return servings.find((serving) => serving.id === ref?.defaultServingId) ?? servings[0];
}

export function lineServing(food: any): FoodServing | null {
  if (!food || food.manual) return null;
  if (food.serving) return food.serving;
  return food.foodRef ? legacyServing(food.foodRef) : null;
}

export function lineRatio(quantity: unknown, size: unknown): number {
  const base = present(size) && Number(size) !== 0 ? Number(size) : 100;
  const amount = present(quantity) ? Number(quantity) : present(size) ? Number(size) : 100;
  return amount / base;
}

export function servingMacros(values: any, ratio = 1): Macros {
  return {
    calories: num(values?.energy ?? values?.calories) * ratio,
    protein: num(values?.protein) * ratio,
    carbs: num(values?.carbohydrates ?? values?.carbs) * ratio,
    fat: num(values?.fat) * ratio,
  };
}

export function lineMacros(food: any): Macros {
  if (!food) return zeroMacros();
  if (food.manual || (!food.serving && !food.foodRef)) {
    return {
      calories: num(food.calories),
      protein: num(food.protein),
      carbs: num(food.carbohydrates ?? food.carbs),
      fat: num(food.fat),
    };
  }
  if (food.serving) return servingMacros(food.serving, lineRatio(food.quantity, food.serving.size));
  return servingMacros(food.foodRef, lineRatio(food.quantity, food.foodRef.servingSize));
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function totalMacros(foods: any[] | null | undefined): Macros {
  return (foods || []).reduce((sum: Macros, food: any) => addMacros(sum, lineMacros(food)), zeroMacros());
}
