import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CalendarCell, CalendarKind, CalendarMenuItem, CalendarWeek } from './program-calendar.model';

export type CalendarDayAction = 'copy' | 'rest' | 'clear' | string;

/**
 * The « Calendrier » mode of the program editors (workout and nutrition), the same everywhere: one row per week, one
 * column per day, the client calendar's cards. A click on a day asks its window (`openDay`); a card dragged onto
 * another day asks a swap; the ⋮ of a card and the ⋯ of a week carry the quick actions. The editor does the work.
 */
@Component({
  selector: 'app-program-calendar',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './program-calendar.component.html',
  styleUrls: ['./_calendar-cards.scss', './program-calendar.component.scss'],
})
export class ProgramCalendarComponent<T = any> implements AfterViewChecked {
  @Input() weeks: CalendarWeek<T>[] = [];
  @Input() columns: string[] = [];
  @Input() todayColumn = -1;
  @Input() kind: CalendarKind = 'WORKOUT';
  @Input() readOnly = false;
  /** The cards show the exercises / meals (« Exercices » / « Repas ») or a one-line summary (« Résumé »). */
  @Input() detailed = true;
  /** The day of the open window, highlighted once a day was opened. */
  @Input() selected: T | null = null;
  @Input() highlight = false;
  @Input() weekCount = 0;
  @Input() maxWeeks = 12;
  /** « Copier ce jour » is offered (the copy is not read-only). */
  @Input() canCopy = true;
  /** « Vider » is offered (workout: « Vider la séance »). */
  @Input() canClear = true;
  /** What the symbols say, under the grid (a client's program: done, missed…). */
  @Input() legend = false;
  /** One week only (the client's profile): no week column, no tools above, no « Ajouter une semaine ». */
  @Input() single = false;
  /** The page's own ⋮ menu of a card (else: copy, rest, clear). */
  @Input() menuItems: ((cell: CalendarCell<T>) => CalendarMenuItem[]) | null = null;

  readonly legendItems: { tone: string; icon: string; key: string }[] = [
    { tone: 'done', icon: 'check-circle', key: 'CALENDAR_LEGEND_DONE' },
    { tone: 'partial', icon: 'loader', key: 'CALENDAR_LEGEND_PARTIAL' },
    { tone: 'missed', icon: 'x-circle', key: 'CALENDAR_LEGEND_MISSED' },
    { tone: 'today', icon: 'calendar', key: 'CALENDAR_LEGEND_TODAY' },
    { tone: 'planned', icon: 'clock', key: 'CALENDAR_LEGEND_PLANNED' },
    { tone: 'rest', icon: 'moon', key: 'CALENDAR_LEGEND_REST' },
    { tone: 'empty', icon: 'plus-circle', key: 'CALENDAR_LEGEND_EMPTY' },
  ];

  @Output() openDay = new EventEmitter<T>();
  @Output() swap = new EventEmitter<{ from: T; to: T }>();
  @Output() addWeek = new EventEmitter<void>();
  @Output() deleteWeek = new EventEmitter<number>();
  @Output() duplicateWeek = new EventEmitter<CalendarWeek<T>>();
  /** « Répéter sur les semaines suivantes »: the copy window, the following weeks already chosen. */
  @Output() repeatWeek = new EventEmitter<CalendarWeek<T>>();
  @Output() dayAction = new EventEmitter<{ type: CalendarDayAction; day: T }>();
  @Output() detailedChange = new EventEmitter<boolean>();

  private readonly translate = inject(TranslateService);
  private readonly host = inject(ElementRef<HTMLElement>);

  dragDay: T | null = null;
  dropDay: T | null = null;
  menuDay: T | null = null;
  weekMenu: number | null = null;
  /**
   * « Déplacer » of the ⋮ (the editors): the day to move; the next day clicked takes it (the two days swap, as a
   * drag does). A drag needs a mouse: on a tablet or a phone this is the way to move a day.
   */
  moving: T | null = null;
  private scrolled = false;

  ht(en: string, fr: string): string {
    return this.translate.currentLang === 'en' ? en : fr;
  }

  get isWorkout(): boolean {
    return this.kind === 'WORKOUT';
  }

  /** A client's program: the past or already done days cannot be dragged (their history stays on their date). */
  get hasLockedDays(): boolean {
    return this.weeks.some((week) => week.cells.some((cell) => cell.locked && cell.hasContent));
  }

  get canAddWeek(): boolean {
    return !this.readOnly && this.weekCount < this.maxWeeks;
  }

  /** The week of today is shown when the calendar appears (once). */
  ngAfterViewChecked(): void {
    if (this.scrolled || !this.weeks.length) return;
    this.scrolled = true;
    const current = this.host.nativeElement.querySelector('.wcal__week.is-current') as HTMLElement | null;
    if (current) setTimeout(() => current.scrollIntoView({ block: 'center' }));
  }

