import { of } from 'rxjs';
import { CustomFoodsComponent } from './custom-foods.component';
import { Food } from '../../../service/nutrition.service';
import { FoodServingFormComponent } from '../food-servings/food-serving-form.component';

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

  it('adds a serving and refuses a duplicate main serving', () => {
    component.editFood(legacyEggs());
    component.openServingForm(null);
    expect(component.canSave).toBeTrue();
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

  function pendingForm(values: Partial<Record<string, string>>): FoodServingFormComponent {
    const form = new FoodServingFormComponent(translate);
    form.ngOnChanges();
    Object.assign(form.draft, values);
    component.openServingForm(null);
    component.servingForm = form;
    return form;
  }

  it('saves the main serving and the serving being typed in one click', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', servingSize: '100', servingDescription: 'g', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    pendingForm({ unit: 'œuf', energy: '72', protein: '6.3', carbohydrates: '0.4', fat: '4.8' });
    await component.saveFood();
    const payload = service.createFood.calls.mostRecent().args[0];
    expect(payload.servings.map((s: any) => `${s.size} ${s.unit}`)).toEqual(['100 g', '1 œuf']);
  });

  it('keeps the food unsaved while the serving being typed is incomplete', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    const form = pendingForm({ unit: 'œuf', energy: '72' });
    await component.saveFood();
    expect(service.createFood).not.toHaveBeenCalled();
    expect(form.error('protein')).toBe('FOOD_VALID_REQUIRED');
    expect(component.servingFormOpen).toBeTrue();
  });

  it('ignores a serving form left empty', async () => {
    component.openAddModal();
    Object.assign(component, { foodName: 'Œufs', calories: '143', protein: '12.6', carbs: '0.7', fat: '9.5' });
    pendingForm({});
    await component.saveFood();
    expect(service.createFood.calls.mostRecent().args[0].servings.length).toBe(1);
  });

  it('shows the main serving and the number of extra servings in the list', () => {
    expect(component.mainServingOf(eggsWithServings()).id).toBe('initial');
    expect(component.servingCount(eggsWithServings())).toBe(2);
    expect(component.servingCount(legacyEggs())).toBe(1);
  });
});
