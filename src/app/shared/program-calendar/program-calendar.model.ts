import { ProgramDayState } from '@shared/models/program-days';

/**
 * The editors' « Calendrier » mode (workout and nutrition): one row per week, one column per day, the same cards as the
 * client's calendar. This file turns the days of a program into weeks and cards; `ProgramCalendarComponent` draws them.
 */

/** A day's state, drawn with the client calendar's symbols; 'filled': a filled day of a library program. */
export type CalendarTone = 'done' | 'missed' | 'partial' | 'today' | 'planned' | 'rest' | 'empty' | 'gap' | 'invalid' | 'filled';

export type CalendarKind = 'WORKOUT' | 'NUTRITION';

/** One line of a card's detail: an exercise (A, B1, B2…) or a meal. */
export interface CalendarLine {
  label: string;
  name: string;
  detail: string;
  link?: 'start' | 'middle' | 'end' | null;
  groupKind?: 'SUPERSET' | 'CIRCUIT' | null;
}

export interface CalendarCell<T = unknown> {
  day: T;
  /** Place of the day in the program (0-based). */
  index: number;
  tone: CalendarTone;
  title: string;
  /** « 7 exercices · 21 séries · ~85 min », « 4 repas · 2 100 kcal ». */
  meta: string;
  status: string;
  icon: string;
  /** « 16 nov. » (a client's program). */
  date: string;
  today: boolean;
  /** A past day of a client's program: a bit paler, today and what comes stand out. */
  past: boolean;
  /** Past or already started by the client: it does not move. */
  locked: boolean;
  movable: boolean;
  rest: boolean;
  hasContent: boolean;
  lines: CalendarLine[];
  /** A day outside the program (the week of the profile): an empty grey cell. */
  out?: boolean;
  /** What the client wrote that day. */
  note?: string | null;
  /** While a day is picked (« Déplacer », « Copier vers… »): this one can be chosen, is the one picked, or not. */
  pick?: 'target' | 'source' | 'dim' | null;
}

