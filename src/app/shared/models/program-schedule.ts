/**
 * Affectation des programmes (backlog-programmes.md A2-A9): one start date for all the selected clients, the new
 * program takes its place on each client's calendar. The server computes the changes; these helpers build the dates
 * shortcuts and the sentences, and tell when a client program is read-only.
 */

export type ProgramKind = 'WORKOUT' | 'NUTRITION';
export type ScheduleChangeKind = 'STOPPED' | 'REMOVED' | 'SHIFTED' | 'PAUSED';

/** One change the rule makes to another program of the client (server ProgramScheduleChange). */
export interface ScheduleChange {
  clientId: string;
  programId: string;
  programName: string;
  kind: ScheduleChangeKind;
  startDate: string;
  endDate: string;
  newEndDate?: string | null;
  preparedDaysLost: number;
  file: boolean;
  /** SHIFTED: its new start (its new end is newEndDate). PAUSED: the day it resumes (DS-01/DS-02). */
  newStartDate?: string | null;
}

/* ---------------- « Décaler la suite » and pause (backlog-programmes.md DS-01/DS-02) ---------------- */

/** What « Décaler la suite » proposes (P1) and would change (server ProgramShiftService.ShiftPreview). */
export interface ShiftPreview {
  startDate: string;
  endDate: string;
  /** The day it proposes: workout, the first day missed; nutrition, today. */
  suggestedFrom: string | null;
  /** The client's last activity in it: the days can move from the day after. */
  lastActivity: string | null;
  newEndDate: string | null;
  changes: ScheduleChange[];
}

export interface ShiftResult {
  programId: string;
  startDate: string;
  endDate: string;
  changes: ScheduleChange[];
  undoId: string | null;
}

export interface PauseView {
  id: string;
  fromDate: string;
  toDate: string;
  types: ProgramKind[];
}

/** What a pause changes by type (WORKOUT, NUTRITION); pause and undoId once saved. */
export interface PauseResult {
  pause: PauseView | null;
  changes: Partial<Record<ProgramKind, ScheduleChange[]>>;
  undoId: string | null;
}

/** The server refused to move days the client already did, or days before them (409, S4). */
export function isAfterActivityError(error: any): boolean {
  return error?.status === 409 && error?.error?.code === 'SHIFT_BEFORE_ACTIVITY';
}

/** « Décaler la suite »: the first day that can move (the day after the client's last activity, else its start). */
export function firstShiftableDay(preview: Pick<ShiftPreview, 'startDate' | 'lastActivity'>): string {
  const after = preview.lastActivity ? addDaysIso(preview.lastActivity, 1) : null;
  const start = String(preview.startDate || '').slice(0, 10);
  return after && after > start ? after : start;
}

/** The day it resumes by default (P1): today when the days to move are already late, else a week later. */
export function defaultResume(from: string, today: string): string {
  return from < today ? today : addDaysIso(from, 7);
}

export interface ClientSchedulePreview {
  clientId: string;
  startDate: string | null;
  endDate: string | null;
  nextFreeDate: string | null;
  changes: ScheduleChange[];
  errorCode?: string | null;
  error?: string | null;
  /** A program that grows (P9): the programs that would start later instead of being removed. */
  shifts?: ScheduleChange[];
}

export interface ClientAssignResult {
  clientId: string;
  ok: boolean;
  programId: string | null;
  startDate: string | null;
  endDate: string | null;
  changes: ScheduleChange[];
  errorCode?: string | null;
  error?: string | null;
}

export interface AssignResult {
  undoId: string | null;
  results: ClientAssignResult[];
}

export type DateShortcutKey = 'CONTINUITY' | 'TODAY' | 'TOMORROW' | 'NEXT_MONDAY' | 'MINUS_WEEK' | 'PLUS_WEEK';

export interface DateShortcut {
  key: DateShortcutKey;
  date: string;
}

/** A translation key and its parameters. */
export interface Sentence {
  key: string;
  params: Record<string, string | number>;
}

/* ---------------- dates (yyyy-MM-dd, local) ---------------- */

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function todayIso(now: Date = new Date()): string {
  return isoDate(now);
}

/** The next Monday after today (a week later when today is a Monday). */
export function nextMondayIso(today: string): string {
  const day = parseIso(today).getDay(); // 0 = Sunday
  const ahead = ((8 - day) % 7) || 7;
  return addDaysIso(today, ahead);
}

