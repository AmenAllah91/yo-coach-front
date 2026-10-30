import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subject, catchError, forkJoin, map, of, shareReplay, takeUntil, timeout } from 'rxjs';

import { FormDetails, FormsApiService, PageResponse } from '../services/forms-api.service';
import { AssignmentsApiService, FormAssignment } from '../services/assignments-api.service';
import { SubmissionsApiService } from '../services/submissions-api.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { capitalizeFirst, capitalizeSentences, initials, planDate } from 'app/components/clients/shared/client-plan-utils';
import { CompletionCelebrationComponent } from 'app/components/clients/shared/completion-celebration.component';
import { CelebrationView, celebrationHash, checkinCelebration } from 'app/components/clients/shared/celebration';
import { PagePart, orderedQuestions, pageOf, pagesOf, visibleQuestionIds } from '../checkin-pages';

/** Answer being filled (mobile SubmissionAnswer): every field is sent, like the mobile app. */
interface DraftAnswer {
  questionId: string; type: string; text: string | null; selectedOptionId: string | null;
  rating: number | null; yes: boolean | null; date: string | null;
}

const SUBMITTED = ['SUBMITTED', 'REVIEWED'];

/** Shown between two parts, one after the other. */
const CHEER_EMOJIS = ['🎉', '💪', '🔥', '⭐', '🚀', '🙌', '✨', '🏆'];
const CHEER_EN = ['Great job, keep going!', 'You are flying through it!', 'Nice, your coach will love this.', 'Halfway there and going strong!', 'Almost done, one last push!'];
const CHEER_FR = ['Bravo, continuez comme ça !', 'Vous avancez vite !', 'Super, votre coach va adorer.', 'À mi-chemin, et en pleine forme !', 'Presque fini, un dernier effort !'];

/** Answers you give with one tap: the page then moves on to the next question by itself. */
const ONE_TAP = ['YES_NO', 'MULTIPLE_CHOICE', 'STAR_RATING', 'SCALE', 'OPINION_RATING'];

/**
 * Client check-ins, same content and logic as the mobile CheckInScreen and CheckInFormPage: "To complete"
 * (due soon / overdue) and "Submitted" lists loaded page by page, the form to fill on its own page, and the
 * answers already sent (with the coach review) in a sheet. Also shown read only in the coach "client view".
 */
