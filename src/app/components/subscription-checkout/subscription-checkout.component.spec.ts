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
    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90, 'FLOUCI');
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
});
