import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, finalize, shareReplay, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../environments/environment';
import { ToastAction, ToastService } from './toast.service';
import {
  AssignResult,
  ClientSchedulePreview,
  ShiftPreview,
  ShiftResult,
  ProgramKind,
  ProgramOverview,
  ScheduleChange,
  Sentence,
  doneLine,
  doneSentence,
  failureReasonKey,
  retryable,
} from '@shared/models/program-schedule';

export interface SchedulePreviewRequest {
  kind: ProgramKind;
  /** A library program; or {@link durationDays} for a program still to create; {@link endDate} for a file. */
  programId?: string | null;
  durationDays?: number | null;
  startDate: string | null;
  endDate?: string | null;
  clientIds: string[];
  /** The client program whose dates change ("Modifier les dates"). */
  excludePlanId?: string | null;
}

export interface AssignRequest {
  kind: ProgramKind;
  programId: string;
  startDate: string;
  endDate?: string | null;
  clientIds: string[];
}

/**
 * A check-in of the client's calendar (lot C, L3): on the day it came, else on its due day; `status` is the
 * assignment's own (the window that shows the answers reads it).
 */
export interface CalendarCheckIn {
  id: string;
  formId: string;
  title: string;
  date: string;
  state: 'RECEIVED' | 'UPCOMING' | 'LATE';
  reviewed: boolean;
  status: string;
  dueAt: string | null;
  submittedAt: string | null;
}

/** A period of the client's calendar: the workout programs whole, the nutrition plans without the foods' details. */
export interface ClientCalendarPeriod {
  from: string;
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workoutPlans: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mealPlans: any[];
  checkIns?: CalendarCheckIn[];
}

/** Two days that changed places; `restedDayId`: the day left empty in the middle, made a rest day. */
export interface CalendarSwapResult {
  undoId: string | null;
  restedDayId: string | null;
}

/** Days copied (day numbers) and the ones that received nothing, with why (OUTSIDE, DONE, PAST, TAKEN, EMPTY_SOURCE). */
export interface CalendarCopyResult {
  copied: number[];
  skipped: { day: number; reason: string }[];
  undoId: string | null;
}

const SKIP_LOADER = { 'X-Skip-Loader': 'true' };

/**
 * Affectation des programmes (backlog-programmes.md A2-A7): what changes before the click, the group assignment,
 * « Annuler ». The lists of client programs listen to {@link changed$} to read them again.
 */
@Injectable({ providedIn: 'root' })
export class ProgramScheduleService {
  private readonly url = `${environment.baseApiUrl}/api/program-schedule`;

  /** Fired after an assignment or an « Annuler ». */
  readonly changed$ = new Subject<void>();

  constructor(private http: HttpClient, private toasts: ToastService, private translate: TranslateService) {}

  preview(request: SchedulePreviewRequest): Observable<ClientSchedulePreview[]> {
    return this.http.post<ClientSchedulePreview[]>(`${this.url}/preview`, {
      type: request.kind,
      programId: request.programId || null,
      durationDays: request.durationDays || null,
      startDate: request.startDate,
      endDate: request.endDate || null,
      clientIds: request.clientIds,
      excludePlanId: request.excludePlanId || null,
    }, { headers: SKIP_LOADER });
  }

  assign(request: AssignRequest): Observable<AssignResult> {
    return this.http.post<AssignResult>(`${this.url}/assign`, {
      type: request.kind,
      programId: request.programId,
      startDate: request.startDate,
      endDate: request.endDate || null,
      clientIds: request.clientIds,
    }, { headers: SKIP_LOADER });
  }

  /** Assigns and says what happened; « Réessayer » runs it again for the clients worth trying again. */
  run(request: AssignRequest, names: Record<string, string>): Observable<AssignResult> {
    return this.assign(request).pipe(tap(result => this.announce(result, names, clientIds =>
      this.run({ ...request, clientIds }, names).subscribe({ error: error => this.announceError(error) }))));
  }

