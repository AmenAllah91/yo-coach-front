import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { SubscriptionBannerComponent, TRIAL_BANNER_DAYS } from './subscription-banner.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { SubscriptionNoticeService } from 'app/service/subscription-notice.service';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';

const base = { readOnly: false, brandingAllowed: false };
const state = (s: Partial<CoachSubscriptionState>): CoachSubscriptionState => ({ ...base, ...s } as CoachSubscriptionState);

describe('SubscriptionBannerComponent (SUB-30)', () => {
  const view = SubscriptionBannerComponent.viewOf;

  it('trial: a banner only in the last 7 days, with the days left', () => {
    expect(view(state({ status: 'TRIAL', trialDaysLeft: TRIAL_BANNER_DAYS + 1 }))).toBeNull();
    expect(view(state({ status: 'TRIAL', trialDaysLeft: 5 }))).toEqual(jasmine.objectContaining({
      textKey: 'BANNER_TRIAL_DAYS', textParams: { count: 5 }, action: 'checkout' }));
    expect(view(state({ status: 'TRIAL', trialDaysLeft: 1 }))!.textKey).toBe('BANNER_TRIAL_ONE_DAY');
    expect(view(state({ status: 'TRIAL', trialDaysLeft: 0 }))!.textKey).toBe('BANNER_TRIAL_LAST_DAY');
  });

  it('late payment: "pay before <date>" and a button that pays the open invoice', () => {
    const v = view(state({ status: 'PAST_DUE', openInvoiceId: 61, openInvoiceDueDate: '2026-10-08', brandingAllowed: true }))!;
    expect(v.tone).toBe('warning');
    expect(v.textKey).toBe('BANNER_PAST_DUE_BEFORE');
    expect(v.textParams).toEqual({ date: '08/10/2026' });
    expect(v.action).toBe('pay');
  });

  it('trial over (never paid) and expired paid subscription are both read-only, with different texts', () => {
    expect(view(state({ status: 'EXPIRED', readOnly: true }))).toEqual(jasmine.objectContaining({
      tone: 'danger', textKey: 'BANNER_TRIAL_OVER', action: 'checkout' }));
    expect(view(state({ status: 'EXPIRED', readOnly: true, currentPeriodEnd: '2026-09-01T00:00:00Z' }))).toEqual(
      jasmine.objectContaining({ textKey: 'BANNER_EXPIRED', actionKey: 'BANNER_REACTIVATE' }));
  });

  it('cancelled: read-only banner with "Reactivate" to the payment screen', () => {
    expect(view(state({ status: 'CANCELLED', readOnly: true }))).toEqual(jasmine.objectContaining({
      textKey: 'BANNER_CANCELLED', actionKey: 'BANNER_REACTIVATE', action: 'checkout' }));
  });

  it('no banner for an active subscription or an unknown state', () => {
    expect(view(state({ status: 'ACTIVE', brandingAllowed: true }))).toBeNull();
    expect(view(null)).toBeNull();
  });

  it('"Pay" on a late payment opens Flouci for the open invoice', () => {
    const states$ = new BehaviorSubject<CoachSubscriptionState | null>(
      state({ status: 'PAST_DUE', openInvoiceId: 61, openInvoiceDueDate: '2026-10-08' }));
    const stateService = { states$, getState: () => of(states$.value), refresh: () => of(states$.value) } as any;
    const billing = jasmine.createSpyObj('CoachBillingService', ['initiateInvoicePayment']);
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/61' }));
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const c = new SubscriptionBannerComponent(stateService, billing, new SubscriptionNoticeService(), router);
    const redirect = spyOn<any>(c, 'redirectTo');
    c.ngOnInit();

    c.act();

    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(61, 'FLOUCI');
    expect(redirect).toHaveBeenCalledWith('https://flouci.example/pay/61');
    c.ngOnDestroy();
  });

  it('a SUBSCRIPTION_READ_ONLY refusal reloads the state so the banner shows up', () => {
    const states$ = new BehaviorSubject<CoachSubscriptionState | null>(state({ status: 'ACTIVE', brandingAllowed: true }));
    const refresh = jasmine.createSpy('refresh').and.callFake(() => {
      states$.next(state({ status: 'EXPIRED', readOnly: true, currentPeriodEnd: '2026-09-01T00:00:00Z' }));
      return of(states$.value);
    });
    const stateService = { states$, getState: () => of(states$.value), refresh } as any;
    const notices = new SubscriptionNoticeService();
    const c = new SubscriptionBannerComponent(stateService, {} as any, notices, {} as any);
    c.ngOnInit();
    expect(c.view).toBeNull();

    notices.publishIfSubscriptionRefusal({ code: 'SUBSCRIPTION_READ_ONLY' });

    expect(refresh).toHaveBeenCalled();
    expect(c.view?.textKey).toBe('BANNER_EXPIRED');
    c.ngOnDestroy();
  });
});

@Component({
  standalone: true,
  imports: [WriteActionDirective],
  template: `<button appWriteAction type="button">Add client</button>
             <button appWriteAction type="button" disabled>Already disabled</button>`,
})
class HostComponent {}

describe('WriteActionDirective (SUB-30)', () => {
  let states$: BehaviorSubject<CoachSubscriptionState | null>;

  beforeEach(() => {
    states$ = new BehaviorSubject<CoachSubscriptionState | null>(null);
    TestBed.configureTestingModule({
      imports: [HostComponent, TranslateModule.forRoot()],
      providers: [{ provide: CoachSubscriptionStateService, useValue: { states$, getState: () => of(states$.value) } }],
    });
  });

  it('disables the write buttons while the account is read-only and enables them again after payment', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const [add, other] = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(add.disabled).toBeFalse();

    states$.next(state({ status: 'EXPIRED', readOnly: true }));
    expect(add.disabled).toBeTrue();
    expect(add.getAttribute('title')).toBe('READ_ONLY_ACTION_HINT');

    states$.next(state({ status: 'ACTIVE', brandingAllowed: true }));
    expect(add.disabled).toBeFalse();
    // A button disabled for its own reasons stays disabled.
    expect(other.disabled).toBeTrue();
  });

  it('an unknown state never disables anything', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    states$.next(null);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
