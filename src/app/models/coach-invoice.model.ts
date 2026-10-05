export interface CoachInvoice {
  id: number;
  subscriptionId: number;
  amount: number;
  invoiceDate: string | null;
  dueDate: string | null;
  status: string;
  note?: string | null;
  paymentIds?: number[];
  customerName?: string | null;
  customerEmail?: string | null;
  planName?: string | null;
  currency?: string | null;
  invoiceType?: string | null;
  creationReason?: string | null;
  baseAmount?: number | null;
  addonAmount?: number | null;
  discountAmount?: number | null;
  planSnapshot?: string | null;
  events?: CoachInvoiceEvent[];
}

export interface CoachInvoiceEvent {
  id: number;
  eventType: string;
  occurredAt: string | null;
  actor?: string | null;
  gateway?: string | null;
  transactionId?: string | null;
  detail?: string | null;
}

export interface InvoicePaymentGateway {
  gateway: string;
  imageUrl?: string | null;
}

export interface InvoicePaymentResponse {
  paymentId?: string | null;
  redirectUrl?: string | null;
  status?: string | null;
  message?: string | null;
}

/** SUB-23: polled by the payment return page (CE GET /api/billing/invoices/{id}/payment-status). */
export interface InvoicePaymentStatus {
  invoiceId: number;
  status: string;
  paid: boolean;
  /** The latest attempt was refused at the gateway: the coach can try again. */
  paymentFailed: boolean;
}

/** SUB-35: answer of cancel / resume. */
export interface SubscriptionCancellation {
  subscriptionId: number;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** First instant without access (ISO). */
  accessUntil?: string | null;
}
