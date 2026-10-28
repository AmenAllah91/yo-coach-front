import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subject, catchError, forkJoin, map, of, shareReplay, takeUntil } from 'rxjs';

import { FormDetails, FormsApiService, PageResponse } from '../services/forms-api.service';
import { AssignmentsApiService, FormAssignment } from '../services/assignments-api.service';
import { SubmissionsApiService } from '../services/submissions-api.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { capitalizeFirst, capitalizeSentences, initials, planDate } from 'app/components/clients/shared/client-plan-utils';

/** Answer being filled (mobile SubmissionAnswer): every field is sent, like the mobile app. */
interface DraftAnswer {
  questionId: string; type: string; text: string | null; selectedOptionId: string | null;
  rating: number | null; yes: boolean | null; date: string | null;
}

const SUBMITTED = ['SUBMITTED', 'REVIEWED'];

/**
 * Client check-ins, same content and logic as the mobile CheckInScreen and CheckInFormPage: "To complete"
 * (due soon / overdue) and "Submitted" lists loaded page by page, the form to fill on its own page, and the
 * answers already sent (with the coach review) in a sheet. Also shown read only in the coach "client view".
 */
@Component({
  selector: 'app-my-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './my-assignments.component.html',
  styleUrls: ['./my-assignments.component.scss'],
})
export class MyAssignmentsComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Coach "client view" preview: this client's check-ins, read only (answers can be viewed, nothing is sent). */
  @Input() previewClientId = '';
  @Input() previewMode = false;

  tab = 0;
  assignments: FormAssignment[] = [];
  loading = false;
  loadingMore = false;
  error = '';
  private pageIndex = 0;
  private readonly pageSize = 10;
  private totalPages = 0;
  private hasMore = true;

  // Opened assignment
  view: 'list' | 'form' = 'list';
  sheetOpen = false;
  opening = false;
  formError = '';
  submitError = '';
  submitting = false;
  selected: FormAssignment | null = null;
  form: FormDetails | null = null;
  answers: DraftAnswer[] = [];
  submittedAnswers: any[] = [];

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;
  private readonly destroy$ = new Subject<void>();
  private readonly formCache = new Map<string, Observable<FormDetails>>();
  private requestedAssignmentId = '';

  constructor(
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private theme: ClientThemeService,
  ) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnInit(): void {
    this.theme.ensureLoaded();
    if (!this.previewMode) {
      this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
        this.requestedAssignmentId = params.get('assignmentId') || '';
        this.loadPage(true);
      });
    } else {
      this.loadPage(true);
    }
  }

  /** Infinite scroll: the next page loads when the end of the list comes into view. */
  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) this.loadMore();
    }, { rootMargin: '200px' });
    setTimeout(() => this.observeSentinel());
  }

  private observeSentinel(): void {
    this.observer?.disconnect();
    if (this.sentinel?.nativeElement) this.observer?.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------------------------------------------------------
  // List (mobile CheckInProvider.loadPage / loadMore)
  // -------------------------------------------------------------------------
  private page$(page: number): Observable<PageResponse<FormAssignment>> {
    return this.previewMode
      ? this.assignmentsApi.pageOwnerAssignmentsByAsigneeId(page, this.pageSize, 'assignedAt', 'DESC', this.previewClientId)
      : this.assignmentsApi.pageMyAssignments(page, this.pageSize, 'assignedAt', 'DESC', undefined, true);
  }

  loadPage(reset: boolean): void {
    if (reset) { this.loading = true; this.error = ''; this.pageIndex = 0; this.hasMore = true; }
    this.page$(this.pageIndex).pipe(takeUntil(this.destroy$)).subscribe({
      next: page => {
        const content = page?.content || [];
        this.totalPages = page?.totalPages ?? 0;
        this.hasMore = this.pageIndex + 1 < this.totalPages && content.length > 0;
        this.attachFormNames(content).subscribe(named => {
          this.assignments = reset ? named : [...this.assignments, ...named];
          this.loading = false;
          this.loadingMore = false;
          setTimeout(() => this.observeSentinel());
          if (reset) this.openRequestedAssignment();
        });
      },
      error: err => {
        this.loading = false;
        if (this.loadingMore) { this.pageIndex = Math.max(this.pageIndex - 1, 0); this.loadingMore = false; }
        this.error = err?.error?.message || err?.message || this.t('Something went wrong', 'Une erreur est survenue');
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore || this.loading || !this.hasMore || this.view !== 'list') return;
    this.loadingMore = true;
    this.pageIndex += 1;
    this.loadPage(false);
  }

  /** Forms rarely change: cached so names and re-opened forms are instant. */
  private form$(formId: string): Observable<FormDetails> {
    let cached = this.formCache.get(formId);
    if (!cached) {
      cached = this.formsApi.getFormById(formId).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.formCache.set(formId, cached);
    }
    return cached;
  }

  private attachFormNames(list: FormAssignment[]): Observable<FormAssignment[]> {
    if (!list.length) return of([]);
    return forkJoin(list.map(item => (item.formName?.trim() || !item.formId) ? of(item)
      : this.form$(item.formId).pipe(map(form => ({ ...item, formName: form?.title || item.formName })), catchError(() => of(item)))));
  }

  setTab(index: number): void { this.tab = index; }

  get pending(): FormAssignment[] { return this.assignments.filter(item => item.status === 'ASSIGNED' || item.status === 'OPENED'); }
  get submitted(): FormAssignment[] { return this.assignments.filter(item => SUBMITTED.includes(item.status)); }

  /** A coach comment the client has not opened yet ("New" badge; never in the coach's preview). */
  hasNewFeedback(item: FormAssignment | null): boolean {
    return !this.previewMode && !!item && !!String(item.coachFeedback || '').trim() && !item.feedbackSeenAt;
  }

  get newFeedbackCount(): number { return this.submitted.filter(item => this.hasNewFeedback(item)).length; }

  private daysUntil(value: string | undefined | null): number | null {
    const due = planDate(value);
    if (!due) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  }

  private byDue = (a: FormAssignment, b: FormAssignment) => {
    const ad = planDate(a.dueAt)?.getTime(); const bd = planDate(b.dueAt)?.getTime();
    if (ad == null && bd == null) return 0;
    if (ad == null) return 1;
    if (bd == null) return -1;
    return ad - bd;
  };

  get dueSoon(): FormAssignment[] {
    return this.pending.filter(item => (this.daysUntil(item.dueAt) ?? 0) >= 0).sort(this.byDue);
  }
  get overdue(): FormAssignment[] {
    return this.pending.filter(item => (this.daysUntil(item.dueAt) ?? 0) < 0).sort(this.byDue);
  }

  title(item: FormAssignment | null): string { return capitalizeFirst(item?.formName || item?.formId || ''); }

  /** Due / submitted chip of a card (mobile _assignmentCard). */
  chip(item: FormAssignment, submitted: boolean): { label: string; color: string; icon?: string } | null {
    if (submitted) {
      if (String(item.coachFeedback || '').trim()) {
        return { label: this.t('Coach replied', 'Le coach a répondu'), color: 'var(--yc-primary)', icon: 'message-circle' };
      }
      return { label: item.status === 'REVIEWED' ? this.t('Reviewed', 'Revu') : this.t('Submitted', 'Soumis'), color: '#1E8E4E', icon: 'check' };
    }
    return this.dueChip(item);
  }

  dueChip(item: FormAssignment | null): { label: string; color: string } | null {
    const days = this.daysUntil(item?.dueAt);
    if (days == null) return null;
    if (days < 0) {
      const n = -days;
      return { label: this.fr ? `En retard de ${n} jour${n > 1 ? 's' : ''}` : `${n} day${n > 1 ? 's' : ''} overdue`, color: 'var(--yc-error)' };
    }
    if (days === 0) return { label: this.t('Due today', "Pour aujourd'hui"), color: '#D97706' };
    return { label: this.fr ? `Dans ${days} jour${days > 1 ? 's' : ''}` : `Due in ${days} day${days > 1 ? 's' : ''}`, color: 'var(--yc-text-secondary)' };
  }

  meta(item: FormAssignment, submitted: boolean): string {
    const format = (value?: string) => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(this.locale, { month: 'short', day: 'numeric' }).format(date) : '';
    };
    if (submitted) { const d = format(item.submittedAt); return d ? `${this.t('Submitted on', 'Soumis le')} ${d}` : ''; }
    const d = format(item.assignedAt);
    return d ? `${this.t('Assigned', 'Assigné le')} ${d}` : '';
  }

  // -------------------------------------------------------------------------
  // Opening (mobile CheckInProvider.openAssignment)
  // -------------------------------------------------------------------------
  private openRequestedAssignment(): void {
    const id = this.requestedAssignmentId.trim();
    if (!id) return;
    this.requestedAssignmentId = '';
    const known = this.assignments.find(item => item.id === id);
    if (known) { this.open(known); return; }
    this.assignmentsApi.getById(id).pipe(takeUntil(this.destroy$)).subscribe({ next: item => this.open(item), error: () => {} });
  }

  open(item: FormAssignment): void {
    const submitted = SUBMITTED.includes(item.status);
    // Preview: only the answers already sent can be read; an open check-in is the client's to fill.
    if (this.previewMode && !submitted) return;
    this.selected = item;
    this.form = null;
    this.answers = [];
    this.submittedAnswers = [];
    this.formError = '';
    this.submitError = '';
    this.opening = true;
    if (submitted) this.sheetOpen = true; else { this.view = 'form'; window.scrollTo({ top: 0 }); }
    if (submitted && this.hasNewFeedback(item)) this.markFeedbackSeen(item);

    const assignment$ = this.previewMode ? of(item) : this.assignmentsApi.getById(item.id).pipe(catchError(() => of(item)));
    assignment$.pipe(takeUntil(this.destroy$)).subscribe(current => {
      if (current.status === 'ASSIGNED' && !this.previewMode) {
        this.assignmentsApi.markOpened(current.id).subscribe({
          next: opened => this.updateListed({ ...current, status: opened?.status || 'OPENED', openedAt: opened?.openedAt }),
          error: () => {},
        });
      }
      this.form$(current.formId).pipe(takeUntil(this.destroy$)).subscribe({
        next: form => {
          this.form = { ...form, questions: [...(form.questions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) };
          this.selected = { ...item, ...current, formName: current.formName || item.formName || form.title };
          if (SUBMITTED.includes(current.status)) {
            this.submissionsApi.getByAssignmentId(current.id).pipe(takeUntil(this.destroy$)).subscribe({
              next: submission => { this.submittedAnswers = submission?.answers || []; this.opening = false; },
              error: () => { this.opening = false; this.formError = this.t('Unable to load the answers.', 'Impossible de charger les réponses.'); },
            });
          } else {
            this.answers = this.form.questions.map(question => ({
              questionId: question.id, type: question.type, text: null, selectedOptionId: null, rating: null, yes: null, date: null,
            }));
            this.opening = false;
          }
        },
        error: () => { this.opening = false; this.formError = this.t('Unable to load the form', 'Impossible de charger le formulaire'); },
      });
    });
  }

  retryOpen(): void { if (this.selected) this.open(this.selected); }

  /** The comment is read once the check-in is opened: the badge goes at once, the server keeps the date. */
  private markFeedbackSeen(item: FormAssignment): void {
    const seenAt = new Date().toISOString();
    this.updateListed({ ...item, feedbackSeenAt: seenAt });
    this.assignmentsApi.markFeedbackSeen(item.id).pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
  }

  private updateListed(item: FormAssignment): void {
    this.assignments = this.assignments.map(value => value.id === item.id ? { ...value, ...item } : value);
  }

  closeForm(): void { this.view = 'list'; this.selected = null; this.form = null; setTimeout(() => this.observeSentinel()); }
  closeSheet(): void { this.sheetOpen = false; this.selected = null; this.form = null; }

  // -------------------------------------------------------------------------
  // Form page (mobile CheckInFormPage)
  // -------------------------------------------------------------------------
  get viewMode(): boolean { return this.previewMode || SUBMITTED.includes(this.selected?.status || ''); }
  get questions(): any[] { return (this.form?.questions || []) as any[]; }

  answered(question: any, index: number): boolean {
    const answer = this.answers[index];
    if (!answer) return false;
    switch (question.type) {
      case 'YES_NO': return answer.yes != null;
      case 'STAR_RATING': case 'SCALE': case 'OPINION_RATING': return answer.rating != null;
      case 'MULTIPLE_CHOICE': return !!(answer.selectedOptionId || '').trim();
      case 'DATE': return !!(answer.date || '').trim();
      default: return !!(answer.text || '').trim();
    }
  }

  get answeredCount(): number { return this.questions.filter((q, i) => this.answered(q, i)).length; }
  get requiredLeft(): number { return this.questions.filter((q, i) => !!(q.required ?? q.requiredField) && !this.answered(q, i)).length; }

  get formSubtitle(): string {
    if (!this.form) return '';
    if (this.viewMode) {
      const date = this.selected?.submittedAt ? new Date(this.selected.submittedAt) : null;
      return date && !Number.isNaN(date.getTime())
        ? `${this.t('Submitted', 'Soumis')}: ${new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}` : '';
    }
    return this.fr ? `${this.answeredCount} sur ${this.questions.length} répondues` : `${this.answeredCount} of ${this.questions.length} answered`;
  }

  get description(): string { return capitalizeSentences(this.form?.description); }
  get minutes(): number { return Math.min(Math.max(Math.ceil(this.questions.length * 0.5), 1), 60); }
  get ownerName(): string { return String((this.selected as any)?.ownerName || (this.selected as any)?.coachName || 'Coach'); }
  get ownerInitials(): string { return initials(this.ownerName); }
  get coachName(): string {
    const name = String(this.selected?.coachName || (this.selected as any)?.ownerName || '').trim();
    return name || this.t('Your coach', 'Votre coach');
  }

  get coachNameInitials(): string { return initials(this.coachName); }

  get feedbackDate(): string {
    const date = this.selected?.reviewedAt ? new Date(this.selected.reviewedAt) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' }).format(date) : '';
  }

  /** Reply: the coach conversation opens with a message that says which check-in it is about. */
  replyToCoach(): void {
    const date = this.selected?.submittedAt ? new Date(this.selected.submittedAt) : null;
    const when = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' }).format(date) : '';
    const name = this.title(this.selected);
    const draft = this.fr
      ? `À propos de mon check-in « ${name} »${when ? ' du ' + when : ''} : `
      : `About my check-in "${name}"${when ? ' of ' + when : ''}: `;
    this.closeSheet();
    void this.router.navigate(['/chat'], { queryParams: { coach: 1, draft } });
  }

  get coachFeedback(): string {
    const item: any = this.selected || {};
    return String(item.coachFeedback || item.feedback || item.review?.feedback || item.submission?.coachFeedback || '').trim();
  }

  label(question: any): string { return capitalizeFirst(question?.label); }
  helpText(question: any): string { return capitalizeSentences(question?.helpText); }
  isRequired(question: any): boolean { return !!(question?.required ?? question?.requiredField); }
  maxStars(question: any): number { const n = Number(question?.maxStars) || 0; return n <= 0 ? 5 : n; }
  range(n: number): number[] { return Array.from({ length: n }, (_, i) => i + 1); }
  optionLabel(option: any): string { return String(option?.label || '').trim() ? capitalizeFirst(option.label) : this.t('Option', 'Option'); }

  submittedAnswer(question: any): any { return this.submittedAnswers.find(answer => answer.questionId === question.id); }
  value(question: any, index: number): any { return this.viewMode ? this.submittedAnswer(question) : this.answers[index]; }

  setOption(index: number, optionId: string): void { if (!this.viewMode) this.answers[index].selectedOptionId = optionId; }
  setYesNo(index: number, value: boolean): void { if (!this.viewMode) this.answers[index].yes = value; }
  setRating(index: number, value: number): void { if (!this.viewMode) this.answers[index].rating = value; }
  setDate(index: number, value: string): void { if (!this.viewMode) this.answers[index].date = value || null; }
  setText(index: number, value: string): void { if (!this.viewMode) this.answers[index].text = value; }

  submit(): void {
    if (!this.selected || this.requiredLeft > 0 || this.submitting) return;
    this.submitting = true;
    this.submitError = '';
    const id = this.selected.id;
    this.submissionsApi.submit(id, { answers: this.answers as any }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.submitting = false;
        // Reflected at once; the authoritative list follows without a loader.
        this.updateListed({ ...this.selected!, status: 'SUBMITTED', submittedAt: new Date().toISOString() });
        this.closeForm();
        this.refreshSilently();
      },
      error: err => {
        this.submitting = false;
        this.submitError = err?.error?.error || err?.error?.message || this.t('Unable to submit the check-in.', "Impossible d'envoyer le check-in.");
      },
    });
  }

  private refreshSilently(): void {
    this.page$(0).pipe(takeUntil(this.destroy$)).subscribe({
      next: page => this.attachFormNames(page?.content || []).subscribe(named => {
        this.assignments = named;
        this.pageIndex = 0;
        this.totalPages = page?.totalPages ?? 0;
        this.hasMore = this.totalPages > 1;
      }),
      error: () => {},
    });
  }

  trackById = (_: number, item: FormAssignment) => item.id;
}