  /** A refusal of the whole request (a date in the past, the server out of reach…). */
  announceError(error: any): void {
    const code = error?.error?.code;
    this.toasts.show({
      type: 'error',
      title: this.translate.instant('ASSIGN_FLOW.ALL_FAILED'),
      message: this.translate.instant(code === 'START_IN_PAST' ? 'ASSIGN_FLOW.REASON_START_IN_PAST'
        : code === 'PROGRAM_LOCKED' ? 'ASSIGN_FLOW.LOCKED_ERROR' : 'ASSIGN_FLOW.REASON_UNEXPECTED'),
    });
  }

  /** The last tab read per client (`kind:client`): shown at once when the tab opens, then read again. */
  private readonly overviews = new Map<string, { at: number; value: ProgramOverview }>();
  private readonly overviewReads = new Map<string, Observable<ProgramOverview>>();

  /** The client's « Programmes » tab in one request (P1-P8); the finished programs come by pages of 20. */
  overview(kind: ProgramKind, clientId: string, finishedOffset = 0, finishedLimit = 20): Observable<ProgramOverview> {
    const read = this.http.get<ProgramOverview>(`${this.url}/overview`, {
      params: { clientId, type: kind, finishedOffset, finishedLimit },
      headers: SKIP_LOADER,
    });
    if (finishedOffset > 0 || finishedLimit !== 20) return read;
    // The first page is kept, and a read already running for it is shared (the profile starts it when it opens).
    const key = `${kind}:${clientId}`;
    const running = this.overviewReads.get(key);
    if (running) return running;
    const shared = read.pipe(
      tap(value => {
        if (this.overviews.size > 60) this.overviews.clear();
        this.overviews.set(key, { at: Date.now(), value });
      }),
      finalize(() => this.overviewReads.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.overviewReads.set(key, shared);
    return shared;
  }

  /** The last tab read for this client (by default up to 15 min old), null when unknown or older. */
  overviewSnapshot(kind: ProgramKind, clientId: string, maxAgeMs = 15 * 60_000): ProgramOverview | null {
    const known = this.overviews.get(`${kind}:${clientId}`);
    return known && Date.now() - known.at < maxAgeMs ? known.value : null;
  }

  /** The client profile opens: both tabs are read in the background, they show at once when the coach opens them. */
  prefetchOverviews(clientId: string): void {
    if (!clientId) return;
    (['WORKOUT', 'NUTRITION'] as ProgramKind[]).forEach(kind => {
      const known = this.overviews.get(`${kind}:${clientId}`);
      if (!known || Date.now() - known.at > 30_000) this.overview(kind, clientId).subscribe({ error: () => {} });
    });
  }

  /**
   * The client's calendar from `from` to `to` (yyyy-MM-dd, calendar lot B): the coach's programs of both types whose
   * dates cross the period, instead of all the client's programs.
   */
  calendar(clientId: string, from: string, to: string): Observable<ClientCalendarPeriod> {
    // The calendar says itself when a month cannot be read (with « Réessayer »); the months around are read silently.
    return this.http.get<ClientCalendarPeriod>(`${this.url}/calendar`, {
      params: { clientId, from, to },
      headers: { ...SKIP_LOADER, 'X-Skip-Toast': 'true' },
    });
  }

  /* ---------------- « Décaler la suite » (backlog-programmes.md DS-10) ---------------- */

  /** What « Décaler la suite » proposes (without from/days) and would change. */
  shiftPreview(kind: ProgramKind, programId: string, from?: string | null, days?: number | null): Observable<ShiftPreview> {
    return this.http.post<ShiftPreview>(`${this.url}/shift/preview`, { type: kind, programId, from: from || null, days: days ?? null },
      { headers: SKIP_LOADER });
  }

  shift(kind: ProgramKind, programId: string, from: string, days: number): Observable<ShiftResult> {
    return this.http.post<ShiftResult>(`${this.url}/shift`, { type: kind, programId, from, days }, { headers: SKIP_LOADER });
  }

  undo(undoId: string): Observable<{ removed: number; restored: number }> {
    return this.http.post<{ removed: number; restored: number }>(`${this.url}/undo/${undoId}`, {}, { headers: SKIP_LOADER });
  }

  /* ---------------- texts ---------------- */

  /** "mer. 22 oct." in the coach's language. */
  formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    const locale = (this.translate.currentLang || this.translate.defaultLang || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  };

  /** "lundi" in the coach's language. */
  formatWeekday = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    const locale = (this.translate.currentLang || this.translate.defaultLang || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR';
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(locale, { weekday: 'long' });
  };

  text(sentence: Sentence): string {
    return this.translate.instant(sentence.key, sentence.params);
  }

  /* ---------------- after the click (A7) ---------------- */

  /**
   * Says what happened after a group assignment: how many clients, what changed for each, who failed and why; with
   * « Annuler » (15 s) and « Réessayer » for the failures worth trying again.
   */
  announce(result: AssignResult, names: Record<string, string>, retry?: (clientIds: string[]) => void): void {
    const done = result.results.filter(item => item.ok);
    const failed = result.results.filter(item => !item.ok);
    const name = (clientId: string) => names[clientId] || this.translate.instant('ASSIGN_FLOW.A_CLIENT');
    const details: string[] = [];
    done.forEach(item => (item.changes || []).forEach(change =>
      details.push(this.text(doneSentence(change, name(item.clientId), this.formatDate)))));
    failed.forEach(item => details.push(this.translate.instant('ASSIGN_FLOW.FAILED_DETAIL', {
      client: name(item.clientId),
      reason: this.translate.instant(failureReasonKey(item.errorCode)),
    })));

    const actions: ToastAction[] = [];
    if (result.undoId) {
      const undoId = result.undoId;
      actions.push({ label: this.translate.instant('ASSIGN_FLOW.UNDO_ASSIGN'), icon: 'fa-undo', run: () => this.undoNow(undoId, 'ASSIGN') });
    }
    const again = failed.filter(retryable).map(item => item.clientId);
    if (retry && again.length) {
      actions.push({ label: this.translate.instant('ASSIGN_FLOW.RETRY'), run: () => retry(again) });
    }

    const title = done.length === 0
      ? this.translate.instant('ASSIGN_FLOW.ALL_FAILED')
      : this.translate.instant(done.length === 1 ? 'ASSIGN_FLOW.DONE_ONE' : 'ASSIGN_FLOW.DONE_MANY', { count: done.length });
    this.toasts.show({
      type: done.length === 0 ? 'error' : failed.length ? 'warning' : 'success',
      title,
      details,
      actions,
      hint: result.undoId ? this.translate.instant('ASSIGN_FLOW.UNDO_ASSIGN_HINT') : undefined,
      duration: 15000,
    });
    if (done.length) this.changed$.next();
  }

  /** After a single client program got its dates (creation, import, dates moved): what changed on the others. */
  announceChanges(changes: ScheduleChange[] | null | undefined, clientName?: string, undoId?: string | null): void {
    if (!changes?.length) return;
    const actions: ToastAction[] = undoId
      ? [{ label: this.translate.instant('ASSIGN_FLOW.UNDO_CHANGE'), icon: 'fa-undo', run: () => this.undoNow(undoId, 'CHANGE') }]
      : [];
    this.toasts.show({
      type: 'info',
      icon: 'fa-calendar-check',
      title: clientName
        ? this.translate.instant('ASSIGN_FLOW.SCHEDULE_UPDATED_FOR', { name: clientName })
        : this.translate.instant('ASSIGN_FLOW.SCHEDULE_UPDATED'),
      details: changes.map(change => this.text(doneLine(change, this.formatDate))),
      // What « Annuler ce changement » does: the coach saw it undo the weeks they had just added (2026-10-24).
      hint: undoId ? this.translate.instant('ASSIGN_FLOW.UNDO_CHANGE_HINT') : undefined,
      actions,
      duration: undoId ? 15000 : 10000,
    });
    this.changed$.next();
  }

  /**
   * After « Modifier les dates » (backlog-programmes.md CD-10): the new dates, what changed on the client's other
   * programs, and « Annuler » (the program and the others come back), even when nothing else changed.
   */
  announceMove(result: { scheduleChanges?: ScheduleChange[] | null; scheduleUndoId?: string | null } | null,
               programName: string, start: string, end: string): void {
    const undoId = result?.scheduleUndoId || null;
    const actions: ToastAction[] = undoId
      ? [{ label: this.translate.instant('ASSIGN_FLOW.UNDO_CHANGE'), icon: 'fa-undo', run: () => this.undoNow(undoId, 'CHANGE') }]
      : [];
    this.toasts.show({
      type: 'success',
      icon: 'fa-calendar-check',
      title: this.translate.instant('ASSIGN_FLOW.DATES_MOVED', { name: programName }),
      message: this.translate.instant('ASSIGN_FLOW.RANGE', { start: this.formatDate(start), end: this.formatDate(end) }),
      details: (result?.scheduleChanges || []).map(change => this.text(doneLine(change, this.formatDate))),
      hint: undoId ? this.translate.instant('ASSIGN_FLOW.DATES_UNDO_HINT') : undefined,
      actions,
      duration: undoId ? 15000 : 8000,
    });
    this.changed$.next();
  }

  /** After « Décaler la suite » (DS-10): when it resumes, what changed on the others, « Annuler ». */
  announceShift(result: ShiftResult, programName: string): void {
    const own = result.changes.find(change => change.kind === 'PAUSED');
    this.announceWithUndo(result.undoId,
      this.translate.instant('ASSIGN_FLOW.SHIFT_DONE', { name: programName, date: this.formatDate(own?.newStartDate) }),
      result.changes.filter(change => change !== own));
  }

  /* ---------------- quick changes of the calendar (backlog-programmes.md, calendar lot C, C4) ---------------- */

  /** Two workout days change places (a workout dragged onto another day); on an empty day, the workout moves there. */
  swapDays(programId: string, firstDayId: string, secondDayId: string): Observable<CalendarSwapResult> {
    return this.http.post<CalendarSwapResult>(`${this.url}/calendar/swap`, { programId, firstDayId, secondDayId },
      { headers: { ...SKIP_LOADER, 'X-Skip-Toast': 'true' } });
  }

  /** Days of the program copied onto its empty days (`from` / `to`: day numbers); `dryRun`: what would be copied. */
  copyDays(programId: string, copies: { from: number; to: number }[], dryRun = false): Observable<CalendarCopyResult> {
    return this.http.post<CalendarCopyResult>(`${this.url}/calendar/copy-days`, { programId, copies, dryRun },
      { headers: { ...SKIP_LOADER, 'X-Skip-Toast': 'true' } });
  }

  /** After a change made in the calendar: what it did and « Annuler » (the program comes back as it was). */
  announceCalendarChange(undoId: string | null, title: string, details: string[] = []): void {
    this.announceDone(undoId, title, details, 'CALENDAR_UNDO_HINT');
  }

  private announceWithUndo(undoId: string | null, title: string, changes: ScheduleChange[]): void {
    this.announceDone(undoId, title, changes.map(change => this.text(doneLine(change, this.formatDate))));
  }

  private announceDone(undoId: string | null, title: string, details: string[], hintKey = 'ASSIGN_FLOW.DATES_UNDO_HINT'): void {
    const actions: ToastAction[] = undoId
      ? [{ label: this.translate.instant('ASSIGN_FLOW.UNDO_CHANGE'), icon: 'fa-undo', run: () => this.undoNow(undoId, 'CHANGE') }]
      : [];
    this.toasts.show({
      type: 'success',
      icon: 'fa-calendar-check',
      title,
      details,
      hint: undoId ? this.translate.instant(hintKey) : undefined,
      actions,
      duration: undoId ? 15000 : 8000,
    });
    this.changed$.next();
  }

  private undoNow(undoId: string, what: 'ASSIGN' | 'CHANGE'): void {
    this.undo(undoId).subscribe({
      next: () => {
        this.toasts.show({
          type: 'success',
          title: this.translate.instant(what === 'ASSIGN' ? 'ASSIGN_FLOW.UNDONE' : 'ASSIGN_FLOW.UNDONE_CHANGE'),
          message: this.translate.instant('ASSIGN_FLOW.UNDONE_DETAIL'),
        });
        this.changed$.next();
      },
      error: error => this.toasts.show({
        type: error?.status === 410 ? 'warning' : 'error',
        title: this.translate.instant(error?.status === 410
          ? (what === 'ASSIGN' ? 'ASSIGN_FLOW.UNDO_EXPIRED' : 'ASSIGN_FLOW.UNDO_CHANGE_EXPIRED')
          : 'ASSIGN_FLOW.UNDO_FAILED'),
      }),
    });
  }
}
