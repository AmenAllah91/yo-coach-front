import { of } from 'rxjs';
import { CustomFoodsComponent } from './custom-foods.component';
import { Food } from '../../../service/nutrition.service';

describe('CustomFoodsComponent servings', () => {
  const translate: any = { instant: (key: string) => (key === 'FOOD_UNIT_PIECE' ? 'pièce' : key) };
  let service: jasmine.SpyObj<any>;
  let component: CustomFoodsComponent;

  const legacyEggs = (): Food => ({
    id: 'eggs', name: 'Œufs', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: null,
    servingSize: 100, servingUnit: 'Grams',
  } as Food);

  const eggsWithServings = (): Food => ({
    ...legacyEggs(),
    defaultServingId: 'initial',
    servings: [
      { id: 'initial', size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 },
      { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 },
    ],
  } as Food);

  beforeEach(() => {
    service = jasmine.createSpyObj('NutritionService', ['updateFood', 'createFood', 'getFoods']);
    service.updateFood.and.callFake((_id: string, food: Food) => of({ ...food, id: 'eggs' }));
    service.createFood.and.callFake((food: Food) => of({ ...food, id: 'new' }));
    service.getFoods.and.returnValue(of({ content: [] }));
    component = new CustomFoodsComponent(service, translate);
  });

  it('opens a historical food on its initial serving shown as grams', async () => {
    component.editFood(legacyEggs());
    expect(component.mainServingId).toBe('initial');
    expect(component.servingDescription).toBe('g');
    expect(component.calories).toBe('143');
    expect(component.extraServings).toEqual([]);
    await component.saveFood();
    const payload = service.updateFood.calls.mostRecent().args[1];
    expect(payload.defaultServingId).toBe('initial');
    expect(payload.servings).toEqual([jasmine.objectContaining({ id: 'initial', size: 100, unit: 'g', energy: 143, carbohydrates: 0.7 })]);
  });

  it('swaps the main serving and saves both with their ids', async () => {
    component.editFood(eggsWithServings());
    expect(component.extraServings.map((s) => s.id)).toEqual(['egg']);
    component.setMainServing(0);
    expect(component.mainServingId).toBe('egg');
    expect(component.servingSize).toBe('1');
    expect(component.calories).toBe('72');
    expect(component.extraServings[0]).toEqual(jasmine.objectContaining({ id: 'initial', unit: 'g', energy: 143 }));
    await component.saveFood();
    const payload = service.updateFood.calls.mostRecent().args[1];
    expect(payload.defaultServingId).toBe('egg');
    expect(payload.servings.map((s: any) => s.id)).toEqual(['egg', 'initial']);
  });

  it('adds a serving, refuses a duplicate main serving and waits for an open serving form', () => {
    component.editFood(legacyEggs());
    component.openServingForm(null);
    expect(component.canSave).toBeFalse();
    component.onServingSaved({ size: 100, unit: 'G', energy: 1, protein: 1, carbohydrates: 1, fat: 1 });
    expect(component.servingFormOpen).toBeFalse();
    expect(component.errors['servingDescription']).toBe('FOOD_VALID_SERVING_DUPLICATE');
    expect(component.fieldError('servingDescription')).toBe('FOOD_VALID_SERVING_DUPLICATE');
    component.removeServing(0);
    expect(component.canSave).toBeTrue();
  });

  it('creates a new food whose first serving becomes the main one', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Barre', servingSize: '1', servingDescription: 'barre', calories: '210', protein: '20', carbs: '22', fat: '7' });
    component.onServingSaved({ size: 3, unit: 'barres', energy: 630, protein: 60, carbohydrates: 66, fat: 21 });
    await component.saveFood();
    const payload = service.createFood.calls.mostRecent().args[0];
    expect(payload.defaultServingId).toBeNull();
    expect(payload.servings.map((s: any) => `${s.size} ${s.unit}`)).toEqual(['1 barre', '3 barres']);
    expect(payload.servings[0].id).toBeUndefined();
  });

  it('shows the main serving and the number of extra servings in the list', () => {
    expect(component.mainServingOf(eggsWithServings()).id).toBe('initial');
    expect(component.servingCount(eggsWithServings())).toBe(2);
    expect(component.servingCount(legacyEggs())).toBe(1);
  });
});
