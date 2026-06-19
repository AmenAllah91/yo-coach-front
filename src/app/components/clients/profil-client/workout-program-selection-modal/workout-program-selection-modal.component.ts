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
import { Client } from 'app/service/client.service';
import { PageResponse, WorkoutService } from 'app/service/workout.service';
import { WorkoutPlan } from '@shared/models/workout.models';

@Component({
  selector: 'app-workout-program-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  readonly isAssignModalTitle = 'Assign Workout Program';

  constructor(private workoutService: WorkoutService) {}

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
    if (!this.isFileProgram(program)) return 'App Program';

    const type = String(program?.resourceType || '').toUpperCase();
    if (type === 'PDF') return 'PDF';
    if (type === 'XLS' || type === 'XLSX' || type === 'EXCEL') return 'Excel';
    return 'File';
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
    if (!this.selectedProgramItem || !this.startDate || !this.client) return;
    if (this.isFileProgram(this.selectedProgramItem) && !this.endDate) return;

    const item = { ...this.selectedProgramItem };
    item.startDate = this.startDate;
    item.endDate = this.calculatedEndDate;
    item.client = this.client;

    this.assigning = true;

    this.workoutService.assignWorkout(item.id, item).subscribe({
      next: (res) => {
        this.assigning = false;
        this.assigned.emit(res);
        this.assignProgram.emit({ program: item, startDate: item.startDate, endDate: item.endDate, result: res });
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
  }
}
