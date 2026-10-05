import { of, throwError } from 'rxjs';

import { SubscriptionCheckoutComponent } from './subscription-checkout.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';
import { SubscriptionPlanDto } from 'app/models/subscription-onboarding.model';

function plan(id: number, name: string, price: number, cycle: 'MONTHLY' | 'YEARLY', toUnits: number | null): SubscriptionPlanDto {
  return { id, planCode: name, name, price, billingCycle: cycle, pricingModel: 'FLAT_FEE', productId: 8, toUnits };
}

const PLANS = [
  plan(1, 'Starter', 30, 'MONTHLY', 5),
  plan(2, 'Pro', 60, 'MONTHLY', 20),
  plan(3, 'Starter', 300, 'YEARLY', 5),
  plan(4, 'Pro', 600, 'YEARLY', 20),
];

describe('SubscriptionCheckoutComponent (SUB-22)', () => {
  let stateService: jasmine.SpyObj<any>;
  let onboarding: jasmine.SpyObj<any>;
  let billing: jasmine.SpyObj<any>;
  let assign: jasmine.Spy;

  function create(state: Partial<CoachSubscriptionState>): SubscriptionCheckoutComponent {
    stateService.refresh.and.returnValue(of({ readOnly: false, brandingAllowed: false, ...state }));
    const component = new SubscriptionCheckoutComponent(stateService, onboarding, billing, { navigate: () => Promise.resolve(true) } as any);
    assign = spyOn<any>(component, 'redirectTo');
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    onboarding = jasmine.createSpyObj('SubscriptionOnboardingService', ['getPlans']);
    onboarding.getPlans.and.returnValue(of(PLANS));
    billing = jasmine.createSpyObj('CoachBillingService', ['checkout', 'initiateInvoicePayment']);
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

  it('an active coach has nothing to pay here', () => {
    const c = create({ status: 'ACTIVE', planId: 2, activeClients: 3 });

    expect(c.canPay).toBeFalse();
    c.pay();
    expect(billing.checkout).not.toHaveBeenCalled();
  });
});