/** Number of days between two dates (to - from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}

/**
 * How many days a library program lasts once assigned (as the server counts them): a workout is padded to full weeks,
 * a nutrition program keeps its days. Null when its days are not known here.
 */
export function programLengthDays(program: any, kind: ProgramKind): number | null {
  const days: unknown[] | undefined = kind === 'WORKOUT' ? program?.workoutDays : program?.mealDays;
  if (!Array.isArray(days)) return null;
  if (kind === 'WORKOUT') return Math.max(7, Math.ceil(days.length / 7) * 7);
  return Math.max(days.length, 1);
}

/**
 * The start date shortcuts (A2):"Dans la continuité" first when given and later than today, then today, tomorrow and
 * next Monday; a date already offered is not offered twice.
 */
export function dateShortcuts(today: string, continuity?: string | null): DateShortcut[] {
  const shortcuts: DateShortcut[] = [];
  if (continuity && continuity > today) shortcuts.push({ key: 'CONTINUITY', date: continuity });
  const candidates: DateShortcut[] = [
    { key: 'TODAY', date: today },
    { key: 'TOMORROW', date: addDaysIso(today, 1) },
    { key: 'NEXT_MONDAY', date: nextMondayIso(today) },
  ];
  for (const candidate of candidates) {
    if (!shortcuts.some(shortcut => shortcut.date === candidate.date)) shortcuts.push(candidate);
  }
  return shortcuts;
}

/**
 * « Modifier les dates » (CD-13): a week earlier (when it is not in the past), a week later, "Dans la continuité" when
 * given and later than today, then today; a date already offered is not offered twice.
 */
export function moveShortcuts(today: string, currentStart: string, continuity?: string | null): DateShortcut[] {
  const candidates: DateShortcut[] = [];
  const earlier = addDaysIso(currentStart, -7);
  if (earlier >= today) candidates.push({ key: 'MINUS_WEEK', date: earlier });
  candidates.push({ key: 'PLUS_WEEK', date: addDaysIso(currentStart >= today ? currentStart : today, 7) });
  if (continuity && continuity > today) candidates.push({ key: 'CONTINUITY', date: continuity });
  candidates.push({ key: 'TODAY', date: today });
  const shortcuts: DateShortcut[] = [];
  for (const candidate of candidates) {
    if (!shortcuts.some(shortcut => shortcut.date === candidate.date)) shortcuts.push(candidate);
  }
  return shortcuts;
}

/**
 * The program started on a {@code reference} weekday and {@code date} is another one (CD-13): the same weekday just
 * before (null when earlier than {@code min}) and just after, so that its "day 1 = Monday" stays a Monday. Null when
 * the weekday is the same.
 */
export function sameWeekdayAround(date: string, reference: string, min: string): { before: string | null; after: string } | null {
  const back = (parseIso(date).getDay() - parseIso(reference).getDay() + 7) % 7;
  if (back === 0) return null;
  const before = addDaysIso(date, -back);
  return { before: before >= min ? before : null, after: addDaysIso(date, 7 - back) };
}

/* ---------------- read-only (A9) ---------------- */

/** A client program stopped by another one, or finished: the coach can open it, not change it. */
export function isPlanLocked(plan: { client?: unknown; stoppedAt?: string | null; endDate?: string | null } | null | undefined,
                             today: string): boolean {
  if (!plan || !plan.client) return false;
  if (plan.stoppedAt) return true;
  return !!plan.endDate && plan.endDate.slice(0, 10) < today;
}

/** The server refusal of a change on a read-only program (409). */
export function isLockedError(error: any): boolean {
  return error?.status === 409 && (error?.error?.code === 'PROGRAM_LOCKED');
}

/** The server refusal to move a program the client already started (409). */
export function isStartedError(error: any): boolean {
  return error?.status === 409 && (error?.error?.code === 'PROGRAM_STARTED');
}

const blank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';
const started = (status: unknown): boolean => !!status && status !== 'PENDING';

/** Something the client did on that day (same test as the server): a status, a log, a time, a note. */
export function dayHasActivity(day: any, kind: ProgramKind): boolean {
  if (!day) return false;
  if (kind === 'WORKOUT') {
    return started(day.status) || (day.clientExerciseLogs?.length ?? 0) > 0 || (day.workoutElapsedSeconds ?? 0) > 0
      || !!day.clientCompletionMode || !blank(day.overallWorkoutNote);
  }
  return started(day.status) || (day.clientMealLogs?.length ?? 0) > 0
    || !blank(day.hunger) || !blank(day.energy) || !blank(day.digestion) || !blank(day.overallNote);
}

