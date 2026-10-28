import { isOnboardingFree } from './coach-onboarding.guard';

describe('coachOnboardingGuard (payment audit CE-M7)', () => {
  it('lets the payment link of an email and the payment return through an unfinished onboarding', () => {
    expect(isOnboardingFree('/billing/pay?invoiceId=90')).toBeTrue();
    expect(isOnboardingFree('/payment/success?invoiceId=90')).toBeTrue();
    expect(isOnboardingFree('/payment/failed')).toBeTrue();
  });

  it('keeps every other page behind the onboarding', () => {
    expect(isOnboardingFree('/coach-dashboard')).toBeFalse();
    expect(isOnboardingFree('/billing/payment-history')).toBeFalse();
    expect(isOnboardingFree('/paymentx')).toBeFalse();
    expect(isOnboardingFree(null)).toBeFalse();
  });
});
