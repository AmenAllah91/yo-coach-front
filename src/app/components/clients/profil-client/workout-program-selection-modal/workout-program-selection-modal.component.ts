import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Client } from 'app/service/client.service';
import { PageResponse, WorkoutService } from 'app/service/workout.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

type ConflictResolution = 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH';

interface ScheduleConflict {
  client: Client;
  program: any;
  resolution?: ConflictResolution;
}

@Component({
  selector: 'app-workout-program-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './workout-program-selection-modal.component.html',
  styleUrls: ['./workout-program-selection-modal.component.scss'],
})
export class WorkoutProgramSelectionModalComponent implements OnChanges {
  // ===== Inputs =====
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() client: Client | null = null;
  @Input() workoutFileEnabled = true;

  // ===== Outputs =====
  @Output() closed = new EventEmitter<void>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() assigned = new EventEmitter<any>(); // optionnel (si tu veux refresh dans parent)
  @Output() assignProgram = new EventEmitter<any>();

  // ===== programSelectionList (maintenant ici) =====
  programs: any[] = [];
  loadingPrograms = false;

  // ===== state modal =====
  searchTerm = '';
  selectedProgramId: string | null = null;
  selectedProgramItem: any | null = null;
  startDate = '';
  endDate = '';
  assigning = false;
  selectedClientChecked = true;
  conflict: ScheduleConflict | null = null;
  checkingConflicts = false;
  readonly isAssignModalTitle = 'Assign Workout Program';

