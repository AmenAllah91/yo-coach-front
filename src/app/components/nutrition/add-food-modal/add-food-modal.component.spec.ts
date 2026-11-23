/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subject } from 'rxjs';
import { AddFoodModalComponent } from './add-food-modal.component';
import { foldFoodText, sortPickerFoods } from 'app/service/nutrition.service';

describe('AddFoodModalComponent', () => {
  let results: Map<string, { foods: any[]; truncated: boolean }>;
  let requests: Map<string, Subject<any[]>>;
  let nutrition: any;
  let component: AddFoodModalComponent;

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
    };
    component = new AddFoodModalComponent(nutrition, { instant: (key: string) => key } as any);
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
