import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

/** AFF-21: the referral of the connected coach (coach-empire relays YoSales). Never the email nor the price of a referred coach. */
export interface ReferralTerms {
  rewardType: 'CREDIT' | 'CASH';
  rewardMode: 'PERCENT' | 'FIXED';
  ratePercent: number | null;
  fixedAmount: number | null;
  durationMode: 'MONTHS' | 'PAYMENTS' | 'WHILE_PAYING';
  durationValue: number | null;
  validationDays: number;
  currency: string;
}

export interface ReferralState {
  programAvailable: boolean;
  /** OK, NOT_ACTIVATED, PROGRAM_UNAVAILABLE, PROGRAM_DISABLED, AFFILIATE_NOT_ACTIVE, TERMS_NOT_ACCEPTED, COACH_READ_ONLY. */
  availability: string;
  activated: boolean;
  affiliateId: number | null;
  code: string | null;
  referralLink: string | null;
  canChangeCode: boolean;
  currentTermsVersion: number | null;
  acceptedTermsVersion: number | null;
  mustAcceptTerms: boolean;
  rewardType: 'CREDIT' | 'CASH';
  terms: ReferralTerms | null;
  counters: { clicks: number; signedUp: number; inTrial: number; customers: number };
  credit: { available: number; pending: number; nextAvailableAt: string | null; currency: string } | null;
  trackingDays: number | null;
  dailyInvitationLimit: number | null;
}

export interface ReferralRulesText {
  currentVersion: number | null;
  text: string | null;
  publishedAt: string | null;
  acceptedVersion: number | null;
}

export type ReferralStatus = 'INVITED' | 'INVITATION_EXPIRED' | 'TRIAL' | 'CUSTOMER' | 'CANCELLED' | 'ENDED' | 'NO_CONVERSION' | 'DETACHED';

export interface ReferralRow {
  id: number;
  kind: 'REFERRAL' | 'INVITATION';
  firstName: string | null;
  initial: string | null;
  status: ReferralStatus;
  signedUpAt: string | null;
  commissionsUntil: string | null;
  earned: number;
  currency: string | null;
}

export interface TimelineItem {
  type: 'SIGNED_UP' | 'BECAME_CUSTOMER' | 'COMMISSION' | 'TAKEN_BACK';
  at: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  reason: string | null;
}

export interface EarningRow {
  id: number;
  type: 'COMMISSION' | 'REVERSAL';
  referredFirstName: string | null;
  referredInitial: string | null;
  date: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'FROZEN';
  availableAt: string | null;
  /** REFUNDED, UNDER_REVIEW, INVOICE_CANCELLED, CANCELLED. */
  reason: string | null;
}

export interface CreditSummary {
  available: number;
  pending: number;
  nextAvailableAt: string | null;
  used: number;
  currency: string;
  expiresAt: string | null;
  deductionEnabled: boolean;
}

export interface CreditMovement {
  id: number;
  type: 'COMMISSION_APPROVED' | 'REVERSAL' | 'APPLIED_TO_INVOICE' | 'RESTORED' | 'EXPIRED' | 'FORFEITED';
  amount: number;
  currency: string;
  invoiceId: number | null;
  commissionId: number | null;
  referredFirstName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PageOf<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface InviteResult {
  sent: number;
  invalid: string[];
  remainingToday: number;
}

/** AFF-41: what a coach who became a collaborator sees of its money, file and payouts. */
export interface PartnerAccount {
  id: number;
  holder: string | null;
  bankName: string | null;
  masked: string | null;
  status: 'CHECKING' | 'VERIFIED' | 'REFUSED';
  reason: string | null;
}

export interface PartnerOverview {
  money: { toPay: number; pending: number; paid: number; threshold: number; missingToThreshold: number; nextPayoutDay: string; currency: string };
  file: { contractSignedAt: string | null; identityVerifiedAt: string | null; account: PartnerAccount | null; readyForPayout: boolean;
    missing: string[] };
}

export interface PartnerPayout {
  id: number;
  period: string;
  total: number;
  withholding: number | null;
  netPaid: number | null;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  method: string | null;
  accountMasked: string | null;
  paidOn: string | null;
  reference: string | null;
}

export interface PartnerStatement {
  period: string;
  validated: number;
  takenBack: number;
  paid: number;
  balanceAfter: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly url = `${environment.baseApiUrl}/api/referral`;
  private readonly headers = { 'X-Skip-Toast': 'true' };

