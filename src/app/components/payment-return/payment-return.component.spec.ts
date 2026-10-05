import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS, PaymentReturnComponent, REDIRECT_DELAY_MS } from './payment-return.component';

describe('PaymentReturnComponent (SUB-23)', () => {
  let billing: jasmine.SpyObj<any>;
  let stateService: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;

  function create(outcome: 'success' | 'failed', invoiceId: string | null): PaymentReturnComponent {
    const route = {
      snapshot: { data: { outcome }, queryParamMap: { get: (k: string) => (k === 'invoiceId' ? invoiceId : null) } },
    } as any;
    const component = new PaymentReturnComponent(route, router, billing, stateService);
    component.ngOnInit();
    return component;
  }

  const status = (paid: boolean, paymentFailed = false) => of({ invoiceId: 90, status: paid ? 'PAID' : 'UNPAID', paid, paymentFailed });

  beforeEach(() => {
    billing = jasmine.createSpyObj('CoachBillingService', ['getInvoicePaymentStatus', 'checkout']);
    stateService = jasmine.createSpyObj('CoachSubscriptionStateService', ['refresh']);
    stateService.refresh.and.returnValue(of(null));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
  });

  it('shows "verifying" then the success without reloading, refreshes the state and goes to the dashboard', fakeAsync(() => {
    billing.getInvoicePaymentStatus.and.returnValues(status(false), status(false), status(true));
    const c = create('success', '90');

    expect(c.phase).toBe('checking');
    tick(POLL_INTERVAL_MS * 2);
    expect(c.phase).toBe('paid');
    expect(billing.getInvoicePaymentStatus).toHaveBeenCalledTimes(3);
    expect(stateService.refresh).toHaveBeenCalled();

    tick(REDIRECT_DELAY_MS);
    expect(router.navigate).toHaveBeenCalledWith(['/coach-dashboard']);
    // Polling stopped.
    tick(POLL_INTERVAL_MS * 3);
    expect(billing.getInvoicePaymentStatus).toHaveBeenCalledTimes(3);
  }));

  it('a refused payment shows the message and "try again" goes back to the checkout', fakeAsync(() => {
    billing.getInvoicePaymentStatus.and.returnValues(status(false), status(false, true));
    const c = create('success', '90');

    tick(POLL_INTERVAL_MS);
    expect(c.phase).toBe('failed');

    c.retry();
    expect(router.navigate).toHaveBeenCalledWith(['/subscription/checkout']);
    // The return page never creates an invoice.
    expect(billing.checkout).not.toHaveBeenCalled();
  }));

  it('a failed return checks once: a payment that went through anyway is shown as paid', fakeAsync(() => {
    billing.getInvoicePaymentStatus.and.returnValue(status(true));
    const c = create('failed', '90');

    tick(0);
    expect(c.phase).toBe('paid');
    tick(REDIRECT_DELAY_MS);
  }));

  it('a failed return without confirmation shows the failure after one check', fakeAsync(() => {
    billing.getInvoicePaymentStatus.and.returnValue(status(false));
    const c = create('failed', '90');

    tick(0);
    expect(c.phase).toBe('failed');
    expect(billing.getInvoicePaymentStatus).toHaveBeenCalledTimes(1);
  }));

  it('after 2 minutes without answer it says the payment is still being verified', fakeAsync(() => {
    billing.getInvoicePaymentStatus.and.returnValue(throwError(() => new Error('down')));
    const c = create('success', '90');

    tick(POLL_INTERVAL_MS * (POLL_MAX_ATTEMPTS - 1));
    expect(c.phase).toBe('timeout');
    expect(billing.getInvoicePaymentStatus).toHaveBeenCalledTimes(POLL_MAX_ATTEMPTS);
    tick(POLL_INTERVAL_MS * 2);
    expect(billing.getInvoicePaymentStatus).toHaveBeenCalledTimes(POLL_MAX_ATTEMPTS);
    discardPeriodicTasks();
  }));

  it('a failure without invoice offers to try again', () => {
    expect(create('failed', null).phase).toBe('failed');
    expect(billing.getInvoicePaymentStatus).not.toHaveBeenCalled();
  });
});
