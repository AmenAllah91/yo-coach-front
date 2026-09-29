import { FoodServing } from '@shared/models/MealPlan';
import { draftOf, editableUnit, prefillFrom, servingErrors, servingFromDraft, servingKey } from './food-serving-rules';

const egg: FoodServing = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8, fiber: null };
const grams: FoodServing = { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 };

function draft(values: Partial<Record<string, string>>) {
  return { ...draftOf(null, ''), ...values } as ReturnType<typeof draftOf>;
}

describe('food-serving-rules', () => {
  it('requires a positive size, a unit and the four macros', () => {
    const errors = servingErrors(draft({ size: '0', unit: ' ' }), []);
    expect(errors).toEqual(jasmine.objectContaining({
      size: 'FOOD_VALID_POSITIVE', unit: 'FOOD_VALID_REQUIRED', energy: 'FOOD_VALID_REQUIRED',
      protein: 'FOOD_VALID_REQUIRED', carbohydrates: 'FOOD_VALID_REQUIRED', fat: 'FOOD_VALID_REQUIRED',
    }));
    expect(servingErrors(draft({ size: '4', unit: 'pièces', energy: '200', protein: '8', carbohydrates: '20', fat: '10' }), [])).toEqual({});
  });

  it('rejects negative or malformed optional values and long units', () => {
    const errors = servingErrors(draft({ size: '1', unit: 'x'.repeat(41), energy: '1', protein: '1', carbohydrates: '1', fat: '1', fiber: '-1', sugar: 'abc' }), []);
    expect(errors['unit']).toBe('FOOD_VALID_UNIT_LENGTH');
    expect(errors['fiber']).toBe('FOOD_VALID_NONNEGATIVE');
    expect(errors['sugar']).toBe('FOOD_VALID_NUMBER');
  });

  it('refuses a serving that already exists, whatever the case and spacing', () => {
    const errors = servingErrors(draft({ size: '1', unit: '  ŒUF ', energy: '1', protein: '1', carbohydrates: '1', fat: '1' }), [egg]);
    expect(errors['unit']).toBe('FOOD_VALID_SERVING_DUPLICATE');
    expect(servingKey(1, ' Œuf  ')).toBe(servingKey('1', 'œuf'));
  });

  it('keeps the fat breakdown under total fat', () => {
    const errors = servingErrors(draft({ size: '1', unit: 'pot', energy: '1', protein: '1', carbohydrates: '1', fat: '5', saturatedFat: '3', polyunsaturatedFat: '3' }), []);
    expect(errors['fat']).toBe('FOOD_VALID_FAT_SUM');
  });

  it('prefills proportionally from a serving with the same unit, singular or plural', () => {
    const prefill = prefillFrom([grams, egg], 6, 'œufs');
    expect(prefill?.source).toBe(egg);
    expect(prefill?.factor).toBe(6);
    expect(prefill?.values.energy).toBe(432);
    expect(prefill?.values.protein).toBe(37.8);
    expect(prefill?.values.fiber).toBeNull();
    expect(prefillFrom([grams, egg], 1, 'container')).toBeNull();
    expect(prefillFrom([grams, egg], 30, 'grams')?.values.energy).toBe(43);
  });

  it('turns historical unit names into editable ones', () => {
    expect(editableUnit('Grams', 'pièce')).toBe('g');
    expect(editableUnit('Qty', 'pièce')).toBe('pièce');
    expect(editableUnit(' pot  de 125 g', 'pièce')).toBe('pot de 125 g');
  });

  it('converts a draft into a serving with nulls for empty optional values', () => {
    const serving = servingFromDraft(draft({ size: '1,5', unit: ' tranche ', energy: '80', protein: '3', carbohydrates: '15', fat: '1', fiber: '' }), 'slice');
    expect(serving).toEqual(jasmine.objectContaining({ id: 'slice', size: 1.5, unit: 'tranche', energy: 80, fiber: null }));
  });
});
