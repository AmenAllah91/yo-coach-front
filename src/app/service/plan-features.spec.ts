import { FEATURE, featureLabel, featureLocked } from './coach-subscription-state.service';
import { SubscriptionNoticeComponent } from 'app/components/subscription-notice/subscription-notice.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { planFeatureChanges, planFeatureLines, SubscriptionPlanDto } from 'app/models/subscription-onboarding.model';

/** Plan features (2026-11-11): padlocks and messages for any feature the plan of the coach does not include. */
describe('plan features in the coach app', () => {
  const state = (extra: Partial<CoachSubscriptionState>): CoachSubscriptionState =>
    ({ status: 'ACTIVE', brandingAllowed: true, readOnly: false, ...extra } as CoachSubscriptionState);

  it('locks a feature the plan says no to, and leaves the others open', () => {
    const s = state({ features: [
      { code: FEATURE.JOIN_LINK, allowed: false, labelFr: 'Lien pour rejoindre', labelEn: 'Join link' },
      { code: FEATURE.TASKS, allowed: true },
    ] });
    expect(featureLocked(s, FEATURE.JOIN_LINK)).toBeTrue();
    expect(featureLocked(s, FEATURE.TASKS)).toBeFalse();
    expect(featureLocked(s, FEATURE.VIDEO_CALL)).toBeFalse(); // not in the plan list: open
    expect(featureLocked(null, FEATURE.JOIN_LINK)).toBeFalse(); // unknown state: open
  });

  it('keeps the rule of before for the website and the branding', () => {
    expect(featureLocked(state({ brandingAllowed: false }), 'website')).toBeTrue();
    expect(featureLocked(state({ brandingAllowed: false, websiteAllowed: true }), FEATURE.WEBSITE)).toBeFalse();
    expect(featureLocked(state({ themeAllowed: false }), 'theme')).toBeTrue();
  });

  it('names the feature in the language of the app', () => {
    const s = state({ features: [{ code: FEATURE.JOIN_LINK, allowed: false, labelFr: 'Lien', labelEn: 'Link' }] });
    expect(featureLabel(s, FEATURE.JOIN_LINK, 'en')).toBe('Link');
    expect(featureLabel(s, FEATURE.JOIN_LINK, 'fr')).toBe('Lien');
    expect(featureLabel(s, FEATURE.JOIN_LINK, 'ar')).toBe('Lien'); // French when no Arabic name
    expect(featureLabel(s, 'feature.nope', 'fr')).toBeNull();
  });

  it('shows "not included in your plan" with the plan-change button', () => {
    const v = SubscriptionNoticeComponent.viewOf({ code: 'FEATURE_LOCKED', feature: FEATURE.JOIN_LINK, reason: 'PLAN',
      featureLabel: 'Lien pour rejoindre' });
    expect(v.titleKey).toBe('NOTICE_FEATURE_NAMED_TITLE');
    expect(v.titleParams).toEqual({ name: 'Lien pour rejoindre' });
    expect(v.textKey).toBe('NOTICE_FEATURE_PLAN_TEXT');
    expect(v.actionKey).toBe('NOTICE_CHOOSE_PLAN');

    const unnamed = SubscriptionNoticeComponent.viewOf({ code: 'FEATURE_LOCKED', feature: FEATURE.TASKS, reason: 'PLAN' });
    expect(unnamed.titleKey).toBe('NOTICE_FEATURE_TITLE');
  });

  it('keeps the branding messages for the website and the app colors', () => {
    const v = SubscriptionNoticeComponent.viewOf({ code: 'FEATURE_LOCKED', feature: 'WEBSITE', reason: 'TRIAL' });
    expect(v.titleKey).toBe('NOTICE_BRANDING_TITLE');
    const blocked = SubscriptionNoticeComponent.viewOf({ code: 'FEATURE_LOCKED', feature: FEATURE.TASKS, reason: 'READ_ONLY' });
    expect(blocked.titleKey).toBe('NOTICE_READ_ONLY_TITLE');
  });

  describe('plan cards (sign-up, payment, plan change)', () => {
    const plan = (id: number, values: SubscriptionPlanDto['featureValues'], extra: Partial<SubscriptionPlanDto> = {}) =>
      ({ id, name: 'P' + id, price: 50, billingCycle: 'MONTHLY', productId: 1, freeTrialDays: 14, featureValues: values, ...extra } as SubscriptionPlanDto);
    const basic = plan(1, [
      { code: FEATURE.WEBSITE, kind: 'ON_OFF', labelFr: 'Site', paid: 0, trial: 0 },
      { code: FEATURE.JOIN_LINK, kind: 'ON_OFF', labelFr: 'Lien', paid: null, trial: 0 },
      { code: 'ai.workout', kind: 'QUANTITY', labelFr: 'IA', paid: 5, trial: 1 },
      { code: 'feature.hidden', kind: 'ON_OFF', labelFr: 'Caché', paid: null, shownToBuyers: false },
    ]);
    const pro = plan(2, [
      { code: FEATURE.WEBSITE, kind: 'ON_OFF', labelFr: 'Site', paid: null, trial: null },
      { code: FEATURE.JOIN_LINK, kind: 'ON_OFF', labelFr: 'Lien', paid: 0, trial: 0 },
      { code: 'ai.workout', kind: 'QUANTITY', labelFr: 'IA', paid: 20, trial: 2 },
    ]);

    it('lists what a plan gives: included, after the trial, not included', () => {
      const lines = planFeatureLines(basic, 'fr');
      expect(lines.map((l) => l.state)).toEqual(['excluded', 'afterTrial', 'included']);
      expect(lines[2].amount).toBe(5);
      // A free plan has no trial: nothing waits for the end of a trial.
      expect(planFeatureLines({ ...basic, price: 0, free: true }, 'fr')[1].state).toBe('included');
    });

    it('says what the coach gains and loses when changing plan', () => {
      const c = planFeatureChanges(basic, pro, 'fr');
      expect(c.gained.map((l) => l.code)).toEqual([FEATURE.WEBSITE]);
      expect(c.lost.map((l) => l.code)).toEqual([FEATURE.JOIN_LINK]);
      expect(c.changed.map((x) => [x.before.amount, x.line.amount])).toEqual([[5, 20]]);
      expect(planFeatureChanges(null, pro, 'fr').gained).toEqual([]);
    });
  });
});
