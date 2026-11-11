import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import * as QRCode from 'qrcode';
import {
  CreditMovement, CreditSummary, EarningRow, PartnerOverview, PartnerPayout, PartnerStatement, ReferralRow, ReferralRulesText,
  ReferralService, ReferralState, ReferralStatus, TimelineItem, errorCode, formatMoney,
} from '../../service/referral.service';
import { CoachSubscriptionStateService } from '../../service/coach-subscription-state.service';

registerLocaleData(localeFr);

type Tab = 'OVERVIEW' | 'REFERRALS' | 'EARNINGS' | 'PAYOUTS';
type Dialog = 'INVITE' | 'SHARE' | 'QR' | 'CODE' | 'RULES' | 'DETAIL' | 'MISSING' | 'ACCOUNT' | null;

/**
 * AFF-22 to AFF-27: the referral page of a coach. Before activation: how it works, an example computed from the terms
 * of the program, the rules to accept. After: link and code (share, QR code, own code once), credit, counters, the
 * referred coaches (first name and initial only) and the rewards.
 */
@Component({
  selector: 'app-referral',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, FeatherModule],
  templateUrl: './referral.component.html',
  styleUrl: './referral.component.scss',
})
export class ReferralComponent implements OnInit {
  readonly pageSize = 10;
  readonly statuses: ReferralStatus[] = ['INVITED', 'TRIAL', 'CUSTOMER', 'CANCELLED', 'ENDED', 'NO_CONVERSION', 'INVITATION_EXPIRED'];

  tab: Tab = 'OVERVIEW';
  dialog: Dialog = null;
  loading = true;
  loadError = false;
  state: ReferralState | null = null;

  // activation
  rules: ReferralRulesText | null = null;
  accepted = false;
  activating = false;
  activationError = '';

  // overview
  latestReferrals: ReferralRow[] = [];
  latestEarnings: EarningRow[] = [];
  copied: 'LINK' | 'CODE' | null = null;

  // referrals
  referrals: ReferralRow[] = [];
  referralsTotal = 0;
  referralsPage = 0;
  statusFilter: ReferralStatus | '' = '';
  search = '';
  referralsLoading = false;
  referralsError = false;
  detail: { referral: ReferralRow; timeline: TimelineItem[] } | null = null;

  // earnings
  credit: CreditSummary | null = null;
  earnings: EarningRow[] = [];
  earningsTotal = 0;
  earningsPage = 0;
  movements: CreditMovement[] = [];
  earningsLoading = false;
  earningsError = false;

  // dialogs
  inviteEmails = '';
  inviteMessage = '';
  inviteSending = false;
  inviteResult = '';
  inviteError = '';
  qrDataUrl = '';
  newCode = '';
  codeCheck: 'AVAILABLE' | 'TAKEN' | 'INVALID_FORMAT' | 'RESERVED' | 'CHECKING' | null = null;
  codeError = '';

  // AFF-12: a missing referred coach
  missingEmail = '';
  missingDay = '';
  missingNote = '';
  missingSending = false;
  missingResult = '';
  missingError = '';

  // AFF-41: a coach who became a collaborator
  partner: PartnerOverview | null = null;
  payouts: PartnerPayout[] = [];
  month = this.lastMonth();
  statement: PartnerStatement | null = null;
  holder = '';
  bankName = '';
  iban = '';
  accountSaving = false;
  accountError = '';

  /** AFF-28: the tab asked by the link (?tab=EARNINGS from "My subscription"), opened once the page is loaded. */
  private askedTab: Tab | null = null;

  constructor(private referral: ReferralService, private translate: TranslateService,
              private subscriptionState: CoachSubscriptionStateService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    this.askedTab = tab === 'REFERRALS' || tab === 'EARNINGS' ? tab : null;
    this.load();
  }

