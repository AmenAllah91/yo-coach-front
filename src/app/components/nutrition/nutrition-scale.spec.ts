import { MealDay } from '@shared/models/MealPlan';
import { lineMacros } from '@shared/models/nutrition-math';
import {
  averageDayCalories,
  dayCalories,
  defaultMealShares,
  nutritionDayLocked,
  roundScaledQuantity,
  scaleChangeLabel,
  scaleDays,
  scaleFactor,
  scaleFactorAllowed,
  scalableDays,
  splitDayMacros,
  splitGrams,
} from './nutrition-scale';

const rice = { id: 'rice', name: 'Riz', servingSize: 100, servingDescription: 'g', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3 };
const eggServing = { id: 'egg', size: 1, unit: 'oeuf', energy: 70, protein: 6, carbohydrates: 0.5, fat: 5 };

function foodDay(extra: Partial<MealDay> = {}): MealDay {
  return {
    id: 'd', date: '', dayOfWeek: 'Day 1', cheatMeal: false, refeedDay: false,
    meals: [
      { id: 'm1', name: 'Lunch', foods: [
        { id: 'f1', name: 'Riz', quantity: 200, unit: 'g', serving: { id: 's', size: 100, unit: 'g', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3 }, foodRef: rice } as any,
        { id: 'f2', name: 'Oeuf', quantity: 2, unit: 'oeuf', serving: eggServing, foodRef: { id: 'e' } } as any,
        { id: 'f3', name: 'Sauce', manual: true, quantity: 1, unit: 'portion', calories: 100, protein: 2, carbohydrates: 10, fat: 6 } as any,
      ] },
    ],
    ...extra,
  } as MealDay;
}

