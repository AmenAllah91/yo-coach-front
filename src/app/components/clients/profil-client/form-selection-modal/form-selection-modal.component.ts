import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormsApiService, Form } from '../../../forms/services/forms-api.service';
import {FeatherModule} from "angular-feather";
import { TranslateModule } from '@ngx-translate/core';

export interface CheckinFormItem {
  id: string;
  name: string;
  questionCount: number;
  raw: Form;
}

@Component({
  selector: 'app-form-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './form-selection-modal.component.html',
  styleUrls: ['./form-selection-modal.component.scss'],
})
export class FormSelectionModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() fullName = '';
  @Input() preselectFormId: string | null = null;
  @Input() clientId: string | null = null;
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
  scheduleEnabled = false;
  constructor(private formsApi: FormsApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const openedNow = changes['isOpen']?.currentValue === true;
    const newPreselect = changes['preselectFormId']?.currentValue;

    if (this.isOpen && (openedNow || !!newPreselect)) {
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

    if (this.preselectFormId) {
      this.formsApi.getFormById(this.preselectFormId).subscribe({
        next: (f: any) => {
          if (f?.status === 'ARCHIVED') {
            this.forms = [];
            this.loading = false;
            return;
          }

          const item: CheckinFormItem = {
            id: String(f.id),
            name: f.title ?? f.name ?? '(Untitled)',
            questionCount: Array.isArray(f.questions) ? f.questions.length : (f.questionsCount ?? 0),
            raw: f,
          };

          this.forms = [item];
          this.selectForm(item);
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message ?? 'Failed to load created form';
        }
      });

      return;
    }

    this.formsApi.getMyFormsPage(this.pageIndex, this.pageSize).subscribe({
      next: (res: any) => {
        const content: Form[] = (res?.content ?? []).filter(f => f.status !== 'ARCHIVED');

        this.forms = content.map((f: any) => ({
          id: String(f.id),
          name: f.title ?? f.name ?? '(Untitled)',
          questionCount: Array.isArray(f.questions) ? f.questions.length : (f.questionsCount ?? 0),
          raw: f,
        }));

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

    this.scheduleEnabled = false;
    this.endDateValue = '';

    const today = new Date().toISOString().split('T')[0];
    this.dueDateValue = today;
  }

  canAssign(): boolean {
    if (!this.selectedForm) return false;

    const hasSchedule = !!this.selectedForm.raw?.schedule;

    if (hasSchedule) {
      return !!this.endDateValue;
    }

    return this.scheduleEnabled ? !!this.dueDateValue : true;
  }

  assign() {
    if (!this.selectedForm || !this.canAssign()) return;

    const form = this.selectedForm.raw;
    const hasSchedule = !!form.schedule;

    let dueDate: string | null = null;

    if (!hasSchedule) {
      if (this.scheduleEnabled && this.dueDateValue) {
        dueDate = this.dueDateValue;
      } else {
        dueDate = new Date().toISOString().split('T')[0];
      }
    }

    this.assignForm.emit({
      form,
      assignedDate: hasSchedule ? '' : dueDate!,
      dueDate: hasSchedule ? null as any : dueDate,
      endDate: hasSchedule ? this.endDateValue : null,
    });
  }
}
