import { planFeatureText } from './subscription-onboarding.model';

/** SUB-57: a feature shows in the language of the app, falling back on the French text. */
describe('planFeatureText', () => {
  const feature = { textFr: 'Clients illimités', textEn: 'Unlimited clients', textAr: '' };

  it('uses the text of the language of the app', () => {
    expect(planFeatureText(feature, 'fr')).toBe('Clients illimités');
    expect(planFeatureText(feature, 'en')).toBe('Unlimited clients');
  });

  it('falls back on French when the text of the language is empty or missing', () => {
    expect(planFeatureText(feature, 'ar')).toBe('Clients illimités');
    expect(planFeatureText({ textFr: 'Branding', textEn: null }, 'en')).toBe('Branding');
    expect(planFeatureText({ textFr: 'Branding', textEn: '   ' }, 'en')).toBe('Branding');
  });
});
