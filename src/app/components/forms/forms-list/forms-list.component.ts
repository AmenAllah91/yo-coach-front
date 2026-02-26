import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormsApiService, Form, PageResponse, UserDto } from '../services/forms-api.service';
import { Subject, takeUntil } from 'rxjs';
import { AssignmentsApiService } from '../services/assignments-api.service';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { ClientService } from '../../../service/client.service';
import { switchMap } from 'rxjs/operators';
import { exhaustMap, finalize, tap, catchError, EMPTY } from 'rxjs';
@Component({
  selector: 'app-forms-list',
  standalone: true,
  imports: [CommonModule, FeatherModule, ReactiveFormsModule, FormsModule, OverlayModule],
  templateUrl: './forms-list.component.html',
  styleUrls: ['./forms-list.component.css'],
})
export class FormsListComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── UI state ──────────────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── View mode (Active / Archived) ─────────────────────────────────────────────
  readonly viewMode = signal<'active' | 'archived'>('active');

  setViewMode(mode: 'active' | 'archived'): void {
    this.viewMode.set(mode);
    this.pageIndex.set(0);
    this.loadPage();
  }

  // ── Pagination ────────────────────────────────────────────────────────────────
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageData = signal<PageResponse<Form> | null>(null);

  readonly forms = computed(() => this.pageData()?.content ?? []);
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 0);
  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);

  // Counts for the toggle badges
  readonly activeForms = computed(() => this.forms().filter(f => !(f as any).archived));
  readonly archivedForms = computed(() => this.forms().filter(f => (f as any).archived));

  // ── Delete modal ──────────────────────────────────────────────────────────────
  readonly confirmOpen = signal(false);
  readonly deleting = signal(false);
  readonly selectedToDelete = signal<Form | null>(null);

  // ── Assign modal ──────────────────────────────────────────────────────────────
  readonly assignOpen = signal(false);
  readonly assigning = signal(false);
  readonly selectedToAssign = signal<Form | null>(null);

  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly allUsers = signal<UserDto[]>([]);
  readonly searchTerm = signal('');
  readonly selectedUserIds = signal<Set<string>>(new Set());
  readonly duplicating = signal(false);
  readonly activeCount = signal(0);
  readonly archivedCount = signal(0);
  // Plain properties pour éviter les soucis avec (change) + *ngIf
  assignSelectAll = false;
  scheduleEnabled = false;
  scheduledDateValue = '';

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const users = this.allUsers();
    if (!term) return users;
    return users.filter(u => {
      const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().toLowerCase();
      return full.includes(term);
    });
  });

  readonly selectedCount = computed(() => this.selectedUserIds().size);

  userId = sessionStorage.getItem('userId');
  endDateValue = '';

  constructor(
    private api: FormsApiService,
    private assignmentsApi: AssignmentsApiService,
    private router: Router,
    private clientService: ClientService,
  ) {}

  private readonly duplicateClick$ = new Subject<Form>();

  ngOnInit(): void {
    this.loadPage();
    this.loadCounts();

    this.duplicateClick$
      .pipe(
        takeUntil(this.destroy$),

        exhaustMap((f) => {
          this.duplicating.set(true);
          this.error.set(null);

          return this.api.getForOwner(String(f.id)).pipe(
            switchMap((details: any) =>
              this.api.createForm(this.duplicatePayloadFromDetails(details))
            ),
            finalize(() => this.duplicating.set(false)),
            tap(() => {
              this.loadPage();


            }),
            catchError((err) => {
              this.error.set(this.extractError(err) ?? 'Erreur lors de la duplication.');
              return EMPTY;
            })
          );
        })
      )
      .subscribe();
  }

  loadCounts(): void {
    this.api.getCounts().pipe(takeUntil(this.destroy$)).subscribe({
      next: c => { this.activeCount.set(c.active); this.archivedCount.set(c.archived); }
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Page load ─────────────────────────────────────────────────────────────────
  loadPage(): void {
    this.loading.set(true);
    this.error.set(null);

    const isArchived = this.viewMode() === 'archived';

    this.api.getMyFormsPage(
      this.pageIndex(),
      this.pageSize(),
      isArchived ? 'ARCHIVED' : undefined,
      !isArchived
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => { this.pageData.set(res); this.loading.set(false); },
        error: err => {
          this.loading.set(false);
          this.error.set(this.extractError(err) ?? 'Erreur lors du chargement des forms.');
        },
      });
  }

  showSpecificDateSchedule(): boolean {
    return !this.selectedToAssign()?.schedule;
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

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
    this.loadPage();
  }

  // ── Delete modal ──────────────────────────────────────────────────────────────
  openDelete(form: Form): void {
    this.selectedToDelete.set(form);
    this.confirmOpen.set(true);
  }

  closeDelete(): void {
    if (this.deleting()) return;
    this.confirmOpen.set(false);
    this.selectedToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.selectedToDelete();
    if (!target) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteForm(target.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmOpen.set(false);
        this.selectedToDelete.set(null);
        if (this.forms().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.set(this.pageIndex() - 1);
        }
        this.loadPage();
      },
      error: err => {
        this.deleting.set(false);
        this.error.set(this.extractError(err) ?? 'Suppression impossible.');
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  onAdd(): void { this.router.navigate(['/forms/create-form']); }
  onEdit(form: Form): void { this.router.navigate(['/forms/', form.id, 'edit']); }

  // ── Assign modal ──────────────────────────────────────────────────────────────
  openAssign(form: Form): void {
    this.selectedToAssign.set(form);
    this.assignOpen.set(true);
    this.assigning.set(false);
    this.usersError.set(null);
    this.searchTerm.set('');
    this.selectedUserIds.set(new Set());
    this.assignSelectAll = false;
    this.scheduleEnabled = false;
    this.scheduledDateValue = '';
    this.endDateValue = '';
    this.loadUsers();
  }

  closeAssign(): void {
    if (this.assigning()) return;
    this.assignOpen.set(false);
    this.selectedToAssign.set(null);
  }

  onAssignOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('am-overlay')) {
      this.closeAssign();
    }
  }

  private duplicatePayloadFromDetails(details: any): any {
    return {
      title: `${(details.title ?? 'Form Title')} (copie)`,
      description: details.description ?? '',
      questions: (details.questions ?? []).map((q: any, idx: number) => ({
        type: q.type,
        label: q.label,
        required: !!q.required,
        order: idx,
        options: (q.options ?? []).map((o: any) => ({
          label: o.label
        })),
      })),
      ...(details.schedule ? { schedule: details.schedule } : {}),
      status: 'DRAFT',
    };
  }


  onDuplicate(f: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.duplicateClick$.next(f);
  }

  archiveForm(f: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.api.archiveForm(f.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadCounts();
        this.loadPage();
      },
      error: err => this.error.set(this.extractError(err) ?? "Erreur lors de l'archivage."),
    });
  }

  unarchiveForm(f: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.api.unarchiveForm(f.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadCounts();
        this.loadPage();
      },
      error: err => this.error.set(this.extractError(err) ?? "Erreur lors de la restauration."),
    });
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.clientService.getListClientsByCoachWithoutPagination(this.userId).subscribe({
      next: users => {
        this.allUsers.set(users ?? []);
        this.usersLoading.set(false);
      },
      error: err => {
        this.usersLoading.set(false);
        this.usersError.set(this.extractError(err) ?? 'Erreur lors du chargement des utilisateurs.');
      },
    });
  }

  onUserSearch(ev: Event): void {
    this.searchTerm.set((ev.target as HTMLInputElement)?.value ?? '');
  }

  userLabel(u: UserDto): string {
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.login || u.email || '(Sans nom)';
  }

  getUserFirstName(u: UserDto): string {
    return (u.firstName ?? this.userLabel(u)).split(' ')[0];
  }

  isSelected(u: UserDto): boolean {
    return this.selectedUserIds().has(u.id);
  }

  toggleUser(u: UserDto): void {
    const next = new Set(this.selectedUserIds());
    if (next.has(u.id)) next.delete(u.id);
    else next.add(u.id);
    this.selectedUserIds.set(next);
    this.assignSelectAll =
      this.allUsers().length > 0 && this.allUsers().every(x => next.has(x.id));
  }

  handleAssignSelectAll(): void {
    if (this.assignSelectAll) {
      this.selectedUserIds.set(new Set());
      this.assignSelectAll = false;
    } else {
      this.selectedUserIds.set(new Set(this.allUsers().map(u => u.id)));
      this.assignSelectAll = true;
    }
  }

  toggleSchedule(): void {
    this.scheduleEnabled = !this.scheduleEnabled;
    if (!this.scheduleEnabled) this.scheduledDateValue = '';
  }

  submitAssign(): void {
    const form = this.selectedToAssign();
    if (!form) return;

    const ids = Array.from(this.selectedUserIds());
    if (ids.length === 0) {
      this.usersError.set('Sélectionne au moins un utilisateur.');
      return;
    }

    this.assigning.set(true);
    this.usersError.set(null);
    const hasSchedule = !!form.schedule;

    this.api.ensurePublished(form.id).pipe(
      switchMap(() =>
        this.assignmentsApi.bulkAssign(form.id, {
          assigneeIds: ids,
          dueDate: (!hasSchedule && this.scheduleEnabled) ? this.scheduledDateValue : null,
          endDate: hasSchedule ? this.endDateValue : null,
        })
      )
    ).subscribe({
      next: res => {
        const createdCount = res?.created?.length ?? 0;
        const errors = res?.errors ?? [];
        if (errors.length > 0) {
          const already = errors.filter((e: any) => e.reason === 'ALREADY_ASSIGNED').length;
          const other = errors.length - already;
          let msg = `Affectation partielle : ${createdCount} succès`;
          if (already > 0) msg += ` • ${already} déjà affecté(s)`;
          if (other > 0) msg += ` • ${other} erreur(s)`;
          this.usersError.set(msg);
        } else {
          this.closeAssign();
        }
        this.assigning.set(false);
        this.assignOpen.set(false);
      },
      error: err => {
        this.assigning.set(false);
        this.usersError.set(err?.error?.message ?? "Erreur lors de l'affectation.");
      },
    });
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────────
  readonly openDropdownId = signal<string | null>(null);

  toggleDropdown(formId: string | number, event: MouseEvent) {
    event.stopPropagation();
    const id = String(formId);
    const nextId = this.openDropdownId() === id ? null : id;
    this.openDropdownId.set(nextId);
    if (nextId) {
      requestAnimationFrame(() => this.positionDropdown(nextId, event.currentTarget as HTMLElement));
    }
  }

  private positionDropdown(formId: string, buttonEl: HTMLElement | null) {
    const menu = document.getElementById(`dropdown-${formId}`) as HTMLElement | null;
    if (!menu || !buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const menuW = menu.offsetWidth || 180;
    const menuH = menu.offsetHeight || 200;
    const top = rect.bottom + menuH > window.innerHeight ? rect.top - menuH - 6 : rect.bottom + 6;
    const left = Math.max(8, rect.right - menuW);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  closeDropdown() { this.openDropdownId.set(null); }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.dropdown')) return;
    this.closeDropdown();
  }

  readonly openedActionsId = signal<string | number | null>(null);

  toggleActions(formId: string | number, event: MouseEvent): void {
    event.stopPropagation();
    this.openedActionsId.set(this.openedActionsId() === formId ? null : formId);
  }

  closeActions(): void { this.openedActionsId.set(null); }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  trackById(_: number, f: Form) { return f.id; }

  badgeClass(status: string): string {
    switch (status) {
      case 'PUBLISHED': return 'badge badge--published';
      case 'DRAFT':     return 'badge badge--draft';
      case 'ARCHIVED':  return 'badge badge--archived';
      default:          return 'badge';
    }
  }

  private extractError(err: any): string | null {
    return err?.error?.message ?? err?.message ?? null;
  }
}
