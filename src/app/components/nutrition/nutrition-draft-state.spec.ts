/* eslint-disable @typescript-eslint/no-explicit-any */
import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { NutritionDraftState, nutritionContent } from './nutrition-draft-state';

describe('Nutrition builder: unsaved changes and free days', () => {
  const route = { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } } } as any;
  const freeDay = () => ({ id: crypto.randomUUID(), dayOfWeek: 'Day', cheatMeal: true, meals: [] } as any);
  let service: any;
  let router: any;
  let draft: NutritionDraftState;
  let days: any[];

  beforeEach(() => {
    service = jasmine.createSpyObj('NutritionService', ['createNutritionPlan', 'updateNutritionPlan']);
    router = jasmine.createSpyObj('Router', ['navigate'], { url: '/nutrition/create-full-plan' });
    draft = new NutritionDraftState(service, route, null, () => 'fr', router, (key, params) => `${key} ${params?.['number'] ?? ''}`.trim());
    days = Array.from({ length: 7 }, freeDay);
    draft.editedPlan = () => ({ name: 'Sèche', details: '', mealDays: days });
  });

  it('is unchanged after a load, whatever the display fills in (photo links, dates)', fakeAsync(() => {
    draft.rememberContent();
    days[0].date = '2026-11-02';
    days[0].imageUrl = 'signed-link';
    tick();
    expect(draft.hasUnsavedChanges()).toBeFalse();
    days[1].description = 'Sortie au restaurant';
    expect(draft.hasUnsavedChanges()).toBeTrue();
  }));

  it('has nothing to protect on a stopped client plan', fakeAsync(() => {
    draft.rememberContent();
    tick();
    days[1].description = 'x';
    draft.readOnly = true;
    expect(draft.hasUnsavedChanges()).toBeFalse();
  }));

  it('remembers what the save sent', fakeAsync(() => {
    draft.rememberContent();
    tick();
    days[1].description = 'Sortie au restaurant';
    service.createNutritionPlan.and.returnValue(of({ id: 'p1' }));
    draft.save({ name: 'Sèche', details: '', mealDays: days } as any);
    expect(service.createNutritionPlan).toHaveBeenCalled();
    expect(draft.hasUnsavedChanges()).toBeFalse();
  }));

  it('asks before making a day with meals a free day, not an empty or free one', () => {
    const filled = { id: 'd', cheatMeal: false, meals: [{ id: 'm', name: 'Midi', foods: [{ name: 'Riz', quantity: 100, unit: 'g' }] }] } as any;
    const empty = { id: 'e', cheatMeal: false, meals: [] } as any;
    const list = [filled, empty, days[0]];
    expect(draft.freeDayQuestion(list, empty)).toBeNull();
    expect(draft.freeDayQuestion(list, days[0])).toBeNull();
    const question = draft.freeDayQuestion(list, filled);
    expect(question?.title).toBe('CONFIRM_ACTION.FREE_DAY_TITLE');
    expect(question?.params).toEqual({ label: 'DAY_NUMBER 1' });
  });

  it('compares the edited fields only', () => {
    const a = nutritionContent({ name: 'A', details: '', mealDays: [{ dayOfWeek: 'Day 1', showDescription: true, meals: [] } as any] });
    const b = nutritionContent({ name: 'A', details: '', mealDays: [{ dayOfWeek: 'Day 3', showDescription: false, meals: [] } as any] });
    expect(a).toBe(b);
  });
});
