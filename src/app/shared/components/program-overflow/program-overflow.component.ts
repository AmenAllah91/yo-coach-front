import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, debounceTime, switchMap, of, catchError, firstValueFrom, map, Observable } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ClientSchedulePreview, ProgramKind, ScheduleChange, addDaysIso, changeSentence } from '@shared/models/program-schedule';

export type OverlapChoice = 'SHIFT' | 'REMOVE';

/**
 * A client program that grows over the next one in its editor (backlog-programmes.md P9): a banner as soon as it does,
 * then, at the save, the coach chooses « Décaler » (the next one starts after it, nothing lost) or « Retirer ».
 */
@Component({
  selector: 'app-program-overflow',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <div class="po-banner" *ngIf="reaches" role="status">
      <i-feather name="alert-triangle" class="po-ico"></i-feather>
      <span>{{ bannerText }}</span>
    </div>

    <div class="po-backdrop" *ngIf="asking" (click)="back()">
      <div class="po" role="dialog" aria-modal="true" aria-labelledby="po-title" (click)="$event.stopPropagation()">
        <h3 class="po-title" id="po-title">{{ 'ASSIGN_FLOW.OVERFLOW_TITLE' | translate }}</h3>
        <p class="po-sub">{{ 'ASSIGN_FLOW.OVERFLOW_SUBTITLE' | translate: { name: programName, end: schedule.formatDate(end) } }}</p>

        <div class="po-options" role="radiogroup">
          <button type="button" role="radio" class="po-option" *ngIf="shifts.length" [class.is-on]="choice === 'SHIFT'"
                  [attr.aria-checked]="choice === 'SHIFT'" (click)="choice = 'SHIFT'">
            <span class="po-radio" aria-hidden="true"></span>
            <span class="po-option-text">
              <strong>{{ 'ASSIGN_FLOW.OVERFLOW_SHIFT' | translate }}</strong>
              <small>{{ 'ASSIGN_FLOW.OVERFLOW_SHIFT_HINT' | translate }}</small>
              <small class="po-line" *ngFor="let line of shiftLines">{{ line }}</small>
            </span>
          </button>
          <button type="button" role="radio" class="po-option" [class.is-on]="choice === 'REMOVE'"
                  [attr.aria-checked]="choice === 'REMOVE'" (click)="choice = 'REMOVE'">
            <span class="po-radio" aria-hidden="true"></span>
            <span class="po-option-text">
              <strong>{{ (shifts.length ? 'ASSIGN_FLOW.OVERFLOW_REMOVE' : 'ASSIGN_FLOW.CONFIRM_BUTTON') | translate }}</strong>
              <small *ngIf="hasRemoval">{{ 'ASSIGN_FLOW.OVERFLOW_REMOVE_HINT' | translate }}</small>
              <small class="po-line" *ngFor="let line of removeLines">{{ line }}</small>
            </span>
          </button>
        </div>

        <div class="po-actions">
          <button type="button" class="po-btn po-btn--ghost" (click)="back()">{{ 'ASSIGN_FLOW.OVERFLOW_BACK' | translate }}</button>
          <button type="button" class="po-btn po-btn--primary" (click)="confirm()">{{ 'ASSIGN_FLOW.OVERFLOW_SAVE' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .po-banner { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; background: light-dark(#fffbeb, #332c12); border: 1px solid #fde68a; color: light-dark(#92400e, #f4996c); font-size: 14px; line-height: 1.45; }
    .po-ico { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
    .po-ico ::ng-deep svg { width: 16px; height: 16px; }
    .po-backdrop { position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, 0.45); }
    .po { width: min(480px, 100%); display: grid; gap: 12px; padding: 24px; border-radius: 18px; background: light-dark(#fff, #1d2125); box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25); color: light-dark(#0f172a, #e8ecf6); }
    .po-title { margin: 0; font-size: 18px; font-weight: 600; }
    .po-sub { margin: 0; font-size: 14px; color: light-dark(#475569, #bfc5ce); line-height: 1.5; }
    .po-options { display: grid; gap: 8px; }
    .po-option { display: flex; gap: 12px; align-items: flex-start; width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid light-dark(#e2e8f0, #34393f); background: light-dark(#fff, #1d2125); text-align: left; font: inherit; cursor: pointer; }
    .po-option.is-on { border-color: #0c86c8; background: light-dark(#f0f9ff, #1f303b); }
    .po-radio { width: 18px; height: 18px; margin-top: 2px; border-radius: 50%; border: 2px solid light-dark(#cbd5e1, #363e47); flex-shrink: 0; }
    .po-option.is-on .po-radio { border-color: #0c86c8; box-shadow: inset 0 0 0 3px #fff; background: #0c86c8; }
    .po-option-text { display: grid; gap: 3px; }
    .po-option-text strong { font-size: 14px; font-weight: 600; }
    .po-option-text small { font-size: 13px; color: light-dark(#64748b, #a5abb4); line-height: 1.4; }
    .po-option-text .po-line { color: light-dark(#92400e, #f4996c); }
    .po-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .po-btn { min-height: 40px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .po-btn--ghost { border: 1px solid light-dark(#e2e8f0, #34393f); background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); }
    .po-btn--primary { border: 1px solid #0f172a; background: #0f172a; color: #fff; }
  `],
})
export class ProgramOverflowComponent implements OnChanges, OnDestroy {
  @Input() kind: ProgramKind = 'WORKOUT';
  @Input() planId: string | null = null;
  @Input() clientId: string | null = null;
  @Input() programName = '';
  @Input() startDate: string | null = null;
  @Input() dayCount = 0;
  /** The end saved on the server: only a longer program is checked. */
  @Input() savedEnd: string | null = null;
  @Output() chosen = new EventEmitter<OverlapChoice>();

  changes: ScheduleChange[] = [];
  shifts: ScheduleChange[] = [];
  end: string | null = null;
  asking = false;
  choice: OverlapChoice = 'SHIFT';

  private readonly check$ = new Subject<void>();
  private readonly subscription: Subscription;
  /** The days the last answer was about: a save made before the answer waits for it (it went without the question). */
  private checkedKey: string | null = null;

  constructor(public schedule: ProgramScheduleService) {
    this.subscription = this.check$.pipe(
      debounceTime(300),
      switchMap(() => this.check()),
    ).subscribe(answer => this.apply(answer));
  }

  private get key(): string {
    return [this.planId, this.clientId, this.startDate, this.dayCount, this.savedEnd].join('|');
  }

  /** What the client's other programs become with the current days (null: nothing to check). */
  private check(): Observable<{ key: string; rows: ClientSchedulePreview[] | null }> {
    const key = this.key;
    if (!this.newEnd || !this.planId || !this.clientId || !this.startDate) return of({ key, rows: null });
    return this.schedule.preview({
      kind: this.kind,
      durationDays: this.dayCount,
      startDate: this.startDate,
      clientIds: [this.clientId],
      excludePlanId: this.planId,
    }).pipe(catchError(() => of(null)), map(rows => ({ key, rows })));
  }

  private apply(answer: { key: string; rows: ClientSchedulePreview[] | null }): void {
    const row = answer.rows?.[0];
    this.changes = row?.changes || [];
    this.shifts = row?.shifts || [];
    this.end = this.newEnd;
    this.checkedKey = answer.key;
  }

  ngOnChanges(): void {
    if (!this.newEnd) {
      this.changes = [];
      this.shifts = [];
      return;
    }
    this.check$.next();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** The program's end with its days now, when it is later than the saved one. */
  private get newEnd(): string | null {
    if (!this.startDate || !this.savedEnd || this.dayCount < 1) return null;
    const end = addDaysIso(this.startDate, this.dayCount - 1);
    return end > this.savedEnd.slice(0, 10) ? end : null;
  }

  /** It now reaches another program: the save asks first. */
  get reaches(): boolean {
    return !!this.newEnd && (this.changes.length > 0 || this.shifts.length > 0);
  }

  get hasRemoval(): boolean {
    return this.changes.some(change => change.kind === 'REMOVED');
  }

  get bannerText(): string {
    const touched = this.shifts.length ? this.shifts : this.changes;
    const first = touched[0];
    if (!first) return '';
    const key = touched.length > 1 ? 'ASSIGN_FLOW.OVERFLOW_BANNER_MANY' : 'ASSIGN_FLOW.OVERFLOW_BANNER';
    return this.schedule.text({ key, params: {
      end: this.schedule.formatDate(this.end),
      name: first.programName || '',
      date: this.schedule.formatDate(first.startDate),
      count: touched.length,
    } });
  }

  get shiftLines(): string[] {
    return this.shifts.map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  get removeLines(): string[] {
    return this.changes.map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  /**
   * The save asks, once the current days are checked: a click on « Enregistrer » right after adding a week waits for
   * the answer instead of saving without the question (2026-10-24: the next program was removed without asking).
   */
  async askWhenChecked(): Promise<boolean> {
    if (!this.newEnd) return false;
    if (this.checkedKey !== this.key) this.apply(await firstValueFrom(this.check()));
    return this.ask();
  }

  /** The save asks: true when the window opened (the save waits for the choice). */
  ask(): boolean {
    if (!this.reaches) return false;
    this.choice = this.shifts.length ? 'SHIFT' : 'REMOVE';
    this.asking = true;
    return true;
  }

  confirm(): void {
    this.asking = false;
    this.chosen.emit(this.choice);
  }

  @HostListener('document:keydown.escape')
  back(): void {
    this.asking = false;
  }
}