/** An entry of a card's ⋮ menu, when the page gives its own (the profile: move, copy to, rest…). */
export interface CalendarMenuItem {
  type: string;
  label: string;
  icon: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface CalendarWeek<T = unknown> {
  number: number;
  title: string;
  range: string;
  filled: number;
  days: T[];
  /** Empty cells at the end of an incomplete week. */
  pad: number[];
  cells: CalendarCell<T>[];
  /** The week of today (a client's program). */
  current: boolean;
  /** Progress bar: done over planned (client), else filled days over 7. */
  progress: number;
  progressText: string;
}

/** What the builder needs to know about the days of one editor. */
export interface CalendarSource<T> {
  kind: CalendarKind;
  days: T[];
  client: boolean;
  readOnly: boolean;
  detailed: boolean;
  /** yyyy-MM-dd */
  today: string;
  locale: string;
  /** The editor's own state of a day (an empty day before the last filled one is a 'GAP'). */
  state(day: T, index: number): ProgramDayState | 'GAP';
  /** The client did something on this day (it keeps its place). */
  started(day: T): boolean;
  /** The day's status from the server (COMPLETED, MISSED…). */
  status(day: T): string;
  /** yyyy-MM-dd of the day ('' in a library program). */
  iso(day: T): string;
  title(day: T): string;
  meta(day: T): string;
  lines(day: T): CalendarLine[];
  t(key: string, params?: Record<string, unknown>): string;
  ht(en: string, fr: string): string;
}

export function isoOf(value: unknown): string {
  return value ? String(value).slice(0, 10) : '';
}

function dateOf(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Column headers: the weekdays (a client's program), else « Jour 1 » to « Jour 7 ». */
export function calendarColumns<T>(source: Pick<CalendarSource<T>, 'days' | 'client' | 'locale' | 'iso' | 't'>): string[] {
  const first = source.days.slice(0, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const date = source.client && first[i] ? dateOf(source.iso(first[i])) : null;
    return date ? date.toLocaleDateString(source.locale, { weekday: 'long' }) : source.t('DAY_NUMBER', { number: i + 1 });
  });
}

/** A day's tone, with the client calendar's rules (started is never « missed »). */
function toneOf<T>(source: CalendarSource<T>, day: T, index: number): CalendarTone {
  const state = source.state(day, index);
  if (state === 'REST') return 'rest';
  if (state === 'EMPTY') return 'empty';
  if (state === 'GAP') return 'gap';
  if (state === 'INVALID') return 'invalid';
  if (!source.client) return 'filled';
  const status = String(source.status(day) || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'OFF_PLAN') return 'done';
  if (status === 'MISSED') return 'missed';
  if (source.started(day)) return 'partial';
  const iso = source.iso(day);
  if (iso && iso === source.today) return 'today';
  if (iso && iso < source.today) return 'missed';
  return 'planned';
}

export function calendarIcon(tone: CalendarTone): string {
  switch (tone) {
    case 'done': return 'check-circle';
    case 'missed': return 'x-circle';
    case 'partial': return 'loader';
    case 'today': return 'calendar';
    case 'planned': return 'clock';
    case 'rest': return 'moon';
    case 'invalid': return 'alert-circle';
    case 'empty':
    case 'gap': return 'plus-circle';
    default: return 'check';
  }
}

function statusText<T>(source: CalendarSource<T>, tone: CalendarTone): string {
  const kind = source.kind;
  switch (tone) {
    case 'done': return source.t(`CLIENT_PROGRAMS.STATUS_DONE_${kind}`);
    case 'missed': return source.t(`CLIENT_PROGRAMS.STATUS_MISSED_${kind}`);
    case 'partial': return source.t(`CLIENT_PROGRAMS.STATUS_PARTIAL_${kind}`);
    case 'today': return source.t('CLIENT_PROGRAMS.STATUS_TODAY');
    case 'planned': return source.t(`CLIENT_PROGRAMS.STATUS_PLANNED_${kind}`);
    case 'invalid': return source.t('PROGRAM_DAY_TO_FIX');
    case 'rest': return source.t(`CLIENT_PROGRAMS.STATUS_REST_${kind}`);
    // An empty day says it in its title (« À remplir », « Vide · à compléter »).
    default: return '';
  }
}

function cellOf<T>(source: CalendarSource<T>, day: T, index: number): CalendarCell<T> {
  const tone = toneOf(source, day, index);
  const iso = source.iso(day);
  const date = source.client ? dateOf(iso) : null;
  const locked = source.client && ((!!iso && iso < source.today) || source.started(day));
  const empty = tone === 'empty' || tone === 'gap';
  return {
    day,
    index,
    tone,
    // A rest / free day: the same words as the client calendar (« Récupération » · « Jour de repos »).
    title: tone === 'rest'
      ? source.t(`CLIENT_PROGRAMS.REST_TITLE_${source.kind}`)
      : empty ? source.t(tone === 'gap' ? 'PROGRAM_DAY_GAP' : 'CLIENT_PROGRAMS.STATUS_EMPTY')
      : source.title(day),
    meta: tone === 'rest' || empty ? '' : source.meta(day),
    status: statusText(source, tone),
    icon: calendarIcon(tone),
    date: date ? date.toLocaleDateString(source.locale, { day: 'numeric', month: 'short' }) : '',
    today: !!iso && source.client && iso === source.today,
    past: source.client && !!iso && iso < source.today,
    locked,
    movable: !source.readOnly && !locked,
    rest: tone === 'rest',
    hasContent: !empty,
    lines: source.detailed && tone !== 'rest' && !empty ? source.lines(day) : [],
  };
}

/** The weeks of the calendar (7 days each, the last one may be incomplete). */
export function buildCalendarWeeks<T>(source: CalendarSource<T>): CalendarWeek<T>[] {
  const weeks: CalendarWeek<T>[] = [];
  for (let start = 0; start < source.days.length; start += 7) {
    const days = source.days.slice(start, start + 7);
    const cells = days.map((day, i) => cellOf(source, day, start + i));
    const filled = cells.filter((cell) => cell.tone !== 'empty' && cell.tone !== 'gap').length;
    const planned = cells.filter((cell) => ['done', 'missed', 'partial', 'today', 'planned', 'invalid'].includes(cell.tone)).length;
    const done = cells.filter((cell) => cell.tone === 'done').length;
    const client = source.client && planned > 0;
    const dates = days.map((day) => dateOf(source.iso(day))).filter((d): d is Date => !!d);
    const fmt = (d: Date) => d.toLocaleDateString(source.locale, { month: 'short', day: 'numeric' });
    const number = start / 7 + 1;
    const plural = planned > 1;
    weeks.push({
      number,
      title: source.t('WEEK_NUMBER', { number }),
      range: source.client && dates.length ? `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}` : '',
      filled,
      days,
      pad: Array.from({ length: 7 - days.length }, (_, i) => i),
      cells,
      current: cells.some((cell) => cell.today),
      progress: client ? Math.round((done / planned) * 100) : Math.round((filled / 7) * 100),
      progressText: !client
        ? source.t('PROGRAM_DAYS_FILLED_SHORT', { count: filled, total: 7 })
        : source.kind === 'WORKOUT'
          ? source.ht(`${done}/${planned} workouts done`, `${done}/${planned} séance${plural ? 's' : ''} faite${plural ? 's' : ''}`)
          : source.ht(`${done}/${planned} days followed`, `${done}/${planned} jour${plural ? 's' : ''} suivi${plural ? 's' : ''}`),
    });
  }
  return weeks;
}

/** The column of today in the headers (a client's program), -1 otherwise. */
export function todayColumn<T>(weeks: CalendarWeek<T>[]): number {
  const week = weeks.find((w) => w.current);
  return week ? week.cells.findIndex((cell) => cell.today) : -1;
}
