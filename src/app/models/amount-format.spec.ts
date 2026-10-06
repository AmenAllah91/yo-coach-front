import { formatAmount, priceInCurrency } from './subscription-onboarding.model';

/** SUB-61: amounts are shown in the currency of the subscription: TND by Flouci, dollars by Stripe. */
describe('formatAmount / priceInCurrency', () => {
  const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

  it('shows TND with up to 3 decimals and dollars with cents only when needed', () => {
    expect(nbsp(formatAmount(50, 'TND'))).toBe('50 TND');
    expect(nbsp(formatAmount(6.667, 'TND'))).toBe('6,667 TND');
    expect(nbsp(formatAmount(17, 'USD'))).toBe('17 $');
    expect(nbsp(formatAmount(4.33, 'USD'))).toBe('4,33 $');
    expect(nbsp(formatAmount(4.3, 'USD'))).toBe('4,30 $');
    expect(formatAmount(null, 'USD')).toBe('');
    expect(nbsp(formatAmount(50, null))).toBe('50 TND');
  });

  it('takes the dollar price of a plan for a dollar subscription', () => {
    const plan = { price: 50, priceUsd: 17 };
    expect(priceInCurrency(plan, 'USD')).toBe(17);
    expect(priceInCurrency(plan, 'TND')).toBe(50);
    expect(priceInCurrency({ price: 50, priceUsd: null }, 'USD')).toBeNull();
  });
});
