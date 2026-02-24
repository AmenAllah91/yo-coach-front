import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormsApiService, Form } from '../../../forms/services/forms-api.service';

export interface CheckinFormItem {
  id: string;
  name: string;
  questionCount: number;
  raw: Form;
}

@Component({
  selector: 'app-form-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-selection-modal.component.html',
  styleUrls: ['./form-selection-modal.component.scss'],
})
export class FormSelectionModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() preselectFormId: string | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() backClick = new EventEmitter<void>();

  @Output() assignForm = new EventEmitter<{
    form: Form;
    assignedDate: string;
    dueDate: string;
    endDate: string | null;
  }>();

  loading = false;
  error: string | null = null;

  searchTerm = '';
  selectedFormId: string | null = null;
  selectedForm: CheckinFormItem | null = null;

  dueDateValue = '';
  endDateValue = '';

  pageIndex = 0;
  pageSize = 50;

  forms: CheckinFormItem[] = [];

  constructor(private formsApi: FormsApiService) {}

  ngOnChanges(): void {
    if (this.isOpen) {
      this.resetUi();
      this.loadForms();
    }
  }

  private resetUi() {
    this.searchTerm = '';
    this.selectedFormId = null;
    this.selectedForm = null;
    this.dueDateValue = '';
    this.endDateValue = '';
    this.error = null;
  }

  loadForms(): void {
    this.loading = true;
    this.error = null;

    this.formsApi.getMyFormsPage(this.pageIndex, this.pageSize).subscribe({
      next: (res: any) => {
        const content: Form[] = res?.content ?? [];

        this.forms = content.map((f: any) => ({
          id: String(f.id),
          name: f.title ?? f.name ?? '(Untitled)',
          questionCount: Array.isArray(f.questions) ? f.questions.length : (f.questionsCount ?? 0),
          raw: f,
        }));

        if (this.preselectFormId) {
          const found = this.forms.find(x => x.id === this.preselectFormId);
          if (found) this.selectForm(found);
        }

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load forms';
      },
    });
  }

  get filteredForms(): CheckinFormItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.forms;
    return this.forms.filter(f => f.name.toLowerCase().includes(term));
  }

  selectForm(form: CheckinFormItem) {
    this.selectedFormId = form.id;
    this.selectedForm = form;

    this.dueDateValue = '';
    this.endDateValue = '';
  }

  canAssign(): boolean {
    if (!this.selectedForm) return false;

    const hasSchedule = !!this.selectedForm.raw?.schedule;
    return hasSchedule ? !!this.endDateValue : !!this.dueDateValue;
  }

  assign() {
    if (!this.selectedForm || !this.canAssign()) return;

    const form = this.selectedForm.raw;
    const hasSchedule = !!form.schedule;

    this.assignForm.emit({
      form,
      assignedDate: hasSchedule ? '' : this.dueDateValue,
      dueDate: hasSchedule ? null as any : this.dueDateValue,
      endDate: hasSchedule ? this.endDateValue : null,
    });
  }
}
