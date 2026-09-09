import {
  nutritionDayState,
  nutritionMealState,
  firstNutritionFoodValidationMessage,
  nutritionFoodValidationMessages,
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

  it('keeps a food-less meal without foods as a placeholder', () => {
    expect(nutritionMealState(placeholder('Meal 1'))).toBe('EMPTY_PLACEHOLDER');
  });

  it('rejects a food with quantity 0 with the expected message', () => {
    const messages = nutritionFoodValidationMessages({ name: 'Eggs', quantity: 0, unit: 'g' });
    expect(messages).toContain('Quantity must be greater than 0.');
    expect(firstNutritionFoodValidationMessage({ name: 'Eggs', quantity: 0, unit: 'g' }))
      .toBe('Quantity must be greater than 0.');
  });

  it('collects name, quantity, unit and negative-value messages for a food', () => {
    const messages = nutritionFoodValidationMessages({
      name: ' ',
      quantity: 0,
      unit: '',
      calories: -5,
    });
    expect(messages).toContain('Please select a food.');
    expect(messages).toContain('Quantity must be greater than 0.');
    expect(messages).toContain('Serving size is required.');
    expect(messages).toContain('Calories cannot be negative.');
  });

  it('returns no messages for a fully valid food', () => {
    expect(nutritionFoodValidationMessages({ name: 'Eggs', quantity: 100, unit: 'g' })).toEqual([]);
    expect(firstNutritionFoodValidationMessage({ name: 'Eggs', quantity: 100, unit: 'g' })).toBeNull();
  });

  it('skips nutrition-value checks when includeNutritionValues is false', () => {
    const messages = nutritionFoodValidationMessages(
      { name: 'Eggs', quantity: 100, unit: 'g', calories: -5 },
      { includeNutritionValues: false },
    );
    expect(messages).toEqual([]);
  });
});