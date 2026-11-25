import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, Subject, catchError, expand, forkJoin, map, of, reduce, shareReplay, takeUntil, timeout } from 'rxjs';

import { FormDetails, FormsApiService, PageResponse } from '../services/forms-api.service';
import { AssignmentsApiService, FormAssignment } from '../services/assignments-api.service';
import { SubmissionsApiService } from '../services/submissions-api.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { UsersService } from 'app/service/users.service';
import { capitalizeFirst, capitalizeSentences, dateKey, initials, instantDay, planDate } from 'app/components/clients/shared/client-plan-utils';
import { WeekMark, WeekStripComponent, addDays, mondayOf } from 'app/components/clients/shared/week-strip.component';
import { HistoryTimelineComponent } from 'app/components/clients/shared/history-timeline.component';
import { CompletionCelebrationComponent } from 'app/components/clients/shared/completion-celebration.component';
import { CelebrationView, celebrationHash, checkinCelebration } from 'app/components/clients/shared/celebration';
import { PagePart, orderedQuestions, pageOf, pagesOf, visibleQuestionIds } from '../checkin-pages';

/** Answer being filled (mobile SubmissionAnswer): every field is sent, like the mobile app. */
interface DraftAnswer {
  questionId: string; type: string; text: string | null; selectedOptionId: string | null;
  rating: number | null; yes: boolean | null; date: string | null;
}

/** The history page: the days with a check-in (after the filter), and the counts of its summary. */
interface HistoryView {
  byDay: Record<string, FormAssignment[]>;
  days: string[];
  marks: Record<string, WeekMark>;
  first: Date;
  total: number;
  sent: number;
  todo: number;
  rate: number;
}

const SUBMITTED = ['SUBMITTED', 'REVIEWED'];
/** The week view needs every check-in at once: pages of 100, at most 5 (500 check-ins). */
const ALL_PAGE_SIZE = 100;
const ALL_MAX_PAGES = 5;

interface CheckinDay { key: string; date: Date; today: boolean; selected: boolean; items: FormAssignment[]; }

/** Shown between two parts, one after the other. */
const CHEER_EMOJIS = ['🎉', '💪', '🔥', '⭐', '🚀', '🙌', '✨', '🏆'];
const CHEER_EN = ['Great job, keep going!', 'You are flying through it!', 'Nice, your coach will love this.', 'Halfway there and going strong!', 'Almost done, one last push!'];
const CHEER_FR = ['Bravo, continuez comme ça !', 'Vous avancez vite !', 'Super, votre coach va adorer.', 'À mi-chemin, et en pleine forme !', 'Presque fini, un dernier effort !'];

/** Answers you give with one tap: the page then moves on to the next question by itself. */
const ONE_TAP = ['YES_NO', 'MULTIPLE_CHOICE', 'STAR_RATING', 'SCALE', 'OPINION_RATING'];

/**
 * Client check-ins, same content and logic as the mobile CheckInScreen and CheckInFormPage: "To complete"
 * shown by week like the client Workouts page (with a History timeline), the form to fill on its own page, and the
 * answers already sent (with the coach review) in a sheet. Also shown read only in the coach "client view".
 */
