import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  FormDetails,
  FormsApiService,
  QuestionBE,
  QuestionTypeBE
} from '../services/forms-api.service'; // adapte le path si besoin

export type QuestionType =
  | 'scale'
  | 'multiple-choice'
  | 'star-rating'
  | 'yes-no'
  | 'input-text'
  | 'opinion-rating'
  | 'signature'
  | 'media'
  | 'date'
  | 'progress-photo';

export interface QuestionItem {
  id: string;
  type: QuestionType;
  text: string;
  isRequired: boolean;
  options?: string[];
}

type Tab = 'form' | 'details' | 'schedule';
type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type BiweeklyWeekOption = '1-3' | '2-4';
type MonthlyMode = 'start' | 'end' | 'specific';

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss'
})
export class CreateFormComponent implements OnInit {
  private api = inject(FormsApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  isEditingTitle = false;
  // mode create/edit
  formId: string | null = null;
  isLoading = false;
  isSaving = false;

  // UI state
  activeTab: Tab = 'form';
  showPreview = false;
  showQuestionSidebar = false;

  // fields
  formTitle = 'Form Title';
  detailsTitle = 'Form Title'; // <-- IMPORTANT (ngModel)
  description = ''; // si tu veux l’ajouter plus tard dans le payload

  questions: QuestionItem[] = [];

  // schedule (statique pour l’instant)
  scheduleFrequency: ScheduleFrequency = 'daily';
  scheduleFrequencyOptions = [
    { id: 'daily' as ScheduleFrequency, label: 'Daily' },
    { id: 'weekly' as ScheduleFrequency, label: 'Weekly' },
    { id: 'biweekly' as ScheduleFrequency, label: 'Biweekly' },
    { id: 'monthly' as ScheduleFrequency, label: 'Monthly' },
  ];
  scheduleWeekDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dailySelectedDays: string[] = ['Mon'];
  weeklySelectedDay: string = 'Mon';
  biweeklyWeekOption: BiweeklyWeekOption = '1-3';
  biweeklySelectedDay: string = 'Mon';
  monthlyMode: MonthlyMode = 'specific';
  monthDays: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  monthlyDay: number = 10;
  scheduleTime: string = '09:00';

  questionTypes = [
    { id: 'multiple-choice' as QuestionType, label: 'Multiple Choice' },
    { id: 'star-rating' as QuestionType, label: 'Star Rating' },
    { id: 'yes-no' as QuestionType, label: 'Yes/No' },
    { id: 'input-text' as QuestionType, label: 'Text Input' },
    { id: 'date' as QuestionType, label: 'Date' },
  ];

  ngOnInit(): void {
    this.formId = this.route.snapshot.paramMap.get('id');

    if (this.formId) {
      this.isLoading = true;
      this.api.getForOwner(this.formId)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: (form) => this.patchFromBackend(form),
          error: () => this.router.navigate(['/forms'])
        });
    } else {
      // create init
      this.formTitle = 'Form Title';
      this.detailsTitle = 'Form Title';
      this.questions = [];
    }
  }
  startEditTitle(): void {
    this.isEditingTitle = true;
  }

  finishEditTitle(): void {
    this.isEditingTitle = false;

    // sécurité : si vide, on remet un titre par défaut
    if (!this.detailsTitle || !this.detailsTitle.trim()) {
      this.detailsTitle = this.formTitle || 'Form Title';
    }
  }

  titleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finishEditTitle();
    }
  }
  // -------- UI actions --------
  back() {
    this.router.navigate(['/forms']);
  }

  setTab(tab: Tab) {
    this.activeTab = tab;
  }

  openPreview() { this.showPreview = true; }
  closePreview() { this.showPreview = false; }

  openTypeDrawer() { this.showQuestionSidebar = true; }
  closeTypeDrawer() { this.showQuestionSidebar = false; }

  // -------- questions --------
  private newId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  addQuestion(type: QuestionType) {
    const newQuestion: QuestionItem = {
      id: this.newId('q'),
      type,
        text: '',
      isRequired: true,
      options: type === 'multiple-choice' ? ['New Option'] : undefined,
    };
    this.questions = [...this.questions, newQuestion];
    this.showQuestionSidebar = false;
  }

  removeQuestion(index: number): void {
    this.questions = this.questions.filter((_, i) => i !== index);
  }

  trackById = (_: number, q: QuestionItem) => q.id;

  // -------- mapping UI <-> BE --------
  private toQuestionTypeBE(t: QuestionType): QuestionTypeBE {
    switch (t) {
      case 'multiple-choice': return 'MULTIPLE_CHOICE';
      case 'yes-no': return 'YES_NO';
      case 'star-rating': return 'STAR_RATING';
      case 'date': return 'DATE';
      case 'scale':
      case 'input-text':
      case 'opinion-rating':
      case 'signature':
      case 'media':
      case 'progress-photo':
      default:
        return 'TEXT';
    }
  }

  private toQuestionTypeUI(t: string): QuestionType {
    switch (t) {
      case 'MULTIPLE_CHOICE': return 'multiple-choice';
      case 'YES_NO': return 'yes-no';
      case 'STAR_RATING': return 'star-rating';
      case 'DATE': return 'date';
      case 'TEXT':
      default:
        return 'input-text';
    }
  }

  private patchFromBackend(form: FormDetails) {
    this.formTitle = form.title;
    this.detailsTitle = form.title;

    this.questions = (form.questions ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(q => ({
        id: q.id,
        type: this.toQuestionTypeUI(q.type),
        text: q.label,
        isRequired: !!q.required,
        options: (q.options ?? []).map(o => o.label),
      }));
  }

  private buildPayload(): FormDetails {
    const title = (this.detailsTitle?.trim() || this.formTitle?.trim() || 'Form Title');

    const questionsBE: QuestionBE[] = this.questions.map((q, idx) => ({
      id: q.id,
      type: this.toQuestionTypeBE(q.type),
      label: q.text,
      required: q.isRequired,
      order: idx,
      options: q.type === 'multiple-choice'
        ? (q.options ?? []).map(label => ({ id: this.newId('opt'), label }))
        : [],
    }));

    return {
      title,
      questions: questionsBE,
      status: 'DRAFT',
    };
  }

  saveForm() {
    const payload = this.buildPayload();
    this.isSaving = true;

    const req$ = this.formId
      ? this.api.updateForm(this.formId, payload)
      : this.api.createForm(payload);

    req$
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => this.router.navigate(['/forms']),
        error: (err) => {
          console.error(err);
          alert("Erreur lors de l'enregistrement.");
        }
      });
  }

  // ===== schedule helpers (tu peux garder ton code existant si tu veux) =====
  setScheduleFrequency(freq: ScheduleFrequency): void {
    this.scheduleFrequency = freq;
    if (freq === 'daily') this.dailySelectedDays = [...this.scheduleWeekDays];
    if (freq !== 'daily' && this.dailySelectedDays.length === 0) this.dailySelectedDays = ['Mon'];
  }

  setBiweeklyWeek(option: BiweeklyWeekOption): void {
    this.biweeklyWeekOption = option;
  }

  setMonthlyMode(mode: MonthlyMode): void {
    this.monthlyMode = mode;
  }

  get daySectionTitle(): string {
    if (this.scheduleFrequency === 'daily') return 'Select Days';
    if (this.scheduleFrequency === 'weekly' || this.scheduleFrequency === 'biweekly') return 'Day of Week';
    return '';
  }

  trackByDay = (_: number, day: string) => day;

  isDayActive(day: string): boolean {
    switch (this.scheduleFrequency) {
      case 'daily': return this.dailySelectedDays.includes(day);
      case 'weekly': return this.weeklySelectedDay === day;
      case 'biweekly': return this.biweeklySelectedDay === day;
      default: return false;
    }
  }

  onDayClick(day: string): void {
    switch (this.scheduleFrequency) {
      case 'daily':
        this.dailySelectedDays = this.dailySelectedDays.includes(day)
          ? this.dailySelectedDays.filter(d => d !== day)
          : [...this.dailySelectedDays, day];
        break;
      case 'weekly': this.weeklySelectedDay = day; break;
      case 'biweekly': this.biweeklySelectedDay = day; break;
    }
  }

  ordinal(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  uiTypeLabel(t: QuestionType): string {
    switch (t) {
      case 'multiple-choice': return 'MULTIPLE CHOICE';
      case 'yes-no': return 'YES / NO';
      case 'star-rating': return 'STAR RATING';
      case 'scale': return 'SCALE';
      case 'date': return 'DATE';
      case 'input-text': return 'TEXT INPUT';
      default: return 'QUESTION';
    }
  }

  addOption(q: QuestionItem) {
    q.options = q.options || [];
    q.options.push('New Option');
  }
  trackByOptionIndex = (index: number, _opt: string) => index;

}