  constructor(private workoutService: WorkoutService, private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true || changes['workoutFileEnabled']) {
      this.programs = [];
      this.ensureProgramsLoaded();
    }
  }

  private ensureProgramsLoaded(): void {
    if (this.programs.length) return; // déjà chargé
    this.loadPrograms();
  }

  private loadPrograms(): void {
    this.loadingPrograms = true;

    this.workoutService.getMyLibrary(0, 200).subscribe({
      next: (res: PageResponse<WorkoutPlan>) => {
        this.programs = (res?.content || [])
          .filter((tpl: any) => !tpl.client)
          .filter((tpl: any) => this.workoutFileEnabled || !this.isFileProgram(tpl))
          .map((tpl: any) => {
            const isFile = this.isFileProgram(tpl);
            const totalDays = tpl.workoutDays?.length || 0;
            const totalWeeks = Math.ceil(totalDays / 7);

            return {
              ...tpl,
              id: tpl.id,
              name: tpl.name,
              coach: tpl.coach,
              isFile,
              resourceType: tpl.resourceType,
              fileName: tpl.fileName,
              fileUrl: tpl.fileUrl,
              originalFileName: tpl.originalFileName,
              fileSizeBytes: tpl.fileSizeBytes,

              status: 'upcoming',
              startDate: '',
              endDate: '',

              totalWeeks,
              daysPerWeek: Math.min(totalDays, 7),
              totalDays,
            };
          });

        this.loadingPrograms = false;
      },
      error: () => {
        this.loadingPrograms = false;
      },
    });
  }

  isFileProgram(program: any): boolean {
    const mode = String(program?.workoutPlanMode || '').toUpperCase();
    const type = String(program?.resourceType || '').toUpperCase();
    return mode === 'FILE' || !!program?.fileName || !!program?.fileUrl || ['PDF', 'XLS', 'XLSX', 'EXCEL'].includes(type);
  }

  getProgramTypeLabel(program: any): string {
    if (!this.isFileProgram(program)) return this.translate.instant('APP_PROGRAM');

    const type = String(program?.resourceType || '').toUpperCase();
    if (type === 'PDF') return 'PDF';
    if (type === 'XLS' || type === 'XLSX' || type === 'EXCEL') return 'Excel';
    return this.translate.instant('FILE');
  }


  // ===== UI logic =====
  get filteredPrograms(): any[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.programs;
    return this.programs.filter((p) =>
      (p?.name || '').toLowerCase().includes(term)
    );
  }

  selectProgram(program: any): void {
    this.selectedProgramItem = program;
    this.selectedProgramId = program.id;
    this.startDate = '';
    this.endDate = '';
    this.conflict = null;
  }

  get selectedProgram(): any | null {
    if (!this.selectedProgramId) return null;
    return this.programs.find((p) => p.id === this.selectedProgramId) || null;
  }

  get calculatedEndDate(): string | null {
    if (!this.selectedProgram || !this.startDate) return null;

    if (this.isFileProgram(this.selectedProgram)) {
      return this.endDate || null;
    }

    const start = new Date(this.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max((this.selectedProgram.totalDays || 1) - 1, 0));
    return end.toISOString().slice(0, 10);
  }

  get canAssign(): boolean {
    if (!this.selectedClientChecked || !this.selectedProgramItem || !this.startDate || this.assigning || this.checkingConflicts) {
      return false;
    }

    if (this.isFileProgram(this.selectedProgramItem) && !this.endDate) {
      return false;
    }

    return !this.conflict || !!this.conflict.resolution;
  }

  get assignmentButtonLabel(): string {
    if (this.assigning) return this.translate.instant('ASSIGNING');
    return this.translate.instant(this.conflict ? 'CONFIRM_ASSIGNMENT' : 'ASSIGN_PROGRAM');
  }

  get clientDisplayName(): string {
    if (!this.client) return this.fullName || 'Client';
    return `${this.client.firstName || ''} ${this.client.lastName || ''}`.trim() || this.client.email || this.fullName || 'Client';
  }

  getProgramName(program: any): string {
    return program?.name || program?.programName || 'Existing program';
  }

  formatDate(value?: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-GB');
  }

  onToggleClient(): void {
    this.selectedClientChecked = !this.selectedClientChecked;
    this.refreshConflicts();
  }

  onStartDateChange(): void {
    this.refreshConflicts();
  }

  onEndDateChange(): void {
    this.refreshConflicts();
  }

  setConflictResolution(resolution: ConflictResolution): void {
    if (this.conflict) {
      this.conflict.resolution = resolution;
    }
  }

  // ===== actions =====
  close(): void {
    this.resetState();
    this.closed.emit();
  }

  back(): void {
    this.resetState();
    this.backClicked.emit();
  }

  assign(): void {
    if (!this.canAssign || !this.client) return;

    const item = { ...this.selectedProgramItem };
    const resolution = this.conflict?.resolution
      ? { resolution: this.conflict.resolution, conflict: this.conflict.program }
      : null;
    item.startDate = this.getResolvedStartDate(this.startDate, resolution);
    item.endDate = this.getCalculatedEndDateForStart(item.startDate);
    item.client = this.client;

    this.assigning = true;

    const replace$ = resolution?.resolution === 'REPLACE'
      ? this.stopExistingWorkoutBefore(resolution.conflict, item.startDate)
      : of(null);

    replace$.pipe(
      switchMap(() => this.workoutService.assignWorkout(item.id, item))
    ).subscribe({
      next: (res) => {
        this.assigning = false;
        this.assigned.emit(res);
        this.assignProgram.emit({
          program: item,
          startDate: item.startDate,
          endDate: item.endDate,
          result: res,
          clients: [this.client],
          conflictResolutions: resolution && this.client?.id
            ? { [this.client.id]: resolution }
            : {},
        });
        this.close();
      },
      error: () => {
        this.assigning = false;
      },
    });
  }

  private resetState(): void {
    this.searchTerm = '';
    this.selectedProgramId = null;
    this.selectedProgramItem = null;
    this.startDate = '';
    this.endDate = '';
    this.assigning = false;
    this.selectedClientChecked = true;
    this.conflict = null;
    this.checkingConflicts = false;
  }

  private refreshConflicts(): void {
    if (!this.selectedClientChecked || !this.client?.id || !this.startDate || !this.calculatedEndDate) {
      this.conflict = null;
      return;
    }

    this.checkingConflicts = true;
    const previousResolution = this.conflict?.resolution;
    const coachId = sessionStorage.getItem('userId');

    if (!coachId) {
      this.checkingConflicts = false;
      this.conflict = null;
      return;
    }

    const visibleProgramType = this.workoutFileEnabled ? 'ALL' : 'APP';
    this.workoutService.getWorkoutByCoachIdAndClient(coachId, this.client.id, 0, 200, visibleProgramType).pipe(
      map((response: any) => {
        const programs = Array.isArray(response) ? response : (response?.content || []);
        const conflictProgram = programs.find((program: any) => this.overlaps(program));

        if (!conflictProgram || !this.client) return null;

        return {
          client: this.client,
          program: conflictProgram,
          resolution: previousResolution,
        } as ScheduleConflict;
      }),
      catchError(() => of(null))
    ).subscribe((result) => {
      this.conflict = result;
      this.checkingConflicts = false;
    });
  }

  private overlaps(program: any): boolean {
    if (!program?.startDate || !program?.endDate || !this.calculatedEndDate) return false;

    const existingStart = this.toDayTime(program.startDate);
    const existingEnd = this.toDayTime(program.endDate);
    const nextStart = this.toDayTime(this.startDate);
    const nextEnd = this.toDayTime(this.calculatedEndDate);

    return existingStart <= nextEnd && nextStart <= existingEnd;
  }

  private getResolvedStartDate(defaultStartDate: string, resolution: any | null): string {
    if (resolution?.resolution === 'START_AFTER' && resolution.conflict?.endDate) {
      return this.addDays(resolution.conflict.endDate, 1);
    }

    return defaultStartDate;
  }

  private getCalculatedEndDateForStart(startDate: string): string | null {
    if (!this.selectedProgramItem || !startDate) return null;

    if (this.isFileProgram(this.selectedProgramItem)) {
      if (!this.endDate) return null;
      const durationDays = this.daysBetweenInclusive(this.startDate, this.endDate);
      return this.addDays(startDate, durationDays - 1);
    }

    return this.addDays(startDate, Math.max((this.selectedProgramItem.totalDays || 1) - 1, 0));
  }

  private stopExistingWorkoutBefore(conflict: any, nextStartDate: string): Observable<unknown> {
    if (!conflict?.id || !conflict.startDate) return of(null);

    const replacementEndDate = this.addDays(nextStartDate, -1);
    if (new Date(`${replacementEndDate}T00:00:00`).getTime() < new Date(`${conflict.startDate}T00:00:00`).getTime()) {
      return this.workoutService.deleteWorkout(conflict.id);
    }

    return this.workoutService.updateWorkoutPlanDates(conflict.id, conflict.startDate, replacementEndDate);
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private toDayTime(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
  }

  private daysBetweenInclusive(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.floor((end - start) / 86400000) + 1;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
