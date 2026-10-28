import { AssignVisibilityNoteComponent } from '@shared/components/assign-visibility-note/assign-visibility-note.component';
import { nutritionPlanKind } from '@shared/models/nutrition-plan-kind';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Client } from 'app/service/client.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { AssignResult, ClientSchedulePreview, changeSentence, programLengthDays } from '@shared/models/program-schedule';

/**
 * Client profile: choose a library nutrition program for this client (backlog-programmes.md A2-A7). One start date,
 * what changes on the client's calendar under it, a confirmation only when something changes, « Annuler » after.
 */
@Component({
  selector: 'app-nutrition-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AssignVisibilityNoteComponent, AssignScheduleComponent, AssignConfirmComponent],
  templateUrl: './nutrition-selection-modal.component.html',
  styleUrls: ['./nutrition-selection-modal.component.scss'],
})
export class NutritionSelectionModalComponent implements OnChanges {
  // affichage
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() client: Client | null = null;
  /** A start to propose (the first day of a gap on the client's calendar). */
  @Input() initialStart: string | null = null;

  // liste complète (non filtrée) fournie par le parent
  @Input() programs: any[] = [];
  @Input() nutritionFileEnabled = true;
  @Input() loadingPrograms = false;
  @Input() page = 0;
  @Input() totalPages = 0;

  // events vers parent
  @Output() closeModal = new EventEmitter<void>();
  @Output() backClick = new EventEmitter<void>();
  @Output() searchPrograms = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  /** The assignment is done (the window did it and shows the message with « Annuler »). */
  @Output() assignProgram = new EventEmitter<{ program: any; startDate: string; result: AssignResult }>();

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

  constructor(private translate: TranslateService, public schedule: ProgramScheduleService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['client']) this.clientIds = this.client?.id ? [String(this.client.id)] : [];
  }

  get filteredPrograms(): any[] {
    const visiblePrograms = this.nutritionFileEnabled === false
      ? (this.programs || []).filter((program) => !this.isFileProgram(program))
      : (this.programs || []);

    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return visiblePrograms;

    return visiblePrograms.filter((p) =>
      [
        p.name,
        p.originalFileName,
        p.fileName,
        this.getProgramTypeLabel(p)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }

  selectProgram(program: any): void {
    this.selectedProgramItem = program;
    this.selectedProgramId = program.id;
    if (!this.isFileProgram(program)) this.endDate = '';
    if (this.initialStart && !this.startDate) this.startDate = this.initialStart;
  }

  onSearchChange(): void {
    this.searchPrograms.emit(this.searchTerm.trim());
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page || this.loadingPrograms) return;
    this.pageChange.emit(page);
  }

  get selectedProgram(): any | null {
    if (!this.selectedProgramId) return null;
    return this.programs.find((p) => p.id === this.selectedProgramId) || null;
  }

  /** The program's length, to show its end at once (the server confirms it). */
  lengthOf(program: any): number | null {
    return programLengthDays(program, 'NUTRITION');
  }

  isFileProgram(program: any): boolean {
    const mode = String(program?.nutritionPlanMode || '').toUpperCase();
    const type = String(program?.resourceType || '').toUpperCase();

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!program?.fileName ||
      !!program?.originalFileName ||
      !!program?.fileUrl
    );
  }

  getFileKind(program: any): 'PDF' | 'EXCEL' {
    const type = String(program?.resourceType || '').toUpperCase();
    const fileName = String(program?.originalFileName || program?.fileName || '').toLowerCase();

    if (type === 'PDF' || fileName.endsWith('.pdf')) {
      return 'PDF';
    }

    return 'EXCEL';
  }

  getProgramTypeLabel(program: any): string {
    if (this.isFileProgram(program)) {
      return this.getFileKind(program);
    }

    const kind = nutritionPlanKind(program);
    return this.translate.instant(kind === 'DAY_MACROS'
      ? 'TOTAL_FOR_DAY'
      : kind === 'MEAL_MACROS'
        ? 'EACH_MEAL'
        : 'FULL_MEAL_PLAN');
  }

  getFileMeta(program: any): string {
    const fileName = program?.originalFileName || program?.fileName || '';

    if (!fileName) {
      return this.getFileKind(program);
    }

    return fileName;
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

  close(): void {
    if (this.assigning) return;
    this.reset();
    this.closeModal.emit();
  }

  back(): void {
    if (this.assigning) return;
    this.reset();
    this.backClick.emit();
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
    const program = this.selectedProgramItem;
    this.schedule.run({
      kind: 'NUTRITION',
      programId: String(program.id),
      startDate: this.startDate,
      endDate: this.isFileProgram(program) ? this.endDate : null,
      clientIds: [clientId],
    }, { [clientId]: this.clientDisplayName }).subscribe({
      next: result => {
        this.assigning = false;
        if (!result.results.some(item => item.ok)) {
          this.step = 'pick';
          return;
        }
        const startDate = this.startDate;
        this.reset();
        this.assignProgram.emit({ program, startDate, result });
      },
      error: error => {
        this.assigning = false;
        this.schedule.announceError(error);
      },
    });
  }

  reset(): void {
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
