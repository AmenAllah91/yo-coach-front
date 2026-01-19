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

  // --- FONCTIONS EXTRAITES ---

  get filteredPrograms(): any[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.programs;
    return this.programs.filter((p) => (p.name || '').toLowerCase().includes(term));
  }

  selectProgram(program: any): void {
    this.selectedProgramItem = program;
    this.selectedProgramId = program.id;
    this.startDate = '';
  }

  get selectedProgram(): any | null {
    if (!this.selectedProgramId) return null;
    return this.programs.find((p) => p.id === this.selectedProgramId) || null;
  }

  get calculatedEndDate(): string | null {
    if (!this.selectedProgram || !this.startDate) return null;

    const start = new Date(this.startDate);
    const end = new Date(start);

    // même logique que toi : + totalDays
    end.setDate(end.getDate() + (this.selectedProgram.totalDays || 0));
    return end.toISOString().slice(0, 10);
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
    if (!this.selectedProgramItem || !this.startDate) return;

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
  }
}
