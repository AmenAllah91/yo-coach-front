import {Component, OnInit} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
type ClientStatus = 'due_today' | 'overdue' | 'to_review' | 'reviewed' | 'upcoming';
import {catchError, finalize, forkJoin, map, of, switchMap} from 'rxjs';
import { UsersService } from '../../../service/users.service';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { AssignmentsApiService, FormAssignment } from '../services/assignments-api.service';
import { FormsApiService, FormDetails } from '../services/forms-api.service';
import {SubmissionsApiService} from "../services/submissions-api.service";
import {Answer, QuestionType, Submission} from "../../../models/forms.model";
import {ClientService} from "../../../service/client.service";
import {ActivatedRoute, Router} from '@angular/router';

export interface OptionItem {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  order: number;
  helpText?: string;

  // MULTIPLE_CHOICE
  options?: OptionItem[];

  // STAR_RATING
  minStars?: number;
  maxStars?: number;

  // TEXT
  minLength?: number;
  maxLength?: number;
  regex?: string;

  // DATE
  minDate?: string;
  maxDate?: string;
}


interface ClientData {
  id: string;
  name: string;
  avatar?: string;
  formType: string;
  date: string;
  status: ClientStatus;
  formName?: string;
  questions?: Question[];
  answers?: Answer[];
  coachFeedback?: string;
  submittedDate?: string;
}




const ITEMS_PER_PAGE = 5;

@Component({
  selector: 'app-manage-checkins',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SectionLoaderComponent],
  templateUrl: './manage-checkins.component.html',
  styleUrl: './manage-checkins.component.scss'
})
export class ManageCheckinsComponent implements OnInit{
  activeTab: ClientStatus = 'due_today';
  searchQuery = '';
  currentPage = 1;

  // Modal state
  selectedClient: ClientData | null = null;
  isModalOpen = false;
  modalMode: 'preview' | 'view' = 'preview'; // preview = voir questions, view = voir réponses
  QuestionType = QuestionType;

  // Feedback state (pour to_review)
  coachFeedback = '';

  // tabs config
  tabs: { id: ClientStatus; labelKey: string }[] = [
    { id: 'due_today', labelKey: 'DUE_TODAY' },
    { id: 'overdue', labelKey: 'OVERDUE_LABEL' },
    { id: 'to_review', labelKey: 'TO_BE_REVIEWED' },
    { id: 'reviewed', labelKey: 'REVIEWED_STATUS' },
    { id: 'upcoming', labelKey: 'UPCOMING_STATUS' },
  ];

  clients: ClientData[] = [];
  loading = false;
  /** The rows show once their client and form names are known (not the raw ids); a loader before. */
  listReady = false;
  error: string | null = null;

  assignments: FormAssignment[] = [];

  constructor(
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private clientService: ClientService,
    private translate: TranslateService,
    private usersService: UsersService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
  }

  goBack(): void { window.history.back(); }

