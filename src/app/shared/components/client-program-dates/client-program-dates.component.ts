/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { daysBetween, todayIso } from '@shared/models/program-schedule';
import { ChangeDatesModalComponent } from '../change-dates-modal/change-dates-modal.component';

/** Undo window of « Modifier les dates » (D3): the dates are read again when the schedule changes during it. */
const UNDO_WINDOW_MS = 16 * 60 * 1000;

/**
 * « Dates chez le client » of the global settings of a client's program, the same in the workout and nutrition
 * editors: its dates, where the client is in it, the days they see, and « Modifier les dates » right here (the same
 * window as the client's Programmes tab). Not offered once the client started the program: their done days keep
 * their date (rule D1, 409 PROGRAM_STARTED); the duration still makes it shorter or longer.
 */
@Component({
  selector: 'app-client-program-dates',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule, ChangeDatesModalComponent],
  templateUrl: './client-program-dates.component.html',
  styleUrls: ['./client-program-dates.component.scss'],
})
export class ClientProgramDatesComponent {
  @Input() kind: 'WORKOUT' | 'NUTRITION' = 'WORKOUT';
  /** Saved program (null while it is being created: its dates come from the creation window). */
  @Input() planId: string | null = null;
  @Input() planName = '';
  @Input() clientId: string | null = null;
  @Input() clientName = '';
  @Input() startDate = '';
  @Input() endDate = '';
  @Input() dayCount = 0;
  /** Days the client sees once saved (filled and rest days up to the last filled one). */
  @Input() visibleDays = 0;
  /** The client did something in it: its dates no longer move. */
  @Input() started = false;
  @Input() readOnly = false;
  @Input() stoppedAt: string | null = null;
  /** New dates (after « Modifier les dates », or after its « Annuler »): the editor moves its days. */
  @Output() moved = new EventEmitter<{ start: string; end: string }>();

  showModal = false;
  private movedAt = 0;
  private destroyRef = inject(DestroyRef);

  constructor(
    public schedule: ProgramScheduleService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
  ) {
    // « Annuler » of the toast puts the old dates back on the server: the editor follows.
    this.schedule.changed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.planId && Date.now() - this.movedAt < UNDO_WINDOW_MS) this.readDatesAgain();
    });
  }

  get today(): string {
    return todayIso();
  }

  get status(): 'UPCOMING' | 'CURRENT' | 'FINISHED' | 'STOPPED' {
    if (this.stoppedAt) return 'STOPPED';
    if (!this.startDate || this.startDate > this.today) return 'UPCOMING';
    return this.endDate && this.endDate < this.today ? 'FINISHED' : 'CURRENT';
  }

  get weeks(): number {
    return Math.max(1, Math.ceil(this.dayCount / 7));
  }

  /** Day of the program today (1-based), while it runs. */
  get todayNumber(): number {
    return this.startDate ? daysBetween(this.startDate, this.today) + 1 : 0;
  }

  get currentWeek(): number {
    return Math.min(this.weeks, Math.floor((this.todayNumber - 1) / 7) + 1);
  }

  get progress(): number {
    return this.dayCount ? Math.min(100, Math.max(0, (this.todayNumber / this.dayCount) * 100)) : 0;
  }

  get startsIn(): number {
    return this.startDate ? daysBetween(this.today, this.startDate) : 0;
  }

  get endsIn(): number {
    return this.endDate ? daysBetween(this.today, this.endDate) : 0;
  }

  get canMove(): boolean {
    return !!this.planId && !!this.clientId && !this.readOnly && !this.started && this.status !== 'FINISHED' && this.status !== 'STOPPED';
  }

  /** What the change-dates window works on: the program as saved. */
  get modalPlan(): any {
    return { id: this.planId, name: this.planName, startDate: this.startDate, endDate: this.endDate };
  }

  open(): void {
    if (this.canMove) this.showModal = true;
  }

  onSaved(updated: any): void {
    this.showModal = false;
    this.movedAt = Date.now();
    this.emitDates(updated);
  }

  private readDatesAgain(): void {
    const request: Observable<any> = this.kind === 'WORKOUT'
      ? this.workoutService.getWorkoutById(this.planId!, true)
      : this.nutritionService.getNutritionPlanById(this.planId!, true);
    request.subscribe({ next: (plan) => this.emitDates(plan), error: () => {} });
  }

  private emitDates(plan: any): void {
    const start = String(plan?.startDate || '').slice(0, 10);
    const end = String(plan?.endDate || '').slice(0, 10);
    if (start && (start !== this.startDate || end !== this.endDate)) this.moved.emit({ start, end });
  }
}