  /** A new week: the calendar goes down to it. */
  scrollToWeek(number: number): void {
    setTimeout(() => {
      const row = this.host.nativeElement.querySelectorAll('.wcal__week')[number - 1] as HTMLElement | undefined;
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.menuDay = null;
    this.weekMenu = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenus();
    this.moving = null;
  }

  /** While a day is picked: by the page (the profile), or by « Déplacer » here. */
  pickOf(cell: CalendarCell<T>): 'target' | 'source' | 'dim' | null {
    if (cell.pick) return cell.pick;
    if (!this.moving) return null;
    if (cell.day === this.moving) return 'source';
    return cell.locked || this.readOnly ? 'dim' : 'target';
  }

  /** A click on a card: its window; while moving a day: the day that takes it (the day itself: cancelled). */
  onCardClick(cell: CalendarCell<T>): void {
    const moved = this.moving;
    if (!moved) {
      this.openDay.emit(cell.day);
      return;
    }
    this.moving = null;
    if (cell.day !== moved && !cell.locked && !this.readOnly) this.swap.emit({ from: moved, to: cell.day });
  }

  get movingText(): string {
    return this.isWorkout
      ? this.ht('Click the day where the workout goes.', 'Cliquez sur le jour où mettre la séance.')
      : this.ht('Click the day where this day goes.', 'Cliquez sur le jour où mettre ce jour.');
  }

  get hasMenu(): boolean {
    return this.menuDay !== null || this.weekMenu !== null;
  }

  toggleDayMenu(day: T, event: Event): void {
    event.stopPropagation();
    this.weekMenu = null;
    this.menuDay = this.menuDay === day ? null : day;
  }

  toggleWeekMenu(week: number, event: Event): void {
    event.stopPropagation();
    this.menuDay = null;
    this.weekMenu = this.weekMenu === week ? null : week;
  }

  act(type: CalendarDayAction, day: T): void {
    this.menuDay = null;
    // « Déplacer » of the editors' menu is done here (the page's own menu, the profile, has its own).
    if (type === 'move' && !this.menuItems) {
      this.moving = day;
      return;
    }
    this.dayAction.emit({ type, day });
  }

  onDuplicateWeek(week: CalendarWeek<T>): void {
    this.weekMenu = null;
    this.duplicateWeek.emit(week);
  }

  onRepeatWeek(week: CalendarWeek<T>): void {
    this.weekMenu = null;
    this.repeatWeek.emit(week);
  }

  onDeleteWeek(week: number): void {
    this.weekMenu = null;
    this.deleteWeek.emit(week);
  }

  setDetailed(on: boolean): void {
    if (on !== this.detailed) this.detailedChange.emit(on);
  }

  // ---------- Drag a card onto another day: the two days swap ----------

  onDragStart(event: DragEvent, cell: CalendarCell<T>): void {
    if (!cell.movable || this.moving) {
      event.preventDefault();
      return;
    }
    this.dragDay = cell.day;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(cell.index));
    }
  }

  onDragOver(event: DragEvent, cell: CalendarCell<T>): void {
    if (!this.dragDay || cell.day === this.dragDay || cell.locked || this.readOnly) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropDay = cell.day;
  }

  onDragLeave(cell: CalendarCell<T>): void {
    if (this.dropDay === cell.day) this.dropDay = null;
  }

  onDragEnd(): void {
    this.dragDay = null;
    this.dropDay = null;
  }

  onDrop(event: DragEvent, cell: CalendarCell<T>): void {
    event.preventDefault();
    const moved = this.dragDay;
    this.onDragEnd();
    if (!moved || moved === cell.day || cell.locked || this.readOnly) return;
    this.swap.emit({ from: moved, to: cell.day });
  }

  /** The ⋮ of a card: the page's own menu, or the editors' (copy, rest, clear). */
  menuOf(cell: CalendarCell<T>): CalendarMenuItem[] {
    if (this.menuItems) return this.menuItems(cell);
    const items: CalendarMenuItem[] = [];
    // An empty day has nothing to move (another day is moved onto it).
    if (cell.hasContent) items.push({ type: 'move', label: this.ht('Move', 'Déplacer'), icon: 'move' });
    if (this.canCopy) items.push({ type: 'copy', label: this.translate.instant('COPY_DAYS.BUTTON_COPY_DAY'), icon: 'copy', disabled: !cell.hasContent });
    items.push({ type: 'rest', label: this.restLabel(cell), icon: cell.rest ? (this.isWorkout ? 'activity' : 'coffee') : (this.isWorkout ? 'moon' : 'flag') });
    if (this.canClear && !cell.rest) items.push({ type: 'clear', label: this.translate.instant('DAY_MENU_CLEAR'), icon: 'x-circle', disabled: !cell.hasContent });
    return items;
  }

  restLabel(cell: CalendarCell<T>): string {
    if (this.isWorkout) return this.translate.instant(cell.rest ? 'DAY_MENU_TRAINING' : 'MARK_AS_REST_DAY');
    return cell.rest ? this.ht('Put meals back', 'Remettre des repas') : this.translate.instant('SET_AS_CHEAT_MEAL');
  }

  trackWeek = (_: number, week: CalendarWeek<T>) => week.number;
  trackCell = (_: number, cell: CalendarCell<T>) => cell.index;
}
