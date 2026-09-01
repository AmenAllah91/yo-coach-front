import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Client } from 'app/service/client.service';
import { NutritionService } from 'app/service/nutrition.service';
import { catchError, map, of } from 'rxjs';

type ConflictResolution = 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH';

interface ScheduleConflict {
  client: Client;
  program: any;
  resolution?: ConflictResolution;
}

@Component({
  selector: 'app-nutrition-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './nutrition-selection-modal.component.html',
  styleUrls: ['./nutrition-selection-modal.component.scss'],
})
export class NutritionSelectionModalComponent {
  // affichage
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() client: Client | null = null;

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

  // action finale : on renvoie au parent l’item choisi + dates
  @Output() assignProgram = new EventEmitter<{
    program: any;
    startDate: string;
    endDate: string | null;
    clients: Client[];
    conflictResolutions: Record<string, { resolution: ConflictResolution; conflict: any }>;
  }>();

  // --- STATE DU MODAL (ex-fonctions/variables du parent) ---
  searchTerm = '';
  selectedProgramId: string | null = null;
  selectedProgramItem: any | null = null;
  startDate = '';
  endDate = '';
  selectedClientChecked = true;
  conflict: ScheduleConflict | null = null;
  checkingConflicts = false;

  constructor(private nutritionService: NutritionService, private translate: TranslateService) {}

  // --- FONCTIONS EXTRAITES ---

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
    this.conflict = null;
    this.refreshConflicts();
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

    return this.translate.instant(program?.trackingMode === 'TOTAL_FOR_DAY'
      ? 'TOTAL_FOR_DAY'
      : program?.trackingMode === 'EACH_MEAL'
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
    if (!this.selectedClientChecked || !this.selectedProgramItem || !this.startDate || this.checkingConflicts) {
      return false;
    }

    if (this.isFileProgram(this.selectedProgramItem) && !this.endDate) {
      return false;
    }

    return !this.conflict || !!this.conflict.resolution;
  }

  get assignmentButtonLabel(): string {
    return this.translate.instant(this.conflict ? 'CONFIRM_ASSIGNMENT' : 'ASSIGN_NUTRITION_PROGRAM');
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

  // fermer
  close(): void {
    this.closeModal.emit();
  }

  // retour
  back(): void {
    this.backClick.emit();
  }

  // assign (le parent fera l'appel service)
  assign(): void {
    if (!this.canAssign) return;

    this.assignProgram.emit({
      program: this.selectedProgramItem,
      startDate: this.startDate,
      endDate: this.calculatedEndDate,
      clients: this.client ? [this.client] : [],
      conflictResolutions: this.conflict?.resolution && this.client?.id
        ? {
          [this.client.id]: {
            resolution: this.conflict.resolution,
            conflict: this.conflict.program,
          },
        }
        : {},
    });
  }

  // optionnel: reset state quand on ferme/ouvre
  reset(): void {
    this.searchTerm = '';
    this.selectedProgramId = null;
    this.selectedProgramItem = null;
    this.startDate = '';
    this.endDate = '';
    this.selectedClientChecked = true;
    this.conflict = null;
    this.checkingConflicts = false;
  }

  private refreshConflicts(): void {
    if (!this.selectedClientChecked || !this.client?.id || !this.startDate || !this.calculatedEndDate) {
      this.conflict = null;
      return;
    }

    const coachId = sessionStorage.getItem('userId');
    if (!coachId) {
      this.conflict = null;
      return;
    }

    this.checkingConflicts = true;
    const previousResolution = this.conflict?.resolution;
    const visibleProgramType = this.nutritionFileEnabled === false ? 'APP' : 'ALL';

    this.nutritionService.getNutritionPlanByCoachIdAndClient(coachId, this.client.id, 0, 200, visibleProgramType).pipe(
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

  private toDayTime(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
  }
}
