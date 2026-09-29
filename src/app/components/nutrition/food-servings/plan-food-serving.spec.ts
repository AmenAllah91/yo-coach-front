import { of, throwError } from 'rxjs';
import { NEW_SERVING_OPTION, PlanFoodServing } from './plan-food-serving';

describe('PlanFoodServing', () => {
  const initial = { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 };
  const egg = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 };
  const eggs = (general = false) => ({ id: 'eggs', name: 'Œufs', general, defaultServingId: 'initial', servings: [initial, egg] });
  const select = (value: string) => ({ value } as HTMLSelectElement);
  let admin: boolean;
  let serving: PlanFoodServing;

  beforeEach(() => {
    admin = false;
    serving = new PlanFoodServing(() => admin);
  });

  it('counts portions of the chosen serving', () => {
    serving.start(eggs());
    expect(serving.portions).toBe(1);
    expect(serving.quantity).toBe(100);
    expect(serving.macros.calories).toBe(143);
    serving.portions = 1.5;
    expect(serving.line('pièce')).toEqual(jasmine.objectContaining({ quantity: 150, unit: 'g', servingId: 'initial' }));
    serving.choose(select('egg'));
    expect(serving.portions).toBe(1);
    serving.portions = 2;
    expect(serving.macros.calories).toBe(144);
    expect(serving.line('pièce')).toEqual({ quantity: 2, unit: 'œuf', servingId: 'egg', serving: egg as any });
  });

  it('takes one portion of a multi-piece serving as the whole serving', () => {
    const fourEggs = { id: 'four', size: 4, unit: 'oeufs', energy: 300, protein: 100, carbohydrates: 50, fat: 50 };
    serving.start({ ...eggs(), servings: [initial, egg, fourEggs] });
    serving.choose(select('four'));
    expect(serving.line('pièce')).toEqual(jasmine.objectContaining({ quantity: 4, unit: 'oeufs', servingId: 'four' }));
    expect(serving.macros.calories).toBe(300);
    serving.portions = 2;
    expect(serving.quantity).toBe(8);
    expect(serving.macros.calories).toBe(600);
  });

  it('shows grams for a historical food without servings', () => {
    serving.start({ id: 'rice', name: 'Riz', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3, servingSize: 100, servingDescription: 'Grams' });
    expect(serving.line('pièce')).toEqual(jasmine.objectContaining({ quantity: 100, unit: 'g', servingId: 'initial' }));
    expect(serving.macros.carbs).toBe(28);
  });

  it('offers a new unit on a catalog food to admins only', () => {
    serving.start(eggs(true));
    expect(serving.canAdd).toBeFalse();
    const element = select(NEW_SERVING_OPTION);
    serving.choose(element);
    expect(serving.formOpen).toBeFalse();
    expect(element.value).toBe('initial');
    admin = true;
    serving.start(eggs(true));
    expect(serving.canAdd).toBeTrue();
    serving.choose(select(NEW_SERVING_OPTION));
    expect(serving.formOpen).toBeTrue();
  });

  it('creates a unit on the food and selects it', () => {
    const box = { size: 6, unit: 'œufs', energy: 430, protein: 37.8, carbohydrates: 2.4, fat: 28.5 };
    const updated = jasmine.createSpy('updated');
    serving.start(eggs());
    serving.choose(select(NEW_SERVING_OPTION));
    serving.create(box, () => of({ servings: [initial, egg, { ...box, id: 'box' }], defaultServingId: 'initial' }), updated);
    expect(updated).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'eggs', servings: jasmine.any(Array) }));
    expect(serving.servingId).toBe('box');
    expect(serving.portions).toBe(1);
    expect(serving.quantity).toBe(6);
    expect(serving.formOpen).toBeFalse();
  });

  it('explains a refused unit and keeps the form open', () => {
    serving.start(eggs());
    serving.choose(select(NEW_SERVING_OPTION));
    serving.create(egg, () => throwError(() => ({ status: 403 })), () => fail('not updated'));
    expect(serving.error).toBe('MEAL_SERVING_NOT_OWNED');
    expect(serving.formOpen).toBeTrue();
    expect(serving.servingId).toBe('initial');
  });
});
