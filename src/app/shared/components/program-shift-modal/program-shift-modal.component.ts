import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import {
  OverviewItem,
  ProgramKind,
  ScheduleChange,
  ShiftPreview,
  addDaysIso,
  changeSentence,
  daysBetween,
  defaultResume,
  firstShiftableDay,
  isAfterActivityError,
  isLockedError,
  losesSomething,
  todayIso,
  typingYear,
} from '@shared/models/program-schedule';

/**
 * « Décaler la suite » of a client program, even started (backlog-programmes.md DS-10, S2): the days from a date on
 * resume later, rest days in between; the days the client did stay where they are; the programs after follow.
 * Workout proposes the first day missed (the client does it after the gap), nutrition today (P1).
 */
@Component({
  selector: 'app-program-shift-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, AssignConfirmComponent],
  templateUrl: './program-shift-modal.component.html',
  styleUrls: ['../change-dates-modal/change-dates-modal.component.scss', './program-shift-modal.component.scss'],
})
export class ProgramShiftModalComponent implements OnInit, OnDestroy {
  @Input() kind: ProgramKind = 'WORKOUT';
  @Input() item!: OverviewItem;
  @Input() clientName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly today = todayIso();
  /** What the server proposes: the first day missed or today, the client's last activity. */
  proposal: ShiftPreview | null = null;
  from = '';
  resume = '';
  changes: ScheduleChange[] = [];
  newEnd: string | null = null;
  checking = false;
  saving = false;
  error = '';
  /** What the server said about the refusal: the program concerned and its days (DS-10). */
  errorParams: Record<string, string> = {};
  step: 'dates' | 'confirm' = 'dates';
  confirmRows: AssignConfirmRow[] = [];

  private readonly check$ = new Subject<void>();
  private subscription?: Subscription;
  private readonly cache = new Map<string, ShiftPreview>();

  constructor(public schedule: ProgramScheduleService) {}

  ngOnInit(): void {
    this.subscription = this.check$.pipe(
      debounceTime(150),
      tap(() => { this.checking = true; this.error = ''; }),
      switchMap(() => {
        const key = `${this.from}|${this.days}`;
        const known = this.cache.get(key);
        if (known) return of({ preview: known, error: null as any });
        return this.schedule.shiftPreview(this.kind, this.item.id, this.from, this.days).pipe(
          tap(preview => this.cache.set(key, preview)),
          switchMap(preview => of({ preview, error: null as any })),
          catchError(error => of({ preview: null as ShiftPreview | null, error })),
        );
      }),
    ).subscribe(({ preview, error }) => {
      this.checking = false;
      this.changes = preview?.changes || [];
      this.newEnd = preview?.newEndDate || null;
      this.error = error ? this.errorKey(error) : '';
    });
    // What it proposes first (P1), then what that changes.
    this.schedule.shiftPreview(this.kind, this.item.id).subscribe({
      next: proposal => {
        this.proposal = proposal;
        this.from = proposal.suggestedFrom || firstShiftableDay(proposal);
        this.resume = defaultResume(this.from, this.today);
        this.check$.next();
      },
      error: error => (this.error = this.errorKey(error)),
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.saving) return;
    if (this.step === 'confirm') this.step = 'dates';
    else this.close();
  }

  /** Days of pause: from the first day moved to the day it resumes. */
  get days(): number {
    return this.from && this.resume ? daysBetween(this.from, this.resume) : 0;
  }

  /** The days can move from the day after the client's last activity. */
  get minFrom(): string {
    return this.proposal ? firstShiftableDay(this.proposal) : '';
  }

  /** It resumes today or later, and after the first day moved. */
  get minResume(): string {
    const next = this.from ? addDaysIso(this.from, 1) : this.today;
    return next > this.today ? next : this.today;
  }

  get resumeChoices(): { key: string; date: string }[] {
    if (!this.from) return [];
    const choices = [
      { key: 'SHIFT_RESUME_TODAY', date: this.today },
      { key: 'SHORTCUT_PLUS_WEEK', date: addDaysIso(this.from, 7) },
      { key: 'SHIFT_PLUS_TWO_WEEKS', date: addDaysIso(this.from, 14) },
    ].filter(choice => choice.date >= this.minResume);
    return choices.filter((choice, i) => choices.findIndex(other => other.date === choice.date) === i);
  }

  get isCustomResume(): boolean {
    return !!this.resume && !this.resumeChoices.some(choice => choice.date === this.resume);
  }

  /** What changes, the program itself first. */
  get lines(): string[] {
    return this.changes.map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  get canSave(): boolean {
    return !this.saving && !this.checking && !this.error && !!this.from && this.days >= 1 && this.resume >= this.minResume;
  }

  pickFrom(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value || typingYear(value)) return;
    const shift = this.days;
    this.from = value < this.minFrom ? this.minFrom : value;
    // A day too early is brought back: the field shows the day kept, not the one typed.
    input.value = this.from;
    // The pause keeps its length when its first day moves.
    this.resume = addDaysIso(this.from, Math.max(shift, 1));
    if (this.resume < this.minResume) this.resume = this.minResume;
    this.check$.next();
  }

  pickResume(date: string): void {
    this.resume = date < this.minResume ? this.minResume : date;
    this.check$.next();
  }

  pickResumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value || typingYear(value)) return;
    this.pickResume(value);
    input.value = this.isCustomResume ? this.resume : '';
  }

  close(): void {
    if (!this.saving) this.closed.emit();
  }

  save(): void {
    if (!this.canSave) return;
    if (losesSomething(this.changes)) {
      this.confirmRows = [{ id: this.item.id, name: this.clientName, lines: this.lines }];
      this.step = 'confirm';
      return;
    }
    this.doSave();
  }

  doSave(): void {
    this.saving = true;
    this.error = '';
    this.schedule.shift(this.kind, this.item.id, this.from, this.days).subscribe({
      next: result => {
        this.saving = false;
        this.schedule.announceShift(result, this.item.name);
        this.saved.emit();
      },
      error: error => {
        this.saving = false;
        this.step = 'dates';
        this.error = this.errorKey(error);
      },
    });
  }

  private errorKey(error: any): string {
    const params = error?.error?.params || {};
    this.errorParams = {
      name: params.name || '',
      date: this.schedule.formatDate(params.date),
      next: this.schedule.formatDate(params.next),
    };
    if (isAfterActivityError(error)) return 'ASSIGN_FLOW.SHIFT_AFTER_ACTIVITY';
    if (isLockedError(error)) return 'ASSIGN_FLOW.LOCKED_ERROR';
    if (error?.status === 400) return 'ASSIGN_FLOW.SHIFT_INVALID';
    return 'ASSIGN_FLOW.REASON_UNEXPECTED';
  }
}