@Component({
  selector: 'app-my-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, CompletionCelebrationComponent, WeekStripComponent, HistoryTimelineComponent],
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

  // Week view (same as the client Workouts page): week strip, the picked day in full, then « This week ».
  weekStart = mondayOf(new Date());
  selectedDate = startOfDay(new Date());
  /** Day the client last opened from the history: the timeline comes back on it. */
  historyDay: Date | null = null;
  private openedFrom: 'list' | 'history' = 'list';

  // Opened assignment
  view: 'list' | 'form' | 'history' = 'list';
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
  private readonly formNameCache = new Map<string, Observable<string | null>>();
  private requestedAssignmentId = '';

  constructor(
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private theme: ClientThemeService,
    private users: UsersService,
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
    // Coach preview: `summary` leaves out the questions and drafts (rows show names only).
    return this.previewMode
      ? this.assignmentsApi.pageOwnerAssignmentsByAssigneeIdStatuses(page, ALL_PAGE_SIZE, 'assignedAt', 'DESC', this.previewClientId, [], undefined, true, true)
      : this.assignmentsApi.pageMyAssignments(page, ALL_PAGE_SIZE, 'assignedAt', 'DESC', undefined, true);
  }

  /** Every check-in of the client (newest first), then placed on the day it is due. */
  loadPage(_reset = true): void {
    this.loading = !this.assignments.length;
    this.error = '';
    this.hasMore = false;
    this.page$(0).pipe(
      expand((page, index) => {
        const next = index + 1;
        return next < (page?.totalPages ?? 0) && next < ALL_MAX_PAGES && (page?.content || []).length ? this.page$(next) : EMPTY;
      }),
      reduce((all, page) => [...all, ...(page?.content || [])], [] as FormAssignment[]),
      takeUntil(this.destroy$),
    ).subscribe({
      next: content => {
        this.attachFormNames(content.filter(item => item.status !== 'CANCELED')).subscribe(named => {
          this.assignments = named;
          this.loading = false;
          this.loadingMore = false;
          this.openRequestedAssignment();
        });
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || this.t('Something went wrong', 'Une erreur est survenue');
      },
    });
  }

  /** Kept for the old infinite scroll: everything is loaded at once now. */
  loadMore(): void {}

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

  /**
   * Only for rows without a name (older backend). Silent: a missing form must not show an error toast.
   * A check-in whose form was deleted (old data, deletion is refused now) cannot be opened: it is left out.
   */
  private attachFormNames(list: FormAssignment[]): Observable<FormAssignment[]> {
    if (!list.length) return of([]);
    return forkJoin(list.map(item => (item.formName?.trim() || !item.formId) ? of(item as FormAssignment | null)
      : this.formName$(item.formId).pipe(
          map(title => title === null ? null : { ...item, formName: title || item.formName }),
        )))
      .pipe(map(rows => rows.filter((row): row is FormAssignment => !!row)));
  }

  /** Title of a form, '' when it could not be read for another reason, null when it no longer exists (404). */
  private formName$(formId: string): Observable<string | null> {
    let cached = this.formNameCache.get(formId);
    if (!cached) {
      cached = this.formsApi.getFormById(formId, true).pipe(
        map(form => form?.title || ''),
        catchError(err => of(err?.status === 404 ? null : '')),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.formNameCache.set(formId, cached);
    }
    return cached;
  }

  setTab(index: number): void { this.tab = index; }

  // -------------------------------------------------------------------------
  // Week view: check-ins on the day they are due (display only)
  // -------------------------------------------------------------------------
  /** Day a check-in belongs to: its due date, else the day it was sent. */
  dayOf(item: FormAssignment): Date | null { return instantDay(item.dueAt) ?? instantDay(item.assignedAt); }
  isSubmitted(item: FormAssignment): boolean { return SUBMITTED.includes(item.status); }

  private get byDay(): Record<string, FormAssignment[]> {
    const byDay: Record<string, FormAssignment[]> = {};
    for (const item of this.assignments) {
      const day = this.dayOf(item);
      if (day) (byDay[dateKey(day)] ||= []).push(item);
    }
    return byDay;
  }

  /** Monday to Sunday of the week shown, each with its check-ins. */
  get weekDays(): CheckinDay[] {
    const byDay = this.byDay;
    const today = dateKey(new Date());
    const selected = dateKey(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(this.weekStart, index);
      const key = dateKey(date);
      return { key, date, today: key === today, selected: key === selected, items: byDay[key] || [] };
    });
  }

  weekIsEmpty(days: CheckinDay[]): boolean { return days.every(day => !day.items.length); }
  focusDay(days: CheckinDay[]): CheckinDay { return days.find(day => day.selected) ?? days.find(day => day.today) ?? days[0]; }
  otherDays(days: CheckinDay[]): CheckinDay[] { return days.filter(day => !day.selected && day.items.length); }

  /** Check-ins still to send whose day is before this week: shown above it, they can still be sent. */
  get olderOverdue(): FormAssignment[] {
    const weekStart = this.weekStart.getTime();
    return this.overdue.filter(item => (this.dayOf(item)?.getTime() ?? weekStart) < weekStart);
  }

  /**
   * Like Workouts: a late check-in stays on its own day (red mark in the strip), no list above the week.
   * One line only says how many are late before this week and opens the most recent one's day.
   */
  goToLatestLate(late: FormAssignment[]): void {
    const latest = late.map(item => this.dayOf(item)).filter((day): day is Date => !!day)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (latest) this.showWeekOf(latest);
  }

  private marksOf(byDay: Record<string, FormAssignment[]>): Record<string, WeekMark> {
    const today = dateKey(new Date());
    const marks: Record<string, WeekMark> = {};
    for (const [key, items] of Object.entries(byDay)) {
      if (!items.length) continue;
      const sent = items.filter(item => this.isSubmitted(item)).length;
      marks[key] = sent === items.length ? 'done' : key < today ? 'missed' : 'planned';
    }
    return marks;
  }

  get weekMarks(): Record<string, WeekMark> {
    const marks: Record<string, FormAssignment[]> = {};
    for (const day of this.weekDays) marks[day.key] = day.items;
    return this.marksOf(marks);
  }

  shiftWeek(delta: number): void { this.showWeekOf(addDays(this.weekStart, delta * 7), false); }
  goToday(): void { this.showWeekOf(startOfDay(new Date())); }

  /** Shows the week of `date`: `date` is opened, or today / the first day with a check-in when browsing. */
  private showWeekOf(date: Date, select = true): void {
    this.weekStart = mondayOf(date);
    if (select) { this.selectedDate = date; return; }
    const days = this.weekDays;
    this.selectedDate = (days.find(day => day.today) ?? days.find(day => day.items.length) ?? days[0]).date;
  }

  selectDate(date: Date): void {
    this.selectedDate = date;
    setTimeout(() => document.querySelector(`.checkins [data-day="${dateKey(date)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  }

  /** « Today · Tue, Nov 17 » / « Aujourd’hui · mar. 17 nov. », or the date alone for another day. */
  focusLabel(day: CheckinDay): string {
    const date = new Intl.DateTimeFormat(this.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(day.date);
    return day.today ? `${this.t('Today', 'Aujourd’hui')} · ${date}` : capitalizeFirst(date);
  }
  weekdayLabel(date: Date): string { return new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(date).toUpperCase(); }
  sentCount(items: FormAssignment[]): number { return items.filter(item => this.isSubmitted(item)).length; }

  // History: the days up to today on the timeline of Workouts and Nutrition.
  openHistory(): void { this.historyDay = null; this.view = 'history'; window.scrollTo({ top: 0 }); }
  closeHistory(): void { this.view = 'list'; window.scrollTo({ top: 0 }); }

  get historyByDay(): Record<string, FormAssignment[]> {
    const today = dateKey(new Date());
    const byDay: Record<string, FormAssignment[]> = {};
    for (const [key, items] of Object.entries(this.byDay)) if (key <= today) byDay[key] = items;
    return byDay;
  }

  historyFirstDay(byDay: Record<string, FormAssignment[]>): Date {
    const first = Object.keys(byDay).sort()[0];
    return (first ? planDate(first) : null) ?? startOfDay(new Date());
  }

  historyMarks(byDay: Record<string, FormAssignment[]>): Record<string, WeekMark> { return this.marksOf(byDay); }

  /** History filter: everything, the sent ones, or the ones not sent. */
  historyFilter: 'all' | 'sent' | 'todo' = 'all';
  private historyCache: { key: string; value: HistoryView } | null = null;

  /**
   * What the history shows, computed once per change (not on every check): the days with a check-in only,
   * their marks, and the counts of the summary and of the filters.
   */
  get history(): HistoryView {
    const key = this.historyFilter + '|' + this.assignments.map(item => item.id + ':' + item.status).join(',');
    if (this.historyCache?.key === key) return this.historyCache.value;
    const all = this.historyByDay;
    const items = Object.values(all).flat();
    const sent = items.filter(item => this.isSubmitted(item)).length;
    const keep = (item: FormAssignment) => this.historyFilter === 'all'
      || (this.historyFilter === 'sent') === this.isSubmitted(item);
    const byDay: Record<string, FormAssignment[]> = {};
    for (const [day, list] of Object.entries(all)) {
      const shown = list.filter(keep);
      if (shown.length) byDay[day] = shown;
    }
    const value: HistoryView = {
      byDay,
      days: Object.keys(byDay),
      marks: this.marksOf(all),
      first: this.historyFirstDay(all),
      total: items.length,
      sent,
      todo: items.length - sent,
      rate: items.length ? Math.round((sent / items.length) * 100) : 0,
    };
    this.historyCache = { key, value };
    return value;
  }

  setHistoryFilter(filter: 'all' | 'sent' | 'todo'): void { this.historyFilter = filter; }

  openFromHistory(item: FormAssignment): void {
    this.historyDay = this.dayOf(item);
    this.openedFrom = 'history';
    this.open(item);
  }

  openFromList(item: FormAssignment): void {
    this.openedFrom = 'list';
    this.open(item);
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
    const due = instantDay(value);
    if (!due) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  }

  private byDue = (a: FormAssignment, b: FormAssignment) => {
    const ad = instantDay(a.dueAt)?.getTime(); const bd = instantDay(b.dueAt)?.getTime();
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
    if (known) {
      const day = this.dayOf(known);
      if (day) this.showWeekOf(day);
      this.open(known);
      return;
    }
    this.assignmentsApi.getById(id).pipe(takeUntil(this.destroy$)).subscribe({ next: item => this.open(item), error: () => {} });
  }

  open(item: FormAssignment): void {
    this.loadCoach(item.ownerId);
    this.draftState = 'idle';
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
    // Back where the check-in was opened from (the week or the history).
    this.view = this.openedFrom === 'history' ? 'history' : 'list';
    this.openedFrom = 'list';
    this.selected = null; this.form = null; this.stage = 'intro';
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
    this.draftState = 'saving';
    this.assignmentsApi.saveDraft(this.selected.id, answers, pageId === '__single' ? null : pageId)
      .subscribe({
        next: () => { this.draftState = 'saved'; },
        error: () => { this.draftState = 'idle'; /* kept on the page; saved again with the next answer */ },
      });
  }

  /** Small « Enregistré » in the header once the answers reached the server (they are kept as the client goes). */
  draftState: 'idle' | 'saving' | 'saved' = 'idle';

  /** The progress bar keeps its segments while the client types: a new segment each letter replayed its shine. */
  trackSegment = (index: number) => index;

  get formSubtitle(): string {
    if (!this.form) return '';
    if (this.viewMode) {
      const date = this.selected?.submittedAt ? new Date(this.selected.submittedAt) : null;
      return date && !Number.isNaN(date.getTime())
        ? `${this.t('Submitted', 'Soumis')}: ${new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}` : '';
    }
    const total = this.shownQuestions.length;
    return this.fr
      ? `${this.answeredCount} sur ${total} répondue${this.answeredCount > 1 ? 's' : ''}`
      : `${this.answeredCount} of ${total} answered`;
  }

  get description(): string { return capitalizeSentences(this.form?.description); }
  get minutes(): number { return Math.min(Math.max(Math.ceil(this.questions.length * 0.5), 1), 60); }
  get ownerName(): string {
    const name = String((this.selected as any)?.ownerName || (this.selected as any)?.coachName || this.coachDisplayName || '').trim();
    return name ? titleWords(name) : 'Coach';
  }
  get ownerInitials(): string { return initials(this.ownerName); }

  // -------------------------------------------------------------------------
  // The coach on the intro screen: the sender of the check-in (its ownerId), name and photo of its profile
  // (a client may read its coach's public profile). Silent: the initials stay if it cannot be read.
  // -------------------------------------------------------------------------
  coachDisplayName = '';
  coachPhotoUrl = '';
  coachPhotoFailed = false;
  private coachLoadedFor = '';

  private loadCoach(coachId: string | null | undefined): void {
    const id = (coachId || '').trim();
    if (!id || this.previewMode || id === this.coachLoadedFor) return;
    this.coachLoadedFor = id;
    this.users.getUserById(id, true, true).pipe(takeUntil(this.destroy$), catchError(() => of(null))).subscribe(user => {
      if (this.coachLoadedFor !== id) return;
      this.coachDisplayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      const photo = String(user?.avatarUrl || '').trim();
      this.coachPhotoUrl = photo.toLowerCase() === 'not found' ? '' : photo;
      this.coachPhotoFailed = false;
    });
  }

  /** « 1 question » / « 5 questions », « 1 partie » / « 3 parties ». */
  questionsLabel(count: number): string {
    return this.fr ? `${count} question${count > 1 ? 's' : ''}` : `${count} question${count > 1 ? 's' : ''}`;
  }
  partsLabel(count: number): string {
    return this.fr ? `${count} partie${count > 1 ? 's' : ''}` : `${count} part${count > 1 ? 's' : ''}`;
  }

  /** Number of a question in the whole check-in (« Question 2 sur 5 »). */
  questionNumber(question: any): number { return this.shownQuestions.indexOf(question) + 1; }

  /** Without parts: the first questions, so the client knows what is asked before starting. */
  readonly previewLimit = 4;
  get previewQuestions(): any[] { return this.shownQuestions.slice(0, this.previewLimit); }

  /** Shown when the coach wrote no description. */
  get introText(): string {
    if (this.description) return this.description;
    const coach = this.coachDisplayName ? titleWords(this.coachDisplayName) : '';
    return coach
      ? this.t(`Your answers help ${coach} adjust your coaching.`, `Vos réponses aident ${coach} à adapter votre suivi.`)
      : this.t('Your answers help your coach adjust your coaching.', 'Vos réponses aident votre coach à adapter votre suivi.');
  }
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
  trackByDay = (_: number, day: CheckinDay) => day.key;
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

function startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

/** « sami ben ali » → « Sami Ben Ali ». */
function titleWords(value: string): string {
  return value.split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