/** The client already did something in this program: its sessions are dated, its start can no longer move (A8). */
export function planHasActivity(plan: any, kind: ProgramKind): boolean {
  const days: any[] = (kind === 'WORKOUT' ? plan?.workoutDays : plan?.mealDays) || [];
  return days.some(day => dayHasActivity(day, kind));
}

/**
 * « Modifier les dates » is offered: an app program the client has not started yet, or a file program (once started,
 * only its end moves).
 */
export function canChangeDates(plan: any, kind: ProgramKind, isFile: boolean, today: string): boolean {
  if (!plan || isPlanLocked(plan, today)) return false;
  return isFile || !planHasActivity(plan, kind);
}

/* ---------------- sentences ---------------- */

/** What will happen to that program, before the click (A5). {@link formatDate} gives the dates as shown. */
export function changeSentence(change: ScheduleChange, formatDate: (iso: string) => string): Sentence {
  if (change.kind === 'PAUSED') {
    return { key: 'ASSIGN_FLOW.CHANGE_PAUSED', params: { name: change.programName || '', date: formatDate(change.newStartDate || ''), end: formatDate(change.newEndDate || change.endDate) } };
  }
  if (change.kind === 'SHIFTED') {
    return { key: 'ASSIGN_FLOW.CHANGE_SHIFTED', params: { name: change.programName || '', date: formatDate(change.newStartDate || change.startDate) } };
  }
  if (change.kind === 'REMOVED') {
    return { key: 'ASSIGN_FLOW.CHANGE_REMOVED', params: { name: change.programName || '', date: formatDate(change.startDate) } };
  }
  const date = formatDate(change.newEndDate || change.endDate);
  if (change.preparedDaysLost > 0) {
    return {
      key: change.preparedDaysLost === 1 ? 'ASSIGN_FLOW.CHANGE_STOPPED_LOST_ONE' : 'ASSIGN_FLOW.CHANGE_STOPPED_LOST',
      params: { name: change.programName || '', date, count: change.preparedDaysLost },
    };
  }
  return { key: 'ASSIGN_FLOW.CHANGE_STOPPED', params: { name: change.programName || '', date } };
}

/** What happened to that program, after the click (A7). */
export function doneSentence(change: ScheduleChange, client: string, formatDate: (iso: string) => string): Sentence {
  if (change.kind === 'PAUSED') {
    return { key: 'ASSIGN_FLOW.DONE_PAUSED', params: { client, name: change.programName || '', date: formatDate(change.newStartDate || '') } };
  }
  if (change.kind === 'SHIFTED') {
    return { key: 'ASSIGN_FLOW.DONE_SHIFTED', params: { client, name: change.programName || '', date: formatDate(change.newStartDate || change.startDate) } };
  }
  if (change.kind === 'REMOVED') {
    return { key: 'ASSIGN_FLOW.DONE_REMOVED', params: { client, name: change.programName || '' } };
  }
  return { key: 'ASSIGN_FLOW.DONE_STOPPED', params: { client, name: change.programName || '', date: formatDate(change.newEndDate || change.endDate) } };
}

/** What happened to that program, for a single client named in the title. */
export function doneLine(change: ScheduleChange, formatDate: (iso: string) => string): Sentence {
  if (change.kind === 'PAUSED') {
    return { key: 'ASSIGN_FLOW.LINE_PAUSED', params: { name: change.programName || '', date: formatDate(change.newStartDate || '') } };
  }
  if (change.kind === 'SHIFTED') {
    return { key: 'ASSIGN_FLOW.LINE_SHIFTED', params: { name: change.programName || '', date: formatDate(change.newStartDate || change.startDate) } };
  }
  if (change.kind === 'REMOVED') {
    return { key: 'ASSIGN_FLOW.LINE_REMOVED', params: { name: change.programName || '' } };
  }
  return { key: 'ASSIGN_FLOW.LINE_STOPPED', params: { name: change.programName || '', date: formatDate(change.newEndDate || change.endDate) } };
}

/** The reason a client could not be assigned, as a translation key. */
export function failureReasonKey(code?: string | null): string {
  switch (code) {
    case 'CLIENT_ARCHIVED': return 'ASSIGN_FLOW.REASON_CLIENT_ARCHIVED';
    case 'NOT_YOUR_CLIENT': return 'ASSIGN_FLOW.REASON_NOT_YOUR_CLIENT';
    case 'CLIENT_NOT_FOUND': return 'ASSIGN_FLOW.REASON_CLIENT_NOT_FOUND';
    case 'START_IN_PAST': return 'ASSIGN_FLOW.REASON_START_IN_PAST';
    case 'PROGRAM_GAP':
    case 'PROGRAM_INVALID_DAYS': return 'ASSIGN_FLOW.REASON_PROGRAM_DAYS';
    default: return 'ASSIGN_FLOW.REASON_UNEXPECTED';
  }
}

