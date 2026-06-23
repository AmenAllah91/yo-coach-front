import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nutrition-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition-selection-modal.component.html',
  styleUrls: ['./nutrition-selection-modal.component.scss'],
})
export class NutritionSelectionModalComponent {
  // affichage
  @Input() isOpen = false;
  @Input() fullName = '';

  // liste complète (non filtrée) fournie par le parent
  @Input() programs: any[] = [];
  @Input() nutritionFileEnabled = true;

  // events vers parent
  @Output() closeModal = new EventEmitter<void>();
  @Output() backClick = new EventEmitter<void>();

  // action finale : on renvoie au parent l’item choisi + dates
  @Output() assignProgram = new EventEmitter<{
    program: any;
    startDate: string;
    endDate: string | null;
  }>();

  // --- STATE DU MODAL (ex-fonctions/variables du parent) ---
  searchTerm = '';
  selectedProgramId: string | null = null;
  selectedProgramItem: any | null = null;
  startDate = '';
  endDate = '';

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
    this.startDate = '';
    this.endDate = '';
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

    return program?.trackingMode === 'TOTAL_FOR_DAY'
      ? 'TOTAL FOR DAY'
      : program?.trackingMode === 'EACH_MEAL'
        ? 'EACH MEAL'
        : 'FULL MEAL PLAN';
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
    if (!this.selectedProgramItem || !this.startDate) {
      return false;
    }

    if (this.isFileProgram(this.selectedProgramItem) && !this.endDate) {
      return false;
    }

    return true;
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
    });
  }

  // optionnel: reset state quand on ferme/ouvre
  reset(): void {
    this.searchTerm = '';
    this.selectedProgramId = null;
    this.selectedProgramItem = null;
    this.startDate = '';
    this.endDate = '';
  }
}
