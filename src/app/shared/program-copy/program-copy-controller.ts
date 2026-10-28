/* eslint-disable @typescript-eslint/no-explicit-any */
import { CopyDaysMode } from './copy-days-modal.component';
import { CopiedDay, ProgramDayClipboardService, ProgramDayKind } from './program-day-clipboard.service';
import { DAYS_PER_WEEK, DayCopy } from './program-day-copy';

/** What an editor gives to the copy actions of its day header and week card. */
export interface ProgramCopyHost<D> {
  days: () => D[];
  selectedDay: () => D | null;
  /** The day has content (a copy onto it replaces it; an empty day is never copied). */
  isFilled: (day: D) => boolean;
  /** Past day of a client's program: its history is not overwritten by a copy. */
  isLocked: (day: D) => boolean;
  /** Copies the content of `source` onto `target`, then recomputes its totals. */
  apply: (source: D, target: D) => void;
  /** After « Annuler »: the day is back as it was (relink what a JSON copy splits, recompute totals). */
  restored: (day: D) => void;
  /** « Programme force »: shown with the copied day. */
  planName: () => string;
  translate: (key: string, params?: any) => string;
  /** Toast of a copy, with its « Annuler » button. */
  notify: (title: string, message?: string, undo?: () => void) => void;
  readOnly: () => boolean;
}

export interface CopyModalState {
  mode: CopyDaysMode;
  dayCount: number;
  sourceIndex: number | null;
  sourceWeek: number;
  filled: boolean[];
  locked: boolean[];
  sourceLabel: string;
}

/** « Semaine 1 · Jour 3 · Programme force » (label of a copied day). */
export function programDayLabel(translate: (key: string, params?: any) => string, index: number, planName: string): string {
  const parts = [
    translate('WEEK_NUMBER', { number: Math.floor(index / DAYS_PER_WEEK) + 1 }),
    translate('DAY_NUMBER', { number: (index % DAYS_PER_WEEK) + 1 }),
    planName.trim(),
  ];
  return parts.filter(Boolean).join(' · ');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * « Copier ce jour » (onto days of this program, or kept for another one), « Dupliquer la semaine » and the paste of
 * a day kept from another program. Every copy can be undone from its toast.
 * The modal state is set once per opening, so the modal keeps its selection between change detections.
 */
export class ProgramCopyController<D> {
  modal: CopyModalState | null = null;

  constructor(
    private clipboard: ProgramDayClipboardService,
    private kind: ProgramDayKind,
    private host: ProgramCopyHost<D>,
  ) {}

  get readOnly(): boolean {
    return this.host.readOnly();
  }

  get selectedIndex(): number {
    const day = this.host.selectedDay();
    return day ? this.host.days().indexOf(day) : -1;
  }

  get selectedWeek(): number {
    return Math.floor(Math.max(0, this.selectedIndex) / DAYS_PER_WEEK) + 1;
  }

  /** The selected day has content to copy (an empty day would only erase the targets). */
  get canCopyDay(): boolean {
    const day = this.host.selectedDay();
    return !this.host.readOnly() && !!day && this.host.days().length > 1 && this.host.isFilled(day);
  }

  /** The week of the selected day has a filled day and the program has another week. */
  get canDuplicateWeek(): boolean {
    const days = this.host.days();
    if (this.host.readOnly() || days.length <= DAYS_PER_WEEK || this.selectedIndex < 0) return false;
    const start = (this.selectedWeek - 1) * DAYS_PER_WEEK;
    return days.slice(start, start + DAYS_PER_WEEK).some((day) => this.host.isFilled(day));
  }

  get copied(): CopiedDay | null {
    return this.host.readOnly() ? null : this.clipboard.get(this.kind);
  }

  openDay(): void {
    if (this.canCopyDay) this.open('day');
  }

  openWeek(): void {
    if (this.canDuplicateWeek) this.open('week');
  }

  openPaste(): void {
    if (this.copied) this.open('paste');
  }

  /** Keeps the selected day to paste it in another program (from the copy modal). */
  keepForAnotherProgram(): void {
    const day = this.host.selectedDay();
    this.modal = null;
    if (!day) return;
    this.clipboard.copy(this.kind, day, programDayLabel(this.host.translate, this.selectedIndex, this.host.planName()));
    this.host.notify(this.host.translate('COPY_DAYS.KEPT'), this.host.translate('COPY_DAYS.KEPT_HINT'));
  }

  /** « ✕ » of the banner: the kept day is forgotten. */
  cancelKept(): void {
    this.clipboard.clear();
  }

  close(): void {
    this.modal = null;
  }

  confirm(copies: DayCopy[]): void {
    const days = this.host.days();
    const pasted = this.modal?.mode === 'paste' ? this.copied : null;
    // Sources are read before any write: a week copied onto itself never copies a copy.
    const sources = copies.map((copy) => (copy.from === null ? pasted?.day : clone(days[copy.from])));
    const changed: { target: D; before: D }[] = [];
    copies.forEach((copy, i) => {
      const target = days[copy.to];
      if (!target || !sources[i] || this.host.isLocked(target)) return;
      changed.push({ target, before: clone(target) });
      this.host.apply(sources[i], target);
    });
    this.modal = null;
    if (pasted) this.clipboard.clear(); // pasted: the banner goes away
    if (!changed.length) return;

    const count = changed.length;
    this.host.notify(
      this.host.translate(count === 1 ? 'COPY_DAYS.DONE_ONE' : 'COPY_DAYS.DONE', { count }),
      undefined,
      () => changed.forEach(({ target, before }) => this.restore(target, before)),
    );
  }

  private restore(target: D, before: D): void {
    // Same object (the editor and its selected day keep their reference), previous content.
    const day = target as any;
    Object.keys(day).forEach((key) => delete day[key]);
    Object.assign(day, before);
    this.host.restored(target);
  }

  private open(mode: CopyDaysMode): void {
    const days = this.host.days();
    this.modal = {
      mode,
      dayCount: days.length,
      sourceIndex: mode === 'day' ? this.selectedIndex : null,
      sourceWeek: this.selectedWeek,
      filled: days.map((day) => this.host.isFilled(day)),
      locked: days.map((day) => this.host.isLocked(day)),
      sourceLabel: this.copied?.label || '',
    };
  }
}