/** A failure worth trying again (not an archived client, not a refusal of the rules). */
export function retryable(result: ClientAssignResult): boolean {
  return !result.ok && (!result.errorCode || result.errorCode === 'ASSIGN_FAILED');
}

/* ---------------- « Modifier les dates » (backlog-programmes.md CD-10) ---------------- */

export type OverlapChoice = 'SHIFT' | 'REMOVE';

/**
 * What new dates change on the client's other programs: with « Décaler », the programs reached start after it (they
 * are no longer stopped or removed); with « Retirer », the rule alone.
 */
export function movedChanges(preview: ClientSchedulePreview | null | undefined, overlap: OverlapChoice): ScheduleChange[] {
  const changes = preview?.changes || [];
  const shifts = overlap === 'SHIFT' ? preview?.shifts || [] : [];
  const shifted = new Set(shifts.map(change => change.programId));
  return [...shifts, ...changes.filter(change => !shifted.has(change.programId))];
}

/** A program removed or cut: the coach confirms first; a shift or a pause loses nothing and saves at once. */
export function losesSomething(changes: ScheduleChange[]): boolean {
  return changes.some(change => change.kind === 'STOPPED' || change.kind === 'REMOVED');
}

/** A date being typed in a date field ("0002-09-06" while typing 2028): not a choice yet. */
export function typingYear(value: string): boolean {
  return Number(value.slice(0, 4)) < 1900;
}

/** The clients whose calendar changes, in the order given. */
export function affectedClientIds(previews: Record<string, ClientSchedulePreview | undefined>, clientIds: string[]): string[] {
  return clientIds.filter(id => (previews[id]?.changes?.length ?? 0) > 0);
}

/* ---------------- the client's « Programmes » tab (P1-P8) ---------------- */

export type OverviewStatus = 'CURRENT' | 'UPCOMING' | 'FINISHED';
export type OverviewDayState = 'DONE' | 'PARTIAL' | 'MISSED' | 'REST' | 'EMPTY' | 'PLANNED' | 'OUT';
export type OverviewAlertKind = 'ENDING_SOON' | 'GAP' | 'EMPTY_DAYS' | 'OVERLAP';

/** A client program without its days (server ProgramOverviewService.Item). */
export interface OverviewItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  stoppedAt: string | null;
  file: boolean;
  fileKind: 'PDF' | 'EXCEL' | 'FILE' | null;
  totalDays: number;
  readyDays: number;
  doneDays: number;
  weeks: number;
  status: OverviewStatus;
}

export interface OverviewDay {
  date: string;
  dayNumber: number;
  state: OverviewDayState;
  today: boolean;
  /** The workout's name (nutrition: none). */
  title?: string | null;
  /** Its exercises (nutrition: the meals shown to the client). */
  items?: number;
  /** The nutrition day's calories. */
  calories?: number | null;
  /** What the client wrote that day. */
  note?: string | null;
}

export interface OverviewCurrent {
  program: OverviewItem;
  week: number;
  weeks: number;
  doneThisWeek: number;
  plannedThisWeek: number;
  days: OverviewDay[];
}

export interface OverviewNext {
  program: OverviewItem;
  firstWeekReady: number;
  firstWeekDays: number;
}

export interface OverviewAlert {
  kind: OverviewAlertKind;
  from: string | null;
  to: string | null;
  programId: string | null;
  otherProgramId: string | null;
  dayNumber: number | null;
  count: number;
}

export interface ProgramOverview {
  type: ProgramKind;
  today: string;
  lastActivity: string | null;
  current: OverviewCurrent | null;
  next: OverviewNext | null;
  alerts: OverviewAlert[];
  upcoming: OverviewItem[];
  finished: OverviewItem[];
  upcomingCount: number;
  finishedCount: number;
  /** A pause of the client's follow-up for this type, going on or to come (DS-03). */
  pause?: { from: string; to: string } | null;
}

/** Whole days from today to that date (negative before). */
export function daysFrom(today: string, date: string | null | undefined): number {
  return date ? daysBetween(today, date) : 0;
}
