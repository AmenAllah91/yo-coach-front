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

  /** Payment audit D6: any currency keeps its own code and decimals, never "TND". */
  it('shows other currencies with their code and decimals', () => {
    expect(nbsp(formatAmount(13.5, 'EUR'))).toBe('13,50 EUR');
    expect(nbsp(formatAmount(1200, 'JPY'))).toBe('1 200 JPY');
    expect(nbsp(formatAmount(29, 'usd'))).toBe('29 $');
  });

  it('takes the price set for a currency, and the base price in the base currency of the product', () => {
    const plan = { price: 29, priceUsd: null, prices: { EUR: 27 }, currency: 'USD' };
    expect(priceInCurrency(plan, 'EUR')).toBe(27);
    expect(priceInCurrency(plan, 'USD')).toBe(29);
    expect(priceInCurrency(plan, 'TND')).toBeNull();
    expect(priceInCurrency({ price: 50, priceUsd: 17, prices: { USD: 15.99 } }, 'USD')).toBe(15.99);
  });
});
