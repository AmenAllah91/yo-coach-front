import {
  nutritionDayState,
  nutritionMealState,
} from './nutrition-publication';
import { Meal, MealDay } from './MealPlan';

const placeholder = (name: string): Meal => ({ name, mealTime: '10:00', foods: [] });
const validMeal = (): Meal => ({
  name: 'Meal 2',
  foods: [{ name: 'Eggs', quantity: 100, unit: 'g' }],
});

const dayWith = (...meals: Meal[]): MealDay => ({
  date: '',
  dayOfWeek: '',
  cheatMeal: false,
  refeedDay: false,
  meals,
});

describe('nutrition publication state', () => {
  it('ignores untouched automatic meal placeholders', () => {
    expect(nutritionMealState(placeholder('Meal 1'))).toBe('EMPTY_PLACEHOLDER');
    expect(nutritionDayState(dayWith(placeholder('Meal 1'), placeholder('Meal 2')))).toBe('EMPTY');
  });

  it('marks a day ready when one meal is valid and the remaining meals are placeholders', () => {
    expect(nutritionDayState(dayWith(validMeal(), placeholder('Meal 3')))).toBe('READY');
  });

  it('marks a started meal without a valid quantity as incomplete', () => {
    const incomplete: Meal = {
      name: 'Meal 1',
      foods: [{ name: 'Eggs', quantity: 0, unit: 'g' }],
    };
    expect(nutritionMealState(incomplete)).toBe('INCOMPLETE');
    expect(nutritionDayState(dayWith(validMeal(), incomplete))).toBe('INCOMPLETE');
  });

  it('counts a cheat day as valid regardless of its placeholders', () => {
    expect(nutritionDayState({ ...dayWith(placeholder('Meal 1')), cheatMeal: true })).toBe('CHEAT');
  });
});
