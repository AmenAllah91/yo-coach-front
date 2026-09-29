import { FoodServingFormComponent } from './food-serving-form.component';
import { FoodServing } from '@shared/models/MealPlan';

describe('FoodServingFormComponent', () => {
  const translate: any = { instant: (key: string) => (key === 'FOOD_UNIT_PIECE' ? 'pièce' : key) };
  const egg: FoodServing = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8, fiber: 0 };
  let form: FoodServingFormComponent;
  let emitted: FoodServing[];

  beforeEach(() => {
    form = new FoodServingFormComponent(translate);
    form.others = [egg];
    form.ngOnChanges();
    emitted = [];
    form.saved.subscribe((serving) => emitted.push(serving));
  });

  function type(field: 'size' | 'unit', value: string) {
    form.draft[field] = value;
    form.onSizeOrUnitChange(field);
  }

  it('prefills from a serving with the same unit and follows the quantity', () => {
    type('unit', 'œufs');
    type('size', '6');
    expect(form.draft.energy).toBe('432');
    expect(form.draft.fiber).toBe('0');
    expect(form.prefill?.source).toBe(egg);
    type('size', '2');
    expect(form.draft.energy).toBe('144');
  });

  it('never overwrites values typed by hand', () => {
    type('size', '1');
    form.draft.energy = '90';
    form.onValueChange('energy');
    type('unit', 'œuf');
    expect(form.draft.energy).toBe('90');
    expect(form.prefill).toBeNull();
  });

  it('clears its own prefill when the unit stops matching', () => {
    type('unit', 'œufs');
    type('size', '6');
    type('unit', 'pot');
    expect(form.draft.energy).toBe('');
    expect(form.prefill).toBeNull();
  });

  it('only emits a valid serving and keeps the id when editing', () => {
    type('size', '1');
    type('unit', 'œuf');
    form.submit();
    expect(emitted).toEqual([]);
    expect(form.error('unit')).toBe('FOOD_VALID_SERVING_DUPLICATE');

    form.initial = { id: 'pot', size: 1, unit: 'Qty', energy: 90, protein: 5, carbohydrates: 10, fat: 3 };
    form.ngOnChanges();
    expect(form.draft.unit).toBe('pièce');
    form.submit();
    expect(emitted).toEqual([jasmine.objectContaining({ id: 'pot', size: 1, unit: 'pièce', energy: 90 })]);
  });
});