  constructor(private http: HttpClient) {}

  state(): Observable<ReferralState> {
    return this.http.get<ReferralState>(`${this.url}/state`, { headers: this.headers });
  }

  rulesText(): Observable<ReferralRulesText> {
    return this.http.get<ReferralRulesText>(`${this.url}/terms`, { headers: this.headers });
  }

  activate(termsVersion: number): Observable<unknown> {
    return this.http.post(`${this.url}/activate`, { termsVersion }, { headers: this.headers });
  }

  referrals(status: ReferralStatus | null, page: number, size: number): Observable<PageOf<ReferralRow>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<PageOf<ReferralRow>>(`${this.url}/referrals`, { params, headers: this.headers });
  }

  referral(id: number): Observable<{ referral: ReferralRow; timeline: TimelineItem[] }> {
    return this.http.get<{ referral: ReferralRow; timeline: TimelineItem[] }>(`${this.url}/referrals/${id}`, { headers: this.headers });
  }

  earnings(page: number, size: number): Observable<PageOf<EarningRow>> {
    return this.http.get<PageOf<EarningRow>>(`${this.url}/earnings`, { params: { page, size }, headers: this.headers });
  }

  credit(): Observable<CreditSummary> {
    return this.http.get<CreditSummary>(`${this.url}/credit`, { headers: this.headers });
  }

  creditHistory(page: number, size: number): Observable<PageOf<CreditMovement>> {
    return this.http.get<PageOf<CreditMovement>>(`${this.url}/credit/history`, { params: { page, size }, headers: this.headers });
  }

  codeAvailability(code: string): Observable<{ code: string; availability: 'AVAILABLE' | 'TAKEN' | 'INVALID_FORMAT' | 'RESERVED' }> {
    return this.http.get<{ code: string; availability: 'AVAILABLE' | 'TAKEN' | 'INVALID_FORMAT' | 'RESERVED' }>(
      `${this.url}/code-availability`, { params: { code }, headers: this.headers });
  }

  changeCode(code: string): Observable<{ code: string; referralLink: string }> {
    return this.http.put<{ code: string; referralLink: string }>(`${this.url}/code`, { code }, { headers: this.headers });
  }

  /** AFF-12: a coach who signed up without the code; the answer is SENT or TOO_LATE, never more. */
  reportMissing(email: string, signupDay: string, note: string | null): Observable<{ answer: 'SENT' | 'TOO_LATE' }> {
    return this.http.post<{ answer: 'SENT' | 'TOO_LATE' }>(`${this.url}/missing-referral`, { email, signupDay, note }, { headers: this.headers });
  }

  partner(): Observable<PartnerOverview> {
    return this.http.get<PartnerOverview>(`${this.url}/partner`, { headers: this.headers });
  }

  partnerPayouts(): Observable<PartnerPayout[]> {
    return this.http.get<PartnerPayout[]>(`${this.url}/partner/payouts`, { headers: this.headers });
  }

  partnerStatement(month: string): Observable<PartnerStatement> {
    return this.http.get<PartnerStatement>(`${this.url}/partner/statement`, { params: { month }, headers: this.headers });
  }

  savePartnerAccount(holder: string, bankName: string | null, iban: string): Observable<PartnerAccount> {
    return this.http.put<PartnerAccount>(`${this.url}/partner/payout-account`, { holder, bankName, iban }, { headers: this.headers });
  }

  invite(emails: string[], message: string | null): Observable<InviteResult> {
    return this.http.post<InviteResult>(`${this.url}/invitations`, { emails, message }, { headers: this.headers });
  }
}

/** "26.7" → "26,70 DT"; "13.351" → "13,351 DT" (the dinar keeps its millimes when it has some). */
export function formatMoney(amount: number | null | undefined, currency = 'TND', signed = false): string {
  const value = Number(amount ?? 0);
  const fixed = value.toFixed(3).replace(/0$/, '');
  const text = (signed && value > 0 ? '+' : '') + fixed.replace('.', ',').replace('-', '−');
  return `${text} ${currency === 'TND' ? 'DT' : currency}`;
}

/** The code of a refusal of the server ({code}), or null. */
export function errorCode(error: any): string | null {
  return error?.error?.code ?? null;
}
