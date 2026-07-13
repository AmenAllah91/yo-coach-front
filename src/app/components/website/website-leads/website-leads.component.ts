import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs';
import { InvitationService } from 'app/service/invitation.service';
import { CoachWebsiteLead, PageResponse, WebsiteService } from 'app/service/website.service';

@Component({
  selector: 'app-website-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
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

  constructor(
    private websiteService: WebsiteService,
    private invitationService: InvitationService,
  ) {}

  ngOnInit(): void {
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

  invite(lead: CoachWebsiteLead): void {
    if (!lead.email || this.processingLeadId) return;
    const coachId = sessionStorage.getItem('userId') || lead.coachId;
    if (!coachId) {
      this.actionError = 'Coach account not found.';
      return;
    }

    this.startAction(lead.id);
    this.invitationService.generateInvitation({ email: lead.email, idCoach: coachId }).pipe(
      switchMap((invitation) =>
        this.invitationService.sendInvitation(invitation.invitationLink, coachId, lead.email),
      ),
      switchMap(() => this.websiteService.updateLeadStatus(lead.id, 'INVITED')),
      finalize(() => (this.processingLeadId = null)),
    ).subscribe({
      next: (updated) => {
        this.replaceLead(updated);
        this.actionMessage = `Invitation sent to ${lead.email}.`;
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
