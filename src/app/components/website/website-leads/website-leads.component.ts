import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Subject, debounceTime, distinctUntilChanged, interval, takeUntil } from 'rxjs';
import { WebsiteService, CoachWebsiteLead, PageResponse } from '../../../service/website.service';

@Component({
  selector: 'app-website-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './website-leads.component.html',
  styleUrls: ['./website-leads.component.scss']
})
export class WebsiteLeadsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  leads: CoachWebsiteLead[] = [];
  searchTerm = '';
  loading = false;

  page = 0;
  size = 10;
  totalElements = 0;
  totalPages = 0;

  openDropdownId: string | null = null;

  constructor(private websiteService: WebsiteService) {}

  ngOnInit(): void {
    this.loadLeads();

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 0;
        this.loadLeads();
      });

    document.addEventListener('click', this.handleOutsideClick);
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.leads = [...this.leads];
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.handleOutsideClick);
  }

  handleOutsideClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.openDropdownId = null;
    }
  };

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
      error: (err) => {
        console.error('Erreur chargement leads', err);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  toggleDropdown(id: string, event: Event): void {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === id ? null : id;
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page) return;
    this.page = page;
    this.loadLeads();
  }

  getLeadFullName(lead: CoachWebsiteLead): string {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || '—';
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  copyEmail(email: string): void {
    navigator.clipboard.writeText(email);
    this.openDropdownId = null;
  }

  copyPhone(phone?: string): void {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    this.openDropdownId = null;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  getElapsedTime(date: string | undefined): string {
    if (!date) return '—';

    const createdAt = new Date(date).getTime();
    const now = Date.now();

    const diffMs = now - createdAt;

    if (diffMs < 0) {
      return 'À l’instant';
    }

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;

    if (diffMs < minute) {
      return 'À l’instant';
    }

    if (diffMs < hour) {
      const minutes = Math.floor(diffMs / minute);
      return `Il y a ${minutes} min`;
    }

    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `Il y a ${hours} h`;
    }

    if (diffMs < week) {
      const days = Math.floor(diffMs / day);
      return `Il y a ${days} j`;
    }

    if (diffMs < month) {
      const weeks = Math.floor(diffMs / week);
      return `Il y a ${weeks} sem`;
    }

    if (diffMs < year) {
      const months = Math.floor(diffMs / month);
      return `Il y a ${months} mois`;
    }

    const years = Math.floor(diffMs / year);
    return `Il y a ${years} an${years > 1 ? 's' : ''}`;
  }
}
