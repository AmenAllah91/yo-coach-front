import { of, throwError } from 'rxjs';

import { PayInvoiceComponent } from './pay-invoice.component';

describe('PayInvoiceComponent (SUB-36, payment audit CE-M6)', () => {
  const invoice = { id: 90, amount: 15, currency: 'USD', status: 'UNPAID', planName: 'Pro' } as any;

  function create(invoiceId: string | null, billing: any, state: any = { paymentGateway: 'FLOUCI' }): PayInvoiceComponent {
    const route = { snapshot: { queryParamMap: { get: () => invoiceId } } } as any;
    const states = { refresh: () => of(state) } as any;
    return new PayInvoiceComponent(route, { navigate: () => Promise.resolve(true) } as any, billing, states);
  }

  function billingWith(invoices: any[]): any {
    const billing = jasmine.createSpyObj('CoachBillingService', ['getInvoices', 'initiateInvoicePayment']);
    billing.getInvoices.and.returnValue(of(invoices));
    return billing;
  }

  it('opening the link charges nothing: the coach sees the amount and confirms', () => {
    const billing = billingWith([invoice]);
    const c = create('90', billing, { paymentGateway: 'STRIPE', autoCharge: true, card: { brand: 'visa', last4: '4242' } });

    c.ngOnInit();

    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
    expect(c.amount).toBe('15 $');
    expect(c.method).toBe('STRIPE');
    expect(c.savedCard).toContain('4242');
  });

  it('the payment starts on the click, with the method of the subscription', () => {
    const billing = billingWith([invoice]);
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://pay.example/90' }));
    const c = create('90', billing);
    const redirect = spyOn<any>(c, 'redirectTo');
    c.ngOnInit();

    c.pay();

    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90);
    expect(redirect).toHaveBeenCalledWith('https://pay.example/90');
  });

  it('a cancelled invoice is not offered for payment', () => {
    const billing = billingWith([{ ...invoice, status: 'VOID' }]);
    const c = create('90', billing);

    c.ngOnInit();

    expect(c.error).toBe('PAY_INVOICE_NOT_PAYABLE');
    expect(c.invoice).toBeNull();
  });

  it('an invoice already paid shows a thank-you message instead of an error', () => {
    const c = create('90', billingWith([{ ...invoice, status: 'PAID' }]));

    c.ngOnInit();

    expect(c.error).toBe('PAY_INVOICE_ALREADY_PAID');
  });

  it('a payment refused because it was paid meanwhile also says thank you', () => {
    const billing = billingWith([invoice]);
    billing.initiateInvoicePayment.and.returnValue(throwError(() => ({ status: 400, error: { error: 'This invoice has already been paid' } })));
    const c = create('90', billing);
    c.ngOnInit();

    c.pay();

    expect(c.error).toBe('PAY_INVOICE_ALREADY_PAID');
  });

  it('a link without invoice, or with an invoice of someone else, is not found', () => {
    const billing = billingWith([invoice]);
    const none = create(null, billing);
    none.ngOnInit();
    expect(none.error).toBe('PAY_INVOICE_NOT_FOUND');

    const other = create('91', billing);
    other.ngOnInit();
    expect(other.error).toBe('PAY_INVOICE_NOT_FOUND');
    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
  });
});
