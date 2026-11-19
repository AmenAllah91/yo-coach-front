import { localizeFood, toServerLanguage } from './food-language';

describe('food-language (2026-11-13)', () => {
  const food = {
    id: 'f1', name: 'Huile d\'olive', nameEn: 'Olive oil', defaultServingId: 's1', servingDescription: 'g',
    servings: [
      { id: 's1', size: 100, unit: 'g', unitEn: 'g' },
      { id: 's2', size: 1, unit: '1 c. à soupe (13.5 g)', unitEn: '1 tbsp (13.5 g)' },
      { id: 's3', size: 1, unit: 'cuillère maison' },
    ],
  };

  it('keeps the French texts in French', () => {
    expect(localizeFood(food, 'fr')).toBe(food);
  });

  it('shows the English texts in English and keeps the French ones aside', () => {
    const en: any = localizeFood(food, 'en');
    expect(en.name).toBe('Olive oil');
    expect(en.nameFr).toBe('Huile d\'olive');
    expect(en.servings[1].unit).toBe('1 tbsp (13.5 g)');
    expect(en.servings[1].unitFr).toBe('1 c. à soupe (13.5 g)');
    expect(en.servings[2].unit).toBe('cuillère maison'); // no English label: unchanged
    expect(localizeFood(en, 'en')).toBe(en); // never twice
  });

  it('a food without English name stays as it is', () => {
    const custom: any = localizeFood({ name: 'Mon plat', servings: [{ id: 'a', size: 100, unit: 'g' }] }, 'en');
    expect(custom.name).toBe('Mon plat');
    expect(custom.nameFr).toBeUndefined();
  });

  it('sends back the French texts, and what was typed in English to the English fields', () => {
    const en: any = localizeFood(food, 'en');
    en.name = 'Extra virgin olive oil';
    const sent: any = toServerLanguage(en);
    expect(sent.name).toBe('Huile d\'olive');
    expect(sent.nameEn).toBe('Extra virgin olive oil');
    expect(sent.nameFr).toBeUndefined();
    expect(sent.servings[1].unit).toBe('1 c. à soupe (13.5 g)');
    expect(sent.servings[1].unitEn).toBe('1 tbsp (13.5 g)');
    expect(sent.servings[1].unitFr).toBeUndefined();
  });

  it('a French food goes back unchanged', () => {
    expect(toServerLanguage(food)).toEqual(food);
  });
});
