import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, debounce, timer, of, switchMap, catchError, map, tap } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import {
  ClientSchedulePreview,
  DateShortcut,
  ProgramKind,
  addDaysIso,
  changeSentence,
  daysBetween,
  dateShortcuts,
  moveShortcuts,
  sameWeekdayAround,
  todayIso,
  typingYear,
} from '@shared/models/program-schedule';

/**
 * When the program starts (backlog-programmes.md A2/A5): shortcuts (Dans la continuité · Aujourd'hui · Demain ·
 * Lundi prochain · Autre date), the end, and what changes on each client's calendar, asked to the server. With one
 * client, the changes are written here; with several, the parent writes them next to each client.
 */
@Component({
  selector: 'app-assign-schedule',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './assign-schedule.component.html',
  styleUrls: ['./assign-schedule.component.scss'],
})
export class AssignScheduleComponent implements OnInit, OnChanges, OnDestroy {
  @Input() kind: ProgramKind = 'WORKOUT';
  /** A library program; or {@link durationDays} for a program still to create; a file takes the end chosen here. */
  @Input() programId: string | null = null;
  @Input() durationDays: number | null = null;
  @Input() isFile = false;
  @Input() clientIds: string[] = [];
  /** The client program whose dates change ("Modifier les dates"). */
  @Input() excludePlanId: string | null = null;
  /** One client: the changes are written under the dates. */
  @Input() showLines = false;
  /** Offer the "continuity" shortcut and preselect it (one client with a program going on). */
  @Input() offerContinuity = true;
  /** The program's length when known here: the end shows before any client is chosen (the server confirms it). */
  @Input() lengthDays: number | null = null;
  /** The start cannot move (a file program already started): only its end is chosen. */
  @Input() fixedStart = false;
  /**
   * « Modifier les dates » (CD-13): the program's current start. The shortcuts become −1 / +1 semaine, the continuity
   * and today, and another weekday proposes the program's own weekday.
   */
  @Input() moveFrom: string | null = null;

  @Input() startDate = '';
  @Output() startDateChange = new EventEmitter<string>();
  @Input() endDate = '';
  @Output() endDateChange = new EventEmitter<string>();
  @Output() previewsChange = new EventEmitter<Record<string, ClientSchedulePreview>>();
  /** True while what changes on the calendars is not known (being checked, or the check failed): no assignment. */
  @Output() checkingChange = new EventEmitter<boolean>();

  readonly today = todayIso();
  shortcuts: DateShortcut[] = dateShortcuts(this.today);
  previews: Record<string, ClientSchedulePreview> = {};
  checking = false;
  failed = false;
  /** The coach picked a date himself: the continuity shortcut no longer takes over. */
  private touched = false;
  private continuityApplied = false;
  /** The dates and program of the last check: when they change, the lines of the previous dates go. */
  private lastKey = '';
  private readonly refresh$ = new Subject<void>();
  private subscription?: Subscription;
  /** What the server answered for each set of dates while this window is open. */
  private readonly cache = new Map<string, ClientSchedulePreview[]>();

  private get requestKey(): string {
    return [this.kind, this.programId, this.durationDays, this.startDate, this.isFile ? this.endDate : '',
      this.excludePlanId, this.clientIds.join(',')].join('|');
  }

  constructor(public schedule: ProgramScheduleService) {}

