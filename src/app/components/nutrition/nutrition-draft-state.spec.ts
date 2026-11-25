/* eslint-disable @typescript-eslint/no-explicit-any */
import { fakeAsync, tick } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { NutritionDraftState, isEmptyNutritionPlan, nutritionContent } from './nutrition-draft-state';

describe('Nutrition builder: unsaved changes and free days', () => {
  const route = { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } } } as any;
  const freeDay = () => ({ id: crypto.randomUUID(), dayOfWeek: 'Day', cheatMeal: true, meals: [] } as any);
  let service: any;
  let router: any;
  let draft: NutritionDraftState;
  let days: any[];

  beforeEach(() => {
    service = jasmine.createSpyObj('NutritionService', ['createNutritionPlan', 'updateNutritionPlan', 'deleteNutritionPlan']);
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

describe('Nutrition builder: a plan left with nothing but its name', () => {
  const zero = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const emptyDay = (extra: Record<string, unknown> = {}) => ({ dayOfWeek: 'Day', cheatMeal: false, refeedDay: false, description: '',
    dayTargets: { ...zero }, meals: [{ name: 'Meal 1', foods: [], mealTargets: { ...zero } }], ...extra } as any);

  it('is empty with empty days, empty meals and zero macros', () => {
    expect(isEmptyNutritionPlan({ details: '', mealDays: [emptyDay(), emptyDay({ meals: [] }), emptyDay({ dayTargets: null })] })).toBeTrue();
    expect(isEmptyNutritionPlan({ mealDays: [] })).toBeTrue();
  });

  it('is not empty with a food, macros, a free day or a description', () => {
    expect(isEmptyNutritionPlan({ mealDays: [emptyDay({ meals: [{ name: 'Midi', foods: [{ name: 'Riz', quantity: 100, unit: 'g' }] }] })] })).toBeFalse();
    expect(isEmptyNutritionPlan({ mealDays: [emptyDay({ meals: [{ name: 'Midi', foods: [], mealTargets: { ...zero, proteinG: 30 } }] })] })).toBeFalse();
    expect(isEmptyNutritionPlan({ mealDays: [emptyDay({ dayTargets: { ...zero, calories: 2000 } })] })).toBeFalse();
    expect(isEmptyNutritionPlan({ mealDays: [emptyDay(), emptyDay({ cheatMeal: true })] })).toBeFalse();
    expect(isEmptyNutritionPlan({ mealDays: [emptyDay({ description: 'Restaurant' })] })).toBeFalse();
    expect(isEmptyNutritionPlan({ details: 'Sèche', mealDays: [emptyDay()] })).toBeFalse();
    expect(isEmptyNutritionPlan(null)).toBeFalse();
  });

  describe('when the editor is left', () => {
    const route = { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } } } as any;
    let service: any;
    let draft: NutritionDraftState;

    beforeEach(() => {
      service = jasmine.createSpyObj('NutritionService', ['createNutritionPlan', 'updateNutritionPlan', 'deleteNutritionPlan']);
      service.createNutritionPlan.and.returnValue(of({ id: 'p1' }));
      service.updateNutritionPlan.and.returnValue(of({ id: 'p1' }));
      service.deleteNutritionPlan.and.returnValue(of(undefined));
      const router = jasmine.createSpyObj('Router', ['navigate'], { url: '/nutrition/create-full-plan' });
      draft = new NutritionDraftState(service, route, null, () => 'fr', router);
    });

    it('deletes the plan it created that is still empty', () => {
      draft.save({ name: 'Sèche', details: '', mealDays: Array.from({ length: 7 }, () => emptyDay()) } as any);
      draft.discardIfEmptyNew(false);
      expect(service.deleteNutritionPlan).toHaveBeenCalledOnceWith('p1', true);
    });

    it('keeps a plan with content, a client plan, or a plan it did not create', () => {
      draft.save({ name: 'Sèche', details: '', mealDays: Array.from({ length: 7 }, () => emptyDay({ cheatMeal: true })) } as any);
      draft.discardIfEmptyNew(false);
      const client = new NutritionDraftState(service, route, null, () => 'fr', jasmine.createSpyObj('Router', ['navigate'], { url: '/x' }));
      client.save({ name: 'Sèche', details: '', mealDays: Array.from({ length: 7 }, () => emptyDay()) } as any);
      client.discardIfEmptyNew(true);
      const opened = new NutritionDraftState(service, route, null, () => 'fr', jasmine.createSpyObj('Router', ['navigate'], { url: '/x' }));
      opened.load({ id: 'old' } as any);
      opened.save({ name: 'Sèche', details: '', mealDays: Array.from({ length: 7 }, () => emptyDay()) } as any);
      opened.discardIfEmptyNew(false);
      expect(service.deleteNutritionPlan).not.toHaveBeenCalled();
    });

    it('waits for a save still on its way', () => {
      const answer = new Subject<any>();
      service.createNutritionPlan.and.returnValue(answer);
      draft.save({ name: 'Sèche', details: '', mealDays: Array.from({ length: 7 }, () => emptyDay()) } as any);
      draft.discardIfEmptyNew(false);
      expect(service.deleteNutritionPlan).not.toHaveBeenCalled();
      answer.next({ id: 'p2' });
      expect(service.deleteNutritionPlan).toHaveBeenCalledOnceWith('p2', true);
    });
  });
});
