import {Component, HostListener, OnInit} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {catchError, finalize, forkJoin, map, Observable, of, switchMap} from 'rxjs';
import Swal from 'sweetalert2';
import { UsersService } from '../../../service/users.service';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { AssignmentsApiService, AssignmentStatus, FormAssignment, PageResponse } from '../services/assignments-api.service';
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
  options?: OptionItem[];
  minStars?: number;
  maxStars?: number;
}

/** The four lists a coach works through: answers to read, late ones to chase, the ones still open, the history. */
export type CheckinTab = 'to_review' | 'overdue' | 'pending' | 'reviewed';
export type RowStatus = 'to_review' | 'overdue' | 'due_today' | 'upcoming' | 'no_due' | 'reviewed';

export interface CheckinRow {
  id: string;
  clientId: string;
  name: string;
  avatar?: string;
  formId: string;
  formName: string;
  status: RowStatus;
  tab: CheckinTab;
  dueAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  coachFeedback?: string;
  /** When the client read the comment (CE feedbackSeenAt); none: not read yet. */
  feedbackSeenAt?: string;
  /** Days late (overdue), days waiting (to review), days left (upcoming). */
  days: number;
}

/** The opened check-in: its questions and the client's answers, loaded on opening. */
interface CheckinDetail {
  questions: Question[];
  answers: Answer[];
  /** Answers to questions removed from the form since the client answered. */
  orphanAnswers: Answer[];
}

const ITEMS_PER_PAGE = 10;
/** Open check-ins read at once per status: beyond, the page says the list is cut. */
const OPEN_LIMIT = 500;
const REVIEWED_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-manage-checkins',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SectionLoaderComponent],
  templateUrl: './manage-checkins.component.html',
  styleUrl: './manage-checkins.component.scss'
})
export class ManageCheckinsComponent implements OnInit {
  readonly QuestionType = QuestionType;

  activeTab: CheckinTab = 'to_review';
  searchQuery = '';
  formFilter = '';
  currentPage = 1;

  tabs: { id: CheckinTab; labelKey: string; hintKey: string }[] = [
    { id: 'to_review', labelKey: 'CHK_TAB_TO_REVIEW', hintKey: 'CHK_TAB_TO_REVIEW_HINT' },
    { id: 'overdue', labelKey: 'CHK_TAB_OVERDUE', hintKey: 'CHK_TAB_OVERDUE_HINT' },
    { id: 'pending', labelKey: 'CHK_TAB_PENDING', hintKey: 'CHK_TAB_PENDING_HINT' },
    { id: 'reviewed', labelKey: 'CHK_TAB_REVIEWED', hintKey: 'CHK_TAB_REVIEWED_HINT' },
  ];

  rows: CheckinRow[] = [];
  /** The rows show once their client and form names are known (not the raw ids); a loader before. */
  listReady = false;
  error: string | null = null;
  /** A status had more check-ins than read at once: the oldest ones are not all listed. */
  truncated = false;

  // Opened check-in
  selected: CheckinRow | null = null;
  detail: CheckinDetail | null = null;
  detailLoading = false;
  detailError: string | null = null;
  feedback = '';
  editingFeedback = false;
  saving = false;
  actionError: string | null = null;

