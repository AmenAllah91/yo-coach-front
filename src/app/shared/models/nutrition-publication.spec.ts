import { Meal, MealDay } from './MealPlan';
import { nutritionDayStatus, nutritionMealStatus } from './nutrition-publication';

function placeholder(): Meal {
  return { name: 'Meal 1', foods: [] };
}

function incompleteMeal(): Meal {
  return {
    name: 'Meal 1',
    foods: [{ name: 'Rice', quantity: 0, unit: 'g', manual: true }],
  };
}

function day(meals: Meal[]): MealDay {
  return {
    date: '', dayOfWeek: '', cheatMeal: false, refeedDay: false, meals,
    dayTargets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  };
}

describe('nutrition publication rules', () => {
  it('keeps untouched meals as empty placeholders', () => {
    expect(nutritionMealStatus(placeholder(), null)).toBe('Empty');
    expect(nutritionDayStatus(day([placeholder()]), null)).toBe('Empty');
  });

  it('marks a day incomplete when its only edited meal is invalid', () => {
    expect(nutritionDayStatus(day([placeholder(), incompleteMeal()]), null)).toBe('Incomplete');
  });

  it('lets an incomplete meal block a total-for-day plan', () => {
    const value = day([placeholder(), incompleteMeal()]);
    value.dayTargets = { calories: 1450, proteinG: 100, carbsG: 150, fatG: 50 };
    expect(nutritionDayStatus(value, 'TOTAL_FOR_DAY')).toBe('Incomplete');
  });

  it('treats a cheat meal day as ready regardless of placeholders', () => {
    const value = day([placeholder()]);
    value.cheatMeal = true;
    expect(nutritionDayStatus(value, null)).toBe('Cheat meal');
  });
});
