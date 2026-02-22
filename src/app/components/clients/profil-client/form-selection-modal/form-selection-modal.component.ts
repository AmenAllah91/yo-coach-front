import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";

export interface CheckinFormItem {
  id: number;
  name: string;
  questionCount: number;
}

@Component({
  selector: 'app-form-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-selection-modal.component.html',
  styleUrls: ['./form-selection-modal.component.scss'],
})
export class FormSelectionModalComponent {
  @Input() isOpen = false;
  @Input() fullName = '';

  @Output() closeModal = new EventEmitter<void>();
  @Output() backClick = new EventEmitter<void>();
  @Output() assignForm = new EventEmitter<{
    form: CheckinFormItem;
    assignedDate: string;
    dueDate: string;
  }>();

  searchTerm = '';
  selectedFormId: number | null = null;
  selectedForm: CheckinFormItem | null = null;
  assignedDate = '';
  dueDate = '';

  // Données statiques — à remplacer par un service plus tard
  forms: CheckinFormItem[] = [
    { id: 1, name: 'Weekly Check-In', questionCount: 5 },
    { id: 2, name: 'Monthly Progress Review', questionCount: 8 },
    { id: 3, name: 'Initial Assessment', questionCount: 12 },
  ];

  get filteredForms(): CheckinFormItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.forms;
    return this.forms.filter(f => f.name.toLowerCase().includes(term));
  }

  selectForm(form: CheckinFormItem) {
    this.selectedFormId = form.id;
    this.selectedForm = form;
  }

  assign() {
    if (!this.selectedForm || !this.assignedDate || !this.dueDate) return;
    this.assignForm.emit({
      form: this.selectedForm,
      assignedDate: this.assignedDate,
      dueDate: this.dueDate,
    });
  }
}
