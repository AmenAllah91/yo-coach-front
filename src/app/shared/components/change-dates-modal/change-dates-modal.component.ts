import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Observable } from 'rxjs';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import {
  ClientSchedulePreview,
  OverlapChoice,
  ProgramKind,
  ScheduleChange,
  addDaysIso,
  changeSentence,
  daysBetween,
  isLockedError,
  isStartedError,
  losesSomething,
  movedChanges,
  todayIso,
} from '@shared/models/program-schedule';

/**
 * « Modifier les dates » of a client program (backlog-programmes.md A8, CD-10/CD-11): it keeps its length (a file keeps
 * the end chosen). The programs it reaches are shifted after it by default, « Retirer » stays a choice; the coach
 * confirms only when a program is removed or cut, and « Annuler » follows the save. It opens on the program's current
 * dates; a file already started keeps its start and only its end moves (an app program the client started is not
 * offered: its history keeps its dates).
 */
@Component({
  selector: 'app-change-dates-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, AssignScheduleComponent, AssignConfirmComponent],
  templateUrl: './change-dates-modal.component.html',
  styleUrls: ['./change-dates-modal.component.scss'],
})
export class ChangeDatesModalComponent implements OnChanges {
  @Input() kind: ProgramKind = 'WORKOUT';
  @Input() plan: any = null;
  @Input() isFile = false;
  @Input() clientId: string | null = null;
  @Input() clientName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  startDate = '';
  endDate = '';
  previews: Record<string, ClientSchedulePreview> = {};
  checking = false;
  /** « Enregistrer » clicked while the new dates were being checked: the save goes as soon as they are. */
  pendingSave = false;
  saving = false;
  error = '';
  step: 'dates' | 'confirm' = 'dates';
  overlap: OverlapChoice = 'SHIFT';
  confirmRows: AssignConfirmRow[] = [];
  clientIds: string[] = [];
  durationDays: number | null = null;
  /** A file program already started: its start stays, its end is chosen. */
  fixedStart = false;
  /** Its start before the change: the shortcuts −1 / +1 semaine count from it (CD-13). */
  originalStart = '';
  private originalEnd = '';

  constructor(public schedule: ProgramScheduleService, private workoutService: WorkoutService,
              private nutritionService: NutritionService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId']) this.clientIds = this.clientId ? [String(this.clientId)] : [];
    if (changes['plan'] && this.plan) {
      const start = String(this.plan.startDate || '').slice(0, 10);
      const end = String(this.plan.endDate || '').slice(0, 10);
      const today = todayIso();
      this.durationDays = !this.isFile && start && end ? daysBetween(start, end) + 1 : null;
      this.originalStart = start;
      this.originalEnd = end;
      this.fixedStart = this.isFile && !!start && start < today;
      // Its current dates first: nothing changes until the coach picks another day.
      this.startDate = start && (start >= today || this.fixedStart) ? start : '';
      this.endDate = this.isFile ? end : '';
      this.step = 'dates';
      this.overlap = 'SHIFT';
      this.error = '';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.saving) return;
    if (this.step === 'confirm') this.step = 'dates';
    else this.close();
  }

  /** The dates are the program's current ones. */
  get unchanged(): boolean {
    return this.startDate === this.originalStart && (!this.isFile || this.endDate === this.originalEnd);
  }

  /** While the dates are being checked the button stays usable: the save waits for the answer (CD-11). */
  get canSave(): boolean {
    if (this.saving || this.pendingSave || !this.startDate || !this.plan?.id || this.unchanged) return false;
    if (this.isFile) return !!this.endDate && this.endDate >= this.startDate && this.endDate >= todayIso();
    return true;
  }

  private get preview(): ClientSchedulePreview | undefined {
    return this.previews[this.clientIds[0]];
  }

  /** Programs the new dates reach that can start later instead: the coach chooses « Décaler » or « Retirer ». */
  get shifts(): ScheduleChange[] {
    return this.preview?.shifts || [];
  }

  get shiftLines(): string[] {
    return this.lines(movedChanges(this.preview, 'SHIFT'));
  }

  get removeLines(): string[] {
    return this.lines(movedChanges(this.preview, 'REMOVE'));
  }

  private lines(changes: ScheduleChange[]): string[] {
    return changes.map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  /** Other dates: « Décaler » again (nothing lost) until the coach chooses otherwise for these ones. */
  onPreviews(previews: Record<string, ClientSchedulePreview>): void {
    this.previews = previews;
    this.overlap = 'SHIFT';
  }

  onChecking(value: boolean): void {
    this.checking = value;
    if (!value && this.pendingSave) {
      this.pendingSave = false;
      this.save();
    }
  }

  close(): void {
    if (this.saving) return;
    this.closed.emit();
  }

  save(): void {
    if (this.pendingSave || !this.canSave) return;
    if (this.checking) {
      this.pendingSave = true;
      return;
    }
    const changes = movedChanges(this.preview, this.shifts.length ? this.overlap : 'REMOVE');
    if (losesSomething(changes)) {
      this.confirmRows = [{ id: this.clientIds[0], name: this.clientName, lines: this.lines(changes) }];
      this.step = 'confirm';
      return;
    }
    this.doSave();
  }

  doSave(): void {
    if (!this.plan?.id) return;
    this.saving = true;
    this.error = '';
    const start = this.startDate;
    const end = this.isFile ? this.endDate : addDaysIso(start, (this.durationDays || 1) - 1);
    const request: Observable<any> = this.kind === 'WORKOUT'
      ? this.workoutService.updateWorkoutPlanDates(this.plan.id, start, end, this.overlap)
      : this.nutritionService.updateNutritionPlanDates(this.plan.id, start, end, this.overlap);
    request.subscribe({
      next: updated => {
        this.saving = false;
        this.schedule.announceMove(updated, this.plan?.name || '', start, end);
        this.saved.emit(updated);
      },
      error: error => {
        this.saving = false;
        this.step = 'dates';
        this.error = isLockedError(error) ? 'ASSIGN_FLOW.LOCKED_ERROR'
          : isStartedError(error) ? 'ASSIGN_FLOW.STARTED_ERROR'
          : 'ASSIGN_FLOW.REASON_UNEXPECTED';
      },
    });
  }
}
