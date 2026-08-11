import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsApiService, Form, FormStatus, PageResponse, UserDto } from '../services/forms-api.service';
import { AssignmentsApiService } from '../services/assignments-api.service';
import { ClientService } from '../../../service/client.service';
import { FeatherModule } from 'angular-feather';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, Subject } from 'rxjs';
import { catchError, exhaustMap, finalize, switchMap, takeUntil, tap } from 'rxjs/operators';

type FormsViewMode = 'active' | 'unsaved' | 'archived';

@Component({
  selector: 'app-forms-list',
  standalone: true,
  imports: [
    CommonModule,
    FeatherModule,
    ReactiveFormsModule,
    FormsModule,
    OverlayModule,
    TranslateModule,
  ],
  templateUrl: './forms-list.component.html',
  styleUrls: ['./forms-list.component.css'],
})
export class FormsListComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly duplicateClick$ = new Subject<Form>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly viewMode = signal<FormsViewMode>('active');

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageData = signal<PageResponse<Form> | null>(null);

  readonly forms = computed(() => this.pageData()?.content ?? []);
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 0);
  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);

  readonly activeCount = signal(0);
  readonly archivedCount = signal(0);
  readonly unsavedCount = signal(0);

  readonly confirmOpen = signal(false);
  readonly deleting = signal(false);
  readonly selectedToDelete = signal<Form | null>(null);

  readonly assignOpen = signal(false);
  readonly assigning = signal(false);
  readonly selectedToAssign = signal<Form | null>(null);

  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly allUsers = signal<UserDto[]>([]);
  readonly searchTerm = signal('');
  readonly selectedUserIds = signal<Set<string>>(new Set());

  readonly duplicating = signal(false);

  assignSelectAll = false;
  scheduleEnabled = false;
  scheduledDateValue = '';
  endDateValue = '';

  userId = sessionStorage.getItem('userId');

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const users = this.allUsers();

    if (!term) return users;

    return users.filter(u => {
      const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().toLowerCase();
      const email = `${u.email ?? ''}`.toLowerCase();
      const login = `${u.login ?? ''}`.toLowerCase();

      return full.includes(term) || email.includes(term) || login.includes(term);
    });
  });

  readonly selectedCount = computed(() => this.selectedUserIds().size);

  readonly openedActionsId = signal<string | number | null>(null);
  readonly openDropdownId = signal<string | null>(null);

  constructor(
    private api: FormsApiService,
    private assignmentsApi: AssignmentsApiService,
    private clientService: ClientService,
    private router: Router,
    private toastr: ToastrService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadCounts();
    this.loadPage();

    this.duplicateClick$
      .pipe(
        takeUntil(this.destroy$),
        exhaustMap((form) => {
          this.duplicating.set(true);
          this.error.set(null);

          return this.api.getForOwner(String(form.id)).pipe(
            switchMap((details: any) =>
              this.api.createForm(this.duplicatePayloadFromDetails(details))
            ),
            finalize(() => this.duplicating.set(false)),
            tap(() => {
              this.loadCounts();
              this.loadPage();
            }),
            catchError((err) => {
              this.error.set(this.extractError(err) ?? this.translate.instant('DUPLICATE_FORM_ERROR'));
              return EMPTY;
            })
          );
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setViewMode(mode: FormsViewMode): void {
    this.viewMode.set(mode);
    this.pageIndex.set(0);
    this.closeActions();
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.error.set(null);

    const mode = this.viewMode();

    let status: FormStatus | undefined;
    let excludeArchived = true;

    if (mode === 'unsaved') {
      status = 'UNSAVED' as FormStatus;
      excludeArchived = false;
    } else if (mode === 'archived') {
      status = 'ARCHIVED' as FormStatus;
      excludeArchived = false;
    }

    this.api
      .getMyFormsPage(this.pageIndex(), this.pageSize(), status, excludeArchived)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pageData.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.extractError(err) ?? this.translate.instant('LOAD_FORMS_ERROR'));
        },
      });
  }

  loadCounts(): void {
    this.api.getCounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (c: any) => {
          this.activeCount.set(c.active ?? c.published ?? 0);
          this.archivedCount.set(c.archived ?? 0);
          this.unsavedCount.set(c.unsaved ?? 0);
        },
        error: () => {
          this.activeCount.set(0);
          this.archivedCount.set(0);
          this.unsavedCount.set(0);
        },
      });
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

  pagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages() || page === this.pageIndex()) {
      return;
    }

    this.pageIndex.set(page);
    this.loadPage();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
    this.loadPage();
  }

  onAdd(): void {
    this.router.navigate(['/forms/create-form']);
  }

  onEdit(form: Form): void {
    this.router.navigate(['/forms', form.id, 'edit']);
  }

  continueCreating(form: Form): void {
    this.router.navigate(['/forms', form.id, 'edit']);
  }

  private isPublished(form: Form): boolean {
    return (form.status ?? '').toUpperCase() === 'PUBLISHED';
  }

  onEditGuarded(form: Form): void {
    if (this.isPublished(form)) {
      this.toastr.warning(
        this.translate.instant('PUBLISHED_FORM_EDIT_FORBIDDEN'),
        this.translate.instant('ACTION_NOT_ALLOWED'),
        {
          timeOut: 2500,
          closeButton: true,
          progressBar: true,
        }
      );
      return;
    }

    this.onEdit(form);
  }

  onDeleteGuarded(form: Form): void {
    if (this.isPublished(form)) {
      this.toastr.warning(
        this.translate.instant('PUBLISHED_FORM_DELETE_FORBIDDEN'),
        this.translate.instant('ACTION_NOT_ALLOWED'),
        {
          timeOut: 2500,
          closeButton: true,
          progressBar: true,
        }
      );
      return;
    }

    this.openDelete(form);
  }

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

          if (this.forms().length === 1 && this.pageIndex() > 0) {
            this.pageIndex.set(this.pageIndex() - 1);
          }

          this.loadCounts();
          this.loadPage();
        },
        error: (err) => {
          this.deleting.set(false);
          this.error.set(this.extractError(err) ?? this.translate.instant('DELETE_FORM_ERROR'));
        },
      });
  }

  private duplicatePayloadFromDetails(details: any): any {
    return {
      title: `${details.title ?? this.translate.instant('FORM_TITLE')} (${this.translate.instant('COPY')})`,
      description: details.description ?? '',
      questions: (details.questions ?? []).map((q: any, idx: number) => ({
        type: q.type,
        label: q.label,
        required: !!q.required,
        order: idx,
        options: (q.options ?? []).map((o: any) => ({
          label: o.label,
        })),
      })),
      ...(details.schedule ? { schedule: details.schedule } : {}),
      status: 'DRAFT',
      showInSignup: !!details.showInSignup,
    };
  }

  onDuplicate(form: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.duplicateClick$.next(form);
  }

  archiveForm(form: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.api.archiveForm(form.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadCounts();
          this.loadPage();
        },
        error: (err) => {
          this.error.set(this.extractError(err) ?? this.translate.instant('ARCHIVE_FORM_ERROR'));
        },
      });
  }

  unarchiveForm(form: Form, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.api.unarchiveForm(form.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadCounts();
          this.loadPage();
        },
        error: (err) => {
          this.error.set(this.extractError(err) ?? this.translate.instant('RESTORE_FORM_ERROR'));
        },
      });
  }

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

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);

    this.clientService.getListClientsByCoachWithoutPagination(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.allUsers.set(users ?? []);
          this.usersLoading.set(false);
        },
        error: (err) => {
          this.usersLoading.set(false);
          this.usersError.set(this.extractError(err) ?? this.translate.instant('LOAD_USERS_ERROR'));
        },
      });
  }

  onUserSearch(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.searchTerm.set(value);
  }

  userLabel(user: UserDto): string {
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return full || user.login || user.email || this.translate.instant('UNNAMED');
  }

  getUserFirstName(user: UserDto): string {
    return (user.firstName ?? this.userLabel(user)).split(' ')[0];
  }

  isSelected(user: UserDto): boolean {
    return this.selectedUserIds().has(user.id);
  }

  toggleUser(user: UserDto): void {
    const next = new Set(this.selectedUserIds());

    if (next.has(user.id)) {
      next.delete(user.id);
    } else {
      next.add(user.id);
    }

    this.selectedUserIds.set(next);

    this.assignSelectAll =
      this.allUsers().length > 0 && this.allUsers().every(u => next.has(u.id));
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

    if (!this.scheduleEnabled) {
      this.scheduledDateValue = '';
    }
  }

  submitAssign(): void {
    const form = this.selectedToAssign();
    if (!form) return;

    const ids = Array.from(this.selectedUserIds());

    if (ids.length === 0) {
      this.usersError.set(this.translate.instant('SELECT_AT_LEAST_ONE_CLIENT'));
      return;
    }

    const hasSchedule = !!form.schedule;

    if (hasSchedule && !this.endDateValue) {
      this.usersError.set(this.translate.instant('SELECT_END_DATE'));
      return;
    }

    this.assigning.set(true);
    this.usersError.set(null);

    let dueDate: string | null = null;

    if (!hasSchedule) {
      if (this.scheduleEnabled && this.scheduledDateValue) {
        dueDate = this.scheduledDateValue;
      } else {
        dueDate = new Date().toISOString();
      }
    }

    this.api.ensurePublished(form.id)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() =>
          this.assignmentsApi.bulkAssign(form.id, {
            assigneeIds: ids,
            dueDate,
            endDate: hasSchedule ? this.endDateValue : null,
          })
        )
      )
      .subscribe({
        next: (res: any) => {
          this.assigning.set(false);
          const createdCount = res?.created?.length ?? 0;
          const errors = res?.errors ?? [];

          if (errors.length > 0) {
            const already = errors.filter((e: any) => e.reason === 'ALREADY_ASSIGNED').length;
            const other = errors.length - already;

            let msg = this.translate.instant('PARTIAL_ASSIGNMENT_SUCCESS', { count: createdCount });

            if (already > 0) msg += ` • ${this.translate.instant('ALREADY_ASSIGNED_COUNT', { count: already })}`;
            if (other > 0) msg += ` • ${this.translate.instant('ERROR_COUNT', { count: other })}`;

            this.usersError.set(msg);

            if (createdCount > 0) {
              this.toastr.success(
                this.translate.instant('ASSIGNMENTS_CREATED', { count: createdCount }),
                this.translate.instant('CHECK_IN_ASSIGNED')
              );
              this.closeAssign();
            }
          } else {
            const scheduled = hasSchedule || (this.scheduleEnabled && !!this.scheduledDateValue);
            this.toastr.success(
              scheduled
                ? this.translate.instant('CHECK_IN_SCHEDULED_FOR_CLIENTS', { count: ids.length })
                : this.translate.instant('CHECK_IN_ASSIGNED_TO_CLIENTS', { count: ids.length }),
              scheduled ? this.translate.instant('SCHEDULE_SAVED') : this.translate.instant('CHECK_IN_ASSIGNED')
            );
            this.closeAssign();
          }

          this.loadCounts();
          this.loadPage();
        },
        error: (err) => {
          this.assigning.set(false);
          this.usersError.set(err?.error?.message ?? this.translate.instant('ASSIGN_FORM_ERROR'));
        },
      });
  }

  showSpecificDateSchedule(): boolean {
    return !this.selectedToAssign()?.schedule;
  }

  toggleActions(formId: string | number, event: MouseEvent): void {
    event.stopPropagation();
    const nextId = this.openedActionsId() === formId ? null : formId;
    this.openedActionsId.set(nextId);

    if (nextId !== null) {
      const button = event.currentTarget as HTMLElement;
      requestAnimationFrame(() =>
        this.positionDropdown(String(nextId), button)
      );
    }
  }

  closeActions(): void {
    this.openedActionsId.set(null);
  }

  toggleDropdown(formId: string | number, event: MouseEvent): void {
    event.stopPropagation();

    const id = String(formId);
    const nextId = this.openDropdownId() === id ? null : id;
    this.openDropdownId.set(nextId);

    if (nextId) {
      requestAnimationFrame(() => this.positionDropdown(nextId, event.currentTarget as HTMLElement));
    }
  }

  private positionDropdown(formId: string, buttonEl: HTMLElement | null): void {
    const menuId = buttonEl?.closest('.mobile-form-list')
      ? `mobile-dropdown-${formId}`
      : `dropdown-${formId}`;
    const menu = document.getElementById(menuId) as HTMLElement | null;
    if (!menu || !buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();

    const menuW = menu.offsetWidth || 180;
    const menuH = menu.offsetHeight || 200;

    const preferredTop = rect.bottom + menuH > window.innerHeight
      ? rect.top - menuH - 6
      : rect.bottom + 6;

    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - menuH - 8));
    const left = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  closeDropdown(): void {
    this.openDropdownId.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (target?.closest('.dropdown')) return;

    this.closeDropdown();
    this.closeActions();
  }

  trackById(_: number, item: Form | UserDto): string {
    return String(item.id);
  }

  badgeClass(status: string): string {
    switch ((status ?? '').toUpperCase()) {
      case 'PUBLISHED':
        return 'badge badge--published';
      case 'DRAFT':
        return 'badge badge--draft';
      case 'UNSAVED':
        return 'badge badge--unsaved';
      case 'ARCHIVED':
        return 'badge badge--archived';
      default:
        return 'badge';
    }
  }

  statusLabel(status: string): string {
    const key = `${(status || 'DRAFT').toUpperCase()}_FORM_STATUS`;
    return this.translate.instant(key);
  }

  private extractError(err: any): string | null {
    return err?.error?.message ?? err?.message ?? null;
  }
}
