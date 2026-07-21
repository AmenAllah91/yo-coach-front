import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { InvitationService } from 'app/service/invitation.service';
import { CoachWebsiteLead, PageResponse, WebsiteService } from 'app/service/website.service';
import { AddClientModalComponent } from '../../clients/add-client-modal/add-client-modal.component';

@Component({
  selector: 'app-website-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, AddClientModalComponent],
  templateUrl: './website-leads.component.html',
  styleUrls: ['./website-leads.component.scss'],
})
export class WebsiteLeadsComponent implements OnInit, OnDestroy {
  @Input() embedded = false;

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  leads: CoachWebsiteLead[] = [];
  searchTerm = '';
  loading = false;
  page = 0;
  size = 10;
  totalElements = 0;
  totalPages = 0;
  processingLeadId: string | null = null;
  actionMessage = '';
  actionError = '';
  openDropdownId: string | null = null;
  highlightedLeadId: string | null = null;
  showInviteModal = false;

  constructor(
    private websiteService: WebsiteService,
    private invitationService: InvitationService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.highlightedLeadId = this.route.snapshot.queryParamMap.get('leadId');
    this.loadLeads();
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
  }

  loadLeads(): void {
    this.loading = true;
    this.websiteService.getMyLeads(this.searchTerm, this.page, this.size).subscribe({
      next: (res: PageResponse<CoachWebsiteLead>) => {
        this.leads = res.content;
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.page = res.number;
        this.loading = false;
        if (this.highlightedLeadId) {
          setTimeout(() => document.getElementById(`lead-${this.highlightedLeadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
        }
      },
      error: () => {
        this.actionError = 'Unable to load leads.';
        this.loading = false;
      },
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  @HostListener('document:click', ['$event'])
  closeDropdownOnOutsideClick(event: Event): void {
    if (!(event.target as HTMLElement).closest('.dropdown')) this.openDropdownId = null;
  }

  toggleDropdown(id: string, event: Event): void {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === id ? null : id;
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  copyEmail(email: string): void {
    navigator.clipboard.writeText(email).catch(() => undefined);
    this.openDropdownId = null;
  }

  copyPhone(phone?: string): void {
    if (!phone) return;
    navigator.clipboard.writeText(phone).catch(() => undefined);
    this.openDropdownId = null;
  }

  openInviteModal(): void {
    this.actionMessage = '';
    this.actionError = '';
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  onNewLeadInvited(event: { email: string }): void {
    this.showInviteModal = false;
    this.actionMessage = `Invitation sent to ${event.email}.`;
  }

  invite(lead: CoachWebsiteLead): void {
    if (!lead.email || this.processingLeadId) return;
    const coachId = sessionStorage.getItem('userId') || lead.coachId;
    if (!coachId) {
      this.actionError = 'Coach account not found.';
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
        this.actionMessage = `Invitation sent to ${email}.`;
      },
      error: () => (this.actionError = 'The invitation could not be sent.'),
    });
  }

  decline(lead: CoachWebsiteLead): void {
    if (this.processingLeadId) return;
    this.startAction(lead.id);
    this.websiteService.updateLeadStatus(lead.id, 'DECLINED')
      .pipe(finalize(() => (this.processingLeadId = null)))
      .subscribe({
        next: (updated) => {
          this.replaceLead(updated);
          this.actionMessage = 'Lead declined.';
        },
        error: () => (this.actionError = 'The lead could not be declined.'),
      });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page) return;
    this.page = page;
    this.loadLeads();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  getLeadFullName(lead: CoachWebsiteLead): string {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'Unknown lead';
  }

  getElapsedTime(date?: string): string {
    if (!date) return '';
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    const minute = 60000;
    const day = 86400000;
    if (diff < minute) return 'Just now';
    if (diff < day && new Date(date).toDateString() === new Date().toDateString()) return 'Today';
    const days = Math.floor(diff / day);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private startAction(id: string): void {
    this.processingLeadId = id;
    this.actionMessage = '';
    this.actionError = '';
  }

  private replaceLead(updated: CoachWebsiteLead): void {
    this.leads = this.leads.map((lead) => lead.id === updated.id ? updated : lead);
  }
}
