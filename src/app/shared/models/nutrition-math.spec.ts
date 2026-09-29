import {
  defaultServingOf,
  INITIAL_SERVING_ID,
  legacyServing,
  lineMacros,
  lineRatio,
  lineServing,
  servingsOf,
  totalMacros,
} from './nutrition-math';

const rice = { id: 'rice', energy: 130, protein: 2.7, carbohydrates: 28, fat: 0.3, fiber: 1.5, servingSize: 100, servingDescription: 'Grams' };
const egg = { id: 'egg', size: 1, unit: 'œuf', energy: 72, protein: 6.3, carbohydrates: 0.4, fat: 4.8 };
const eggs = {
  id: 'eggs', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5, servingSize: 100, servingDescription: 'Grams',
  defaultServingId: 'egg',
  servings: [{ id: INITIAL_SERVING_ID, size: 100, unit: 'Grams', energy: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 }, egg],
};

describe('nutrition-math', () => {
  it('computes a legacy line exactly like the back', () => {
    const m = lineMacros({ foodRef: rice, quantity: 150, unit: 'g' });
    expect(m.calories).toBeCloseTo(195, 6);
    expect(m.carbs).toBeCloseTo(42, 6);
  });

  it('uses the line serving when there is one', () => {
    const m = lineMacros({ foodRef: eggs, serving: egg, servingId: 'egg', quantity: 2 });
    expect(m.calories).toBeCloseTo(144, 6);
    expect(m.protein).toBeCloseTo(12.6, 6);
  });

  it('expresses the quantity in the serving unit', () => {
    const pieces = { size: 4, unit: 'pièces', energy: 200, protein: 8, carbohydrates: 20, fat: 10 };
    expect(lineMacros({ foodRef: {}, serving: pieces, quantity: 2 })).toEqual({ calories: 100, protein: 4, carbs: 10, fat: 5 });
    expect(lineMacros({ foodRef: {}, serving: pieces, quantity: null })).toEqual({ calories: 200, protein: 8, carbs: 20, fat: 10 });
  });

  it('keeps manual values and never scales them', () => {
    const m = lineMacros({ manual: true, calories: 250, protein: 20, carbohydrates: null, fat: 3, quantity: 3, serving: egg });
    expect(m).toEqual({ calories: 250, protein: 20, carbs: 0, fat: 3 });
  });

  it('treats a line without food nor serving as carrying its own values', () => {
    expect(lineMacros({ name: 'Banane', calories: 90, carbs: 22, quantity: 1 })).toEqual({ calories: 90, protein: 0, carbs: 22, fat: 0 });
  });

  it('mirrors the back ratio rules', () => {
    expect(lineRatio(null, 30)).toBe(1);
    expect(lineRatio(null, null)).toBe(1);
    expect(lineRatio(50, 0)).toBe(0.5);
    expect(lineRatio(0, 100)).toBe(0);
    expect(lineRatio('', 100)).toBe(1);
  });

  it('sums a meal', () => {
    const total = totalMacros([
      { foodRef: rice, quantity: 150 },
      { foodRef: eggs, serving: egg, quantity: 2 },
      { manual: true, calories: 250 },
    ]);
    expect(total.calories).toBeCloseTo(589, 6);
  });

  it('builds the initial serving from the historical fields', () => {
    const initial = legacyServing(rice);
    expect(initial.id).toBe(INITIAL_SERVING_ID);
    expect(initial.size).toBe(100);
    expect(initial.unit).toBe('Grams');
    expect(initial.fiber).toBe(1.5);
    expect(legacyServing({ servingSize: 0, calories: 50, carbs: 3 })).toEqual(jasmine.objectContaining({ size: 100, unit: 'Grams', energy: 50, carbohydrates: 3 }));
  });

  it('lists servings and finds the main one', () => {
    expect(servingsOf(rice).map((s) => s.id)).toEqual([INITIAL_SERVING_ID]);
    expect(defaultServingOf(eggs)).toBe(egg);
    expect(defaultServingOf({ ...eggs, defaultServingId: 'gone' }).id).toBe(INITIAL_SERVING_ID);
  });

  it('knows which serving a line uses', () => {
    expect(lineServing({ foodRef: eggs, serving: egg })).toBe(egg);
    expect(lineServing({ foodRef: rice })?.id).toBe(INITIAL_SERVING_ID);
    expect(lineServing({ manual: true, foodRef: rice })).toBeNull();
  });
});