  loadAssignments(): void {
    this.loading = true;
    this.error = null;

    this.assignmentsApi.pageOwnerAssignments(0, 200, 'dueAt', 'DESC', true)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.assignments = res.content ?? [];
          // The rows (and the previous ones on a reload) stay until the names are known.
          this.enrichClients(this.assignments);
        },
        error: (err) => {
          this.error = err?.error?.message ?? this.translate.instant('LOAD_ASSIGNMENTS_ERROR');
          this.listReady = true;
        }
      });
  }

  private enrichClients(assignments: FormAssignment[]) {
    if (!assignments.length) {
      this.clients = [];
      this.listReady = true;
      return;
    }
    const uniqueClientIds = Array.from(new Set(assignments.map(a => a.assigneeId).filter(Boolean)));
    const uniqueFormIds = Array.from(new Set(assignments.map(a => a.formId).filter(Boolean)));
    const coachId = sessionStorage.getItem('userId') || '';

    // The names come from one request for all the coach's clients (one per client before); a client missing from
    // it (moved to another coach) is still asked on its own.
    const clients$ = (coachId
      ? this.clientService.getListClientsByCoachWithoutPagination(coachId, true).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.content ?? []) as any[]),
        catchError(() => of([] as any[])),
      )
      : of([] as any[])
    ).pipe(
      switchMap((known) => {
        const knownIds = new Set(known.map((c: any) => String(c?.id)));
        const missing = uniqueClientIds.filter(id => !knownIds.has(String(id)));
        return missing.length
          ? forkJoin(missing.map(id => this.clientService.getClientById(id, true).pipe(catchError(() => of(null)))))
            .pipe(map(extra => [...known, ...extra.filter(Boolean)]))
          : of(known);
      }),
    );

    const forms$ = uniqueFormIds.length
      ? forkJoin(
        uniqueFormIds.map(id =>
          this.formsApi.getFormById(id, true).pipe(
            catchError(() => of(null))
          )
        )
      )
      : of([]);

    forkJoin([clients$, forms$]).pipe(finalize(() => (this.listReady = true))).subscribe({
      next: ([clients, forms]: any[]) => {
        const clientMap = new Map<string, any>();
        (clients ?? []).forEach((c: any) => {
          if (c?.id) clientMap.set(String(c.id), c);
        });

        const formMap = new Map<string, any>();
        (forms ?? []).forEach((f: any) => {
          if (f?.id) formMap.set(String(f.id), f);
        });

        this.clients = assignments.map(a => this.assignmentToClient(a)).map(row => {
          const assignment = assignments.find(a => a.id === row.id);
          if (!assignment) return row;

          const c = clientMap.get(String(assignment.assigneeId));
          const f = formMap.get(String(assignment.formId));

          const fullName = c
            ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
            : row.name;

          return {
            ...row,
            name: fullName || row.name,
            avatar: c?.avatarUrl
              || c?.avatar
              || c?.image
              || row.avatar,
            formType: f?.title ?? f?.name ?? row.formType,
            formName: f?.title ?? f?.name ?? row.formName,
          };
        });

        this.openPendingAssignment();
        this.loadClientPhotos(uniqueClientIds);
      },
    });
  }

  /** Photos fill in once the list shows (shared with the other client pages, fetched once per hour). */
  private loadClientPhotos(clientIds: string[]): void {
    if (!clientIds.length) return;
    forkJoin(clientIds.map(id => this.usersService.getAvatarUrl(String(id)))).subscribe((photos) => {
      const photoMap = new Map<string, string>();
      clientIds.forEach((id, index) => {
        if (photos[index]) photoMap.set(String(id), photos[index]);
      });
      this.clients = this.clients.map(row => {
        const assignment = this.assignments.find(a => a.id === row.id);
        const photo = assignment ? photoMap.get(String(assignment.assigneeId)) : undefined;
        return photo ? { ...row, avatar: photo } : row;
      });
    });
  }

  private assignmentToClient(a: FormAssignment): ClientData {
    return {
      id: a.id,
      name: a.assigneeId,          // until you have assignee name in DTO
      avatar: undefined,           // optional
      formType: a.formId,          // will be replaced when we fetch form
      formName: a.formId,
      date: this.formatDueDate(a.dueAt),
      status: this.mapAssignmentToClientStatus(a),
      submittedDate: a.submittedAt ? this.formatDate(a.submittedAt) : undefined,
    };
  }

  private mapAssignmentToClientStatus(a: FormAssignment): ClientStatus {
    if (a.status === 'CANCELED') return 'upcoming';

    // ✅ reviewed comes from backend status
    if (a.status === 'REVIEWED') return 'reviewed';

    // submitted but not reviewed yet
    if (a.status === 'SUBMITTED' || a.submittedAt) return 'to_review';

    // not submitted: due_today / overdue / upcoming
    if (!a.dueAt) return 'upcoming';

    const due = new Date(a.dueAt);
    const now = new Date();

    const due0 = new Date(due); due0.setHours(0,0,0,0);
    const now0 = new Date(now); now0.setHours(0,0,0,0);

    if (due0.getTime() === now0.getTime()) return 'due_today';
    if (due0.getTime() < now0.getTime()) return 'overdue';
    return 'upcoming';
  }
  private formatDueDate(iso?: string): string {
    if (!iso) return '';
    return this.formatDate(iso);
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  }



  // counts
  get counts(): Record<ClientStatus, number> {
    return this.clients.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<ClientStatus, number>);
  }

  // filtered
  get filteredClients(): ClientData[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.clients.filter((c) => {
      const matchesTab = c.status === this.activeTab;
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.formType.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredClients.length / ITEMS_PER_PAGE));
  }

  get safePage(): number {
    return Math.min(this.currentPage, this.totalPages);
  }

  get paginatedClients(): ClientData[] {
    const start = (this.safePage - 1) * ITEMS_PER_PAGE;
    return this.filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // actions
  setTab(tab: ClientStatus) {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  onSearch(value: string) {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  prevPage() {
    this.currentPage = Math.max(1, this.safePage - 1);
  }

  nextPage() {
    this.currentPage = Math.min(this.totalPages, this.safePage + 1);
  }

  goToPage(p: number) {
    this.currentPage = p;
  }

  initials(name: string) {
    return name?.trim()?.charAt(0)?.toUpperCase() || '?';
  }

  onAvatarError(client: ClientData): void {
    client.avatar = undefined;
  }

  openCheckInModal(client: ClientData) {
    const assignment = this.assignments.find(a => a.id === client.id);
    if (!assignment) return;

    this.selectedClient = client;
    this.isModalOpen = true;

    this.modalMode = (client.status === 'to_review' || client.status === 'reviewed') ? 'view' : 'preview';

    // 1) load form questions
    this.formsApi.getFormById(assignment.formId).subscribe({
      next: (form: FormDetails) => {
        if (!this.selectedClient) return;

        this.selectedClient.formType = form.title;
        this.selectedClient.formName = form.title;

        this.selectedClient.questions = (form.questions ?? []).map(q => ({
          id: q.id,
          type: q.type as QuestionType, // ✅ now it matches
          label: q.label,
          required: q.required,
          order: q.order,
          options: (q.options ?? []).map(o => ({ id: o.id, label: o.label }))
        }));
      }
    });

    // 2) ✅ if submitted, load submission answers
    if (assignment.submittedAt) {
      this.submissionsApi.getByAssignmentId(assignment.id).subscribe({
        next: (sub: Submission) => {
          if (!this.selectedClient) return;

          // ✅ NOW THIS WORKS (same Answer type)
          this.selectedClient.answers = sub.answers ?? [];
          this.selectedClient.submittedDate = sub.submittedAt ? this.formatDate(sub.submittedAt) : undefined;
        }
      });
    }
  }


  closeModal() {
    this.isModalOpen = false;
    this.selectedClient = null;
    this.coachFeedback = '';
  }

  // Récupère la réponse soumise pour une question
  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.selectedClient?.answers?.find(a => a.questionId === questionId);
  }

  // Récupère le label d'une option pour MULTIPLE_CHOICE
  getOptionLabel(question: Question, optionId: string): string {
    return question.options?.find(opt => opt.id === optionId)?.label || '';
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  isStarFilled(questionId: string, starValue: number): boolean {
    const answer = this.getSubmittedAnswer(questionId);
    if (!answer) return false;

    if (answer.type !== QuestionType.STAR_RATING) return false;

    return starValue <= (answer.rating ?? 0);
  }

  markAsReviewed() {
    if (!this.selectedClient) return;

    const assignmentId = this.selectedClient.id;
    const feedback = (this.coachFeedback ?? '').trim() || null;

    this.loading = true;
    this.error = null;

    this.assignmentsApi.reviewAssignment(assignmentId, feedback).subscribe({
      next: (updated) => {
        const idx = this.assignments.findIndex(a => a.id === updated.id);
        if (idx >= 0) this.assignments[idx] = updated;

        // Only the reviewed row changes (rebuilding all rows showed the raw ids instead of the names).
        this.clients = this.clients.map(row =>
          row.id === updated.id ? { ...row, status: this.mapAssignmentToClientStatus(updated) } : row);

        if (this.selectedClient) {
          this.selectedClient.status = 'reviewed';
          this.selectedClient.coachFeedback = feedback ?? undefined;
        }

        this.loading = false;
        this.closeModal();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? this.translate.instant('MARK_REVIEWED_ERROR');
      }
    });
  }

  // helpers style/status
  statusLabel(status: ClientStatus): string {
    switch (status) {
      case 'due_today':
        return this.translate.instant('DUE_TODAY');
      case 'overdue':
        return this.translate.instant('OVERDUE_LABEL');
      case 'to_review':
        return this.translate.instant('TO_REVIEW');
      case 'reviewed':
        return this.translate.instant('REVIEWED_STATUS');
      case 'upcoming':
        return this.translate.instant('UPCOMING_STATUS');
    }
  }

  statusIcon(status: ClientStatus): string {
    switch (status) {
      case 'due_today':
        return 'clock';
      case 'overdue':
        return 'alert-circle';
      case 'to_review':
        return 'eye';
      case 'reviewed':
        return 'check-circle-2';
      case 'upcoming':
        return 'calendar';
    }
  }
}
