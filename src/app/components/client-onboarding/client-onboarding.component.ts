import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { ClientOnboardingState, ClientOnboardingStep } from '../../models/client-onboarding.model';
import { QuestionBE } from '../forms/services/forms-api.service';
import { ClientOnboardingService } from '../../service/client-onboarding.service';
import { LanguageService } from '../../service/language.service';
import { APP_STORE_URL, PLAY_STORE_URL, mobilePlatform } from '../../config/app-store-links';
import { CLIENT_OBJECTIVES, isClientObjective } from '../../models/client-objective';

/** Remembered for the tab: the client chose to go on with the onboarding on the web. */
const CONTINUE_ON_WEB_KEY = 'clientOnboardingOnWeb';
/** Remembered for the tab: the welcome screen was passed. */
const WELCOME_SEEN_KEY = 'clientOnboardingWelcomeSeen';

/** Same rules as the server: a real date, between 10 and 120 years ago. */
function birthDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value || '');
  if (!value) return null;
  const date = new Date(value + 'T00:00:00');
  if (isNaN(date.getTime())) return { birthDate: true };
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age--;
  return date > now || age < 10 || age > 120 ? { birthDate: true } : null;
}

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value || '').trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '').length;
  return /^\+?[0-9 ().-]{6,25}$/.test(value) && digits >= 6 && digits <= 15 ? null : { phone: true };
}

@Component({ selector: 'app-client-onboarding', standalone: true, imports: [CommonModule, ReactiveFormsModule, TranslateModule], templateUrl: './client-onboarding.component.html', styleUrl: './client-onboarding.component.scss' })
export class ClientOnboardingComponent implements OnInit {
  state?: ClientOnboardingState;
  loading = true; saving = false; loadError = false; submitError = '';
  step: ClientOnboardingStep = 'language';
  readonly languageForm: FormGroup;
  readonly profileForm: FormGroup;
  readonly objectives = CLIENT_OBJECTIVES;
  /** First screen: welcome, then the app offer, then the steps. */
  welcome = false;
  readonly unitsForm: FormGroup;
  formAnswers: Record<string, any> = {};
  /**
   * The app is offered first: before the first step ('start'), and again once the web onboarding is done ('done').
   * The onboarding resumes at the same step in the app, signed in with the same account.
   */
  appOffer: 'start' | 'done' | null = null;
  readonly appStoreUrl = APP_STORE_URL;
  readonly playStoreUrl = PLAY_STORE_URL;
  readonly platform = mobilePlatform();

  constructor(private fb: FormBuilder, private onboarding: ClientOnboardingService, private languages: LanguageService, private router: Router) {
    this.languageForm = fb.group({ language: [languages.languageCodeToName(languages.getCurrentLanguage()), Validators.required] });
    this.profileForm = fb.group({
      birthDate: ['', [Validators.required, birthDateValidator]],
      gender: ['', Validators.required],
      phoneNumber: ['', [Validators.required, phoneValidator]],
      currentWeight: [null, [Validators.required, Validators.min(1), Validators.max(500)]],
      goalWeight: [null, [Validators.required, Validators.min(1), Validators.max(500)]],
      mainObjective: ['', Validators.required],
    });
    const locale = String(navigator.language || '').toUpperCase();
    const imperial = locale.endsWith('-US');
    const miles = imperial || locale.endsWith('-GB');
    this.unitsForm = fb.group({ weightUnit: [imperial ? 'lbs' : 'kg', Validators.required], distanceUnit: [miles ? 'miles' : 'km', Validators.required], measurementUnit: [imperial ? 'in' : 'cm', Validators.required] });
  }

  ngOnInit(): void { this.load(); }
  get steps(): ClientOnboardingStep[] {
    if (this.state?.profileUpdate) return ['profile'];
    return this.state?.signupFormId ? ['language','profile','units','form'] : ['language','profile','units'];
  }
  get index(): number { return Math.max(0, this.steps.indexOf(this.step)); }
  get progress(): number { return ((this.index + 1) / this.steps.length) * 100; }
  get questions(): QuestionBE[] { return [...(this.state?.signupFormQuestions || [])].sort((a,b) => a.order - b.order); }
  get currentForm(): FormGroup | null { return this.step === 'language' ? this.languageForm : this.step === 'profile' ? this.profileForm : this.step === 'units' ? this.unitsForm : null; }

  load(force = false): void {
    this.loading = true; this.loadError = false;
    this.onboarding.load(force).pipe(finalize(() => this.loading = false)).subscribe({ next: state => this.apply(state), error: () => this.loadError = true });
  }
  selectUnit(field: string, value: string): void { this.unitsForm.get(field)?.setValue(value); }
  selectProfile(field: string, value: string): void { this.profileForm.get(field)?.setValue(value); this.profileForm.get(field)?.markAsTouched(); }
  invalid(field: string): boolean { const control = this.profileForm.get(field); return !!control && control.invalid && control.touched; }
  get maxBirthDate(): string { const d = new Date(); d.setFullYear(d.getFullYear() - 10); return d.toISOString().slice(0, 10); }
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
      if (state.completed && this.state?.profileUpdate) { this.goToDashboard(); return; }
      if (state.completed) { this.appOffer = 'done'; window.scrollTo({top: 0, behavior: 'smooth'}); return; }
      this.apply(state); window.scrollTo({top: 0, behavior: 'smooth'});
    }, error: error => this.submitError = String(error?.error?.error || error?.error?.message || 'Unable to save this step. Please try again.') });
  }
  back(): void { if (this.index > 0 && !this.saving) this.step = this.steps[this.index - 1]; }
  startOnboarding(): void {
    try { sessionStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch {}
    this.welcome = false;
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  continueOnWeb(): void {
    try { sessionStorage.setItem(CONTINUE_ON_WEB_KEY, '1'); } catch {}
    this.appOffer = null;
  }
  goToDashboard(): void { this.router.navigate(['/client-dashboard']); }
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
    let onWeb = false, welcomeSeen = false;
    try { onWeb = sessionStorage.getItem(CONTINUE_ON_WEB_KEY) === '1'; welcomeSeen = sessionStorage.getItem(WELCOME_SEEN_KEY) === '1'; } catch {}
    const firstVisit = !state.completedSteps?.length && !state.profileUpdate;
    if ((firstVisit || state.profileUpdate) && !welcomeSeen) this.welcome = true;
    if (firstVisit && !onWeb) this.appOffer = 'start';
    this.languageForm.patchValue({language: state.language || 'English'});
    this.profileForm.patchValue({
      birthDate: state.birthDate || '', gender: state.gender || '', phoneNumber: state.phoneNumber || '',
      currentWeight: state.currentWeight, goalWeight: state.goalWeight,
      mainObjective: isClientObjective(state.mainObjective) ? state.mainObjective : '',
    });
    if (state.completedSteps?.includes('units')) {
      this.unitsForm.patchValue({weightUnit: state.weightUnit || 'kg', distanceUnit: state.distanceUnit || 'km', measurementUnit: state.measurementUnit || 'cm'});
    }
  }
}
