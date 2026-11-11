import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of, throwError } from 'rxjs';

import { ReferralComponent } from './referral.component';
import { ReferralService, ReferralState, formatMoney } from '../../service/referral.service';
import { CoachSubscriptionStateService } from '../../service/coach-subscription-state.service';

describe('ReferralComponent (AFF-22 to AFF-27)', () => {
  let fixture: ComponentFixture<ReferralComponent>;
  let component: ReferralComponent;
  let api: jasmine.SpyObj<ReferralService>;
  let subscriptionState: jasmine.SpyObj<CoachSubscriptionStateService>;

  const terms = { rewardType: 'CREDIT' as const, rewardMode: 'PERCENT' as const, ratePercent: 15, fixedAmount: null,
    durationMode: 'MONTHS' as const, durationValue: 12, validationDays: 30, currency: 'TND' };
  const notActivated: ReferralState = {
    programAvailable: true, availability: 'NOT_ACTIVATED', activated: false, affiliateId: null, code: null, referralLink: null,
    canChangeCode: false, currentTermsVersion: 2, acceptedTermsVersion: null, mustAcceptTerms: false, rewardType: 'CREDIT', terms,
    counters: { clicks: 0, signedUp: 0, inTrial: 0, customers: 0 }, credit: null, trackingDays: 30, dailyInvitationLimit: 20,
  };
  const activated: ReferralState = {
    ...notActivated, availability: 'OK', activated: true, affiliateId: 7, code: 'KHALIL-7F3K',
    referralLink: 'https://yocoach.app/r/KHALIL-7F3K', canChangeCode: true, acceptedTermsVersion: 2,
    counters: { clicks: 48, signedUp: 6, inTrial: 2, customers: 3 },
    credit: { available: 26.7, pending: 13.35, nextAvailableAt: '2026-11-20T23:00:00Z', currency: 'TND' },
  };
  const referral = { id: 11, kind: 'REFERRAL' as const, firstName: 'Sami', initial: 'B.', status: 'CUSTOMER' as const,
    signedUpAt: '2026-09-02T09:00:00Z', commissionsUntil: '2027-09-02T09:00:00Z', earned: 40.05, currency: 'TND' };
  const invitation = { id: 3, kind: 'INVITATION' as const, firstName: 'Ines', initial: null, status: 'INVITED' as const,
    signedUpAt: '2026-10-30T09:00:00Z', commissionsUntil: null, earned: 0, currency: null };
  const commission = { id: 21, type: 'COMMISSION' as const, referredFirstName: 'Sami', referredInitial: 'B.', date: '2026-10-05T10:00:00Z',
    amount: 13.35, currency: 'TND', status: 'PENDING' as const, availableAt: '2026-11-04T23:00:00Z', reason: null };
  const reversal = { ...commission, id: 22, type: 'REVERSAL' as const, amount: -13.35, status: 'APPROVED' as const, availableAt: null };

  function setUp(state: ReferralState | 'ERROR'): void {
    api = jasmine.createSpyObj<ReferralService>('ReferralService', ['state', 'rulesText', 'activate', 'referrals', 'referral',
      'earnings', 'credit', 'creditHistory', 'codeAvailability', 'changeCode', 'invite', 'reportMissing', 'partner', 'partnerPayouts',
      'partnerStatement', 'savePartnerAccount']);
    api.partner.and.returnValue(of({
      money: { toPay: 37.4, pending: 13.35, paid: 240, threshold: 50, missingToThreshold: 12.6, nextPayoutDay: '2026-12-10', currency: 'TND' },
      file: { contractSignedAt: '2026-10-12T10:00:00Z', identityVerifiedAt: '2026-10-12T10:00:00Z', account: null, readyForPayout: false,
        missing: ['PAYOUT_ACCOUNT'] },
    }));
    api.partnerPayouts.and.returnValue(of([{ id: 1, period: '2026-10', total: 120, withholding: 1.8, netPaid: 118.2, currency: 'TND',
      status: 'PAID' as const, method: 'BANK_TRANSFER', accountMasked: '0800 •••• 2100', paidOn: '2026-11-11T10:00:00', reference: 'VIR-1' }]));
    api.partnerStatement.and.returnValue(of({ period: '2026-10', validated: 124.45, takenBack: -4.45, paid: 120, balanceAfter: 0, currency: 'TND' }));
    api.state.and.returnValue(state === 'ERROR' ? throwError(() => ({ status: 503 })) : of(state));
    api.rulesText.and.returnValue(of({ currentVersion: 2, text: 'Règlement v2', publishedAt: '2026-10-01T00:00:00Z', acceptedVersion: null }));
    api.referrals.and.returnValue(of({ items: [referral, invitation], total: 2, page: 0, size: 10 }));
    api.referral.and.returnValue(of({ referral, timeline: [{ type: 'SIGNED_UP' as const, at: referral.signedUpAt, amount: null, currency: null, status: null, reason: null }] }));
    api.earnings.and.returnValue(of({ items: [commission, reversal], total: 2, page: 0, size: 10 }));
    api.credit.and.returnValue(of({ available: 26.7, pending: 13.35, nextAvailableAt: null, used: 62.3, currency: 'TND',
      expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(), deductionEnabled: true }));
    api.creditHistory.and.returnValue(of({ items: [{ id: 1, type: 'APPLIED_TO_INVOICE' as const, amount: -26.7, currency: 'TND',
      invoiceId: 90, commissionId: null, referredFirstName: null, reason: null, createdAt: '2026-10-10T10:00:00Z' }], total: 1, page: 0, size: 10 }));
    subscriptionState = jasmine.createSpyObj<CoachSubscriptionStateService>('CoachSubscriptionStateService', ['refresh']);
    subscriptionState.refresh.and.returnValue(of(null));

    TestBed.configureTestingModule({
      imports: [ReferralComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([]), { provide: ReferralService, useValue: api },
        { provide: CoachSubscriptionStateService, useValue: subscriptionState }],
    });
    fixture = TestBed.createComponent(ReferralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('before activation: shows how it works and activates only once the rules are accepted', () => {
    setUp(notActivated);
    api.activate.and.returnValue(of({}));

    expect(text()).toContain('REFERRAL_PAGE.HOW_TITLE');
    expect(component.rewardText).toBe('15 %');
    expect(component.exampleAmount).toBe('15,00 DT');
    component.activate();
    expect(api.activate).not.toHaveBeenCalled();

    component.accepted = true;
    component.activate();
    expect(api.activate).toHaveBeenCalledWith(2);
    expect(subscriptionState.refresh).toHaveBeenCalled();
  });

  it('shows why the activation is refused (read-only account, new rules)', () => {
    setUp(notActivated);
    api.activate.and.returnValue(throwError(() => ({ error: { code: 'TERMS_VERSION_OUTDATED' } })));
    component.accepted = true;

    component.activate();

    expect(component.activationError).toBe('REFERRAL_PAGE.ERROR_TERMS_CHANGED');
    expect(api.rulesText).toHaveBeenCalledTimes(2);
  });

  it('overview: link, code, credit, counters, latest referrals and rewards', () => {
    setUp(activated);

    expect(component.shortLink).toBe('yocoach.app/r/KHALIL-7F3K');
    const page = text();
    expect(page).toContain('KHALIL-7F3K');
    expect(page).toContain('26,70 DT');
    expect(page).toContain('48');
    expect(page).toContain('Sami B.');
    expect(page).toContain('−13,35 DT');
    expect(page).not.toContain('@');
  });

  it('referrals tab: first name and initial only, invitations not clickable, search on the page', () => {
    setUp(activated);
    component.selectTab('REFERRALS');
    fixture.detectChanges();

    expect(api.referrals).toHaveBeenCalledWith(null, 0, 10);
    expect(component.initials(referral)).toBe('SB');
    component.search = 'ines';
    expect(component.shownReferrals.map((r) => r.id)).toEqual([3]);

    component.openDetail(invitation);
    expect(api.referral).not.toHaveBeenCalled();
    component.openDetail(referral);
    fixture.detectChanges();
    expect(component.dialog).toBe('DETAIL');
    expect(text()).toContain('REFERRAL_PAGE.TIMELINE_SIGNED_UP');
  });

  it('rewards tab: credit, expiry warning, history with refunds taken back, credit use', () => {
    setUp(activated);
    component.selectTab('EARNINGS');
    fixture.detectChanges();

    expect(component.expiresSoon).toBeTrue();
    expect(component.earningLabel(commission)).toBe('REFERRAL_PAGE.EARNING_PENDING');
    expect(component.earningLabel(reversal)).toBe('REFERRAL_PAGE.EARNING_REVERSAL');
    expect(component.movementLabel(component.movements[0])).toBe('REFERRAL_PAGE.MOVEMENT_APPLIED_TO_INVOICE');
    expect(text()).toContain('62,30 DT');
  });

  it('collaborator (money): no credit card nor credit history', () => {
    setUp({ ...activated, rewardType: 'CASH', credit: null, terms: { ...terms, rewardType: 'CASH' } });
    component.selectTab('EARNINGS');
    fixture.detectChanges();

    expect(component.isCash).toBeTrue();
    expect(api.credit).not.toHaveBeenCalled();
    expect(api.creditHistory).not.toHaveBeenCalled();
    expect(text()).not.toContain('REFERRAL_PAGE.NOT_CASH');
  });

  it('collaborator (AFF-41): money to be paid, its file, its payouts and its bank account', () => {
    setUp({ ...activated, rewardType: 'CASH', credit: null, terms: { ...terms, rewardType: 'CASH' } });
    fixture.detectChanges();

    expect(api.partner).toHaveBeenCalled();
    expect(component.progress).toBe(75);
    expect(component.needsAccount).toBeTrue();
    expect(text()).toContain('37,40 DT');
    expect(text()).toContain('REFERRAL_PAGE.BANNER_ACCOUNT');
    expect(text()).toContain('REFERRAL_PAGE.FILE_TITLE');

    component.selectTab('PAYOUTS');
    fixture.detectChanges();
    expect(api.partnerPayouts).toHaveBeenCalled();
    expect(api.partnerStatement).toHaveBeenCalledWith(component.month);
    expect(text()).toContain('VIR-1');
    expect(text()).toContain('124,45 DT');

    api.savePartnerAccount.and.returnValue(of({ id: 3, holder: 'Khalil', bankName: 'BIAT', masked: '0800 •••• 2100', status: 'CHECKING' as const, reason: null }));
    component.open('ACCOUNT');
    component.holder = 'Khalil Ben Ali';
    component.iban = '0800 0000 0000 0045';
    expect(component.ibanValid).toBeFalse();
    component.iban = '0800 0000 0000 0045 2100';
    expect(component.ibanValid).toBeTrue();
    component.saveAccount();
    expect(api.savePartnerAccount).toHaveBeenCalledWith('Khalil Ben Ali', null, '0800 0000 0000 0045 2100');
    expect(component.dialog).toBeNull();
  });

  it('reports a missing referred coach; the answer never says whether the email is a customer', () => {
    setUp(activated);
    api.reportMissing.and.returnValue(of({ answer: 'SENT' as const }));
    component.open('MISSING');
    expect(component.missingDay).toBe(component.missingMax);
    component.missingEmail = ' sarah@gym.test ';
    component.sendMissing();
    expect(api.reportMissing).toHaveBeenCalledWith('sarah@gym.test', component.missingMax, null);
    expect(component.missingResult).toBe('REFERRAL_PAGE.MISSING_SENT');

    api.reportMissing.and.returnValue(of({ answer: 'TOO_LATE' as const }));
    component.missingEmail = 'old@gym.test';
    component.sendMissing();
    expect(component.missingError).toBe('REFERRAL_PAGE.MISSING_TOO_LATE');
  });

  it('invites coaches and shows the addresses refused', () => {
    setUp(activated);
    api.invite.and.returnValue(of({ sent: 1, invalid: ['bad'], remainingToday: 19 }));
    component.open('INVITE');
    component.inviteEmails = 'coach@example.com, bad';

    component.sendInvitations();

    expect(api.invite).toHaveBeenCalledWith(['coach@example.com', 'bad'], 'REFERRAL_PAGE.INVITE_DEFAULT_MESSAGE');
    expect(component.inviteEmails).toBe('bad');
    expect(component.inviteResult).toContain('REFERRAL_PAGE.INVITE_SENT');
    expect(component.inviteResult).toContain('REFERRAL_PAGE.INVITE_INVALID');
  });

  it('changes the code only after a free check', () => {
    setUp(activated);
    api.codeAvailability.and.returnValue(of({ code: 'COACH-KHALIL', availability: 'AVAILABLE' as const }));
    api.changeCode.and.returnValue(of({ code: 'COACH-KHALIL', referralLink: 'https://yocoach.app/r/COACH-KHALIL' }));
    component.open('CODE');
    component.newCode = 'coach-khalil';

    component.checkCode();
    expect(component.codeCheck).toBe('AVAILABLE');
    component.saveCode();

    expect(api.changeCode).toHaveBeenCalledWith('coach-khalil');
    expect(component.dialog).toBeNull();
    expect(api.state).toHaveBeenCalledTimes(2);
  });

  it('shows a retry when the page cannot be loaded', () => {
    setUp('ERROR');

    expect(component.loadError).toBeTrue();
    expect(text()).toContain('REFERRAL_PAGE.RETRY');
  });

  it('a negative balance (reward taken back) shows 0 and says it is never asked for', () => {
    setUp({ ...activated, credit: { available: -13.35, pending: 0, nextAvailableAt: null, currency: 'TND' } });

    const card = (fixture.nativeElement as HTMLElement).querySelector('.credit-card')?.textContent ?? '';
    expect(component.positive(-13.35)).toBe(0);
    expect(card).toContain('0,00 DT');
    expect(card).toContain('REFERRAL_PAGE.TAKEN_BACK_LATER');
    expect(card).not.toContain('−13,35 DT');
  });

  it('opens the rewards tab asked by the link of "My subscription"', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { queryParamMap: convertToParamMap({ tab: 'EARNINGS' }) } } });
    setUp(activated);

    expect(component.tab).toBe('EARNINGS');
    expect(api.earnings).toHaveBeenCalledWith(0, 10);
  });

  it('formats dinars with their millimes', () => {
    expect(formatMoney(26.7)).toBe('26,70 DT');
    expect(formatMoney(13.351)).toBe('13,351 DT');
    expect(formatMoney(13.35, 'TND', true)).toBe('+13,35 DT');
    expect(formatMoney(-13.35, 'TND', true)).toBe('−13,35 DT');
  });
});
