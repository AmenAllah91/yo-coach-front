import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil, throwError } from 'rxjs';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { InvitationService } from 'app/service/invitation.service';
import {
  CoachWebsiteLead,
  CoachWebsiteLeadSummary,
  LeadSource,
  LeadStatus,
  PageResponse,
  WebsiteService,
} from 'app/service/website.service';
import { AddClientModalComponent } from '../../clients/add-client-modal/add-client-modal.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type StatusFilter = LeadStatus | '';
type SourceFilter = LeadSource | '';

/** Inbox of the prospects sent by the coach's contact form and website. */
@Component({
  selector: 'app-website-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, RouterModule, AddClientModalComponent, TranslateModule],
  templateUrl: './website-leads.component.html',
  styleUrls: ['./website-leads.component.scss'],
})
export class WebsiteLeadsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();
  private messageTimer?: ReturnType<typeof setTimeout>;

  readonly statusFilters: { value: StatusFilter; label: string; tone: string }[] = [
    { value: '', label: 'LEADS_FILTER_ALL', tone: 'all' },
    { value: 'NEW', label: 'LEADS_FILTER_NEW', tone: 'new' },
    { value: 'INVITED', label: 'LEADS_FILTER_INVITED', tone: 'invited' },
    { value: 'DECLINED', label: 'LEADS_FILTER_DECLINED', tone: 'declined' },
  ];
  readonly sourceFilters: { value: SourceFilter; label: string }[] = [
    { value: '', label: 'LEADS_SOURCE_ALL' },
    { value: 'CONTACT_FORM', label: 'LEADS_SOURCE_CONTACT_FORM' },
    { value: 'COACH_WEBSITE', label: 'LEADS_SOURCE_WEBSITE' },
  ];

  leads: CoachWebsiteLead[] = [];
  summary: CoachWebsiteLeadSummary | null = null;
  searchTerm = '';
  status: StatusFilter = '';
  source: SourceFilter = '';
  loading = false;
  loadError = false;
  page = 0;
  readonly size = 10;
  totalElements = 0;
  totalPages = 0;
  processingLeadId: string | null = null;
  actionMessage = '';
  actionError = '';
  openMenuId: string | null = null;
  expandedIds = new Set<string>();
  highlightedLeadId: string | null = null;
  showInviteModal = false;

  constructor(
    private websiteService: WebsiteService,
    private invitationService: InvitationService,
    private route: ActivatedRoute,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.highlightedLeadId = query.get('leadId');
    const source = query.get('source');
    if (source === 'CONTACT_FORM' || source === 'COACH_WEBSITE') this.source = source;
    this.loadLeads();
    this.loadSummary();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 0;
        this.loadLeads();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.messageTimer);
  }

  goBack(): void { window.history.back(); }

  get hasFilters(): boolean {
    return !!this.searchTerm.trim() || !!this.status || !!this.source;
  }

  countFor(filter: StatusFilter): number | null {
    if (!this.summary) return null;
    switch (filter) {
      case 'NEW': return this.summary.newCount;
      case 'INVITED': return this.summary.invited;
      case 'DECLINED': return this.summary.declined;
      default: return this.summary.total;
    }
  }

  loadLeads(): void {
    this.loading = true;
    this.loadError = false;
    this.websiteService.getMyLeads(this.searchTerm.trim(), this.page, this.size, this.status, this.source)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: PageResponse<CoachWebsiteLead>) => {
          this.leads = res.content;
          this.totalElements = res.totalElements;
          this.totalPages = res.totalPages;
          this.page = res.number;
          this.loading = false;
          if (this.highlightedLeadId && this.leads.some((lead) => lead.id === this.highlightedLeadId)) {
            this.expandedIds.add(this.highlightedLeadId);
            setTimeout(() => document.getElementById(`lead-${this.highlightedLeadId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
          }
        },
        error: () => {
          this.leads = [];
          this.loadError = true;
          this.loading = false;
        },
      });
  }

  loadSummary(): void {
    this.websiteService.getMyLeadsSummary().pipe(takeUntil(this.destroy$)).subscribe({
      next: (summary) => (this.summary = summary),
      error: () => (this.summary = null),
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  setStatus(status: StatusFilter): void {
    if (this.status === status) return;
    this.status = status;
    this.page = 0;
    this.loadLeads();
  }

  setSource(source: SourceFilter): void {
    if (this.source === source) return;
    this.source = source;
    this.page = 0;
    this.loadLeads();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.status = '';
    this.source = '';
    this.page = 0;
    this.loadLeads();
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: Event): void {
    if (!(event.target as HTMLElement).closest('.lead-menu')) this.openMenuId = null;
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.openMenuId = null;
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  toggleMessage(id: string): void {
    if (this.expandedIds.has(id)) this.expandedIds.delete(id); else this.expandedIds.add(id);
  }

  isLongMessage(lead: CoachWebsiteLead): boolean {
    const message = lead.message || '';
    return message.length > 220 || message.split('\n').length > 3;
  }

  copy(value: string | undefined, key: 'EMAIL_COPIED' | 'PHONE_COPIED'): void {
    this.openMenuId = null;
    if (!value) return;
    navigator.clipboard.writeText(value)
      .then(() => this.showMessage(this.translate.instant(key)))
      .catch(() => undefined);
  }

  /** wa.me needs the international number: a local 8-digit number is taken as Tunisian. */
  whatsappUrl(phone?: string): string | null {
    let digits = (phone || '').replace(/[^\d+]/g, '');
    if (!digits) return null;
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 8) digits = `216${digits}`;
    digits = digits.replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }

  telUrl(phone?: string): string {
    return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
  }

  mailUrl(lead: CoachWebsiteLead): string {
    const subject = this.translate.instant('LEAD_EMAIL_SUBJECT');
    return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}`;
  }

  openInviteModal(): void {
    this.actionError = '';
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  onNewLeadInvited(event: { email: string }): void {
    this.showInviteModal = false;
    this.showMessage(this.translate.instant('INVITATION_SENT_TO', { email: event.email }));
  }

  invite(lead: CoachWebsiteLead): void {
    this.openMenuId = null;
    if (!lead.email || this.processingLeadId) return;
    const coachId = sessionStorage.getItem('userId') || lead.coachId;
    if (!coachId) {
      this.actionError = this.translate.instant('COACH_ACCOUNT_NOT_FOUND');
      return;
    }

    this.startAction(lead.id);
    const email = lead.email.trim();
    this.invitationService.generateInvitation({ email, idCoach: coachId }).pipe(
      switchMap((invitation) =>
        this.invitationService.sendInvitation(invitation.invitationLink, coachId, email).pipe(
          catchError((error) => this.invitationService.deleteInvitationByToken(invitation.invitationLink).pipe(
            catchError(() => throwError(() => error)),
            switchMap(() => throwError(() => error)),
          )),
        ),
      ),
      switchMap(() => this.websiteService.updateLeadStatus(lead.id, 'INVITED')),
      finalize(() => (this.processingLeadId = null)),
    ).subscribe({
      next: (updated) => {
        this.replaceLead(updated);
        this.showMessage(this.translate.instant('INVITATION_SENT_TO', { email }));
      },
      error: () => (this.actionError = this.translate.instant('INVITATION_SEND_ERROR')),
    });
  }

  setLeadStatus(lead: CoachWebsiteLead, status: LeadStatus): void {
    this.openMenuId = null;
    if (this.processingLeadId) return;
    this.startAction(lead.id);
    this.websiteService.updateLeadStatus(lead.id, status)
      .pipe(finalize(() => (this.processingLeadId = null)))
      .subscribe({
        next: (updated) => {
          this.replaceLead(updated);
          this.showMessage(this.translate.instant(status === 'DECLINED' ? 'LEAD_DECLINED' : 'LEAD_RESTORED'));
        },
        error: () => (this.actionError = this.translate.instant('LEAD_STATUS_ERROR')),
      });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page) return;
    this.page = page;
    this.loadLeads();
    document.querySelector('.leads-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  getLeadFullName(lead: CoachWebsiteLead): string {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || this.translate.instant('UNKNOWN_LEAD');
  }

  initials(lead: CoachWebsiteLead): string {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email || '?';
    return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  statusOf(lead: CoachWebsiteLead): LeadStatus {
    return lead.status || 'NEW';
  }

  sourceLabel(lead: CoachWebsiteLead): string {
    return lead.sourceType === 'CONTACT_FORM' ? 'LEADS_SOURCE_CONTACT_FORM' : 'LEADS_SOURCE_WEBSITE';
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString(this.locale, {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  getElapsedTime(date?: string): string {
    if (!date) return '';
    const value = new Date(date);
    const diff = Math.max(0, Date.now() - value.getTime());
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;
    if (diff < minute) return this.translate.instant('JUST_NOW');
    if (diff < hour) return this.translate.instant('LEAD_MINUTES_AGO', { count: Math.floor(diff / minute) });
    if (diff < day && value.toDateString() === new Date().toDateString()) {
      return this.translate.instant('LEAD_HOURS_AGO', { count: Math.floor(diff / hour) });
    }
    const days = Math.max(1, Math.floor(diff / day));
    if (days < 7) return this.translate.instant(days === 1 ? 'DAY_AGO' : 'DAYS_AGO', { count: days });
    return value.toLocaleDateString(this.locale, { day: 'numeric', month: 'short' });
  }

  trackById(_: number, lead: CoachWebsiteLead): string {
    return lead.id;
  }

  private get locale(): string {
    return this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US';
  }

  private startAction(id: string): void {
    this.processingLeadId = id;
    this.actionMessage = '';
    this.actionError = '';
  }

  private showMessage(message: string): void {
    this.actionError = '';
    this.actionMessage = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => (this.actionMessage = ''), 4000);
  }

  /** The counters follow the change without reloading the list (the lead stays visible until the next load). */
  private replaceLead(updated: CoachWebsiteLead): void {
    const previous = this.leads.find((lead) => lead.id === updated.id);
    this.leads = this.leads.map((lead) => lead.id === updated.id ? updated : lead);
    if (previous && this.summary && previous.status !== updated.status) {
      const key = (status?: LeadStatus) => status === 'INVITED' ? 'invited' : status === 'DECLINED' ? 'declined' : 'newCount';
      this.summary = {
        ...this.summary,
        [key(previous.status)]: this.summary[key(previous.status)] - 1,
        [key(updated.status)]: this.summary[key(updated.status)] + 1,
      };
    }
  }
}
