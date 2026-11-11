import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { ReferralCreditCardComponent } from './referral-credit-card.component';

describe('Referral credit in "My subscription" (AFF-28)', () => {
  function render(state: object | null) {
    TestBed.configureTestingModule({
      imports: [ReferralCreditCardComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ReferralCreditCardComponent);
    fixture.componentInstance.state = state as any;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the credit, what is waiting and that it is taken off the next invoice', () => {
    const el = render({ readOnly: false, brandingAllowed: true, referralCreditAvailable: 26.7, referralCreditPending: 13.35,
      referralCreditPendingAvailableAt: '2026-11-20T10:00:00Z', referralCreditCurrency: 'TND', referralCreditDeduction: true });
    expect(el.textContent).toContain('26,7 TND');
    expect(el.textContent).toContain('MY_SUB_REFERRAL_PENDING_ON');
    expect(el.textContent).toContain('MY_SUB_REFERRAL_DEDUCTED_NEXT');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/referral?tab=EARNINGS');
  });

  it('says the credit is kept while the deduction is off', () => {
    const el = render({ readOnly: false, brandingAllowed: true, referralCreditAvailable: 10, referralCreditDeduction: false });
    expect(el.textContent).toContain('MY_SUB_REFERRAL_KEPT');
  });

  it('is hidden without credit, and a balance below zero is never shown', () => {
    expect(render({ readOnly: false, brandingAllowed: true, referralCreditAvailable: 0 }).textContent?.trim()).toBe('');
    TestBed.resetTestingModule();
    expect(render({ readOnly: false, brandingAllowed: true, referralCreditAvailable: -13.35 }).textContent?.trim()).toBe('');
  });
});
