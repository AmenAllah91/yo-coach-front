import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import {
  PauseResult,
  ProgramKind,
  addDaysIso,
  changeSentence,
  daysBetween,
  isAfterActivityError,
  todayIso,
  typingYear,
} from '@shared/models/program-schedule';

/**
 * « Mettre en pause » a client (backlog-programmes.md DS-11, S3): from one day to another, everything planned (workout
 * and nutrition by default, P2) resumes after the pause; the program in progress keeps its past days. Nothing is lost,
 * so no confirmation: « Annuler » follows the save.
 */
@Component({
  selector: 'app-client-pause-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './client-pause-modal.component.html',
  styleUrls: ['../change-dates-modal/change-dates-modal.component.scss', '../program-shift-modal/program-shift-modal.component.scss'],
})
export class ClientPauseModalComponent implements OnInit, OnDestroy {
  @Input() clientId = '';
  @Input() clientName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly today = todayIso();
  from = this.today;
  to = addDaysIso(this.today, 6);
  types: ProgramKind[] = ['WORKOUT', 'NUTRITION'];
  preview: PauseResult | null = null;
  checking = false;
  saving = false;
  error = '';
  /** What the server said about the refusal: the program concerned and its days (DS-10). */
  errorParams: Record<string, string> = {};

  private readonly check$ = new Subject<void>();
  private subscription?: Subscription;

  constructor(public schedule: ProgramScheduleService) {}

  ngOnInit(): void {
    this.subscription = this.check$.pipe(
      debounceTime(150),
      tap(() => { this.checking = true; this.error = ''; }),
      switchMap(() => !this.types.length || this.to < this.from ? of({ preview: null as PauseResult | null, error: null as any })
        : this.schedule.pausePreview(this.clientId, this.from, this.to, this.types).pipe(
          map(preview => ({ preview: preview as PauseResult | null, error: null as any })),
          catchError(error => of({ preview: null as PauseResult | null, error })),
        )),
    ).subscribe(({ preview, error }) => {
      this.checking = false;
      this.preview = preview;
      this.error = error ? this.errorKey(error) : '';
    });
    this.check$.next();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  readonly addDays = addDaysIso;

  get days(): number {
    return this.to >= this.from ? daysBetween(this.from, this.to) + 1 : 0;
  }

  get lengthChoices(): { key: string; to: string }[] {
    return [
      { key: 'PAUSE_ONE_WEEK', to: addDaysIso(this.from, 6) },
      { key: 'PAUSE_TWO_WEEKS', to: addDaysIso(this.from, 13) },
    ];
  }

  get isCustomEnd(): boolean {
    return !this.lengthChoices.some(choice => choice.to === this.to);
  }

  /** What moves, type by type, in the order chosen. */
  get groups(): { kind: ProgramKind; lines: string[] }[] {
    if (!this.preview) return [];
    return this.types.map(kind => ({
      kind,
      lines: (this.preview?.changes[kind] || []).map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate))),
    }));
  }

  get canSave(): boolean {
    return !this.saving && !this.checking && !this.error && this.types.length > 0 && this.days >= 1;
  }

  pickFrom(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value || typingYear(value)) return;
    const length = this.days;
    this.from = value;
    // The pause keeps its length when its first day moves.
    this.to = addDaysIso(value, Math.max(length, 1) - 1);
    this.check$.next();
  }

  pickTo(date: string): void {
    this.to = date < this.from ? this.from : date;
    this.check$.next();
  }

  pickToInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value || typingYear(value)) return;
    this.pickTo(value);
    // A day before the first one is brought back: the field shows the day kept.
    input.value = this.isCustomEnd ? this.to : '';
  }

  toggle(kind: ProgramKind): void {
    this.types = this.types.includes(kind) ? this.types.filter(type => type !== kind)
      : (['WORKOUT', 'NUTRITION'] as ProgramKind[]).filter(type => type === kind || this.types.includes(type));
    this.check$.next();
  }

  close(): void {
    if (!this.saving) this.closed.emit();
  }

  save(): void {
    if (!this.canSave) return;
    this.saving = true;
    this.schedule.pause(this.clientId, this.from, this.to, this.types).subscribe({
      next: result => {
        this.saving = false;
        this.schedule.announcePause(result, this.clientName);
        this.saved.emit();
      },
      error: error => {
        this.saving = false;
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
    if (isAfterActivityError(error)) return 'ASSIGN_FLOW.PAUSE_AFTER_ACTIVITY';
    if (error?.status === 400) return 'ASSIGN_FLOW.PAUSE_INVALID';
    return 'ASSIGN_FLOW.REASON_UNEXPECTED';
  }
}
