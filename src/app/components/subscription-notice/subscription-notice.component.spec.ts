import { SubscriptionNoticeComponent } from './subscription-notice.component';
import { SubscriptionNoticeService } from 'app/service/subscription-notice.service';

describe('SubscriptionNoticeComponent (SUB-29)', () => {
  const view = SubscriptionNoticeComponent.viewOf;

  it('trial limit: "Limit reached (5 active clients)" and a button to the payment screen', () => {
    const v = view({ code: 'CLIENT_LIMIT_REACHED', reason: 'TRIAL', limit: 5, current: 5 });
    expect(v.titleKey).toBe('NOTICE_LIMIT_TITLE');
    expect(v.titleParams).toEqual({ count: 5 });
    expect(v.textKey).toBe('NOTICE_LIMIT_TRIAL_TEXT');
    expect(v.actionPath).toBe('/subscription/checkout');
  });

  it('plan limit with a suggested plan: "Upgrade to plan Y for Z TND"', () => {
    const v = view({ code: 'CLIENT_LIMIT_REACHED', reason: 'PLAN', limit: 20, current: 20,
      suggestedPlan: { planId: 7, planName: 'Pro', price: 90, proratedCost: 13.333 } });
    expect(v.textKey).toBe('NOTICE_LIMIT_PLAN_SUGGESTED_NOW_TEXT');
    expect(v.textParams).toEqual({ plan: 'Pro', price: 90, now: 13.333 });
    // SUB-46: the plan-change screen, the suggested plan preselected.
    expect(v.actionPath).toBe('/subscription/change-plan');
    expect(v.actionQuery).toEqual({ planId: 7 });
    const free = view({ code: 'CLIENT_LIMIT_REACHED', reason: 'PLAN', limit: 20, current: 20,
      suggestedPlan: { planId: 7, planName: 'Pro', price: 90, proratedCost: null } });
    expect(free.textKey).toBe('NOTICE_LIMIT_PLAN_SUGGESTED_TEXT');
  });

  it('plan limit without suggestion (no bigger plan): archive a client or choose a bigger plan', () => {
    const v = view({ code: 'CLIENT_LIMIT_REACHED', reason: 'PLAN', limit: 20, current: 20, suggestedPlan: null });
    expect(v.textKey).toBe('NOTICE_LIMIT_PLAN_TEXT');
    expect(v.actionPath).toBe('/clients');
  });

  it('locked branding: the validated message and "View plans / Unlock branding"', () => {
    const v = view({ code: 'FEATURE_LOCKED', feature: 'WEBSITE', reason: 'TRIAL' });
    expect(v.textKey).toBe('NOTICE_BRANDING_TEXT');
    expect(v.actionKey).toBe('NOTICE_UNLOCK_BRANDING');
    expect(v.actionPath).toBe('/subscription/checkout');
  });

  it('blocked account (read only, from any refusal): choose a plan', () => {
    for (const notice of [
      { code: 'SUBSCRIPTION_READ_ONLY' as const },
      { code: 'CLIENT_LIMIT_REACHED' as const, reason: 'READ_ONLY' },
      { code: 'FEATURE_LOCKED' as const, reason: 'READ_ONLY' },
    ]) {
      const v = view(notice);
      expect(v.titleKey).toBe('NOTICE_READ_ONLY_TITLE');
      expect(v.actionPath).toBe('/subscription/checkout');
    }
  });

  it('the button closes the window and goes to the screen', () => {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    const notices = new SubscriptionNoticeService();
    const c = new SubscriptionNoticeComponent(notices, router);
    c.ngOnInit();

    notices.publishIfSubscriptionRefusal({ code: 'CLIENT_LIMIT_REACHED', reason: 'TRIAL', limit: 5, current: 5 });
    expect(c.view).not.toBeNull();
    c.act();

    expect(c.view).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/subscription/checkout'], { queryParams: undefined });
    c.ngOnDestroy();
  });

  it('only subscription refusals are published (other errors keep their usual handling)', () => {
    const notices = new SubscriptionNoticeService();
    expect(notices.publishIfSubscriptionRefusal({ code: 'CLIENT_ARCHIVED' })).toBeFalse();
    expect(notices.publishIfSubscriptionRefusal('Server error')).toBeFalse();
    expect(notices.publishIfSubscriptionRefusal(null)).toBeFalse();
    expect(notices.publishIfSubscriptionRefusal({ code: 'FEATURE_LOCKED' })).toBeTrue();
  });
});
