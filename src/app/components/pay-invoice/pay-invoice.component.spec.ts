import { of, throwError } from 'rxjs';

import { PayInvoiceComponent } from './pay-invoice.component';

describe('PayInvoiceComponent (SUB-36)', () => {
  function create(invoiceId: string | null, billing: any): PayInvoiceComponent {
    const route = { snapshot: { queryParamMap: { get: () => invoiceId } } } as any;
    return new PayInvoiceComponent(route, { navigate: () => Promise.resolve(true) } as any, billing);
  }

  it('opens the Flouci payment of the invoice of the link', () => {
    const billing = jasmine.createSpyObj('CoachBillingService', ['initiateInvoicePayment']);
    billing.initiateInvoicePayment.and.returnValue(of({ redirectUrl: 'https://flouci.example/pay/90' }));
    const c = create('90', billing);
    const redirect = spyOn<any>(c, 'redirectTo');

    c.ngOnInit();

    expect(billing.initiateInvoicePayment).toHaveBeenCalledWith(90, 'FLOUCI');
    expect(redirect).toHaveBeenCalledWith('https://flouci.example/pay/90');
  });

  it('an invoice already paid shows a thank-you message instead of an error', () => {
    const billing = jasmine.createSpyObj('CoachBillingService', ['initiateInvoicePayment']);
    billing.initiateInvoicePayment.and.returnValue(throwError(() => ({ status: 400, error: { error: 'This invoice has already been paid' } })));
    const c = create('90', billing);

    c.ngOnInit();

    expect(c.error).toBe('PAY_INVOICE_ALREADY_PAID');
  });

  it('a link without invoice is not found', () => {
    const billing = jasmine.createSpyObj('CoachBillingService', ['initiateInvoicePayment']);
    const c = create(null, billing);

    c.ngOnInit();

    expect(c.error).toBe('PAY_INVOICE_NOT_FOUND');
    expect(billing.initiateInvoicePayment).not.toHaveBeenCalled();
  });
});
