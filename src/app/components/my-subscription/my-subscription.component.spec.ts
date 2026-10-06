import { of, throwError } from 'rxjs';

import { MySubscriptionComponent } from './my-subscription.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';

describe('MySubscriptionComponent (SUB-37)', () => {
  let stateService: jasmine.SpyObj<any>;
  let billing: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  const translate = { instant: (key: string) => key } as any;

  const active: CoachSubscriptionState = {
    status: 'ACTIVE', readOnly: false, brandingAllowed: true, planName: 'Pro', billingCycle: 'MONTHLY',
    // Midnight 15/11 in Tunis = 14/11 23:00 UTC: the next payment is on 15/11.
    currentPeriodEnd: '2026-11-14T23:00:00Z', accessUntil: '2026-11-14T23:00:00Z', timeZone: 'Africa/Tunis',
    cancelAtPeriodEnd: false, maxActiveClients: 20, activeClients: 7,
  };
  const invoices = [
    { id: 90, status: 'UNPAID', amount: 30, invoiceDate: '2026-11-10', dueDate: '2026-11-15', planName: 'Pro', subscriptionId: 41 },
    { id: 80, status: 'PAID', amount: 30, invoiceDate: '2026-10-10', dueDate: '2026-10-15', planName: 'Pro', subscriptionId: 41 },
  ];

  function create(state: CoachSubscriptionState | null): MySubscriptionComponent {
    stateService.refresh.and.returnValue(of(state));
    const c = new MySubscriptionComponent(stateService, billing, translate, router);
    c.ngOnInit();
    return c;
  }

  beforeEach(() => {
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    billing = jasmine.createSpyObj('CoachBillingService',
      ['getInvoices', 'initiateInvoicePayment', 'cancelSubscription', 'resumeSubscription']);
    billing.getInvoices.and.returnValue(of(invoices));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
  });

  it('shows the plan, the next payment date (coach zone) and the invoices', () => {
    const c = create(active);

    expect(c.state?.planName).toBe('Pro');
    expect(c.dateLine).toEqual({ key: 'MY_SUB_NEXT_PAYMENT', date: '15/11/2026' });
    expect(c.invoices.length).toBe(2);
    expect(c.isPayable(c.invoices[0])).toBeTrue();
    expect(c.isPayable(c.invoices[1])).toBeFalse();
    expect(c.formatDay('2026-11-10')).toBe('10/11/2026');
  });

  it('pays an open invoice from the page (Flouci)', () => {
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/90' }));
    const c = create(active);
    const redirect = spyOn<any>(c, 'redirectTo');

    c.pay(c.invoices[0]);

    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90, 'FLOUCI');
    expect(redirect).toHaveBeenCalledWith('https://flouci.example/pay/90');
  });

  it('cancels after confirmation, then can take the cancellation back', async () => {
    billing.cancelSubscription.and.returnValue(of({ cancelAtPeriodEnd: true }));
    const c = create(active);
    spyOn<any>(c, 'confirm').and.returnValue(Promise.resolve(true));
    expect(c.canCancel).toBeTrue();
    expect(c.canResume).toBeFalse();

    stateService.refresh.and.returnValue(of({ ...active, cancelAtPeriodEnd: true }));
    await c.cancel();

    expect(billing.cancelSubscription).toHaveBeenCalled();
    expect(c.canResume).toBeTrue();
    expect(c.dateLine).toEqual({ key: 'MY_SUB_ACCESS_UNTIL', date: '14/11/2026' });

    billing.resumeSubscription.and.returnValue(of({ cancelAtPeriodEnd: false }));
    stateService.refresh.and.returnValue(of(active));
    c.resume();
    expect(billing.resumeSubscription).toHaveBeenCalled();
    expect(c.canCancel).toBeTrue();
  });

  it('does not cancel when the coach keeps the subscription', async () => {
    const c = create(active);
    spyOn<any>(c, 'confirm').and.returnValue(Promise.resolve(false));

    await c.cancel();

    expect(billing.cancelSubscription).not.toHaveBeenCalled();
  });

  it('a read-only coach sees "Reactivate", which leads to the payment screen', () => {
    const c = create({ status: 'EXPIRED', readOnly: true, brandingAllowed: false, planName: 'Pro' });

    expect(c.isReadOnly).toBeTrue();
    expect(c.canCancel).toBeFalse();
    c.reactivate();
    expect(router.navigate).toHaveBeenCalledWith(['/subscription/checkout']);
  });

  it('a late coach sees the last day to pay', () => {
    const c = create({ ...active, status: 'PAST_DUE', openInvoiceDueDate: '2026-11-22' });
    expect(c.dateLine).toEqual({ key: 'MY_SUB_PAY_BEFORE', date: '22/11/2026' });
  });

  it('a resume refused after the end shows a clear message', () => {
    billing.resumeSubscription.and.returnValue(throwError(() => ({ error: { code: 'RESUME_NOT_ALLOWED' } })));
    const c = create({ ...active, cancelAtPeriodEnd: true });

    c.resume();

    expect(c.actionError).toBe('MY_SUB_RESUME_NOT_ALLOWED');
  });

  describe('SUB-62: card saved at Stripe', () => {
    const byCard: CoachSubscriptionState = {
      ...active, paymentGateway: 'STRIPE', currency: 'USD', autoCharge: true,
      card: { brand: 'visa', last4: '4242', expMonth: 3, expYear: 2028 },
    };

    beforeEach(() => {
      billing.setAutoCharge = jasmine.createSpy('setAutoCharge').and.returnValue(of({ autoCharge: false }));
      billing.startCardChange = jasmine.createSpy('startCardChange').and.returnValue(of({ redirectUrl: 'https://checkout.stripe.test/setup' }));
    });

    it('shows the card and the automatic renewal date', () => {
      const c = create(byCard);
      expect(c.paidByCard).toBeTrue();
      expect(c.cardLabel).toBe('Visa •••• 4242');
      expect(c.cardExpiry).toBe('03/28');
      expect(c.dateLine).toEqual({ key: 'MY_SUB_NEXT_CHARGE', date: '15/11/2026' });
    });

    it('a coach paid by Flouci has no card section', () => {
      const c = create(active);
      expect(c.paidByCard).toBeFalse();
      expect(c.dateLine?.key).toBe('MY_SUB_NEXT_PAYMENT');
    });

    it('"I pay each invoice myself" after confirmation, and back to the automatic renewal', async () => {
      const c = create(byCard);
      const confirm = spyOn<any>(c, 'confirm').and.returnValue(Promise.resolve(false));
      await c.setAutoCharge(false);
      expect(billing.setAutoCharge).not.toHaveBeenCalled();

      confirm.and.returnValue(Promise.resolve(true));
      await c.setAutoCharge(false);
      expect(billing.setAutoCharge).toHaveBeenCalledWith(false);

      c.state = { ...byCard, autoCharge: false };
      await c.setAutoCharge(true);
      expect(billing.setAutoCharge).toHaveBeenCalledWith(true);
    });

    it('opens the Stripe page to change the card', () => {
      const c = create(byCard);
      const redirect = spyOn<any>(c, 'redirectTo');
      c.changeCard();
      expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.test/setup');
    });
  });
});
