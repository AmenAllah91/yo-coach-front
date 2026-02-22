import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {FormDetails, FormsApiService} from "../services/forms-api.service";
import {SubmissionsApiService} from "../services/submissions-api.service";
import {AssignmentsApiService} from "../services/assignments-api.service";
import {Answer, QuestionType, SubmissionPayload} from "../../../models/forms.model";

function assertNever(x: never): never {
  throw new Error('Unexpected value: ' + JSON.stringify(x));
}

@Component({
  selector: 'app-assignment-fill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-fill.component.html',
  styleUrls: ['./assignment-fill.component.css'],
})
export class AssignmentFillComponent implements OnInit {

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  assignmentId!: string;
  form!: FormDetails;

  answers: Answer[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formsApi: FormsApiService,
    private submissionsApi: SubmissionsApiService,
    private assignmentsApi: AssignmentsApiService
  ) {}

  ngOnInit(): void {
    this.assignmentId = this.route.snapshot.paramMap.get('id')!;
    this.load();
  }

  load(): void {
    this.loading.set(true);

    // 1) get assignment -> formId
    this.assignmentsApi.getById(this.assignmentId).subscribe({
      next: (a) => {
        this.formsApi.getFormById(a.formId).subscribe({
          next: (form) => {
            this.form = form;
            this.answers = form.questions
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((q): Answer => {
                switch (q.type) {
                  case 'MULTIPLE_CHOICE':
                    return { questionId: q.id, type: QuestionType.MULTIPLE_CHOICE, selectedOptionId: null };

                  case 'STAR_RATING':
                    return { questionId: q.id, type: QuestionType.STAR_RATING, rating: null };

                  case 'YES_NO':
                    return { questionId: q.id, type: QuestionType.YES_NO, yes: null };

                  case 'TEXT':
                    return { questionId: q.id, type: QuestionType.TEXT, text: null };

                  case 'DATE':
                    return { questionId: q.id, type: QuestionType.DATE, date: null };
                }

                // ✅ if backend sends a new type, you’ll see it immediately
                return assertNever(q.type as never);
              });
            this.loading.set(false);
          },
          error: () => this.fail('Impossible de charger le formulaire'),
        });
      },
      error: () => this.fail('Affectation introuvable'),
    });
  }

  submit(): void {
    if (!this.isValid()) {
      this.error.set('Tous les champs sont obligatoires.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: SubmissionPayload = {
      answers: this.answers.map((a): Answer => {
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

        // ✅ TS exhaustive check
        return assertNever(a);
      }),
    };

    this.submissionsApi.submit(this.assignmentId, payload).subscribe({
      next: () => this.router.navigate(['/assignments/me']),
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error ?? err?.error?.message ?? 'Erreur lors de la soumission.');
      },
    });
  }

  isValid(): boolean {
    return this.answers.every(a => {
      switch (a.type) {
        case 'YES_NO':
          return a.yes !== null;
        case 'STAR_RATING':
          return a.rating !== null;
        case 'MULTIPLE_CHOICE':
          return !!a.selectedOptionId;
        case 'TEXT':
          return !!a.text && a.text.trim().length > 0;
        case 'DATE':
          return !!a.date; // 'YYYY-MM-DD'
        default:
          return false;
      }
    });
  }

  private fail(msg: string) {
    this.error.set(msg);
    this.loading.set(false);
  }
}