describe('nutrition-scale', () => {
  it('counts the kcal of a day as each editor does', () => {
    const day = foodDay();
    const expected = (day.meals[0].foods || []).reduce((sum, food) => sum + lineMacros(food).calories, 0);
    expect(dayCalories(day, 'FOODS')).toBeCloseTo(expected, 5);
    const macroDay = { meals: [{ mealTargets: { proteinG: 30, carbsG: 50, fatG: 10, calories: 0 } }] } as any;
    expect(dayCalories(macroDay, 'MEAL_MACROS')).toBe(30 * 4 + 50 * 4 + 10 * 9);
    expect(dayCalories({ dayTargets: { proteinG: 100, carbsG: 200, fatG: 50 }, meals: [] } as any, 'DAY_MACROS')).toBe(1650);
    expect(dayCalories({ cheatMeal: true, dayTargets: { proteinG: 100 } } as any, 'DAY_MACROS')).toBe(0);
  });

  it('leaves out free, empty and locked days from the average', () => {
    const filled = { dayTargets: { proteinG: 100, carbsG: 200, fatG: 50 }, meals: [] } as any; // 1650
    const other = { dayTargets: { proteinG: 150, carbsG: 250, fatG: 50 }, meals: [] } as any; // 2050
    const free = { cheatMeal: true, dayTargets: { proteinG: 100, carbsG: 100, fatG: 100 }, meals: [] } as any;
    const empty = { dayTargets: { proteinG: 0, carbsG: 0, fatG: 0 }, meals: [] } as any;
    const locked = { dayTargets: { proteinG: 10, carbsG: 10, fatG: 10 }, meals: [], locked: true } as any;
    const days = scalableDays([filled, other, free, empty, locked], 'DAY_MACROS', (day: any) => !!day.locked);
    expect(days).toEqual([filled, other]);
    expect(averageDayCalories(days, 'DAY_MACROS')).toBe(1850);
    expect(averageDayCalories([], 'DAY_MACROS')).toBe(0);
  });

  it('locks only the past or followed days of a client plan', () => {
    expect(nutritionDayLocked(true, { date: '2026-11-01' } as any, '2026-11-23')).toBeTrue();
    expect(nutritionDayLocked(true, { date: '2026-11-30' } as any, '2026-11-23')).toBeFalse();
    expect(nutritionDayLocked(false, { date: '2026-11-01' } as any, '2026-11-23')).toBeFalse();
    expect(nutritionDayLocked(true, { date: '2026-11-30', status: 'COMPLETED' } as any, '2026-11-23')).toBeTrue();
  });

  it('computes and limits the factor', () => {
    expect(scaleFactor(2200, 1800)).toBeCloseTo(2200 / 1800, 10);
    expect(scaleFactor('', 1800)).toBeNull();
    expect(scaleFactor(2000, 0)).toBeNull();
    expect(scaleFactorAllowed(0.5)).toBeTrue();
    expect(scaleFactorAllowed(2)).toBeTrue();
    expect(scaleFactorAllowed(0.49)).toBeFalse();
    expect(scaleFactorAllowed(2.01)).toBeFalse();
    expect(scaleFactorAllowed(null)).toBeFalse();
    expect(scaleChangeLabel(1.22)).toBe('+22 %');
    expect(scaleChangeLabel(0.9)).toBe('−10 %');
    expect(scaleChangeLabel(1)).toBe('0 %');
  });

  it('rounds the quantities by unit', () => {
    expect(roundScaledQuantity(243, true)).toBe(245);
    expect(roundScaledQuantity(22, true)).toBe(20);
    expect(roundScaledQuantity(12.4, true)).toBe(12);
    expect(roundScaledQuantity(0.2, true)).toBe(1);
    expect(roundScaledQuantity(2.3, false)).toBe(2.5);
    expect(roundScaledQuantity(0.1, false)).toBe(0.5);
  });

  it('scales the foods: quantity of normal lines, macros of manual lines', () => {
    const day = foodDay();
    scaleDays([day], 'FOODS', 1.22);
    const [riceLine, eggLine, manual] = day.meals[0].foods as any[];
    expect(riceLine.quantity).toBe(245); // 244 g -> nearest 5
    expect(eggLine.quantity).toBe(2.5); // 2.44 eggs -> nearest half
    expect(manual.quantity).toBe(1);
    expect(manual.calories).toBe(122);
    expect(manual.protein).toBe(2.4);
    expect(manual.carbohydrates).toBe(12.2);
    expect(manual.fat).toBe(7.3);
  });

  it('scales a meal of macros without food, and leaves free days alone', () => {
    const day = { cheatMeal: false, meals: [{ foods: [], mealTargets: { proteinG: 20, carbsG: 40, fatG: 10, calories: 330 } }] } as any;
    scaleDays([day], 'FOODS', 1.5);
    expect(day.meals[0].mealTargets).toEqual({ proteinG: 30, carbsG: 60, fatG: 15, calories: 495 });
    const free = { cheatMeal: true, meals: [], dayTargets: { proteinG: 0, carbsG: 0, fatG: 0, calories: 0 } } as any;
    scaleDays([free], 'DAY_MACROS', 1.5);
    expect(free.dayTargets.proteinG).toBe(0);
  });

  it('scales the macro editors to the gram, kcal from the grams', () => {
    const meals = { meals: [{ mealTargets: { proteinG: 33, carbsG: 47, fatG: 11, calories: 0 } }] } as any;
    scaleDays([meals], 'MEAL_MACROS', 1.1);
    expect(meals.meals[0].mealTargets).toEqual({ proteinG: 36, carbsG: 52, fatG: 12, calories: 36 * 4 + 52 * 4 + 12 * 9 });
    const total = { meals: [], dayTargets: { proteinG: 150, carbsG: 200, fatG: 60, calories: 0 } } as any;
    scaleDays([total], 'DAY_MACROS', 0.9);
    expect(total.dayTargets).toEqual({ proteinG: 135, carbsG: 180, fatG: 54, calories: 135 * 4 + 180 * 4 + 54 * 9 });
  });

  it('gives the default shares by number of meals', () => {
    expect(defaultMealShares(1)).toEqual([100]);
    expect(defaultMealShares(3)).toEqual([30, 40, 30]);
    expect(defaultMealShares(4)).toEqual([25, 35, 10, 30]);
    expect(defaultMealShares(6)).toEqual([20, 10, 25, 10, 25, 10]);
    expect(defaultMealShares(8).length).toBe(8);
    expect(defaultMealShares(0)).toEqual([]);
  });

  it('splits the day to the gram, the rest on the biggest meal', () => {
    expect(splitGrams(155, [30, 40, 30])).toEqual([46, 63, 46]);
    expect(splitGrams(4, defaultMealShares(7)).reduce((a, b) => a + b, 0)).toBe(4);
    expect(Math.min(...splitGrams(4, defaultMealShares(7)))).toBeGreaterThanOrEqual(0);
    const split = splitDayMacros({ proteinG: 160, carbsG: 251, fatG: 71 }, 5);
    expect(split.length).toBe(5);
    expect(split.reduce((sum, meal) => sum + meal.proteinG, 0)).toBe(160);
    expect(split.reduce((sum, meal) => sum + meal.carbsG, 0)).toBe(251);
    expect(split.reduce((sum, meal) => sum + meal.fatG, 0)).toBe(71);
    expect(split[2].proteinG).toBe(48); // 30 % of 160
  });
});
