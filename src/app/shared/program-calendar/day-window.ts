/**
 * The day window of the « Calendrier » mode (workout and nutrition editors): the editor's own day section shown over
 * the calendar. It behaves like an edit window: what is changed in it is kept only with « Enregistrer »; « Fermer »
 * with changes asks (discard, keep editing, save and close). Opened from the client's profile (`?day=N&open=1`), it
 * goes back there when it closes.
 */
export interface DayWindowHost<T> {
  days(): T[];
  selected(): T | null;
  select(day: T): void;
  /** What the coach edits, as text (to see a change). */
  content(): string;
  /** « Abandonner » : the days as they were when the window opened. */
  restore(days: T[]): void;
  save(): void;
  saving(): boolean;
  /** Something is not saved on the server (the toolbar's « Modifications non enregistrées »). */
  unsaved(): boolean;
  readOnly(): boolean;
  /** A small window over the day window (picker, copy, confirmation…): Escape is for it. */
  subWindowOpen(): boolean;
  /** Panels that belong to the day window (the exercise / food picker): closed with it. */
  closeSubPanels(): void;
  goBack(): void;
  /** « Tout le programme » / a read-only program: the list mode on the selected day. */
  toList(): void;
  t(key: string, params?: Record<string, unknown>): string;
  dateLabel(day: T): string;
  scrollTop(): void;
}

export class CalendarDayWindow<T> {
  open = false;
  /** A day was opened once: its card stays highlighted after the window closes. */
  opened = false;
  /** « Fermer » with changes: the bottom of the window asks what to do. */
  ask = false;
  /** Opened from the client's profile: closing goes back there. */
  returnOnClose = false;
  private snapshot: { content: string; days: T[] } | null = null;
  private closeAfterSave = false;
  private changedCache: boolean | null = null;
  private wasSaving = false;

  constructor(private readonly host: DayWindowHost<T>) {}

  /** Called by the host once per change detection (ngDoCheck): a fresh « changed », a save that just ended. */
  check(saveError: unknown): void {
    this.changedCache = null;
    const saving = this.host.saving();
    if (this.wasSaving && !saving) {
      // Saved for real (nothing left unsaved): a check that stopped the save (next program reached…) is not a save.
      if (!saveError && this.open && !this.host.unsaved()) {
        if (this.closeAfterSave) this.close();
        else this.takeSnapshot();
      }
      this.closeAfterSave = false;
    }
    this.wasSaving = saving;
  }

  get index(): number {
    const selected = this.host.selected();
    return selected ? this.host.days().indexOf(selected) : -1;
  }

  /** « Semaine 2 · Jour 3 · mer. 25 nov. » */
  get title(): string {
    const day = this.host.selected();
    const index = this.index;
    if (!day || index < 0) return '';
    const parts = [
      this.host.t('WEEK_NUMBER', { number: Math.floor(index / 7) + 1 }),
      this.host.t('DAY_NUMBER', { number: (index % 7) + 1 }),
    ];
    const date = this.host.dateLabel(day);
    if (date) parts.push(date);
    return parts.join(' · ');
  }

  get canPrev(): boolean {
    return this.index > 0;
  }

  get canNext(): boolean {
    return this.index >= 0 && this.index < this.host.days().length - 1;
  }

  /** Something changed since the window opened (or since the last save made in it). */
  get changed(): boolean {
    return this.changedCache ??= !!this.snapshot && this.host.content() !== this.snapshot.content;
  }

  private takeSnapshot(): void {
    this.snapshot = { content: this.host.content(), days: JSON.parse(JSON.stringify(this.host.days())) };
  }

  /** A click on a day: its window opens over the calendar (a read-only program: the list mode). */
  openDay(day: T): void {
    this.host.select(day);
    if (this.host.readOnly()) {
      this.host.toList();
      return;
    }
    if (!this.open) this.takeSnapshot();
    this.open = true;
    this.opened = true;
    this.ask = false;
    this.host.scrollTop();
  }

  close(): void {
    this.host.closeSubPanels();
    this.open = false;
    this.ask = false;
    this.snapshot = null;
    if (this.returnOnClose) {
      this.returnOnClose = false;
      this.host.goBack();
    }
  }

  /** ✕, « Fermer », Escape, a click beside: closes, or asks when something is not saved. */
  requestClose(): void {
    if (this.changed) {
      this.ask = true;
      return;
    }
    this.close();
  }

  /** « Abandonner les changements »: the program as when the window opened. */
  discard(): void {
    if (this.snapshot) this.host.restore(this.snapshot.days);
    this.close();
  }

  /** « Enregistrer et fermer »: closes once the save succeeded (an error keeps it open). */
  saveAndClose(): void {
    this.ask = false;
    this.host.save();
    this.closeAfterSave = this.host.saving();
  }

  /** « Enregistrer » at the bottom: saves, the window stays open. */
  saveInWindow(): void {
    this.closeAfterSave = false;
    this.ask = false;
    this.host.save();
  }

  step(delta: number): void {
    const next = this.host.days()[this.index + delta];
    if (!next) return;
    this.host.select(next);
    this.ask = false;
    this.host.scrollTop();
  }

  /** « Tout le programme »: the window closes (its changes stay in the page), the list mode on this day. */
  whole(): void {
    this.returnOnClose = false;
    this.host.closeSubPanels();
    this.open = false;
    this.ask = false;
    this.snapshot = null;
    this.host.toList();
  }

  /** Escape: the question first, then the window (a menu or a small window over it is not for us). */
  escape(): void {
    if (!this.open || this.host.subWindowOpen()) return;
    if (this.ask) this.ask = false;
    else this.requestClose();
  }

  /** Leaves the window without asking (the view changes). */
  reset(): void {
    this.open = false;
    this.ask = false;
    this.snapshot = null;
  }
}
