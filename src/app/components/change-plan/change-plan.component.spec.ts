import { of, throwError } from 'rxjs';

import { ChangePlanComponent } from './change-plan.component';
import { PlanChangeOption, PlanChangeOptions } from 'app/models/plan-change.model';

const NOV_15 = '2026-11-14T23:00:00Z'; // 15/11/2026 in Tunis
const OCT_15 = '2026-10-14T23:00:00Z';
const OCT_15_2027 = '2027-10-14T23:00:00Z';

function option(planId: number, planName: string, price: number, kind: PlanChangeOption['kind'],
                extra: Partial<PlanChangeOption> = {}): PlanChangeOption {
  return {
    planId, planName, price, kind, allowed: kind !== 'CURRENT',
    billingCycle: kind === 'TO_YEARLY' ? 'YEARLY' : 'MONTHLY', toUnits: 10, couponsNotKept: [], ...extra,
  };
}

function options(extra: Partial<PlanChangeOptions> = {}): PlanChangeOptions {
  return {
    status: 'ACTIVE', blockedCode: null, currentPlanId: 6, currentPlanName: 'Pro', currentCycle: 'MONTHLY',
    currentPeriodEnd: NOV_15, activeClients: 3, pendingRequest: null, scheduledChange: null,
    plans: [
      option(4, 'Starter', 30, 'DOWNGRADE', { effectiveAt: NOV_15 }),
      option(6, 'Pro', 50, 'CURRENT'),
      option(7, 'Elite', 90, 'UPGRADE', { amountNow: 13.333 }),
      option(16, 'Pro yearly', 500, 'TO_YEARLY', { amountNow: 450, periodStart: OCT_15, periodEnd: OCT_15_2027 }),
    ],
    ...extra,
  };
}

