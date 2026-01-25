import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {PageResponse} from "../services/forms-api.service";
import {AssignmentsApiService, AssignmentStatus, FormAssignment} from "../services/assignments-api.service";

@Component({
  selector: 'app-my-assignments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-assignments.component.html',
  styleUrls: ['./my-assignments.component.css'],
})
export class MyAssignmentsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageData = signal<PageResponse<FormAssignment> | null>(null);

  readonly statusFilter = signal<AssignmentStatus | ''>('');

  readonly assignments = computed(() => this.pageData()?.content ?? []);
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 0);
  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);

  readonly statuses = [
    { id: '', label: 'Tous' },
    { id: 'ASSIGNED', label: 'Assigned' },
    { id: 'OPENED', label: 'Opened' },
    { id: 'SUBMITTED', label: 'Submitted' },
    { id: 'CANCELED', label: 'Canceled' },
  ];

  constructor(private assignmentsApi: AssignmentsApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadPage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPage(): void {
    this.loading.set(true);
    this.error.set(null);

    const status = this.statusFilter() || undefined;

    this.assignmentsApi
      .pageMyAssignments(this.pageIndex(), this.pageSize(), 'assignedAt', 'DESC', status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pageData.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Erreur lors du chargement des affectations.');
        },
      });
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
    this.loadPage();
  }

  changeStatusFilter(value: '' | AssignmentStatus): void {
    this.statusFilter.set(value);
    this.pageIndex.set(0);
    this.loadPage();
  }

  goToPrev(): void {
    if (this.pageIndex() <= 0) return;
    this.pageIndex.set(this.pageIndex() - 1);
    this.loadPage();
  }

  goToNext(): void {
    if (this.pageIndex() >= this.totalPages() - 1) return;
    this.pageIndex.set(this.pageIndex() + 1);
    this.loadPage();
  }

  badgeClass(status: AssignmentStatus): string {
    switch (status) {
      case 'ASSIGNED':
        return 'badge badge--draft';
      case 'OPENED':
        return 'badge badge--published';
      case 'SUBMITTED':
        return 'badge badge--archived';
      case 'CANCELED':
        return 'badge badge--canceled';
      default:
        return 'badge';
    }
  }

  trackById(_: number, a: FormAssignment) {
    return a.id;
  }
  //
  // openAssignment(a: FormAssignment): void {
  //   // if (a.status === 'ASSIGNED') {
  //     this.assignmentsApi.markOpened(a.id).subscribe({ next: () => this.loadPage() });
  //   // }
  //   this.router.navigate(['/assignments', a.id]);
  // }


  openAssignment(a: FormAssignment): void {
    this.assignmentsApi.markOpened(a.id).subscribe({
      next: () => this.loadPage(),
      error: () => {} // ignore
    });

    // ✅ navigation vers la page fill
    this.router.navigate(['/assignments', a.id, 'fill']);
  }
}
