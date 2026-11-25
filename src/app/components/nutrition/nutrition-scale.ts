/* eslint-disable @typescript-eslint/no-explicit-any */
import { MealDay } from '@shared/models/MealPlan';
import { lineMacros } from '@shared/models/nutrition-math';
import { todayIso } from '@shared/models/program-schedule';
import { mealDayActive } from '@shared/models/client-day-activity';

/**
 * « Adapter les calories » (audit nutrition 2026-11-23, lot 3): one factor for every day the coach may still change,
 * so the gap between training and rest days stays the same.
 */
export type NutritionScaleMode = 'FOODS' | 'MEAL_MACROS' | 'DAY_MACROS';

export const MIN_SCALE_FACTOR = 0.5;
export const MAX_SCALE_FACTOR = 2;

/** A client's past day, or a day the client already followed: kept as it is (same rule as « Copier vers… »). */
export function nutritionDayLocked(clientPlan: boolean, day: MealDay, today = todayIso()): boolean {
  return clientPlan && ((!!day?.date && String(day.date).slice(0, 10) < today) || mealDayActive(day));
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function macroKcal(protein: unknown, carbs: unknown, fat: unknown): number {
  return num(protein) * 4 + num(carbs) * 4 + num(fat) * 9;
}

/** The day's kcal as the editor of that mode counts them. */
export function dayCalories(day: MealDay, mode: NutritionScaleMode): number {
  if (!day || day.cheatMeal) return 0;
  if (mode === 'DAY_MACROS') {
    const t = day.dayTargets;
    return t ? macroKcal(t.proteinG, t.carbsG, t.fatG) : 0;
  }
  return (day.meals || []).reduce((sum, meal) => {
    if (mode === 'MEAL_MACROS') {
      const t = meal.mealTargets;
      return sum + (t ? macroKcal(t.proteinG, t.carbsG, t.fatG) : 0);
    }
    const foods = meal.foods || [];
    if (!foods.length) return sum + num(meal.mealTargets?.calories);
    return sum + foods.reduce((total, food) => total + lineMacros(food).calories, 0);
  }, 0);
}

/** The days the factor applies to: not free, not locked, with something in them. */
export function scalableDays(days: MealDay[], mode: NutritionScaleMode, locked: (day: MealDay) => boolean): MealDay[] {
  return (days || []).filter((day) => !!day && !day.cheatMeal && !locked(day) && dayCalories(day, mode) > 0);
}

/** Average kcal per day of those days, rounded (0 when there is none). */
export function averageDayCalories(days: MealDay[], mode: NutritionScaleMode): number {
  if (!days.length) return 0;
  return Math.round(days.reduce((sum, day) => sum + dayCalories(day, mode), 0) / days.length);
}

/** target ÷ average, or null when it cannot be computed. */
export function scaleFactor(target: unknown, average: number): number | null {
  const wanted = Number(target);
  if (target === null || target === undefined || target === '' || !Number.isFinite(wanted) || wanted <= 0 || !(average > 0)) return null;
  return wanted / average;
}

export function scaleFactorAllowed(factor: number | null): boolean {
  return factor !== null && factor >= MIN_SCALE_FACTOR - 1e-9 && factor <= MAX_SCALE_FACTOR + 1e-9;
}

/** « +22 % », « −10 % », « 0 % ». */
export function scaleChangeLabel(factor: number | null): string {
  if (factor === null) return '';
  const percent = Math.round((factor - 1) * 100);
  return percent > 0 ? `+${percent} %` : percent < 0 ? `−${Math.abs(percent)} %` : '0 %';
}

const WEIGHT_UNITS = new Set(['g', 'gr', 'gram', 'grams', 'gramme', 'grammes', 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters']);

/** The line is counted in grams or millilitres (its unit, or its serving's unit). */
export function isWeightUnit(unit: unknown): boolean {
  return WEIGHT_UNITS.has(String(unit ?? '').trim().toLowerCase());
}

/** g/ml: to the nearest 5 from 20, else to the unit (at least 1); pieces, portions…: to the half (at least 0.5). */
export function roundScaledQuantity(quantity: number, weight: boolean): number {
  if (weight) return quantity >= 20 ? Math.max(5, Math.round(quantity / 5) * 5) : Math.max(1, Math.round(quantity));
  return Math.max(0.5, Math.round(quantity * 2) / 2);
}

function scaled(value: unknown, factor: number, decimals: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const power = Math.pow(10, decimals);
  return Math.round(num(value) * factor * power) / power;
}

/**
 * Applies the factor to one day, in place. Foods: a normal line gets a rounded quantity (its macros follow the
 * quantity, the editor then recomputes its totals), a manual line gets its macros scaled, a meal with macros but no
 * food gets its macros scaled. Macro modes: P/C/F to the gram, kcal = P×4 + C×4 + F×9 like the editors.
 */
export function scaleDay(day: MealDay, mode: NutritionScaleMode, factor: number): void {
  if (!day || day.cheatMeal) return;
  if (mode === 'DAY_MACROS') {
    const t = day.dayTargets;
    if (!t) return;
    t.proteinG = Math.round(num(t.proteinG) * factor);
    t.carbsG = Math.round(num(t.carbsG) * factor);
    t.fatG = Math.round(num(t.fatG) * factor);
    t.calories = macroKcal(t.proteinG, t.carbsG, t.fatG);
    return;
  }
  (day.meals || []).forEach((meal) => {
    const foods = meal.foods || [];
    if (mode === 'MEAL_MACROS' || !foods.length) {
      const t = meal.mealTargets;
      if (!t) return;
      const kcal = num(t.calories);
      t.proteinG = Math.round(num(t.proteinG) * factor);
      t.carbsG = Math.round(num(t.carbsG) * factor);
      t.fatG = Math.round(num(t.fatG) * factor);
      // Macro editor: kcal from the grams, like updateMealCalories; a meal of macros in the foods editor: kcal scaled.
      t.calories = mode === 'MEAL_MACROS' ? macroKcal(t.proteinG, t.carbsG, t.fatG) : Math.round(kcal * factor);
      return;
    }
    foods.forEach((food: any) => {
      if (food.manual || (!food.serving && !food.foodRef)) {
        food.calories = scaled(food.calories, factor, 0);
        food.protein = scaled(food.protein, factor, 1);
        if (food.carbohydrates !== undefined) food.carbohydrates = scaled(food.carbohydrates, factor, 1);
        if (food.carbs !== undefined) food.carbs = scaled(food.carbs, factor, 1);
        food.fat = scaled(food.fat, factor, 1);
        return;
      }
      const base = food.quantity ?? food.serving?.size ?? food.foodRef?.servingSize ?? 100;
      const weight = isWeightUnit(food.unit) || isWeightUnit(food.serving?.unit);
      food.quantity = roundScaledQuantity(num(base) * factor, weight);
    });
  });
}

/** Applies one factor to every given day; returns the days changed (the editor recomputes their totals). */
export function scaleDays(days: MealDay[], mode: NutritionScaleMode, factor: number): MealDay[] {
  days.forEach((day) => scaleDay(day, mode, factor));
  return days;
}

/** Default shares of the day per meal (percent), by number of meals; 7 and more: equal shares. */
export function defaultMealShares(count: number): number[] {
  switch (count) {
    case 1: return [100];
    case 2: return [50, 50];
    case 3: return [30, 40, 30];
    case 4: return [25, 35, 10, 30];
    case 5: return [25, 10, 30, 10, 25];
    case 6: return [20, 10, 25, 10, 25, 10];
    default: return count > 0 ? Array.from({ length: count }, () => 100 / count) : [];
  }
}

export interface MacroGrams {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Splits one macro (whole grams) over the shares; the rounding rest goes to the biggest meal so the sum is exact. */
export function splitGrams(total: number, shares: number[]): number[] {
  if (!shares.length) return [];
  const whole = Math.max(0, Math.round(num(total)));
  // Rounded down, so the rest is never negative (4 g over 7 meals must not give -2 g to one meal).
  const parts = shares.map((share) => Math.floor((whole * share) / 100 + 1e-9));
  const biggest = shares.indexOf(Math.max(...shares));
  parts[biggest] += whole - parts.reduce((sum, value) => sum + value, 0);
  return parts;
}

/** « Répartir sur les N repas »: the day's P/C/F split over `mealCount` meals with the default shares. */
export function splitDayMacros(total: MacroGrams, mealCount: number): MacroGrams[] {
  const shares = defaultMealShares(mealCount);
  const protein = splitGrams(total.proteinG, shares);
  const carbs = splitGrams(total.carbsG, shares);
  const fat = splitGrams(total.fatG, shares);
  return shares.map((_, index) => ({ proteinG: protein[index], carbsG: carbs[index], fatG: fat[index] }));
}