describe('ChangePlanComponent (SUB-46)', () => {
  let billing: jasmine.SpyObj<any>;
  let stateService: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;
  let redirect: jasmine.Spy;

  function create(o: PlanChangeOptions, planId?: number): ChangePlanComponent {
    billing.getPlanChangeOptions.and.returnValue(of(o));
    const route = { snapshot: { queryParamMap: { get: () => (planId ? String(planId) : null) } } };
    const c = new ChangePlanComponent(billing, stateService, route as any, router);
    redirect = spyOn<any>(c, 'redirectTo');
    c.ngOnInit();
    return c;
  }

  beforeEach(() => {
    billing = jasmine.createSpyObj('CoachBillingService', ['getPlanChangeOptions', 'requestUpgrade', 'switchToYearly',
      'requestDowngrade', 'switchToMonthly', 'cancelScheduledChange', 'cancelPendingRequest', 'initiateInvoicePayment']);
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    stateService.refresh.and.returnValue(of({ status: 'ACTIVE', timeZone: 'Africa/Tunis', readOnly: false, brandingAllowed: true }));
    router = jasmine.createSpyObj('Router', ['navigate']);
  });

  it('shows the server amount and date for each kind of change', () => {
    const c = create(options());

    expect(c.lineOf(c.options!.plans[0])).toEqual({ key: 'CHANGE_PLAN_LINE_DOWNGRADE', params: { date: '15/11/2026' } });
    expect(c.lineOf(c.options!.plans[2])!.key).toBe('CHANGE_PLAN_LINE_UPGRADE');
    expect(c.lineOf(c.options!.plans[2])!.params['amount']).toBe(c.amount(13.333));
    expect(c.lineOf(c.options!.plans[3])!.params).toEqual({ amount: c.amount(450), start: '15/10/2026', end: '14/10/2027' });
    expect(c.lineOf(option(5, 'Pro', 30, 'TO_MONTHLY', { effectiveAt: NOV_15 }))!.key).toBe('CHANGE_PLAN_LINE_TO_MONTHLY');
    expect(c.lineOf(option(9, 'Mini', 20, 'DOWNGRADE', { allowed: false, refusalCode: 'PLAN_TOO_SMALL', clientsToArchive: 2 })))
      .toEqual({ key: 'CHANGE_PLAN_REFUSED_PLAN_TOO_SMALL', params: { count: 2 } });
  });

  it('nothing is paid before the coach confirms; then the invoice opens the Flouci page', () => {
    billing.requestUpgrade.and.returnValue(of({ applied: false, invoice: { id: 90 } }));
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/1' }));
    const c = create(options());

    c.select(c.options!.plans[2]);
    expect(c.paysNow(c.selected!)).toBeTrue();
    expect(billing.requestUpgrade).not.toHaveBeenCalled();

    c.confirm();
    expect(billing.requestUpgrade).toHaveBeenCalledWith(7);
    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90, 'FLOUCI');
    expect(redirect).toHaveBeenCalledWith('https://flouci.example/pay/1');
  });

  it('a yearly switch is paid the same way, a free one applies at once', () => {
    billing.switchToYearly.and.returnValue(of({ applied: true, invoice: null }));
    const c = create(options());

    c.select(c.options!.plans[3]);
    c.confirm();

    expect(billing.switchToYearly).toHaveBeenCalledWith(16);
    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
    expect(c.success?.key).toBe('CHANGE_PLAN_DONE_NOW');
  });

  it('a downgrade and a switch to monthly are scheduled for the renewal', () => {
    billing.requestDowngrade.and.returnValue(of({ pendingPlanId: 4, effectiveAt: NOV_15 }));
    const c = create(options());

    c.select(c.options!.plans[0]);
    expect(c.paysNow(c.selected!)).toBeFalse();
    c.confirm();
    expect(billing.requestDowngrade).toHaveBeenCalledWith(4);
    expect(c.success).toEqual({ key: 'CHANGE_PLAN_DONE_SCHEDULED', params: { plan: 'Starter', date: '15/11/2026' } });

    billing.switchToMonthly.and.returnValue(of({ pendingPlanId: 6, effectiveAt: OCT_15_2027 }));
    const yearly = create(options({ currentCycle: 'YEARLY', plans: [option(6, 'Pro', 50, 'TO_MONTHLY', { effectiveAt: OCT_15_2027 })] }));
    yearly.cycle = 'MONTHLY';
    yearly.select(yearly.options!.plans[0]);
    yearly.confirm();
    expect(billing.switchToMonthly).toHaveBeenCalledWith(6);
  });

  it('a refused plan cannot be selected and a server refusal is explained', () => {
    billing.requestUpgrade.and.returnValue(throwError(() => ({ error: { code: 'UPGRADE_PENDING' } })));
    const c = create(options());

    c.select(option(9, 'Mini', 20, 'DOWNGRADE', { allowed: false, refusalCode: 'PLAN_TOO_SMALL' }));
    expect(c.selected).toBeNull();

    c.select(c.options!.plans[2]);
    c.confirm();
    expect(c.error).toBe('CHANGE_PLAN_ERROR_UPGRADE_PENDING');
    expect(billing.getPlanChangeOptions).toHaveBeenCalledTimes(2); // reloaded to show the current situation
  });

  it('the request waiting for payment can be paid or taken back; the scheduled one can be taken back', () => {
    billing.cancelPendingRequest.and.returnValue(of({}));
    billing.cancelScheduledChange.and.returnValue(of({}));
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/2' }));
    const c = create(options({
      pendingRequest: { invoiceId: 101, planId: 7, planName: 'Elite', amount: 13.333, expiresAt: NOV_15, kind: 'UPGRADE', paymentInProgress: false },
      scheduledChange: { planId: 4, planName: 'Starter', effectiveAt: NOV_15, kind: 'DOWNGRADE' },
    }));

    c.payPending();
    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(101, 'FLOUCI');

    c.busy = false;
    c.cancelPending();
    expect(billing.cancelPendingRequest).toHaveBeenCalled();
    c.cancelScheduled();
    expect(billing.cancelScheduledChange).toHaveBeenCalled();
  });

  it('a payment in progress cannot be paid again', () => {
    const c = create(options({
      pendingRequest: { invoiceId: 101, planId: 7, planName: 'Elite', amount: 13.333, expiresAt: NOV_15, kind: 'UPGRADE', paymentInProgress: true },
    }));

    c.payPending();
    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
  });

  it('the plan suggested by the client-limit notice is preselected, in its cycle', () => {
    const c = create(options(), 16);

    expect(c.selected?.planId).toBe(16);
    expect(c.cycle).toBe('YEARLY');
  });

  it('a late coach is sent to pay the renewal first', () => {
    const c = create(options({ status: 'PAST_DUE', blockedCode: 'PAY_FIRST' }));

    expect(c.blockedCode).toBe('PAY_FIRST');
    c.goToPayment();
    expect(router.navigate).toHaveBeenCalledWith(['/subscription']);
  });
});
