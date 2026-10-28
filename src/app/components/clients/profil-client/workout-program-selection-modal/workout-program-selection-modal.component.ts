import { AssignVisibilityNoteComponent } from '@shared/components/assign-visibility-note/assign-visibility-note.component';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
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
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { ClientSchedulePreview, changeSentence, programLengthDays } from '@shared/models/program-schedule';

/**
 * Client profile: choose a library workout program for this client (backlog-programmes.md A2-A7). One start date,
 * what changes on the client's calendar under it, a confirmation only when something changes, « Annuler » after.
 */
@Component({
  selector: 'app-workout-program-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AssignVisibilityNoteComponent, AssignScheduleComponent, AssignConfirmComponent],
  templateUrl: './workout-program-selection-modal.component.html',
  styleUrls: ['./workout-program-selection-modal.component.scss'],
})
export class WorkoutProgramSelectionModalComponent implements OnChanges {
  // ===== Inputs =====
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() client: Client | null = null;
  /** A start to propose (the first day of a gap on the client's calendar). */
  @Input() initialStart: string | null = null;
  @Input() workoutFileEnabled = true;

  // ===== Outputs =====
  @Output() closed = new EventEmitter<void>();
  @Output() backClicked = new EventEmitter<void>();
  @Output() assigned = new EventEmitter<any>();
  @Output() assignProgram = new EventEmitter<any>();

  programs: any[] = [];
  loadingPrograms = false;

  // ===== state modal =====
  searchTerm = '';
  selectedProgramId: string | null = null;
  selectedProgramItem: any | null = null;
  startDate = '';
  endDate = '';
  assigning = false;
  checking = false;
  step: 'pick' | 'confirm' = 'pick';
  previews: Record<string, ClientSchedulePreview> = {};
  confirmRows: AssignConfirmRow[] = [];
  /** A stable list for the schedule (a new array at each check would ask the server again and again). */
  clientIds: string[] = [];

  constructor(private workoutService: WorkoutService, private translate: TranslateService,
              public schedule: ProgramScheduleService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['client']) this.clientIds = this.client?.id ? [String(this.client.id)] : [];
    if (changes['workoutFileEnabled']) this.programs = []; // the filter changed: read again on the next opening
    // The library (up to 200 programs) is read when the modal opens, never while the profile loads.
    if (this.isOpen && (changes['isOpen']?.currentValue === true || changes['workoutFileEnabled'])) {
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

  /** The program's length, to show its end at once (the server confirms it). */
  lengthOf(program: any): number | null {
    return programLengthDays(program, 'WORKOUT');
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
    return this.programs.filter((p) => (p?.name || '').toLowerCase().includes(term));
  }

  selectProgram(program: any): void {
    this.selectedProgramItem = program;
    this.selectedProgramId = program.id;
    if (!this.isFileProgram(program)) this.endDate = '';
    if (this.initialStart && !this.startDate) this.startDate = this.initialStart;
  }

  get selectedProgram(): any | null {
    if (!this.selectedProgramId) return null;
    return this.programs.find((p) => p.id === this.selectedProgramId) || null;
  }

  get canAssign(): boolean {
    if (!this.client?.id || !this.selectedProgramItem || !this.startDate || this.assigning || this.checking) return false;
    if (this.isFileProgram(this.selectedProgramItem) && (!this.endDate || this.endDate < this.startDate)) return false;
    return true;
  }

  get clientDisplayName(): string {
    if (!this.client) return this.fullName || 'Client';
    return `${this.client.firstName || ''} ${this.client.lastName || ''}`.trim() || this.client.email || this.fullName || 'Client';
  }

  // ===== actions =====
  close(): void {
    if (this.assigning) return;
    this.resetState();
    this.closed.emit();
  }

  back(): void {
    if (this.assigning) return;
    this.resetState();
    this.backClicked.emit();
  }

  assign(): void {
    if (!this.canAssign || !this.client?.id) return;
    const lines = (this.previews[String(this.client.id)]?.changes || [])
      .map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
    if (lines.length) {
      this.confirmRows = [{ id: String(this.client.id), name: this.clientDisplayName, lines }];
      this.step = 'confirm';
      return;
    }
    this.doAssign();
  }

  doAssign(): void {
    if (!this.client?.id || !this.selectedProgramItem) return;
    this.assigning = true;
    const clientId = String(this.client.id);
    this.schedule.run({
      kind: 'WORKOUT',
      programId: String(this.selectedProgramItem.id),
      startDate: this.startDate,
      endDate: this.isFileProgram(this.selectedProgramItem) ? this.endDate : null,
      clientIds: [clientId],
    }, { [clientId]: this.clientDisplayName }).subscribe({
      next: (result) => {
        this.assigning = false;
        if (!result.results.some(item => item.ok)) {
          this.step = 'pick';
          return;
        }
        this.assigned.emit(result);
        this.assignProgram.emit({ program: this.selectedProgramItem, startDate: this.startDate, result });
        this.resetState();
        this.closed.emit();
      },
      error: (error) => {
        this.assigning = false;
        this.schedule.announceError(error);
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
    this.checking = false;
    this.step = 'pick';
    this.previews = {};
    this.confirmRows = [];
  }
}
