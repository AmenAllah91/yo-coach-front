import { of } from 'rxjs';

import { PlanBillingTabComponent } from './plan-billing-tab.component';
import { CoachSubscriptionState } from 'app/models/coach-subscription-state.model';

describe('PlanBillingTabComponent (settings, same as My subscription)', () => {
  let stateService: jasmine.SpyObj<any>;
  let billing: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  const translate = { instant: (key: string) => key } as any;

  const active: CoachSubscriptionState = {
    status: 'ACTIVE', readOnly: false, brandingAllowed: true, planName: 'Pro', billingCycle: 'MONTHLY',
    currentPeriodEnd: '2026-11-14T23:00:00Z', accessUntil: '2026-11-14T23:00:00Z', timeZone: 'Africa/Tunis',
    cancelAtPeriodEnd: false, maxActiveClients: 20, activeClients: 7,
  };
  const invoices = [
    { id: 90, status: 'UNPAID', amount: 30, invoiceDate: '2026-11-10', dueDate: '2026-11-15', planName: 'Pro', subscriptionId: 41 },
  ];

  function create(state: CoachSubscriptionState | null): PlanBillingTabComponent {
    stateService.refresh.and.returnValue(of(state));
    const c = new PlanBillingTabComponent(stateService, billing, translate, router);
    c.ngOnInit();
    return c;
  }

  beforeEach(() => {
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    billing = jasmine.createSpyObj('CoachBillingService', ['getInvoices', 'initiateInvoicePayment']);
    billing.getInvoices.and.returnValue(of(invoices));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
  });

  it('shows the same plan, date and invoices as My subscription', () => {
    const c = create(active);

    expect(c.state?.planName).toBe('Pro');
    expect(c.dateLine).toEqual({ key: 'MY_SUB_NEXT_PAYMENT', date: '15/11/2026' });
    expect(c.invoices.length).toBe(1);
    expect(c.isPayable(c.invoices[0])).toBeTrue();
    expect(c.canChangePlan).toBeTrue();
    expect(c.hasPlanActions).toBeTrue();
  });

  it('fills the usage bar with the active clients out of the plan limit', () => {
    expect(create(active).usagePercent).toBe(35);
    expect(create({ ...active, activeClients: 30 }).usagePercent).toBe(100);
    expect(create({ ...active, maxActiveClients: null }).usagePercent).toBe(0);
    expect(create({ ...active, activeClients: 0, maxActiveClients: 2147483647 }).usagePercent).toBe(0);
  });

  it('pays an open invoice from the tab (Flouci)', () => {
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/90' }));
    const c = create(active);
    const redirect = spyOn<any>(c, 'redirectTo');

    c.pay(c.invoices[0]);

    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90, 'FLOUCI');
    expect(redirect).toHaveBeenCalledWith('https://flouci.example/pay/90');
  });

  it('offers the paid plan during the trial', () => {
    const c = create({ ...active, status: 'TRIAL', trialEndsAt: '2026-10-20T23:00:00Z' });

    expect(c.isTrial).toBeTrue();
    expect(c.canChangePlan).toBeFalse();
    c.reactivate();
    expect(router.navigate).toHaveBeenCalled();
  });
});
