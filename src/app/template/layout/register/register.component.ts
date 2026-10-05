import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../service/language.service';
import {
  OnboardingResponse,
  RegistrationUser,
  SubscriptionPlanDto,
  planFeatureText
} from '../../../models/subscription-onboarding.model';
import { RegisterService } from '../../../service/register.service';
import { SubscriptionOnboardingService } from '../../../service/subscription-onboarding.service';
import { AuthService } from '../../../config/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,TranslateModule,RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit {
  signupForm!: FormGroup;
  usernameError: string | null = null;
  passwordError: string | null = null;
  generalError: string | null = null;
  accountExists = false;
  selectedPlan: SubscriptionPlanDto | null = null;
  planId: number | null = null;
  planLoadError: string | null = null;
  invitationToken: string | null = null;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private registerService: RegisterService,
    private onboardingService: SubscriptionOnboardingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private languageService: LanguageService
) {}

  ngOnInit(): void {
    this.translate.use(this.languageService.getCurrentLanguage());
    this.signupForm = this.fb.group({
      username: ['', [this.trimmedRequired, this.trimmedLength(3, 50)]],
      firstName: ['', [this.trimmedRequired, this.trimmedMaxLength(100)]],
      lastName: ['', [this.trimmedRequired, this.trimmedMaxLength(100)]],
      email: ['', [this.trimmedRequired, this.trimmedMaxLength(254), Validators.email]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required]],
      isCoach: [false]
    }, { validators: this.passwordMatchValidator });
    this.invitationToken = this.route.snapshot.queryParamMap.get('invitationToken');
    const planId = Number(this.route.snapshot.queryParamMap.get('planId'));
    if (!this.invitationToken && Number.isInteger(planId) && planId > 0) {
      this.planId = planId;
      this.signupForm.patchValue({ isCoach: true });
      this.loadSelectedPlan(planId);
    }
  }

  /** SUB-57: the features of the chosen plan, in the order defined in YoSales, in the language of the app. */
  get featureLines(): { text: string; lockedInTrial: boolean }[] {
    const lang = this.languageService.getCurrentLanguage();
    return (this.selectedPlan?.features ?? []).map((f) => ({
      text: planFeatureText(f, lang),
      lockedInTrial: f.includedInTrial === false
    }));
  }

  passwordMatchValidator(formGroup: AbstractControl): ValidationErrors | null {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');

    if (confirmPassword?.value && password?.value !== confirmPassword.value) {
      confirmPassword.setErrors({ ...confirmPassword.errors, mismatch: true });
      return null;
    }

    if (confirmPassword?.hasError('mismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['mismatch'];
      confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
    }
    return null;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    this.usernameError = null;
    this.passwordError = null;
    this.generalError = null;
    const formValues = this.normalizedFormValue();

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();

      return;
    }

    const isCoachRegistration = this.invitationToken
      ? false
      : Boolean(this.planId || formValues.isCoach);

    const user: RegistrationUser = {
      login: formValues.username,
      email: formValues.email,
      password: formValues.password,
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      authorities: [isCoachRegistration ? 'ROLE_COACH' : 'ROLE_CLIENT']
    };

    this.isSubmitting = true;
    this.accountExists = false;
    const registration$: Observable<void | OnboardingResponse> = this.planId
      ? this.onboardingService.onboard({ user, planId: this.planId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      : this.registerService.registerUser(user);

    registration$.pipe(
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: () => {
        const targetPath = this.invitationToken
          ? this.invitationReturnPath()
          : (isCoachRegistration ? '/coach-onboarding' : '/');
        const redirectUri = new URL(targetPath, window.location.origin).toString();
        void this.authService.login(redirectUri, formValues.username).catch(error => {
          this.generalError = this.translate.instant('UNEXPECTED_ERROR_RETRY');
          console.error('Unable to start authentication after registration:', error);
        });
      },
      error: (error) => {
        const message = String(error?.error?.error || error?.error || error?.message || '');
        if (error?.error?.code === 'ACCOUNT_ALREADY_EXISTS') {
          // SUB-14: one trial per coach: point to the sign-in instead of a generic error.
          this.accountExists = true;
          this.signupForm.get('email')?.setErrors({ serverConflict: true });
          this.signupForm.get('email')?.markAsTouched();
          console.error('Registration error:', error);
          return;
        }
        if (message.includes('This username is already in use.')) {
          this.usernameError = this.translate.instant('USERNAME_ALREADY_IN_USE');
          this.signupForm.get('username')?.setErrors({ serverConflict: true });
        } else if (message.includes('An account already exists with this email.')) {
          this.signupForm.get('email')?.setErrors({ serverConflict: true });
        } else if (error?.status === 409) {
          this.generalError = this.translate.instant('USER_ALREADY_EXISTS');
        } else {
          this.generalError = this.translate.instant('UNEXPECTED_ERROR_RETRY');
        }
        if (message.includes('This username is already in use.')) {
          this.signupForm.get('username')?.markAsTouched();
        } else if (message.includes('An account already exists with this email.')) {
          this.signupForm.get('email')?.markAsTouched();
        }
        console.error('Registration error:', error);
      }
    });
  }

  signIn(): void {
    const targetPath = this.invitationToken
      ? this.invitationReturnPath()
      : '/';
    const redirectUri = new URL(targetPath, window.location.origin).toString();
    void this.authService.login(redirectUri).catch(error => {
      this.generalError = this.translate.instant('UNEXPECTED_ERROR_RETRY');
      console.error('Unable to start authentication:', error);
    });
  }

  private invitationReturnPath(): string {
    return `/invitation/${encodeURIComponent(this.invitationToken!)}?accept=1`;
  }

  getFieldError(controlName: string): string | null {
    const control = this.signupForm.get(controlName);
    if (control?.hasError('required')) {
      return this.translate.instant('FIELD_REQUIRED', { field: this.fieldLabel(controlName) });
    }
    if (control?.hasError('email')) {
      return this.translate.instant('INVALID_EMAIL_FORMAT');
    }
    if (control?.hasError('serverConflict')) {
      return controlName === 'username'
        ? this.translate.instant('USERNAME_ALREADY_IN_USE')
        : this.translate.instant('EMAIL_ALREADY_IN_USE');
    }
    if (control?.hasError('minlength')) {
      return this.translate.instant('FIELD_MIN_LENGTH', { field: this.fieldLabel(controlName), count: control.errors?.['minlength'].requiredLength });
    }
    if (control?.hasError('trimmedMinlength')) {
      return this.translate.instant('FIELD_MIN_LENGTH', { field: this.fieldLabel(controlName), count: control.errors?.['trimmedMinlength'].requiredLength });
    }
    if (control?.hasError('maxlength') || control?.hasError('trimmedMaxlength')) {
      const details = control.errors?.['maxlength'] || control.errors?.['trimmedMaxlength'];
      return this.translate.instant('FIELD_MAX_LENGTH', { field: this.fieldLabel(controlName), count: details.requiredLength });
    }
    if (controlName === 'confirmPassword' && control?.hasError('mismatch')) {
      return this.translate.instant('PASSWORDS_DO_NOT_MATCH');
    }
    return null;
  }

  normalizeField(controlName: 'username' | 'firstName' | 'lastName' | 'email'): void {
    const control = this.signupForm.get(controlName);
    if (!control) return;
    control.setValue(String(control.value ?? '').trim(), { emitEvent: false });
    control.updateValueAndValidity();
  }

  clearServerError(controlName: 'username' | 'email'): void {
    const control = this.signupForm.get(controlName);
    if (!control?.hasError('serverConflict')) return;
    const errors = { ...control.errors };
    delete errors['serverConflict'];
    control.setErrors(Object.keys(errors).length ? errors : null);
    if (controlName === 'username') this.usernameError = null;
  }

  private normalizedFormValue(): any {
    (['username', 'firstName', 'lastName', 'email'] as const).forEach(field => this.normalizeField(field));
    return this.signupForm.getRawValue();
  }

  private trimmedRequired(control: AbstractControl): ValidationErrors | null {
    return String(control.value ?? '').trim() ? null : { required: true };
  }

  private trimmedLength(min: number, max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const length = String(control.value ?? '').trim().length;
      if (!length) return null;
      if (length < min) return { trimmedMinlength: { requiredLength: min, actualLength: length } };
      if (length > max) return { trimmedMaxlength: { requiredLength: max, actualLength: length } };
      return null;
    };
  }

  private trimmedMaxLength(max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const length = String(control.value ?? '').trim().length;
      return length > max ? { trimmedMaxlength: { requiredLength: max, actualLength: length } } : null;
    };
  }

  private fieldLabel(controlName: string): string {
    const keys: Record<string, string> = {
      username: 'USERNAME',
      firstName: 'FIRST_NAME',
      lastName: 'LAST_NAME',
      email: 'EMAIL',
      password: 'PASSWORD',
      confirmPassword: 'CONFIRM_PASSWORD'
    };
    return this.translate.instant(keys[controlName] || controlName);
  }

  private loadSelectedPlan(planId: number): void {
    this.onboardingService.getPlans().subscribe({
      next: (plans) => {
        this.selectedPlan = plans.find(plan => plan.id === planId) ?? null;
        if (!this.selectedPlan) {
          this.planLoadError = 'The selected plan is no longer available. Please choose another plan.';
        }
      },
      error: () => {
        this.planLoadError = 'We could not confirm the selected plan. Please return to the plans page and try again.';
      }
    });
  }
}
