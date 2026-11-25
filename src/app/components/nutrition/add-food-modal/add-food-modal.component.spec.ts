/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subject, of, throwError } from 'rxjs';
import { AddFoodModalComponent, quickFoodCalories, quickFoodError, quickFoodPayload } from './add-food-modal.component';
import { foldFoodText, sortPickerFoods } from 'app/service/nutrition.service';

describe('AddFoodModalComponent', () => {
  let results: Map<string, { foods: any[]; truncated: boolean }>;
  let requests: Map<string, Subject<any[]>>;
  let nutrition: any;
  let component: AddFoodModalComponent;
  let toast: any;

  const rice = { id: 'rice', name: 'Riz', general: true };
  const chicken = { id: 'chicken', name: 'Poulet', general: true };

  beforeEach(() => {
    results = new Map();
    requests = new Map();
    nutrition = {
      pickerFoodsResult: (search: string, maxAgeMs?: number) => (maxAgeMs === 30_000 ? results.get(`recent:${search}`) : results.get(search)) ?? null,
      loadPickerFoods: (search: string) => {
        const request = new Subject<any[]>();
        requests.set(search, request);
        return request;
      },
      loadFrequentFoods: () => of([]),
      createFood: jasmine.createSpy('createFood'),
    };
    toast = { error: jasmine.createSpy('error') };
    component = new AddFoodModalComponent(nutrition, { instant: (key: string) => key } as any, toast);
  });

  afterEach(() => component.ngOnDestroy());

  it('never shows the answer of an older search', () => {
    results.set('recent:', { foods: [rice], truncated: false });
    (component as any).load('poulet');
    (component as any).load(''); // erased quickly: the cached list is shown
    expect(component.foods).toEqual([rice]);

    results.set('poulet', { foods: [chicken], truncated: false });
    requests.get('poulet')!.next([chicken]); // the old answer arrives late
    expect(component.foods).toEqual([rice]);
  });

  it('says when the server had more foods than the list', () => {
    (component as any).load('a');
    results.set('a', { foods: [rice], truncated: true });
    requests.get('a')!.next([rice]);
    expect(component.foods).toEqual([rice]);
    expect(component.truncated).toBeTrue();
  });

  it('Échap closes the unit form first, then the modal, without reaching the day window', () => {
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    spyOn(event, 'stopPropagation');

    component.serving.formOpen = true;
    component.onEscape(event);
    expect(component.serving.formOpen).toBeFalse();
    expect(closed).not.toHaveBeenCalled();

    component.onEscape(event);
    expect(closed).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('shows the frequent foods while the search is empty only', () => {
    nutrition.loadFrequentFoods = () => of([rice, chicken]);
    component.ngOnInit();
    expect(component.frequent).toEqual([rice, chicken]);
    expect(component.showFrequent).toBeTrue();
    component.search = 'po';
    expect(component.showFrequent).toBeFalse();
  });

  it('offers « Créer » from 2 letters, with the search as the name', () => {
    component.search = 'r';
    expect(component.canCreate).toBeFalse();
    component.search = ' riz maison ';
    expect(component.canCreate).toBeTrue();
    component.openCreate();
    expect(component.step).toBe('create');
    expect(component.quick.name).toBe('riz maison');
  });

  it('chooses the created food like a click in the results', () => {
    const created = { id: 'new', name: 'riz maison', general: false, servings: [{ id: 's1', size: 100, unit: 'g', energy: 120 }] };
    nutrition.createFood.and.returnValue(of(created));
    component.search = 'riz maison';
    component.openCreate();
    component.quick.protein = 3;
    component.quick.carbs = 25;
    component.saveQuick();
    expect(nutrition.createFood).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'riz maison', servingSize: 100, servingUnit: 'g' }), true);
    expect(component.step).toBe('detail');
    expect(component.selectedFood).toBe(created);
    expect(component.serving.servingId).toBe('s1');
  });

  it('keeps the form and shows a red toast when the server refuses', () => {
    nutrition.createFood.and.returnValue(throwError(() => ({ status: 500 })));
    component.search = 'riz maison';
    component.openCreate();
    component.quick.calories = 120;
    component.saveQuick();
    expect(toast.error).toHaveBeenCalled();
    expect(component.step).toBe('create');
    expect(component.quick.calories).toBe(120);
  });

  it('does not send an invalid food; Échap goes back to the list', () => {
    component.search = 'riz maison';
    component.openCreate();
    component.saveQuick();
    expect(nutrition.createFood).not.toHaveBeenCalled();
    expect(component.quickError).toBe('AFM_CREATE.VALUE_REQUIRED');
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    component.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.step).toBe('list');
    expect(closed).not.toHaveBeenCalled();
  });
});

describe('Add Food quick form', () => {
  const draft = (values: any) => ({ name: 'Riz maison', base: 'g' as const, calories: null, protein: null, carbs: null, fat: null, ...values });

  it('checks the name, the numbers and at least one value', () => {
    expect(quickFoodError(draft({ name: ' ', protein: 3 }))).toBe('AFM_CREATE.NAME_REQUIRED');
    expect(quickFoodError(draft({}))).toBe('AFM_CREATE.VALUE_REQUIRED');
    expect(quickFoodError(draft({ protein: 0, fat: '' }))).toBe('AFM_CREATE.VALUE_REQUIRED');
    expect(quickFoodError(draft({ protein: -1, carbs: 10 }))).toBe('FOOD_VALID_NONNEGATIVE');
    expect(quickFoodError(draft({ carbs: 'abc' }))).toBe('FOOD_VALID_NUMBER');
    expect(quickFoodError(draft({ fat: 2 }))).toBe('');
  });

  it('computes empty kcal with 4/4/9', () => {
    expect(quickFoodCalories(draft({ protein: 10, carbs: 20, fat: 5 }))).toBe(165);
    expect(quickFoodCalories(draft({ calories: 150, protein: 10 }))).toBe(150);
  });

  it('builds a coach food of one serving, like « Mes aliments »', () => {
    const food = quickFoodPayload(draft({ base: 'portion', protein: 10, carbs: 20, fat: 5 }), 'portion');
    expect(food.name).toBe('Riz maison');
    expect(food.servingSize).toBe(1);
    expect(food.servingUnit).toBe('portion');
    expect(food.calories).toBe(165);
    expect(food.servings).toEqual([jasmine.objectContaining({ size: 1, unit: 'portion', energy: 165, protein: 10, carbohydrates: 20, fat: 5 })]);
    expect(quickFoodPayload(draft({ base: 'ml', fat: 1 }), 'portion').servingUnit).toBe('ml');
  });
});

describe('Add Food list order', () => {
  it('ignores accents and « œ »', () => {
    expect(foldFoodText('Œuf à la Crème')).toBe('oeuf a la creme');
  });

  it('puts the coach foods first, then the names starting with the search, then A to Z', () => {
    const foods = [
      { name: 'Farine de riz', general: true },
      { name: 'Riz blanc', general: true },
      { name: 'Riz au lait maison', general: false },
      { name: 'Galette de riz', general: true },
    ];
    expect(sortPickerFoods(foods, 'riz').map((food) => food.name)).toEqual([
      'Riz au lait maison',
      'Riz blanc',
      'Farine de riz',
      'Galette de riz',
    ]);
  });
});