  ngOnInit(): void {
    this.shortcuts = this.buildShortcuts(null);
    if (this.startDate) {
      this.touched = true;
      this.fillEnd();
    } else {
      this.setStart(this.today, false);
    }
    this.subscription = this.refresh$.pipe(
      // Dates already checked in this window answer at once, without a request (CD-11).
      debounce(() => timer(this.cache.has(this.requestKey) ? 0 : 200)),
      tap(() => this.beginCheck()),
      switchMap(() => {
        if (!this.clientIds.length || !this.startDate || (this.isFile && !this.endDate)) {
          return of({ rows: null as ClientSchedulePreview[] | null, failed: false });
        }
        const key = this.requestKey;
        const known = this.cache.get(key);
        if (known) return of({ rows: known as ClientSchedulePreview[] | null, failed: false });
        return this.schedule.preview({
          kind: this.kind,
          programId: this.programId,
          durationDays: this.durationDays,
          startDate: this.startDate,
          endDate: this.isFile ? this.endDate : null,
          clientIds: this.clientIds,
          excludePlanId: this.excludePlanId,
        }).pipe(
          tap(rows => this.cache.set(key, rows)),
          map(rows => ({ rows: rows as ClientSchedulePreview[] | null, failed: false })),
          catchError(() => of({ rows: null as ClientSchedulePreview[] | null, failed: true })),
        );
      }),
    ).subscribe(({ rows, failed }) => {
      this.failed = failed;
      this.setChecking(false);
      if (!rows) {
        this.previews = {};
        this.previewsChange.emit(this.previews);
        return;
      }
      this.previews = Object.fromEntries(rows.map(row => [row.clientId, row]));
      this.applyContinuity(rows);
      const end = rows.find(row => row.endDate)?.endDate;
      if (!this.isFile && end && end !== this.endDate) {
        this.endDate = end;
        this.endDateChange.emit(end);
      }
      this.previewsChange.emit(this.previews);
    });
    this.refresh$.next();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientIds'] && !changes['clientIds'].firstChange) {
      this.continuityApplied = false;
      if (this.clientIds.length !== 1) this.shortcuts = this.buildShortcuts(null);
    }
    const later = !Object.values(changes).every(change => change.firstChange);
    if (later && (changes['durationDays'] || changes['lengthDays']) && !this.isFile && this.startDate) {
      // Another length chosen (create window): the end follows at once.
      this.endDate = '';
      this.fillEnd();
    }
    if (later && (changes['clientIds'] || changes['programId'] || changes['durationDays'] || changes['excludePlanId'])) {
      this.refresh$.next();
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /* ---------------- choosing ---------------- */

  pick(date: string): void {
    this.touched = true;
    this.setStart(date, true);
  }

  pickCustom(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    // While the year is typed (0002, 0020…) nothing is chosen: no request, no jump back to today.
    if (!value || typingYear(value)) return;
    this.pick(value < this.today ? this.today : value);
    // A day in the past is brought back to today: the field shows the day kept, not the one typed.
    input.value = this.isCustom ? this.startDate : '';
  }

  pickEnd(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.endDate = value;
    this.endDateChange.emit(value);
    this.refresh$.next();
  }

  /** The check failed: try again. */
  retry(): void {
    this.refresh$.next();
  }

  /** The end chosen for a file program cannot be before its start, nor in the past. */
  get endMin(): string {
    return this.startDate > this.today ? this.startDate : this.today;
  }

  /** The shortcuts: those of an assignment, or those of new dates for a program (CD-13). */
  private buildShortcuts(continuity: string | null): DateShortcut[] {
    return this.moveFrom ? moveShortcuts(this.today, this.moveFrom, continuity) : dateShortcuts(this.today, continuity);
  }

  /** Another weekday than the program's (an app program): the same weekday just before or after (CD-13). */
  get weekdayChoice(): { day: string; before: string | null; after: string } | null {
    if (!this.moveFrom || this.isFile || this.fixedStart || !this.startDate) return null;
    const around = sameWeekdayAround(this.startDate, this.moveFrom, this.today);
    return around ? { day: this.schedule.formatWeekday(this.moveFrom), ...around } : null;
  }

  get isCustom(): boolean {
    return !!this.startDate && !this.shortcuts.some(shortcut => shortcut.date === this.startDate);
  }

  get endLabel(): string {
    if (!this.endDate || this.endDate < this.startDate) return '';
    return this.schedule.formatDate(this.endDate);
  }

  get durationLabelDays(): number {
    return this.startDate && this.endDate && this.endDate >= this.startDate ? daysBetween(this.startDate, this.endDate) + 1 : 0;
  }

  get endBeforeStart(): boolean {
    return this.isFile && !!this.endDate && !!this.startDate && this.endDate < this.startDate;
  }

  /** With one client: what changes on their calendar. */
  get singleLines(): string[] {
    if (this.clientIds.length !== 1) return [];
    const preview = this.previews[this.clientIds[0]];
    return (preview?.changes || []).map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  get singleError(): string | null {
    if (this.clientIds.length !== 1) return null;
    return this.previews[this.clientIds[0]]?.errorCode || null;
  }

  private setStart(date: string, refresh: boolean): void {
    if (this.endDate && this.startDate && this.endDate >= this.startDate && date !== this.startDate) {
      // The program keeps its length when its start moves: the end follows at once.
      const end = addDaysIso(date, daysBetween(this.startDate, this.endDate));
      this.endDate = end;
      this.endDateChange.emit(end);
    }
    this.startDate = date;
    this.startDateChange.emit(date);
    this.fillEnd();
    if (refresh) this.refresh$.next();
  }

  /** The end of a program whose length is known here, before the server answers. */
  private fillEnd(): void {
    if (this.isFile || !this.startDate || (this.endDate && this.endDate >= this.startDate)) return;
    const days = this.lengthDays || this.durationDays;
    if (!days || days < 1) return;
    this.endDate = addDaysIso(this.startDate, days - 1);
    this.endDateChange.emit(this.endDate);
  }

  /** A new check: the lines of other dates go at once (never shown next to dates they were not computed for). */
  private beginCheck(): void {
    const key = [this.kind, this.programId, this.durationDays, this.startDate, this.isFile ? this.endDate : '',
      this.excludePlanId].join('|');
    if (key !== this.lastKey) {
      this.lastKey = key;
      if (Object.keys(this.previews).length) {
        this.previews = {};
        this.previewsChange.emit(this.previews);
      }
    }
    this.setChecking(true);
  }

  /** One client with a program going on: "Dans la continuité" is offered and, until the coach picks, selected. */
  private applyContinuity(rows: ClientSchedulePreview[]): void {
    if (!this.offerContinuity || this.clientIds.length !== 1) return;
    const next = rows[0]?.nextFreeDate || null;
    this.shortcuts = this.buildShortcuts(next);
    // New dates of a program: the continuity is offered, never chosen for the coach.
    if (this.moveFrom) return;
    if (!this.touched && !this.continuityApplied && next && next > this.today && next !== this.startDate) {
      this.continuityApplied = true;
      this.setStart(next, true);
    }
  }

  private setChecking(value: boolean): void {
    this.checking = value;
    this.checkingChange.emit(value || this.failed);
  }
}