@Component({
  selector: 'app-my-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, CompletionCelebrationComponent],
  templateUrl: './my-assignments.component.html',
  styleUrls: ['./my-assignments.component.scss'],
})
export class MyAssignmentsComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Coach "client view" preview: this client's check-ins, read only (answers can be viewed, nothing is sent). */
  @Input() previewClientId = '';
  @Input() previewMode = false;

  tab = 0;
  assignments: FormAssignment[] = [];
  /** "Submitted" tab, loaded on its own and newest answer first; [assignments] stays the mixed list of the first tab. */
  sentAssignments: FormAssignment[] = [];
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

  // Filling, page by page: an intro, one part per page, a small celebration between parts.
  stage: 'intro' | 'part' | 'cheer' = 'intro';
  /** The parts (a form without parts: one page). */
  pages: PagePart[] = [];
  pageIndex2 = 0;
  /** Direction of the last page change, for the slide animation. */
  slide: 'forward' | 'back' = 'forward';
  /** Questions shown for the current answers. */
  visible = new Set<string>();
  /** The page the client stopped on last time (null: a new check-in). */
  resumePageId: string | null = null;
  /** Ready to go on: the button glows. */
  pageReady = false;
  celebration: CelebrationView | null = null;
  /** On-time check-ins in a row (CE); the pill shows from two. */
  streak = 0;
  private indexById = new Map<string, number>();
  private startedAt = 0;
  private draftTimer?: ReturnType<typeof setTimeout>;

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
      this.assignmentsApi.getMyStreak().pipe(takeUntil(this.destroy$)).subscribe({
        next: result => this.streak = result?.streak || 0,
        error: () => {},
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
    this.flushDraft();
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------------------------------------------------------
  // List (mobile CheckInProvider.loadPage / loadMore)
  // -------------------------------------------------------------------------
  private page$(page: number): Observable<PageResponse<FormAssignment>> {
    if (this.tab === 1) {
      // Sorted by the day the client filled it, not the day the coach sent it (2026-10-29).
      return this.previewMode
        ? this.assignmentsApi.pageOwnerAssignmentsByAssigneeIdStatuses(page, this.pageSize, 'submittedAt', 'DESC', this.previewClientId, ['SUBMITTED', 'REVIEWED'])
        : this.assignmentsApi.pageMyAssignments(page, this.pageSize, 'submittedAt', 'DESC', undefined, true, ['SUBMITTED', 'REVIEWED']);
    }
    return this.previewMode
      ? this.assignmentsApi.pageOwnerAssignmentsByAsigneeId(page, this.pageSize, 'assignedAt', 'DESC', this.previewClientId)
      : this.assignmentsApi.pageMyAssignments(page, this.pageSize, 'assignedAt', 'DESC', undefined, true);
  }

  loadPage(reset: boolean): void {
    if (reset) { this.loading = true; this.error = ''; this.pageIndex = 0; this.hasMore = true; }
    const sentTab = this.tab === 1;
    this.page$(this.pageIndex).pipe(takeUntil(this.destroy$)).subscribe({
      next: page => {
        const content = page?.content || [];
        this.totalPages = page?.totalPages ?? 0;
        this.hasMore = this.pageIndex + 1 < this.totalPages && content.length > 0;
        this.attachFormNames(content).subscribe(named => {
          if (sentTab) this.sentAssignments = reset ? named : [...this.sentAssignments, ...named];
          else this.assignments = reset ? named : [...this.assignments, ...named];
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
  private form$(formId: string, answeredAssignmentId?: string): Observable<FormDetails> {
    // An answered check-in shows the questions frozen with its answers: cached per check-in, not per form.
    const key = answeredAssignmentId ? `${formId}|${answeredAssignmentId}` : formId;
    let cached = this.formCache.get(key);
    if (!cached) {
      cached = this.formsApi.getFormById(formId, false, answeredAssignmentId).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.formCache.set(key, cached);
    }
    return cached;
  }

  private attachFormNames(list: FormAssignment[]): Observable<FormAssignment[]> {
    if (!list.length) return of([]);
    return forkJoin(list.map(item => (item.formName?.trim() || !item.formId) ? of(item)
      : this.form$(item.formId).pipe(map(form => ({ ...item, formName: form?.title || item.formName })), catchError(() => of(item)))));
  }

  setTab(index: number): void {
    if (index === this.tab) return;
    this.tab = index;
    this.loadPage(true);
  }

  get pending(): FormAssignment[] { return this.assignments.filter(item => item.status === 'ASSIGNED' || item.status === 'OPENED'); }
  get submitted(): FormAssignment[] {
    if (this.tab === 1) return this.sentAssignments;
    return this.assignments.filter(item => SUBMITTED.includes(item.status)).sort(this.bySubmittedDesc);
  }

  private bySubmittedDesc = (a: FormAssignment, b: FormAssignment) => {
    const at = a.submittedAt ? new Date(a.submittedAt).getTime() : null;
    const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : null;
    if (at == null && bt == null) return 0;
    if (at == null) return 1;
    if (bt == null) return -1;
    return bt - at;
  };

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
      this.form$(current.formId, SUBMITTED.includes(current.status) ? current.id : undefined).pipe(takeUntil(this.destroy$)).subscribe({
        next: form => {
          // Page by page: the parts in order, then each part's questions.
          this.pages = pagesOf(form.sections as PagePart[], capitalizeFirst(form.title || ''));
          this.form = { ...form, questions: orderedQuestions(form.questions || [], this.pages) };
          this.indexById = new Map(this.form.questions.map((q, i) => [q.id, i] as const));
          this.selected = { ...item, ...current, formName: current.formName || item.formName || form.title };
          if (SUBMITTED.includes(current.status)) {
            this.submissionsApi.getByAssignmentId(current.id).pipe(takeUntil(this.destroy$)).subscribe({
              next: submission => {
                this.submittedAnswers = submission?.answers || [];
                this.visible = visibleQuestionIds(this.form!.questions, this.pages, this.submittedAnswers);
                this.opening = false;
              },
              error: () => { this.opening = false; this.formError = this.t('Unable to load the answers.', 'Impossible de charger les réponses.'); },
            });
          } else {
            // Answers saved last time come back: the client resumes where they stopped.
            const saved = new Map((current.draftAnswers || []).map((a: any) => [a.questionId, a] as const));
            this.answers = this.form.questions.map(question => {
              const draft: any = saved.get(question.id) || {};
              return {
                questionId: question.id, type: question.type, text: draft.text ?? null,
                selectedOptionId: draft.selectedOptionId ?? null, rating: draft.rating ?? null,
                yes: draft.yes ?? null, date: draft.date ?? null,
              };
            });
            this.resumePageId = saved.size && current.draftSectionId ? current.draftSectionId : (saved.size ? this.pages[0].id : null);
            this.refreshVisible();
            this.stage = 'intro';
            this.pageIndex2 = 0;
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
    this.sentAssignments = this.sentAssignments.map(value => value.id === item.id ? { ...value, ...item } : value);
  }

  closeForm(): void {
    this.flushDraft();
    this.view = 'list'; this.selected = null; this.form = null; this.stage = 'intro';
    setTimeout(() => this.observeSentinel());
  }

  /** « Done » on the celebration: back to the list. */
  celebrationDone(): void {
    this.celebration = null;
    this.answers = [];
    this.closeForm();
  }
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

  /** Only the questions shown count: a question hidden by a condition is neither asked nor required. */
  get shownQuestions(): any[] { return this.questions.filter(q => this.visible.has(q.id)); }
  get answeredCount(): number { return this.shownQuestions.filter(q => this.answered(q, this.idx(q))).length; }
  get requiredLeft(): number {
    return this.shownQuestions.filter(q => !!(q.required ?? q.requiredField) && !this.answered(q, this.idx(q))).length;
  }

  /** Index of a question in [questions] and [answers]. */
  idx(question: any): number { return this.indexById.get(question?.id) ?? -1; }

  // -------------------------------------------------------------------------
  // Pages (one part each): intro, parts, a celebration between parts
  // -------------------------------------------------------------------------
  private refreshVisible(): void {
    this.visible = visibleQuestionIds(this.questions, this.pages, this.answers);
    this.pageReady = this.stage === 'part' && this.pageRequiredLeft === 0 && this.pageUnanswered === 0;
  }

  /** The pages the client goes through: a part whose questions are all hidden is skipped. */
  get shownPages(): PagePart[] {
    return this.pages.filter(page => this.questions.some(q => this.visible.has(q.id) && pageOf(q, this.pages) === page.id));
  }

  get currentPage(): PagePart | null { return this.shownPages[this.pageIndex2] ?? null; }
  get isLastPage(): boolean { return this.pageIndex2 >= this.shownPages.length - 1; }
  get hasParts(): boolean { return this.pages.length > 1 || !!this.form?.sections?.length; }

  pageQuestions(page: PagePart | null): any[] {
    return page ? this.questions.filter(q => this.visible.has(q.id) && pageOf(q, this.pages) === page.id) : [];
  }

  get pageRequiredLeft(): number {
    return this.pageQuestions(this.currentPage).filter(q => this.isRequired(q) && !this.answered(q, this.idx(q))).length;
  }

  private get pageUnanswered(): number {
    return this.pageQuestions(this.currentPage).filter(q => !this.answered(q, this.idx(q))).length;
  }

  /** One segment per part: empty, partly or fully answered. */
  get progressSegments(): { title: string; done: number; current: boolean }[] {
    return this.shownPages.map((page, i) => {
      const shown = this.pageQuestions(page);
      const answered = shown.filter(q => this.answered(q, this.idx(q))).length;
      return { title: page.title, done: shown.length ? answered / shown.length : 0, current: i === this.pageIndex2 && this.stage !== 'intro' };
    });
  }

  get overallPercent(): number {
    const shown = this.shownQuestions.length;
    return shown ? Math.round((this.answeredCount / shown) * 100) : 0;
  }

  get pageMinutes(): number { return Math.min(Math.max(Math.ceil(this.shownQuestions.length * 0.4), 1), 60); }

  /** Index in [shownPages] of the page the client stopped on. */
  get resumeIndex(): number {
    const index = this.shownPages.findIndex(page => page.id === this.resumePageId);
    return index < 0 ? 0 : index;
  }

  isPageDone(page: PagePart): boolean {
    const shown = this.pageQuestions(page);
    return shown.length > 0 && shown.every(q => !this.isRequired(q) || this.answered(q, this.idx(q)));
  }

  start(resume = false): void {
    this.startedAt = Date.now();
    this.goToPage(resume ? this.resumeIndex : 0, 'forward');
  }

  private goToPage(index: number, slide: 'forward' | 'back'): void {
    this.slide = slide;
    this.pageIndex2 = Math.max(0, Math.min(index, this.shownPages.length - 1));
    this.stage = 'part';
    this.refreshVisible();
    window.scrollTo({ top: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  /** Next part, after a short celebration; the last one sends the check-in. */
  nextPage(): void {
    if (this.pageRequiredLeft > 0) { this.scrollToFirstMissing(); return; }
    if (this.isLastPage) { this.submit(); return; }
    this.flushDraft(this.shownPages[this.pageIndex2 + 1]?.id ?? null);
    this.stage = 'cheer';
    window.scrollTo({ top: 0 });
    try { navigator.vibrate?.(25); } catch { /* not supported */ }
  }

  continueAfterCheer(): void { this.goToPage(this.pageIndex2 + 1, 'forward'); }

  previousPage(): void {
    if (this.pageIndex2 === 0) { this.stage = 'intro'; window.scrollTo({ top: 0 }); return; }
    this.goToPage(this.pageIndex2 - 1, 'back');
  }

  /** The part just finished (shown on the celebration between parts). */
  get finishedPage(): PagePart | null { return this.shownPages[this.pageIndex2] ?? null; }
  get nextPagePreview(): PagePart | null { return this.shownPages[this.pageIndex2 + 1] ?? null; }
  get pagesLeft(): number { return this.shownPages.length - this.pageIndex2 - 1; }
  get cheerEmoji(): string { return CHEER_EMOJIS[this.pageIndex2 % CHEER_EMOJIS.length]; }

  /** The coach's word for this part, else an encouragement that changes from one part to the next. */
  get cheerMessage(): string {
    const own = String(this.finishedPage?.endMessage || '').trim();
    if (own) return own;
    const list = this.fr ? CHEER_FR : CHEER_EN;
    const seed = celebrationHash(`${this.selected?.id}|${this.pageIndex2}`);
    return list[seed % list.length];
  }

  private get reducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** After a one-tap answer: on to the next unanswered question of the page. */
  private onAnswered(index: number): void {
    this.refreshVisible();
    this.queueDraft();
    const question = this.questions[index];
    if (!question || !ONE_TAP.includes(question.type)) return;
    const page = this.pageQuestions(this.currentPage);
    const next = page.slice(page.indexOf(question) + 1).find(q => !this.answered(q, this.idx(q)));
    setTimeout(() => {
      const target = next ? document.getElementById('ck-q-' + next.id) : document.getElementById('ck-next');
      target?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: next ? 'center' : 'end' });
    }, 260);
  }

  private scrollToFirstMissing(): void {
    const missing = this.pageQuestions(this.currentPage).find(q => this.isRequired(q) && !this.answered(q, this.idx(q)));
    const element = missing ? document.getElementById('ck-q-' + missing.id) : null;
    element?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'center' });
    element?.classList.remove('shake');
    void element?.offsetWidth;
    element?.classList.add('shake');
  }

  /** The answers are kept as the client goes: they can stop and come back later. */
  private queueDraft(): void {
    if (this.previewMode || !this.selected) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.flushDraft(), 1200);
  }

  private flushDraft(pageId: string | null = this.currentPage?.id ?? null): void {
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = undefined; }
    if (this.previewMode || !this.selected || this.viewMode || !this.answers.length) return;
    const answers = this.answers.filter((a, i) => this.answered(this.questions[i], i));
    if (!answers.length) return;
    this.resumePageId = pageId;
    this.assignmentsApi.saveDraft(this.selected.id, answers, pageId === '__single' ? null : pageId)
      .subscribe({ error: () => { /* kept on the page; saved again with the next answer */ } });
  }

  get formSubtitle(): string {
    if (!this.form) return '';
    if (this.viewMode) {
      const date = this.selected?.submittedAt ? new Date(this.selected.submittedAt) : null;
      return date && !Number.isNaN(date.getTime())
        ? `${this.t('Submitted', 'Soumis')}: ${new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}` : '';
    }
    return this.fr ? `${this.answeredCount} sur ${this.shownQuestions.length} répondues` : `${this.answeredCount} of ${this.shownQuestions.length} answered`;
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

  setOption(index: number, optionId: string): void {
    if (this.viewMode) return;
    this.answers[index].selectedOptionId = optionId;
    this.onAnswered(index);
  }
  setYesNo(index: number, value: boolean): void {
    if (this.viewMode) return;
    this.answers[index].yes = value;
    this.onAnswered(index);
  }
  setRating(index: number, value: number): void {
    if (this.viewMode) return;
    this.answers[index].rating = value;
    this.onAnswered(index);
  }
  setDate(index: number, value: string): void {
    if (this.viewMode) return;
    this.answers[index].date = value || null;
    this.onAnswered(index);
  }
  setText(index: number, value: string): void {
    if (this.viewMode) return;
    this.answers[index].text = value;
    this.onAnswered(index);
  }

  submit(): void {
    if (!this.selected || this.requiredLeft > 0 || this.submitting) return;
    this.submitting = true;
    this.submitError = '';
    const id = this.selected.id;
    // Only what the client was asked: answers to questions hidden since are left out.
    const answers = this.answers.filter(a => this.visible.has(a.questionId));
    const answered = this.answeredCount;
    if (this.draftTimer) { clearTimeout(this.draftTimer); this.draftTimer = undefined; }
    this.submissionsApi.submit(id, { answers: answers as any }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.submitting = false;
        // Reflected at once; the authoritative list follows without a loader.
        this.updateListed({ ...this.selected!, status: 'SUBMITTED', submittedAt: new Date().toISOString() });
        const base = {
          title: this.title(this.selected),
          answered,
          parts: this.shownPages.length,
          durationSeconds: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : null,
          seed: id,
        };
        this.refreshSilently();
        // Change since last time and streak, from saved answers only; slow or failed: shown without them.
        this.assignmentsApi.getInsights(id).pipe(timeout(3000), catchError(() => of(null)), takeUntil(this.destroy$))
          .subscribe(insights => {
            if (insights) this.streak = insights.streak || 0;
            this.celebration = checkinCelebration({ ...base, insights }, this.fr);
          });
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
  trackQuestion = (_: number, question: any) => question.id;
  /** A new element for each page, so each one slides in. */
  trackPage = (_: number, page: PagePart | null) => page?.id ?? '';
  /** Pieces of the burst between two parts (each one its own direction). */
  readonly confettiPieces = Array.from({ length: 16 }, (_, i) => i);

  /** The part a question opens in the answers sheet (its first shown question). */
  partStart(question: any): PagePart | null {
    const pageId = pageOf(question, this.pages);
    const first = this.shownQuestions.find(q => pageOf(q, this.pages) === pageId);
    return first?.id === question.id ? this.pages.find(page => page.id === pageId) ?? null : null;
  }
}
