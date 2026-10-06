import { indicativeUsd } from './coach-subscription-state.model';

/** SUB-60: whole dollars, only for a coach whose chosen country is not Tunisia, display only. */
describe('indicativeUsd', () => {
  const abroad = { billingCountry: 'FR', usdRateTnd: 3.1, currency: 'TND' } as any;

  it('gives whole dollars (no decimals) for a coach outside Tunisia', () => {
    expect(indicativeUsd(50, abroad)).toBe(16);
    expect(indicativeUsd(155, abroad)).toBe(50);
    expect(indicativeUsd(1, abroad)).toBe(1);
  });

  it('shows nothing for a Tunisian coach, before the country is chosen, without rate or amount', () => {
    expect(indicativeUsd(50, { ...abroad, billingCountry: 'TN' })).toBeNull();
    expect(indicativeUsd(50, { ...abroad, billingCountry: null })).toBeNull();
    expect(indicativeUsd(50, { ...abroad, usdRateTnd: null })).toBeNull();
    expect(indicativeUsd(0, abroad)).toBeNull();
    expect(indicativeUsd(50, null)).toBeNull();
  });

  it('never converts a subscription that is not charged in TND', () => {
    expect(indicativeUsd(50, { ...abroad, currency: 'USD' })).toBeNull();
  });
});