  // ---------------------------------------------------------------- state

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.referral.state().subscribe({
      next: (state) => {
        this.state = state;
        this.loading = false;
        if (!state.activated || state.mustAcceptTerms) {
          this.loadRules();
        }
        if (state.activated) {
          this.loadOverview();
          this.inviteMessage = this.translate.instant('REFERRAL_PAGE.INVITE_DEFAULT_MESSAGE');
          if (this.askedTab) {
            this.selectTab(this.askedTab);
            this.askedTab = null;
          }
        }
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  /** Month names in the language of the coach ("octobre 2026"). */
  get locale(): string {
    return (this.translate.currentLang || this.translate.defaultLang) === 'en' ? 'en-US' : 'fr';
  }

  get isCash(): boolean {
    return this.state?.rewardType === 'CASH';
  }

  /** "15 %" of what the referred coach pays, or a fixed amount once. */
  get rewardText(): string {
    const t = this.state?.terms;
    if (!t) return '';
    return t.rewardMode === 'FIXED' ? formatMoney(t.fixedAmount, t.currency) : `${t.ratePercent} %`;
  }

  get durationText(): string {
    const t = this.state?.terms;
    if (!t) return '';
    if (t.durationMode === 'WHILE_PAYING') return this.translate.instant('REFERRAL_PAGE.DURATION_WHILE_PAYING');
    return this.translate.instant(t.durationMode === 'MONTHS' ? 'REFERRAL_PAGE.DURATION_MONTHS' : 'REFERRAL_PAGE.DURATION_PAYMENTS',
      { n: t.durationValue });
  }

  /** The example of the presentation: what 100 DT paid by a referred coach brings. */
  get exampleAmount(): string {
    const t = this.state?.terms;
    if (!t) return '';
    return t.rewardMode === 'FIXED' ? formatMoney(t.fixedAmount, t.currency) : formatMoney((100 * (t.ratePercent ?? 0)) / 100, t.currency);
  }

  /** Why the link brings nobody right now (null when it works). */
  get blockedReason(): string | null {
    const a = this.state?.availability;
    if (!this.state?.activated || !a || a === 'OK') return null;
    return ({
      PROGRAM_DISABLED: 'REFERRAL_PAGE.BLOCKED_PROGRAM',
      AFFILIATE_NOT_ACTIVE: 'REFERRAL_PAGE.BLOCKED_SUSPENDED',
      TERMS_NOT_ACCEPTED: 'REFERRAL_PAGE.BLOCKED_TERMS',
      COACH_READ_ONLY: 'REFERRAL_PAGE.BLOCKED_READ_ONLY',
    } as Record<string, string>)[a] ?? 'REFERRAL_PAGE.BLOCKED_PROGRAM';
  }

  /** A balance below zero (a reward taken back after the credit was spent) is shown as 0: it is never asked for. */
  positive(amount: number | null | undefined): number {
    return Math.max(0, Number(amount ?? 0));
  }

  money(amount: number | null | undefined, signed = false): string {
    return formatMoney(amount, this.state?.credit?.currency ?? this.credit?.currency ?? 'TND', signed);
  }

  // ---------------------------------------------------------------- activation (AFF-23)

  loadRules(): void {
    this.referral.rulesText().subscribe({ next: (r) => (this.rules = r), error: () => (this.rules = null) });
  }

  activate(): void {
    if (!this.rules?.currentVersion || !this.accepted) return;
    this.activating = true;
    this.activationError = '';
    this.referral.activate(this.rules.currentVersion).subscribe({
      next: () => {
        this.activating = false;
        this.accepted = false;
        this.dialog = null;
        this.load();
        this.subscriptionState.refresh().subscribe();
      },
      error: (e) => {
        this.activating = false;
        const code = errorCode(e);
        this.activationError = this.translate.instant(code === 'COACH_READ_ONLY' ? 'REFERRAL_PAGE.BLOCKED_READ_ONLY'
          : code === 'TERMS_VERSION_OUTDATED' ? 'REFERRAL_PAGE.ERROR_TERMS_CHANGED'
          : code === 'PROGRAM_UNAVAILABLE' || code === 'TERMS_NOT_PUBLISHED' ? 'REFERRAL_PAGE.PROGRAM_UNAVAILABLE'
          : 'REFERRAL_PAGE.ERROR_GENERIC');
        if (code === 'TERMS_VERSION_OUTDATED') this.loadRules();
      },
    });
  }

  // ---------------------------------------------------------------- overview (AFF-24)

  loadOverview(): void {
    this.referral.referrals(null, 0, 3).subscribe({ next: (p) => (this.latestReferrals = p.items), error: () => (this.latestReferrals = []) });
    this.referral.earnings(0, 3).subscribe({ next: (p) => (this.latestEarnings = p.items), error: () => (this.latestEarnings = []) });
    if (!this.isCash) {
      this.referral.credit().subscribe({ next: (c) => (this.credit = c), error: () => (this.credit = null) });
    } else {
      this.loadPartner();
    }
  }

  // ---------------------------------------------------------------- collaborator (AFF-41)

  loadPartner(): void {
    this.referral.partner().subscribe({ next: (p) => (this.partner = p), error: () => (this.partner = null) });
  }

  loadPayouts(): void {
    this.referral.partnerPayouts().subscribe({ next: (p) => (this.payouts = p), error: () => (this.payouts = []) });
    this.loadStatement();
  }

  loadStatement(): void {
    this.referral.partnerStatement(this.month).subscribe({ next: (s) => (this.statement = s), error: () => (this.statement = null) });
  }

  /** Share of the payout threshold already reached, 0 to 100. */
  get progress(): number {
    const m = this.partner?.money;
    if (!m || !m.threshold || m.threshold <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((m.toPay / m.threshold) * 100)));
  }

  get needsAccount(): boolean {
    const account = this.partner?.file.account;
    return !!this.partner && (!account || account.status === 'REFUSED');
  }

  /** The last twelve months, for the statement. */
  get months(): string[] {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  get ibanValid(): boolean {
    return /^(\d{20}|[A-Z]{2}\d{2}[A-Z0-9]{10,30})$/.test(this.iban.replace(/[\s-]/g, '').toUpperCase());
  }

  saveAccount(): void {
    if (this.holder.trim().length < 3 || !this.ibanValid) return;
    this.accountSaving = true;
    this.accountError = '';
    this.referral.savePartnerAccount(this.holder.trim(), this.bankName.trim() || null, this.iban).subscribe({
      next: () => {
        this.accountSaving = false;
        this.dialog = null;
        this.loadPartner();
      },
      error: (e) => {
        this.accountSaving = false;
        const code = errorCode(e);
        this.accountError = this.translate.instant(code === 'ACCOUNT_INVALID' ? 'REFERRAL_PAGE.ACCOUNT_INVALID'
          : code === 'HOLDER_REQUIRED' ? 'REFERRAL_PAGE.HOLDER_REQUIRED' : 'REFERRAL_PAGE.ERROR_GENERIC');
      },
    });
  }

  private lastMonth(): string {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- missing referred coach (AFF-12)

  /** No earlier than 30 days ago, no later than today (the form says so; the server checks it again). */
  get missingMin(): string {
    return this.isoDay(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  }

  get missingMax(): string {
    return this.isoDay(new Date());
  }

  sendMissing(): void {
    if (!this.missingEmail.trim() || !this.missingDay) return;
    this.missingSending = true;
    this.missingError = '';
    this.missingResult = '';
    this.referral.reportMissing(this.missingEmail.trim(), this.missingDay, this.missingNote.trim() || null).subscribe({
      next: (r) => {
        this.missingSending = false;
        if (r.answer === 'TOO_LATE') {
          this.missingError = this.translate.instant('REFERRAL_PAGE.MISSING_TOO_LATE');
        } else {
          this.missingResult = this.translate.instant('REFERRAL_PAGE.MISSING_SENT');
          this.missingEmail = '';
          this.missingNote = '';
        }
      },
      error: (e) => {
        this.missingSending = false;
        const code = errorCode(e);
        this.missingError = this.translate.instant(code === 'REQUEST_LIMIT' ? 'REFERRAL_PAGE.MISSING_LIMIT'
          : code === 'EMAIL_INVALID' ? 'REFERRAL_PAGE.MISSING_EMAIL' : 'REFERRAL_PAGE.ERROR_GENERIC');
      },
    });
  }

  private isoDay(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get shortLink(): string {
    return (this.state?.referralLink ?? '').replace(/^https?:\/\//, '');
  }

  copy(what: 'LINK' | 'CODE'): void {
    const text = what === 'LINK' ? this.state?.referralLink : this.state?.code;
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      this.copied = what;
      setTimeout(() => (this.copied = null), 2000);
    });
  }

  selectTab(tab: Tab): void {
    this.tab = tab;
    if (tab === 'REFERRALS' && !this.referrals.length) this.loadReferrals(0);
    if (tab === 'EARNINGS') this.loadEarnings(0);
    if (tab === 'PAYOUTS') this.loadPayouts();
  }

  // ---------------------------------------------------------------- referrals (AFF-26)

  loadReferrals(page: number): void {
    this.referralsLoading = true;
    this.referralsError = false;
    this.referral.referrals(this.statusFilter || null, page, this.pageSize).subscribe({
      next: (p) => {
        this.referrals = p.items;
        this.referralsTotal = p.total;
        this.referralsPage = p.page;
        this.referralsLoading = false;
      },
      error: () => {
        this.referralsLoading = false;
        this.referralsError = true;
      },
    });
  }

  /** The search looks at the names of the page shown (first name and initial only). */
  get shownReferrals(): ReferralRow[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.referrals.filter((r) => `${r.firstName ?? ''} ${r.initial ?? ''}`.toLowerCase().includes(q)) : this.referrals;
  }

  get referralPages(): number {
    return Math.max(1, Math.ceil(this.referralsTotal / this.pageSize));
  }

  openDetail(row: ReferralRow): void {
    if (row.kind !== 'REFERRAL') return;
    this.referral.referral(row.id).subscribe({ next: (d) => { this.detail = d; this.dialog = 'DETAIL'; } });
  }

  initials(row: { firstName: string | null; initial: string | null }): string {
    return `${(row.firstName ?? '?').charAt(0)}${(row.initial ?? '').charAt(0)}`.toUpperCase();
  }

  name(row: { firstName: string | null; initial: string | null }): string {
    return `${row.firstName ?? ''} ${row.initial ?? ''}`.trim() || '—';
  }

  statusClass(status: string): string {
    return ({ CUSTOMER: 'ok', TRIAL: 'wait', INVITED: 'muted', INVITATION_EXPIRED: 'muted', CANCELLED: 'bad', ENDED: 'muted',
      NO_CONVERSION: 'muted', DETACHED: 'bad' } as Record<string, string>)[status] ?? 'muted';
  }

  // ---------------------------------------------------------------- earnings (AFF-27)

  loadEarnings(page: number): void {
    this.earningsLoading = true;
    this.earningsError = false;
    this.referral.earnings(page, this.pageSize).subscribe({
      next: (p) => {
        this.earnings = p.items;
        this.earningsTotal = p.total;
        this.earningsPage = p.page;
        this.earningsLoading = false;
      },
      error: () => {
        this.earningsLoading = false;
        this.earningsError = true;
      },
    });
    if (!this.isCash && page === 0) {
      this.referral.credit().subscribe({ next: (c) => (this.credit = c), error: () => (this.credit = null) });
      this.referral.creditHistory(0, 10).subscribe({ next: (p) => (this.movements = p.items), error: () => (this.movements = []) });
    }
  }

  get earningPages(): number {
    return Math.max(1, Math.ceil(this.earningsTotal / this.pageSize));
  }

  /** The credit expires within the next month (shown as a warning). */
  get expiresSoon(): boolean {
    if (!this.credit?.expiresAt || !this.credit.available || this.credit.available <= 0) return false;
    return new Date(this.credit.expiresAt).getTime() - Date.now() < 31 * 24 * 3600 * 1000;
  }

  earningLabel(row: EarningRow): string {
    if (row.type === 'REVERSAL') return this.translate.instant('REFERRAL_PAGE.EARNING_REVERSAL');
    switch (row.status) {
      case 'PENDING': return this.translate.instant('REFERRAL_PAGE.EARNING_PENDING');
      case 'APPROVED': return this.translate.instant(this.isCash ? 'REFERRAL_PAGE.EARNING_APPROVED_CASH' : 'REFERRAL_PAGE.EARNING_APPROVED');
      case 'PAID': return this.translate.instant('REFERRAL_PAGE.EARNING_PAID');
      case 'FROZEN': return this.translate.instant('REFERRAL_PAGE.EARNING_UNDER_REVIEW');
      default: return this.translate.instant(row.reason === 'REFUNDED' ? 'REFERRAL_PAGE.EARNING_CANCELLED_REFUND'
        : row.reason === 'INVOICE_CANCELLED' ? 'REFERRAL_PAGE.EARNING_CANCELLED_INVOICE' : 'REFERRAL_PAGE.EARNING_CANCELLED');
    }
  }

  earningClass(row: EarningRow): string {
    if (row.type === 'REVERSAL') return 'bad';
    return ({ PENDING: 'wait', APPROVED: 'ok', PAID: 'ok', FROZEN: 'wait', CANCELLED: 'muted' } as Record<string, string>)[row.status];
  }

  movementLabel(m: CreditMovement): string {
    return this.translate.instant('REFERRAL_PAGE.MOVEMENT_' + m.type, { invoice: m.invoiceId, name: m.referredFirstName ?? '' });
  }

  // ---------------------------------------------------------------- dialogs (AFF-24, AFF-25)

  open(dialog: Dialog): void {
    this.dialog = dialog;
    if (dialog === 'INVITE') {
      this.inviteResult = '';
      this.inviteError = '';
    }
    if (dialog === 'QR' && this.state?.referralLink) {
      QRCode.toDataURL(this.state.referralLink, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
        .then((url) => (this.qrDataUrl = url))
        .catch(() => (this.qrDataUrl = ''));
    }
    if (dialog === 'MISSING') {
      this.missingResult = '';
      this.missingError = '';
      this.missingDay = this.missingDay || this.missingMax;
    }
    if (dialog === 'ACCOUNT') {
      const account = this.partner?.file.account;
      this.holder = account?.holder ?? '';
      this.bankName = account?.bankName ?? '';
      this.iban = '';
      this.accountError = '';
    }
    if (dialog === 'CODE') {
      this.newCode = '';
      this.codeCheck = null;
      this.codeError = '';
    }
  }

  close(): void {
    this.dialog = null;
    this.detail = null;
  }

  get inviteAddresses(): string[] {
    return this.inviteEmails.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.length > 0);
  }

  sendInvitations(): void {
    const emails = this.inviteAddresses;
    if (!emails.length) return;
    this.inviteSending = true;
    this.inviteError = '';
    this.referral.invite(emails, this.inviteMessage.trim() || null).subscribe({
      next: (r) => {
        this.inviteSending = false;
        this.inviteEmails = r.invalid.join('\n');
        this.inviteResult = this.translate.instant('REFERRAL_PAGE.INVITE_SENT', { sent: r.sent, left: r.remainingToday })
          + (r.invalid.length ? ' ' + this.translate.instant('REFERRAL_PAGE.INVITE_INVALID', { emails: r.invalid.join(', ') }) : '');
      },
      error: (e) => {
        this.inviteSending = false;
        const code = errorCode(e);
        this.inviteError = this.translate.instant(code === 'INVITATION_LIMIT' ? 'REFERRAL_PAGE.INVITE_LIMIT'
          : code === 'INVITATION_EMAILS_INVALID' ? 'REFERRAL_PAGE.INVITE_TOO_MANY'
          : code?.startsWith('REFERRAL_') ? 'REFERRAL_PAGE.INVITE_BLOCKED' : 'REFERRAL_PAGE.ERROR_GENERIC');
      },
    });
  }

  shareUrl(network: 'WHATSAPP' | 'FACEBOOK' | 'LINKEDIN' | 'EMAIL'): string {
    const link = this.state?.referralLink ?? '';
    const text = this.translate.instant('REFERRAL_PAGE.SHARE_TEXT');
    switch (network) {
      case 'WHATSAPP': return `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
      case 'FACEBOOK': return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
      case 'LINKEDIN': return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
      default: return `mailto:?subject=${encodeURIComponent(this.translate.instant('REFERRAL_PAGE.SHARE_SUBJECT'))}&body=${encodeURIComponent(text + '\n' + link)}`;
    }
  }

  printQr(): void {
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win || !this.qrDataUrl) return;
    const title = this.translate.instant('REFERRAL_PAGE.QR_PRINT_TITLE');
    win.document.write(`<html><head><title>${title}</title></head><body style="font-family:sans-serif;text-align:center;padding:32px">
      <h2>${title}</h2><img src="${this.qrDataUrl}" style="width:280px"/><p style="font-size:18px">${this.shortLink}</p>
      <p>Code : <strong>${this.state?.code ?? ''}</strong></p></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  checkCode(): void {
    const code = this.newCode.trim();
    if (!code) return;
    this.codeCheck = 'CHECKING';
    this.referral.codeAvailability(code).subscribe({
      next: (r) => (this.codeCheck = r.availability),
      error: () => (this.codeCheck = null),
    });
  }

  saveCode(): void {
    this.codeError = '';
    this.referral.changeCode(this.newCode.trim()).subscribe({
      next: () => {
        this.dialog = null;
        this.load();
      },
      error: (e) => {
        const code = errorCode(e);
        this.codeError = this.translate.instant(code === 'CODE_ALREADY_CHANGED' ? 'REFERRAL_PAGE.CODE_ALREADY_CHANGED'
          : code === 'CODE_TAKEN' ? 'REFERRAL_PAGE.CODE_TAKEN'
          : code === 'CODE_RESERVED' ? 'REFERRAL_PAGE.CODE_RESERVED'
          : code === 'CODE_INVALID_FORMAT' ? 'REFERRAL_PAGE.CODE_FORMAT' : 'REFERRAL_PAGE.ERROR_GENERIC');
      },
    });
  }
}
