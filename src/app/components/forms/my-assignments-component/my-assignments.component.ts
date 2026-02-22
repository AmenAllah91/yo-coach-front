import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { FormDetails, FormsApiService, PageResponse } from "../services/forms-api.service";
import { AssignmentsApiService, AssignmentStatus, FormAssignment } from "../services/assignments-api.service";
import { SubmissionsApiService } from "../services/submissions-api.service";
import {Answer, QuestionType, SubmissionPayload} from "../../../models/forms.model";


type Tab = 'pending' | 'submitted';

@Component({
  selector: 'app-my-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-assignments.component.html',
  styleUrls: ['./my-assignments.component.css'],
})
export class MyAssignmentsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ─── List state ───────────────────────────────────────────────
  activeTab: Tab = 'pending';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageData = signal<PageResponse<FormAssignment> | null>(null);

  readonly assignments = computed(() => this.pageData()?.content ?? []);
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 0);
  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);

  readonly pendingAssignments = computed(() =>
    this.assignments().filter(a => a.status === 'ASSIGNED' || a.status === 'OPENED')
  );

  readonly submittedAssignments = computed(() =>
    this.assignments().filter(a => a.status === 'SUBMITTED')
  );

  readonly pendingCount = computed(() => this.pendingAssignments().length);

  // ─── Modal state ──────────────────────────────────────────────
  isModalOpen = false;
  isViewMode = false;
  selectedAssignment: FormAssignment | null = null;

  readonly modalLoading = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly submitting = signal(false);

  currentForm: FormDetails | null = null;

  // ✅ now Answer[] (not UiAnswer[])
  modalAnswers: Answer[] = [];
  submittedAnswers: Answer[] = [];

  // Expose enum for template if you need it (optional)
  QuestionType = QuestionType;

  constructor(
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
  ) {}

  ngOnInit(): void {
    this.loadPage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── List methods ─────────────────────────────────────────────

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  loadPage(): void {
    this.loading.set(true);
    this.error.set(null);

    this.assignmentsApi
      .pageMyAssignments(this.pageIndex(), this.pageSize(), 'assignedAt', 'DESC', undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.pageData.set(res); this.loading.set(false); },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Erreur lors du chargement des affectations.');
        },
      });
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
    this.loadPage();
  }

  goToPrev(): void {
    if (this.pageIndex() <= 0) return;
    this.pageIndex.set(this.pageIndex() - 1);
    this.loadPage();
  }

  goToNext(): void {
    if (this.pageIndex() >= this.totalPages() - 1) return;
    this.pageIndex.set(this.pageIndex() + 1);
    this.loadPage();
  }

  isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  statusLabel(status: AssignmentStatus): string {
    switch (status) {
      case 'ASSIGNED': return 'Assigné';
      case 'OPENED':   return 'Ouvert';
      case 'SUBMITTED': return 'Soumis';
      case 'CANCELED': return 'Annulé';
      default: return status;
    }
  }

  trackById(_: number, a: FormAssignment): string {
    return a.id;
  }

  // ─── Modal methods ────────────────────────────────────────────

  openAssignment(a: FormAssignment): void {
    this.selectedAssignment = a;
    this.isModalOpen = true;
    this.isViewMode = a.status === 'SUBMITTED';
    this.currentForm = null;
    this.modalAnswers = [];
    this.submittedAnswers = [];
    this.modalError.set(null);
    this.modalLoading.set(true);

    if (a.status === 'ASSIGNED') {
      this.assignmentsApi.markOpened(a.id).subscribe({ error: () => {} });
    }

    this.formsApi.getFormById(a.formId).subscribe({
      next: (form) => {
        this.currentForm = {
          ...form,
          questions: form.questions.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
        };

        if (this.isViewMode) {
          this.submissionsApi.getByAssignmentId(a.id).subscribe({
            next: (submission) => {
              this.submittedAnswers = submission.answers ?? [];
              this.modalLoading.set(false);
            },
            error: () => {
              this.modalLoading.set(false);
              this.modalError.set('Impossible de charger les réponses.');
            }
          });
        } else {
          // ✅ Create empty answers using QuestionType enum
          this.modalAnswers = this.currentForm!.questions.map((q): Answer => {
            switch (q.type) {
              case 'MULTIPLE_CHOICE':
                return { questionId: q.id, type: QuestionType.MULTIPLE_CHOICE, selectedOptionId: null };
              case 'STAR_RATING':
                return { questionId: q.id, type: QuestionType.STAR_RATING, rating: null };
              case 'YES_NO':
                return { questionId: q.id, type: QuestionType.YES_NO, yes: null };
              case 'DATE':
                return { questionId: q.id, type: QuestionType.DATE, date: null };
              default:
                return { questionId: q.id, type: QuestionType.TEXT, text: null };
            }
          });

          this.modalLoading.set(false);
        }
      },
      error: () => {
        this.modalLoading.set(false);
        this.modalError.set('Impossible de charger le formulaire.');
      }
    });
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isViewMode = false;
    this.selectedAssignment = null;
    this.currentForm = null;
    this.modalAnswers = [];
    this.submittedAnswers = [];
    this.modalError.set(null);
    this.submitting.set(false);
  }

  submitModal(): void {
    if (!this.selectedAssignment || !this.isValid()) {
      this.modalError.set('Veuillez répondre à toutes les questions obligatoires.');
      return;
    }

    this.submitting.set(true);
    this.modalError.set(null);

    const payload: SubmissionPayload = {
      answers: this.modalAnswers.map((a): Answer => {
        switch (a.type) {
          case QuestionType.MULTIPLE_CHOICE:
            return { questionId: a.questionId, type: a.type, selectedOptionId: a.selectedOptionId ?? null };

          case QuestionType.STAR_RATING:
            return { questionId: a.questionId, type: a.type, rating: a.rating ?? null };

          case QuestionType.YES_NO:
            return { questionId: a.questionId, type: a.type, yes: a.yes ?? null };

          case QuestionType.TEXT:
            return { questionId: a.questionId, type: a.type, text: a.text ?? null };

          case QuestionType.DATE:
            return { questionId: a.questionId, type: a.type, date: a.date ?? null };
        }
      }),
    };

    this.submissionsApi.submit(this.selectedAssignment.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.loadPage();
      },
      error: (err) => {
        this.submitting.set(false);
        this.modalError.set(err?.error?.error ?? err?.error?.message ?? 'Erreur lors de la soumission.');
      }
    });
  }

  isValid(): boolean {
    return this.modalAnswers.every(a => {
      switch (a.type) {
        case QuestionType.YES_NO:          return a.yes !== null && a.yes !== undefined;
        case QuestionType.STAR_RATING:     return a.rating !== null && a.rating !== undefined;
        case QuestionType.MULTIPLE_CHOICE: return !!a.selectedOptionId;
        case QuestionType.TEXT:            return !!a.text && a.text.trim().length > 0;
        case QuestionType.DATE:            return !!a.date;
        default:                           return false;
      }
    });
  }

  // ✅ now returns Answer
  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.submittedAnswers.find(a => a.questionId === questionId);
  }

  getOptionLabel(question: any, optionId: string): string {
    return question.options?.find((o: any) => o.id === optionId)?.label ?? optionId;
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
}