  private assignments = new Map<string, FormAssignment>();
  private clientNames = new Map<string, { name: string; avatar?: string }>();
  private formNames = new Map<string, string>();
  private formCache = new Map<string, FormDetails>();
  private pendingAssignmentId: string | null = null;

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
    this.pendingAssignmentId = this.route.snapshot.queryParamMap.get('assignmentId');
    this.loadAssignments(true);
  }

  goBack(): void { window.history.back(); }

  // ───────────────────────── Loading ─────────────────────────

  /**
   * Each status is read on its own (one page of everything cut the oldest unreviewed check-ins once a coach had a
   * few hundred): all the open ones, the latest reviewed ones.
   */
  loadAssignments(chooseTab = false): void {
    this.error = null;
    const page = (status: AssignmentStatus, size: number, sortBy: string, direction: 'ASC' | 'DESC') =>
      this.assignmentsApi.pageOwnerAssignmentsByAssigneeIdStatuses(0, size, sortBy, direction, undefined, [status], undefined, true);

    forkJoin([
      page('SUBMITTED', OPEN_LIMIT, 'submittedAt', 'ASC'),
      page('ASSIGNED', OPEN_LIMIT, 'dueAt', 'ASC'),
      page('OPENED', OPEN_LIMIT, 'dueAt', 'ASC'),
      page('REVIEWED', REVIEWED_LIMIT, 'reviewedAt', 'DESC'),
    ]).pipe(
      switchMap((pages: PageResponse<FormAssignment>[]) => {
        const [submitted, assigned, opened] = pages;
        this.truncated = [submitted, assigned, opened].some(p => (p.totalElements ?? 0) > (p.content?.length ?? 0));
        const all = pages.flatMap(p => p.content ?? []);
        return this.loadNames(all).pipe(map(() => all));
      }),
      finalize(() => (this.listReady = true)),
    ).subscribe({
      next: (all) => {
        this.assignments = new Map(all.map(a => [a.id, a]));
        this.rows = all.map(a => this.toRow(a));
        if (chooseTab) this.activeTab = this.firstUsefulTab();
        this.openPendingAssignment();
        this.loadClientPhotos();
      },
      error: (err) => {
        this.error = err?.error?.message ?? this.translate.instant('LOAD_ASSIGNMENTS_ERROR');
      },
    });
  }

  /** The client and form names, read once (the coach's clients in one request, the forms one by one). */
  private loadNames(assignments: FormAssignment[]): Observable<unknown> {
    const clientIds = Array.from(new Set(assignments.map(a => a.assigneeId).filter(id => id && !this.clientNames.has(id))));
    const formIds = Array.from(new Set(assignments.map(a => a.formId).filter(id => id && !this.formNames.has(id))));
    const coachId = sessionStorage.getItem('userId') || '';

    // A client missing from the coach's list (moved to another coach) is still asked on its own.
    const clients$ = !clientIds.length ? of([]) : (coachId
      ? this.clientService.getListClientsByCoachWithoutPagination(coachId, true).pipe(
        map((res: any) => (Array.isArray(res) ? res : res?.content ?? []) as any[]),
        catchError(() => of([] as any[])),
      )
      : of([] as any[])
    ).pipe(
      switchMap((known: any[]) => {
        const knownIds = new Set(known.map((c: any) => String(c?.id)));
        const missing = clientIds.filter(id => !knownIds.has(String(id)));
        return missing.length
          ? forkJoin(missing.map(id => this.clientService.getClientById(id, true).pipe(catchError(() => of(null)))))
            .pipe(map(extra => [...known, ...extra.filter(Boolean)]))
          : of(known);
      }),
    );

    const forms$ = formIds.length
      ? forkJoin(formIds.map(id => this.formsApi.getFormById(id, true).pipe(catchError(() => of(null)))))
      : of([]);

    return forkJoin([clients$, forms$]).pipe(map(([clients, forms]: any[]) => {
      (clients ?? []).forEach((c: any) => {
        if (!c?.id) return;
        const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
        const avatar = String(c.avatarUrl || c.avatar || c.image || '').trim();
        this.clientNames.set(String(c.id), { name, avatar: avatar && avatar.toLowerCase() !== 'not found' ? avatar : undefined });
      });
      (forms ?? []).forEach((f: any) => {
        if (!f?.id) return;
        this.formNames.set(String(f.id), f.title ?? f.name ?? '');
        this.formCache.set(String(f.id), f);
      });
    }));
  }

  /** Photos fill in once the list shows (shared with the other client pages, fetched once per hour). */
  private loadClientPhotos(): void {
    const clientIds = Array.from(new Set(this.rows.map(r => r.clientId).filter(Boolean)));
    if (!clientIds.length) return;
    forkJoin(clientIds.map(id => this.usersService.getAvatarUrl(String(id)))).subscribe((photos) => {
      const photoMap = new Map<string, string>();
      clientIds.forEach((id, index) => { if (photos[index]) photoMap.set(id, photos[index]); });
      this.rows = this.rows.map(row => photoMap.has(row.clientId) ? { ...row, avatar: photoMap.get(row.clientId) } : row);
      if (this.selected && photoMap.has(this.selected.clientId)) this.selected.avatar = photoMap.get(this.selected.clientId);
    });
  }

  private toRow(a: FormAssignment): CheckinRow {
    const client = this.clientNames.get(String(a.assigneeId));
    const status = this.statusOf(a);
    const today = this.startOfDay(new Date()).getTime();
    let days = 0;
    if (status === 'to_review' && a.submittedAt) days = Math.round((today - this.startOfDay(new Date(a.submittedAt)).getTime()) / DAY);
    else if (a.dueAt) days = Math.round(Math.abs(this.startOfDay(new Date(a.dueAt)).getTime() - today) / DAY);
    return {
      id: a.id,
      clientId: String(a.assigneeId ?? ''),
      name: client?.name || this.translate.instant('CHK_UNKNOWN_CLIENT'),
      avatar: client?.avatar,
      formId: String(a.formId ?? ''),
      formName: this.formNames.get(String(a.formId)) || a.formName || this.translate.instant('CHK_DELETED_FORM'),
      status,
      tab: this.tabOf(status),
      dueAt: a.dueAt,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt ?? undefined,
      coachFeedback: a.coachFeedback ?? undefined,
      feedbackSeenAt: a.feedbackSeenAt ?? undefined,
      days,
    };
  }

  private statusOf(a: FormAssignment): RowStatus {
    if (a.status === 'REVIEWED') return 'reviewed';
    if (a.status === 'SUBMITTED' || a.submittedAt) return 'to_review';
    if (!a.dueAt) return 'no_due';
    const due = this.startOfDay(new Date(a.dueAt)).getTime();
    const today = this.startOfDay(new Date()).getTime();
    if (due === today) return 'due_today';
    return due < today ? 'overdue' : 'upcoming';
  }

  private tabOf(status: RowStatus): CheckinTab {
    if (status === 'to_review' || status === 'overdue' || status === 'reviewed') return status;
    return 'pending';
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  /** The page opens on the work to do: answers to read first, then late check-ins. */
  private firstUsefulTab(): CheckinTab {
    const counts = this.counts;
    if (counts.to_review) return 'to_review';
    if (counts.overdue) return 'overdue';
    if (counts.pending) return 'pending';
    return counts.reviewed ? 'reviewed' : 'to_review';
  }

  /** A link to a check-in (dashboard, notification) opens it, even when it is not in the loaded lists. */
  private openPendingAssignment(): void {
    const id = this.pendingAssignmentId;
    if (!id) return;
    this.pendingAssignmentId = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: { assignmentId: null }, queryParamsHandling: 'merge', replaceUrl: true });

    const row = this.rows.find(r => r.id === id);
    if (row) {
      this.showRow(row);
      return;
    }
    this.assignmentsApi.getById(id).pipe(
      switchMap(a => this.loadNames([a]).pipe(map(() => a))),
      catchError(() => of(null)),
    ).subscribe(a => {
      if (!a || a.status === 'CANCELED') return;
      this.assignments.set(a.id, a);
      const added = this.toRow(a);
      this.rows = [...this.rows, added];
      this.showRow(added);
    });
  }

  private showRow(row: CheckinRow): void {
    this.activeTab = row.tab;
    this.currentPage = 1;
    this.openCheckIn(row);
  }

  // ───────────────────────── List ─────────────────────────

  /** The forms of the listed check-ins, for the form filter. */
  get formOptions(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    this.rows.forEach(r => { if (r.formId && !seen.has(r.formId)) seen.set(r.formId, r.formName); });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Rows matching the search and the form filter, all tabs. */
  private get matchingRows(): CheckinRow[] {
    const q = this.normalize(this.searchQuery.trim());
    return this.rows.filter(r =>
      (!this.formFilter || r.formId === this.formFilter) &&
      (!q || this.normalize(r.name).includes(q) || this.normalize(r.formName).includes(q)));
  }

  private normalize(value: string): string {
    return (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  get counts(): Record<CheckinTab, number> {
    const acc: Record<CheckinTab, number> = { to_review: 0, overdue: 0, pending: 0, reviewed: 0 };
    this.matchingRows.forEach(r => acc[r.tab]++);
    return acc;
  }

  get hasFilter(): boolean {
    return !!this.searchQuery.trim() || !!this.formFilter;
  }

  /** The tab's rows in working order: oldest answers first, most late first, nearest due first, latest review first. */
  get filteredRows(): CheckinRow[] {
    const time = (iso?: string) => (iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER);
    const rows = this.matchingRows.filter(r => r.tab === this.activeTab);
    switch (this.activeTab) {
      case 'to_review': return rows.sort((a, b) => time(a.submittedAt) - time(b.submittedAt));
      case 'overdue': return rows.sort((a, b) => time(a.dueAt) - time(b.dueAt));
      case 'pending': return rows.sort((a, b) => time(a.dueAt) - time(b.dueAt));
      case 'reviewed': return rows.sort((a, b) => -(time(a.reviewedAt ?? a.submittedAt) - time(b.reviewedAt ?? b.submittedAt)));
    }
  }

  /** How many late check-ins each client has: a client who stopped answering shows once per week otherwise. */
  get overdueByClient(): Map<string, number> {
    const counts = new Map<string, number>();
    this.rows.filter(r => r.status === 'overdue').forEach(r => counts.set(r.clientId, (counts.get(r.clientId) ?? 0) + 1));
    return counts;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / ITEMS_PER_PAGE));
  }

  get safePage(): number {
    return Math.min(this.currentPage, this.totalPages);
  }

  get paginatedRows(): CheckinRow[] {
    const start = (this.safePage - 1) * ITEMS_PER_PAGE;
    return this.filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setTab(tab: CheckinTab): void {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  onSearch(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  onFormFilter(value: string): void {
    this.formFilter = value;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.formFilter = '';
    this.currentPage = 1;
  }

  prevPage(): void { this.currentPage = Math.max(1, this.safePage - 1); }
  nextPage(): void { this.currentPage = Math.min(this.totalPages, this.safePage + 1); }
  goToPage(p: number): void { this.currentPage = p; }

  initials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '')).toUpperCase() || '?';
  }

  onAvatarError(row: CheckinRow): void {
    row.avatar = undefined;
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(this.locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private get locale(): string {
    return (this.translate.currentLang || this.translate.defaultLang) === 'en' ? 'en-US' : 'fr-FR';
  }

  /** What the coach reads first on a row: how long it waits, how late it is, when it is due. */
  timing(row: CheckinRow): string {
    const t = (key: string, n?: number) => this.translate.instant(key, { n });
    switch (row.status) {
      case 'to_review': return row.days <= 0 ? t('CHK_SUBMITTED_TODAY') : row.days === 1 ? t('CHK_SUBMITTED_YESTERDAY') : t('CHK_SUBMITTED_DAYS_AGO', row.days);
      case 'overdue': return row.days === 1 ? t('CHK_LATE_ONE_DAY') : t('CHK_LATE_DAYS', row.days);
      case 'due_today': return t('CHK_DUE_TODAY');
      case 'upcoming': return row.days === 1 ? t('CHK_DUE_TOMORROW') : t('CHK_DUE_IN_DAYS', row.days);
      case 'no_due': return t('CHK_NO_DUE_DATE');
      case 'reviewed': return this.translate.instant('CHK_REVIEWED_ON', { date: this.formatDate(row.reviewedAt ?? row.submittedAt) });
    }
  }

  /** The date under the timing: the real date of the event the timing counts from. */
  timingDate(row: CheckinRow): string {
    if (row.status === 'to_review') return this.formatDate(row.submittedAt);
    if (row.status === 'reviewed') return '';
    return this.formatDate(row.dueAt);
  }

  statusLabel(status: RowStatus): string {
    const keys: Record<RowStatus, string> = {
      to_review: 'CHK_STATUS_TO_REVIEW',
      overdue: 'CHK_STATUS_OVERDUE',
      due_today: 'CHK_STATUS_DUE_TODAY',
      upcoming: 'CHK_STATUS_UPCOMING',
      no_due: 'CHK_STATUS_WAITING',
      reviewed: 'CHK_STATUS_REVIEWED',
    };
    return this.translate.instant(keys[status]);
  }

  // ───────────────────────── Row actions ─────────────────────────

  openClientProfile(row: CheckinRow, event?: Event): void {
    event?.stopPropagation();
    if (!row.clientId) return;
    void this.router.navigate(['/clients/profil-client', row.clientId], { queryParams: { tab: 'checkins' } });
  }

  messageClient(row: CheckinRow, event?: Event): void {
    event?.stopPropagation();
    if (!row.clientId) return;
    void this.router.navigate(['/chat'], { queryParams: { clientId: row.clientId } });
  }

  /** Withdraws a check-in the client will not answer any more: it leaves the late list (the client stops seeing it). */
  async cancelCheckIn(row: CheckinRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    const result = await Swal.fire({
      title: this.translate.instant('CHK_CANCEL_TITLE'),
      text: this.translate.instant('CHK_CANCEL_TEXT', { client: row.name, form: row.formName }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.translate.instant('CHK_CANCEL_CONFIRM'),
      cancelButtonText: this.translate.instant('CHK_KEEP'),
      confirmButtonColor: '#b91c1c',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    this.saving = true;
    this.assignmentsApi.cancel(row.id).pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.rows = this.rows.filter(r => r.id !== row.id);
        this.assignments.delete(row.id);
        if (this.selected?.id === row.id) this.closeModal();
      },
      error: (err) => {
        const message = err?.error?.message ?? this.translate.instant('CHK_CANCEL_ERROR');
        if (this.selected) this.actionError = message; else this.error = message;
      },
    });
  }

  // ───────────────────────── Opened check-in ─────────────────────────

  openCheckIn(row: CheckinRow): void {
    const assignment = this.assignments.get(row.id);
    if (!assignment) return;

    this.selected = row;
    this.detail = null;
    this.detailError = null;
    this.actionError = null;
    this.feedback = row.coachFeedback ?? '';
    this.editingFeedback = row.status === 'to_review';
    this.detailLoading = true;

    const answered = !!row.submittedAt || assignment.status === 'SUBMITTED' || assignment.status === 'REVIEWED';
    // Answered: the questions frozen with these answers (the form may have been edited since), never the cached form.
    const form$ = answered
      ? this.formsApi.getFormById(row.formId, true, row.id)
      : this.formCache.has(row.formId)
        ? of(this.formCache.get(row.formId)!)
        : this.formsApi.getFormById(row.formId, true);
    const submission$ = answered
      ? this.submissionsApi.getByAssignmentId(row.id).pipe(catchError(() => of(null as Submission | null)))
      : of(null as Submission | null);

    const openedId = row.id;
    forkJoin([form$, submission$]).subscribe({
      next: ([form, submission]) => {
        if (this.selected?.id !== openedId) return; // another check-in was opened meanwhile
        if (!answered) this.formCache.set(row.formId, form);
        const questions: Question[] = (form.questions ?? [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((q: any) => ({
            id: q.id,
            type: q.type as QuestionType,
            label: q.label,
            required: !!q.required,
            order: q.order,
            helpText: q.helpText || undefined,
            minStars: q.minStars ?? undefined,
            maxStars: q.maxStars ?? undefined,
            options: (q.options ?? []).map((o: any) => ({ id: o.id, label: o.label })),
          }));
        const answers = submission?.answers ?? [];
        const questionIds = new Set(questions.map(q => q.id));
        this.detail = {
          questions,
          answers,
          orphanAnswers: answers.filter(a => !questionIds.has(a.questionId) && this.hasValue(a)),
        };
        if (submission?.submittedAt && this.selected) this.selected.submittedAt = submission.submittedAt;
        this.detailLoading = false;
      },
      error: (err) => {
        if (this.selected?.id !== openedId) return;
        this.detailLoading = false;
        this.detailError = err?.status === 404
          ? this.translate.instant('CHK_FORM_DELETED_ERROR')
          : err?.error?.message ?? this.translate.instant('CHK_DETAIL_ERROR');
      },
    });
  }

  closeModal(): void {
    this.selected = null;
    this.detail = null;
    this.feedback = '';
    this.editingFeedback = false;
    this.actionError = null;
    this.detailError = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selected && !this.saving) this.closeModal();
  }

  /** Position of the opened check-in in the current list, for the previous / next arrows. */
  get queuePosition(): number {
    return this.selected ? this.filteredRows.findIndex(r => r.id === this.selected!.id) : -1;
  }

  get queueLength(): number {
    return this.filteredRows.length;
  }

  openSibling(step: 1 | -1): void {
    const rows = this.filteredRows;
    const next = rows[this.queuePosition + step];
    if (next) this.openCheckIn(next);
  }

  get isSubmitted(): boolean {
    return this.selected?.status === 'to_review' || this.selected?.status === 'reviewed';
  }

  getAnswer(questionId: string): Answer | undefined {
    return this.detail?.answers.find(a => a.questionId === questionId);
  }

  hasValue(answer?: Answer): boolean {
    if (!answer) return false;
    const a = answer as any;
    switch (answer.type) {
      case QuestionType.TEXT: return !!String(a.text ?? '').trim();
      case QuestionType.MULTIPLE_CHOICE: return !!a.selectedOptionId;
      case QuestionType.STAR_RATING: return a.rating !== null && a.rating !== undefined;
      case QuestionType.YES_NO: return a.yes !== null && a.yes !== undefined;
      case QuestionType.DATE: return !!a.date;
      default: return false;
    }
  }

  optionLabel(question: Question | undefined, optionId?: string | null): string {
    if (!optionId) return '';
    return question?.options?.find(o => o.id === optionId)?.label || this.translate.instant('CHK_REMOVED_OPTION');
  }

  answerText(answer: Answer, question?: Question): string {
    const a = answer as any;
    switch (answer.type) {
      case QuestionType.TEXT: return a.text ?? '';
      case QuestionType.MULTIPLE_CHOICE: return this.optionLabel(question, a.selectedOptionId);
      case QuestionType.YES_NO: return this.translate.instant(a.yes ? 'YES' : 'NO');
      case QuestionType.STAR_RATING: return `${a.rating ?? 0} / ${question?.maxStars || 5}`;
      case QuestionType.DATE: return this.formatDate(a.date);
      default: return '';
    }
  }

  stars(question: Question): number[] {
    return Array.from({ length: Math.max(1, question.maxStars || 5) }, (_, i) => i + 1);
  }

  rating(questionId: string): number {
    return Number((this.getAnswer(questionId) as any)?.rating ?? 0);
  }

  /** Marks the opened check-in reviewed (with the optional comment the client reads), then opens the next one if asked. */
  saveReview(goNext = false): void {
    const row = this.selected;
    if (!row || this.saving) return;
    const nextRow = goNext ? this.filteredRows[this.queuePosition + 1] : undefined;
    const feedback = this.feedback.trim() || null;

    this.saving = true;
    this.actionError = null;
    this.assignmentsApi.reviewAssignment(row.id, feedback).pipe(finalize(() => (this.saving = false))).subscribe({
      next: (updated) => {
        this.assignments.set(updated.id, updated);
        this.rows = this.rows.map(r => r.id === updated.id ? this.toRow(updated) : r);
        if (nextRow && nextRow.id !== updated.id) {
          this.openCheckIn(nextRow);
        } else {
          this.closeModal();
        }
      },
      error: (err) => {
        this.actionError = err?.error?.message ?? this.translate.instant('MARK_REVIEWED_ERROR');
      },
    });
  }

  /** Ready-made openings (mobile check_in_detail_modal.dart): added to the text, to be edited before sending. */
  get quickReplies(): string[] {
    return this.isFrench
      ? ['Bravo pour la régularité, continuez comme ça !', 'Belle semaine, vos efforts se voient.',
         'Merci pour vos réponses détaillées.', 'On ajuste un peu le programme cette semaine.',
         'Pensez à bien vous reposer et à vous hydrater.']
      : ['Great consistency, keep it up!', 'Nice week, your effort shows.', 'Thanks for the detailed answers.',
         'We will adjust the plan a little this week.', 'Remember to rest and stay hydrated.'];
  }

  addQuickReply(reply: string, field?: HTMLTextAreaElement): void {
    const current = this.feedback.trim();
    this.feedback = current ? `${current} ${reply}` : reply;
    setTimeout(() => { field?.focus(); field?.setSelectionRange(this.feedback.length, this.feedback.length); });
  }

  /** « Lu le 30 oct., 14:05 » under the comment, or « Pas encore lu ». */
  feedbackReadLabel(row: CheckinRow): string {
    const date = row.feedbackSeenAt ? new Date(row.feedbackSeenAt) : null;
    if (!date || isNaN(date.getTime())) return this.isFrench ? 'Pas encore lu par le client' : 'Not read by the client yet';
    const when = new Intl.DateTimeFormat(this.isFrench ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(date);
    return this.isFrench ? `Lu par le client le ${when}` : `Read by the client on ${when}`;
  }

  private get isFrench(): boolean { return (this.translate.currentLang || this.translate.defaultLang) !== 'en'; }

  onFeedbackKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.saveReview(this.selected?.status === 'to_review' && this.queuePosition + 1 < this.queueLength);
    }
  }
}
