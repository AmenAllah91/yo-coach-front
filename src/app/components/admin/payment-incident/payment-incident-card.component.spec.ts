import { defaultExtraDays } from './payment-incident-card.component';
import { SubscriptionBannerComponent } from 'app/components/subscription-banner/subscription-banner.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';

describe('Payment incident (rules)', () => {
  const start = '2026-11-04T10:00:00Z';
  const at = (iso: string) => new Date(iso).getTime();

  it('proposes the length of the incident + 2 days, at most 14', () => {
    expect(defaultExtraDays(start, at('2026-11-04T12:00:00Z'))).toBe(3);
    expect(defaultExtraDays(start, at('2026-11-05T22:00:00Z'))).toBe(4);
    expect(defaultExtraDays(start, at('2026-12-04T10:00:00Z'))).toBe(14);
  });

  const state = (extra: Partial<CoachSubscriptionState>): CoachSubscriptionState =>
    ({ readOnly: false, brandingAllowed: false, ...extra } as CoachSubscriptionState);

  it('the coach banner says the payment is unavailable, without a button', () => {
    const view = SubscriptionBannerComponent.viewOf(state({ status: 'PAST_DUE', paymentIncident: true, openInvoiceId: 5 }));
    expect(view?.textKey).toBe('BANNER_PAYMENT_INCIDENT');
    expect(view?.actionKey).toBeUndefined();
    expect(SubscriptionBannerComponent.viewOf(state({ status: 'ACTIVE', paymentIncident: true }))).toBeNull();
  });

  it('a trial over with a deferral shows the last day of access', () => {
    const view = SubscriptionBannerComponent.viewOf(state({
      status: 'TRIAL', trialDaysLeft: 0, cutoffDeferredUntil: '2026-11-10T23:00:00Z', timeZone: 'Africa/Tunis',
    }));
    expect(view?.textKey).toBe('BANNER_ACCESS_KEPT_UNTIL');
    expect(view?.textParams?.['date']).toBe('10/11/2026');
  });
});
