import { of, throwError } from 'rxjs';

import { SubscriptionCheckoutComponent } from './subscription-checkout.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { SubscriptionPlanDto } from 'app/models/subscription-onboarding.model';

function plan(id: number, name: string, price: number, cycle: 'MONTHLY' | 'YEARLY', toUnits: number | null): SubscriptionPlanDto {
  return { id, planCode: name, name, price, billingCycle: cycle, pricingModel: 'FLAT_FEE', productId: 8, toUnits };
}

function quote(planId: number, base: number, discount: number, applied: string[] = []) {
  return { planId, baseAmount: base, addonAmount: 0, discountAmount: discount, amount: base - discount,
    couponsApplied: applied, couponsNotApplied: [] };
}

const PLANS = [
  plan(1, 'Starter', 30, 'MONTHLY', 5),
  plan(2, 'Pro', 60, 'MONTHLY', 20),
  plan(3, 'Starter', 300, 'YEARLY', 5),
  plan(4, 'Pro', 600, 'YEARLY', 20),
];

describe('SubscriptionCheckoutComponent (SUB-22)', () => {
  let stateService: jasmine.SpyObj<any>;
  let billing: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  let assign: jasmine.Spy;

  function create(state: Partial<CoachSubscriptionState>): SubscriptionCheckoutComponent {
    stateService.refresh.and.returnValue(of({ readOnly: false, brandingAllowed: false, ...state }));
    const component = new SubscriptionCheckoutComponent(stateService, billing, router);
    assign = spyOn<any>(component, 'redirectTo');
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    billing = jasmine.createSpyObj('CoachBillingService', ['getPlans', 'getCheckoutQuote', 'applyCoupon', 'removeCoupon', 'checkout', 'initiateInvoicePayment']);
    billing.getPlans.and.returnValue(of(PLANS));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    billing.getCheckoutQuote.and.callFake((planId: number) => of(quote(planId, PLANS.find((p) => p.id === planId)!.price, 0)));
  });

  it('preselects the plan of a coach in trial and shows the trial notice', () => {
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });

    expect(c.selectedPlan?.id).toBe(1);
    expect(c.cycle).toBe('MONTHLY');
    expect(c.isTrial).toBeTrue();
    expect(c.canPay).toBeTrue();
    expect(c.visiblePlans.map((p) => p.id)).toEqual([1, 2]);
  });

  it('changing plan or cycle updates the selected plan and its price', () => {
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });

    c.select(PLANS[1]);
    expect(c.selectedPlan?.price).toBe(60);

    c.setCycle('YEARLY');
    expect(c.selectedPlan?.id).toBe(4);
    expect(c.selectedPlan?.price).toBe(600);
  });

  it('a plan too small for the active clients cannot be selected', () => {
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 7 });

    expect(c.isTooSmall(PLANS[0])).toBeTrue();
    expect(c.isTooSmall(PLANS[1])).toBeFalse();
    // The current plan is too small: the first plan that fits is proposed instead.
    expect(c.selectedPlan?.id).toBe(2);
    c.select(PLANS[0]);
    expect(c.selectedPlan?.id).toBe(2);
  });

  it('"Pay with Flouci" creates the invoice of the chosen plan and opens the Flouci page', () => {
    billing.checkout.and.returnValue(of({ id: 90 }));
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/abc' }));
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });
    c.select(PLANS[1]);

    c.pay();

    expect(billing.checkout).toHaveBeenCalledWith(2);
    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90);
    expect(assign).toHaveBeenCalledWith('https://flouci.example/pay/abc');
  });

  it('a PLAN_TOO_SMALL refusal shows the message and reloads the state', () => {
    billing.checkout.and.returnValue(throwError(() => ({ error: { code: 'PLAN_TOO_SMALL' } })));
    const c = create({ status: 'EXPIRED', planId: 1, activeClients: 2 });

    c.pay();

    expect(c.payError).toBe('CHECKOUT_PLAN_TOO_SMALL');
    expect(stateService.refresh).toHaveBeenCalledTimes(2);
    expect(assign).not.toHaveBeenCalled();
  });

  it('SUB-45: the amount shown is the quote of the selected plan', () => {
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });
    expect(billing.getCheckoutQuote).toHaveBeenCalledWith(1);
    expect(c.selectedQuote?.amount).toBe(30);

    c.select(PLANS[1]);
    expect(billing.getCheckoutQuote).toHaveBeenCalledWith(2);
    expect(c.selectedQuote?.amount).toBe(60);
  });

  /** Review 2026-10-26: the currency and the method of the plan chosen, not of the trial plan. */
  it('the button and the amounts follow the method and currency of the plan chosen', () => {
    billing.getCheckoutQuote.and.callFake((planId: number) => of(planId === 1
      ? { ...quote(1, 15, 0), currency: 'USD', gateway: 'STRIPE' }
      : { ...quote(2, 60, 0), currency: 'TND', gateway: 'FLOUCI' }));
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2, checkoutCurrency: 'USD', checkoutPaymentGateway: 'STRIPE' });
    expect(c.currency).toBe('USD');
    expect(c.paymentMethod).toBe('STRIPE');

    c.select(PLANS[1]); // no dollar price: Flouci in TND
    expect(c.currency).toBe('TND');
    expect(c.paymentMethod).toBe('FLOUCI');
  });

  it('SUB-45: a promo code updates the amount, and can be removed', () => {
    billing.applyCoupon.and.returnValue(of(quote(1, 30, 6, ['WELCOME'])));
    billing.removeCoupon.and.returnValue(of(quote(1, 30, 0)));
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });

    c.setPromoCode('  welcome ');
    c.applyPromo();
    expect(billing.applyCoupon).toHaveBeenCalledWith('welcome', 1);
    expect(c.selectedQuote?.amount).toBe(24);
    expect(c.selectedQuote?.couponsApplied).toEqual(['WELCOME']);
    expect(c.promoCode).toBe('');

    c.removePromo('WELCOME');
    expect(billing.removeCoupon).toHaveBeenCalledWith('WELCOME', 1);
    expect(c.selectedQuote?.amount).toBe(30);
  });

  it('SUB-45: a refused promo code shows its own message', () => {
    billing.applyCoupon.and.returnValue(throwError(() => ({ error: { code: 'COUPON_EXPIRED' } })));
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });

    c.setPromoCode('OLD');
    c.applyPromo();
    expect(c.promoError).toBe('CHECKOUT_PROMO_COUPON_EXPIRED');

    billing.applyCoupon.and.returnValue(throwError(() => ({ error: { code: 'SOMETHING_ELSE' } })));
    c.applyPromo();
    expect(c.promoError).toBe('CHECKOUT_PROMO_ERROR');
  });

  it('SUB-49: a 100% promo code activates the plan without the Flouci page', () => {
    billing.getCheckoutQuote.and.returnValue(of(quote(1, 30, 30, ['FREE100'])));
    billing.checkout.and.returnValue(of({ id: 90, status: 'PAID' }));
    const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });
    expect(c.nothingToPay).toBeTrue();

    c.pay();

    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/payment/success'], { queryParams: { invoiceId: 90 } });
  });

  it('an active coach has nothing to pay here', () => {
    const c = create({ status: 'ACTIVE', planId: 2, activeClients: 3 });

    expect(c.canPay).toBeFalse();
    c.pay();
    expect(billing.checkout).not.toHaveBeenCalled();
  });

  describe('free plan (2026-11-10)', () => {
    const FREE = { ...plan(9, 'Free', 0, 'MONTHLY', 3), free: true };

    beforeEach(() => {
      billing.getPlans.and.returnValue(of([FREE, ...PLANS]));
    });

    it('a coach on the free plan chooses the first paid plan here: the free plan is not offered, a paid one is preselected', () => {
      const c = create({ status: 'ACTIVE', freePlan: true, planId: 9, activeClients: 3, maxActiveClients: 3 });

      expect(c.canPay).toBeTrue();
      expect(c.isFreePlan).toBeTrue();
      expect(c.isTrial).toBeFalse();
      expect(c.visiblePlans.map((p) => p.id)).toEqual([1, 2]);
      expect(c.selectedPlan?.id).toBe(1);

      billing.checkout.and.returnValue(of({ id: 91, status: 'UNPAID' }));
      billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/91' }));
      c.pay();
      expect(billing.checkout).toHaveBeenCalledWith(1);
      expect(assign).toHaveBeenCalledWith('https://flouci.example/pay/91');
    });

    it('a coach who never paid (trial, blocked trial) sees the free plan, never preselected', () => {
      const trial = create({ status: 'TRIAL', planId: 1, activeClients: 2 });
      expect(trial.visiblePlans.map((p) => p.id)).toEqual([9, 1, 2]);
      expect(trial.isFree(trial.visiblePlans[0])).toBeTrue();
      expect(trial.selectedPlan?.id).toBe(1);

      const blocked = create({ status: 'EXPIRED', readOnly: true, planId: 77, activeClients: 2 });
      expect(blocked.visiblePlans.map((p) => p.id)).toEqual([9, 1, 2]);
      expect(blocked.selectedPlan?.id).toBe(1);
    });

    it('a coach who already paid is never offered the free plan', () => {
      const c = create({ status: 'EXPIRED', readOnly: true, planId: 2, activeClients: 2,
        currentPeriodStart: '2026-09-01T00:00:00Z', currentPeriodEnd: '2026-10-01T00:00:00Z' });

      expect(c.visiblePlans.map((p) => p.id)).toEqual([1, 2]);
    });

    it('without the flag of YoSales, a price of 0 is a free plan', () => {
      const c = create({ status: 'TRIAL', planId: 1, activeClients: 2 });
      expect(c.isFree(plan(10, 'Zero', 0, 'MONTHLY', 2))).toBeTrue();
      expect(c.isFree(PLANS[0])).toBeFalse();
    });
  });
});
