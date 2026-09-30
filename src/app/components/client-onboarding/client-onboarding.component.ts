import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { ClientOnboardingState, ClientOnboardingStep } from '../../models/client-onboarding.model';
import { QuestionBE } from '../forms/services/forms-api.service';
import { ClientOnboardingService } from '../../service/client-onboarding.service';
import { LanguageService } from '../../service/language.service';

@Component({ selector: 'app-client-onboarding', standalone: true, imports: [CommonModule, ReactiveFormsModule, TranslateModule], templateUrl: './client-onboarding.component.html', styleUrl: './client-onboarding.component.scss' })
export class ClientOnboardingComponent implements OnInit {
  state?: ClientOnboardingState;
  loading = true; saving = false; loadError = false; submitError = '';
  step: ClientOnboardingStep = 'language';
  readonly languageForm: FormGroup;
  readonly goalsForm: FormGroup;
  readonly unitsForm: FormGroup;
  formAnswers: Record<string, any> = {};

  constructor(private fb: FormBuilder, private onboarding: ClientOnboardingService, private languages: LanguageService, private router: Router) {
    this.languageForm = fb.group({ language: [languages.languageCodeToName(languages.getCurrentLanguage()), Validators.required] });
    this.goalsForm = fb.group({ currentWeight: [null, [Validators.required, Validators.min(1)]], goalWeight: [null, [Validators.required, Validators.min(1)]], mainObjective: ['', [Validators.required, Validators.maxLength(500)]] });
    const locale = String(navigator.language || '').toUpperCase();
    const imperial = locale.endsWith('-US');
    const miles = imperial || locale.endsWith('-GB');
    this.unitsForm = fb.group({ weightUnit: [imperial ? 'lbs' : 'kg', Validators.required], distanceUnit: [miles ? 'miles' : 'km', Validators.required], measurementUnit: [imperial ? 'in' : 'cm', Validators.required] });
  }

  ngOnInit(): void { this.load(); }
  get steps(): ClientOnboardingStep[] { return this.state?.signupFormId ? ['language','goals','units','form'] : ['language','goals','units']; }
  get index(): number { return Math.max(0, this.steps.indexOf(this.step)); }
  get progress(): number { return ((this.index + 1) / this.steps.length) * 100; }
  get questions(): QuestionBE[] { return [...(this.state?.signupFormQuestions || [])].sort((a,b) => a.order - b.order); }
  get currentForm(): FormGroup | null { return this.step === 'language' ? this.languageForm : this.step === 'goals' ? this.goalsForm : this.step === 'units' ? this.unitsForm : null; }

  load(force = false): void {
    this.loading = true; this.loadError = false;
    this.onboarding.load(force).pipe(finalize(() => this.loading = false)).subscribe({ next: state => this.apply(state), error: () => this.loadError = true });
  }
  selectUnit(field: string, value: string): void { this.unitsForm.get(field)?.setValue(value); }
  setAnswer(question: QuestionBE, value: any): void { this.formAnswers[question.id] = value; }
  answer(question: QuestionBE): any { return this.formAnswers[question.id]; }
  stars(question: QuestionBE): number[] { return Array.from({length: Number((question as any).maxStars || 5)}, (_, i) => i + 1); }
  formValid(): boolean { return this.questions.every(q => !q.required || this.answer(q) !== undefined && this.answer(q) !== null && this.answer(q) !== ''); }

  continue(): void {
    this.submitError = ''; this.currentForm?.markAllAsTouched();
    if (this.saving || (this.currentForm?.invalid ?? !this.formValid())) return;
    let payload: any = this.currentForm?.getRawValue() || { answers: this.questions.filter(q => this.answer(q) !== undefined).map(q => this.toAnswer(q, this.answer(q))) };
    const savingStep = this.step as Exclude<ClientOnboardingStep, 'completed'>;
    this.saving = true;
    this.onboarding.saveStep(savingStep, payload).pipe(finalize(() => this.saving = false)).subscribe({ next: state => {
      if (savingStep === 'language') this.languages.setLanguage(this.languages.languageNameToCode(payload.language));
      if (state.completed) { this.router.navigate(['/client-dashboard']); return; }
      this.apply(state); window.scrollTo({top: 0, behavior: 'smooth'});
    }, error: error => this.submitError = String(error?.error?.error || error?.error?.message || 'Unable to save this step. Please try again.') });
  }
  back(): void { if (this.index > 0 && !this.saving) this.step = this.steps[this.index - 1]; }
  private toAnswer(q: QuestionBE, value: any): any {
    const answer: any = { questionId: q.id, type: q.type };
    if (q.type === 'MULTIPLE_CHOICE') answer.selectedOptionId = value;
    else if (q.type === 'STAR_RATING') answer.rating = value;
    else if (q.type === 'YES_NO') answer.yes = value;
    else if (q.type === 'DATE') answer.date = value;
    else answer.text = value;
    return answer;
  }
  private apply(state: ClientOnboardingState): void {
    if (state.completed) { this.router.navigate(['/client-dashboard']); return; }
    this.state = state; this.step = state.currentStep;
    this.languageForm.patchValue({language: state.language || 'English'});
    this.goalsForm.patchValue({currentWeight: state.currentWeight, goalWeight: state.goalWeight, mainObjective: state.mainObjective || ''});
    if (state.completedSteps?.includes('units')) {
      this.unitsForm.patchValue({weightUnit: state.weightUnit || 'kg', distanceUnit: state.distanceUnit || 'km', measurementUnit: state.measurementUnit || 'cm'});
    }
  }
}
