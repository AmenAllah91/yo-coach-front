import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsApiService, Form, PageResponse, UserDto } from '../services/forms-api.service';
import { Subject, takeUntil } from 'rxjs';
import {AssignmentsApiService} from "../services/assignments-api.service";

@Component({
  selector: 'app-forms-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forms-list.component.html',
  styleUrls: ['./forms-list.component.css'],
})
export class FormsListComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // UI state
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // pagination state
  readonly pageIndex = signal(0);     // 0-based
  readonly pageSize = signal(10);
  readonly pageData = signal<PageResponse<Form> | null>(null);

  readonly forms = computed(() => this.pageData()?.content ?? []);
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 0);
  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);

  // delete modal state
  readonly confirmOpen = signal(false);
  readonly deleting = signal(false);
  readonly selectedToDelete = signal<Form | null>(null);

  // ====== ASSIGNMENT MODAL STATE ======
  readonly assignOpen = signal(false);
  readonly assigning = signal(false);
  readonly selectedToAssign = signal<Form | null>(null);

  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly allUsers = signal<UserDto[]>([]);
  readonly searchTerm = signal('');
  readonly selectedUserIds = signal<Set<string>>(new Set());

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

  constructor(
    private api: FormsApiService,
    private assignmentsApi: AssignmentsApiService,
    private router: Router
  ) {}
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

    this.api
      .getMyFormsPage(this.pageIndex(), this.pageSize())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pageData.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.extractError(err) ?? 'Erreur lors du chargement des forms.');
        },
      });
  }

  // Pagination handlers
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

  // Delete modal
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

    this.api
      .deleteForm(target.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmOpen.set(false);
          this.selectedToDelete.set(null);

          const currentCount = this.forms().length;
          if (currentCount === 1 && this.pageIndex() > 0) {
            this.pageIndex.set(this.pageIndex() - 1);
          }
          this.loadPage();
        },
        error: (err) => {
          this.deleting.set(false);
          this.error.set(this.extractError(err) ?? 'Suppression impossible.');
        },
      });
  }

  // ===== NAVIGATION =====
  onAdd(): void {
    this.router.navigate(['/forms/create-form']);
  }

  onEdit(form: Form): void {
    this.router.navigate(['/forms/create-form', form.id]);
  }

  // ====== ASSIGNMENT MODAL ======
  openAssign(form: Form): void {
    this.selectedToAssign.set(form);
    this.assignOpen.set(true);
    this.assigning.set(false);
    this.usersError.set(null);

    // reset selection + search each time
    this.searchTerm.set('');
    this.selectedUserIds.set(new Set());

    // load users (provisoire)
    this.loadUsers();
  }

  closeAssign(): void {
    if (this.assigning()) return;
    this.assignOpen.set(false);
    this.selectedToAssign.set(null);
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);

    this.api.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.allUsers.set(users ?? []);
          this.usersLoading.set(false);
        },
        error: (err) => {
          this.usersLoading.set(false);
          this.usersError.set(this.extractError(err) ?? 'Erreur lors du chargement des utilisateurs.');
        }
      });
  }

  onUserSearch(ev: Event): void {
    const value = (ev.target as HTMLInputElement)?.value ?? '';
    this.searchTerm.set(value);
  }

  userLabel(u: UserDto): string {
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.login || u.email || '(Sans nom)';
  }

  isSelected(u: UserDto): boolean {
    return this.selectedUserIds().has(u.id);
  }

  toggleUser(u: UserDto): void {
    const next = new Set(this.selectedUserIds());
    if (next.has(u.id)) next.delete(u.id);
    else next.add(u.id);
    this.selectedUserIds.set(next);
  }



  // helpers
  trackById(_: number, f: Form) {
    return f.id;
  }

  badgeClass(status: string): string {
    switch (status) {
      case 'PUBLISHED':
        return 'badge badge--published';
      case 'DRAFT':
        return 'badge badge--draft';
      case 'ARCHIVED':
        return 'badge badge--archived';
      default:
        return 'badge';
    }
  }

  private extractError(err: any): string | null {
    return err?.error?.message ?? err?.message ?? null;
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

    this.assignmentsApi.bulkAssign(form.id, ids).subscribe({
      next: (res) => {
        const createdCount = res?.created?.length ?? 0;
        const errors = res?.errors ?? [];

        if (errors.length > 0) {
          // message friendly (ex: déjà affecté)
          const already = errors.filter((e: any) => e.reason === 'ALREADY_ASSIGNED').length;
          const other = errors.length - already;

          let msg = `Affectation partielle : ${createdCount} succès`;
          if (already > 0) msg += ` • ${already} déjà affecté(s)`;
          if (other > 0) msg += ` • ${other} erreur(s)`;

          this.usersError.set(msg);

          // tu peux décider de fermer quand même si au moins 1 succès:
          if (createdCount > 0) {
            // si tu préfères fermer direct, décommente:
            // this.closeAssign();
          }
        } else {
          // tout OK
          this.closeAssign();
        }

        this.assigning.set(false);
        this.assignOpen.set(false)
      },
      error: (err) => {
        this.assigning.set(false);
        this.usersError.set(err?.error?.message ?? 'Erreur lors de l’affectation.');
      }
    });
  }
}
