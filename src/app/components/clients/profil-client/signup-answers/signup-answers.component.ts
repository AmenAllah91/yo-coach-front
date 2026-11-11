import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { SignupAnswers, SignupAnswerRow, SubmissionsApiService } from '../../../forms/services/submissions-api.service';

/**
 * Client profile › Check-ins: the client's answers to the coach's signup form (filled during the onboarding, so never
 * in the check-in lists). Shown only when there are answers; folded by default after the first look.
 */
@Component({
  selector: 'app-signup-answers',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="signup-answers" *ngIf="answers" [attr.aria-label]="'SIGNUP_ANSWERS.TITLE' | translate">
      <button type="button" class="signup-answers__head" (click)="open = !open" [attr.aria-expanded]="open">
        <span class="signup-answers__icon"><i-feather name="clipboard"></i-feather></span>
        <span class="signup-answers__titles">
          <span class="signup-answers__title">{{ 'SIGNUP_ANSWERS.TITLE' | translate }}</span>
          <span class="signup-answers__sub">
            {{ answers.formTitle || ('SIGNUP_ANSWERS.FORM' | translate) }}
            <ng-container *ngIf="answers.submittedAt"> · {{ 'SIGNUP_ANSWERS.FILLED_ON' | translate: { date: date(answers.submittedAt) } }}</ng-container>
          </span>
        </span>
        <i-feather class="signup-answers__chevron" [name]="open ? 'chevron-up' : 'chevron-down'"></i-feather>
      </button>

      <dl class="signup-answers__list" *ngIf="open">
        <div class="signup-answers__row" *ngFor="let row of answers.rows">
          <dt>{{ row.label }}</dt>
          <dd [class.signup-answers__empty]="empty(row)">{{ display(row) }}</dd>
        </div>
      </dl>
    </section>
  `,
  styles: [`
    .signup-answers { margin: 0 0 16px; border: 1px solid light-dark(#dbeaf5, #2f3a44); border-radius: 12px;
      background: light-dark(#fff, #1f2327); overflow: hidden; }
    .signup-answers__head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: 0;
      background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .signup-answers__icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: light-dark(#eef9ff, #1e313a); color: light-dark(#0a8fcc, #4cc3f7); }
    .signup-answers__icon i-feather { width: 18px; height: 18px; }
    .signup-answers__titles { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .signup-answers__title { font-weight: 700; font-size: 14px; }
    .signup-answers__sub { font-size: 12.5px; color: light-dark(#58708e, #a9afb7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .signup-answers__chevron { width: 18px; height: 18px; color: light-dark(#94a3b8, #8b939c); }
    .signup-answers__list { margin: 0; padding: 4px 14px 12px; border-top: 1px solid light-dark(#edf1f5, #32373c); }
    .signup-answers__row { padding: 10px 0; border-bottom: 1px solid light-dark(#f1f4f7, #2c3136); }
    .signup-answers__row:last-child { border-bottom: 0; }
    dt { font-size: 12.5px; font-weight: 600; color: light-dark(#58708e, #a9afb7); }
    dd { margin: 3px 0 0; font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
    .signup-answers__empty { color: light-dark(#94a3b8, #8b939c); }
  `],
})
export class SignupAnswersComponent implements OnChanges {
  @Input() clientId: string | null = null;

  answers: SignupAnswers | null = null;
  open = true;

  constructor(
    private submissions: SubmissionsApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(): void {
    this.answers = null;
    if (!this.clientId) return;
    // A failure, or no answers (204), only hides the block.
    this.submissions.getSignupAnswers(this.clientId).subscribe({
      next: (answers) => {
        this.answers = answers && answers.rows?.length ? answers : null;
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  empty(row: SignupAnswerRow): boolean {
    return row.value == null && row.rating == null && row.yes == null;
  }

  display(row: SignupAnswerRow): string {
    if (this.empty(row)) return this.translate.instant('SIGNUP_ANSWERS.NOT_ANSWERED');
    switch (row.type) {
      case 'STAR_RATING':
        return `${'★'.repeat(row.rating ?? 0)}${'☆'.repeat(Math.max(0, (row.maxStars ?? 5) - (row.rating ?? 0)))}  ${row.rating}/${row.maxStars ?? 5}`;
      case 'YES_NO':
        return this.translate.instant(row.yes ? 'YES' : 'NO');
      case 'DATE':
        return this.date(row.value!);
      default:
        return row.value ?? '';
    }
  }

  date(value: string): string {
    const lang = this.translate.currentLang === 'en' ? 'en-GB' : 'fr-FR';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
