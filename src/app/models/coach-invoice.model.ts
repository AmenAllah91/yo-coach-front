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
