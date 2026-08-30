import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../service/language.service';
import {
  OnboardingResponse,
  RegistrationUser,
  SubscriptionPlanDto
} from '../../../models/subscription-onboarding.model';
import { RegisterService } from '../../../service/register.service';
import { SubscriptionOnboardingService } from '../../../service/subscription-onboarding.service';

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
  selectedPlan: SubscriptionPlanDto | null = null;
  planId: number | null = null;
  planLoadError: string | null = null;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private registerService: RegisterService,
    private onboardingService: SubscriptionOnboardingService,
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private languageService: LanguageService
) {}

  ngOnInit(): void {
    this.translate.use(this.languageService.getCurrentLanguage());
    this.signupForm = this.fb.group({
      username: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      isCoach: [false]
    }, { validators: this.passwordMatchValidator });
    const planId = Number(this.route.snapshot.queryParamMap.get('planId'));
    if (Number.isInteger(planId) && planId > 0) {
      this.planId = planId;
      this.signupForm.patchValue({ isCoach: true });
      this.loadSelectedPlan(planId);
    }
  }

  passwordMatchValidator(formGroup: FormGroup): void {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');

    if (confirmPassword?.value && password?.value !== confirmPassword.value) {
      confirmPassword.setErrors({ ...confirmPassword.errors, mismatch: true });
      return;
    }

    if (confirmPassword?.hasError('mismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['mismatch'];
      confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
    }
  }

  onSubmit(): void {
    this.usernameError = null;
    this.passwordError = null;
    this.generalError = null;

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();

      const password = this.signupForm.get('password')?.value;
      const confirmPassword = this.signupForm.get('confirmPassword')?.value;
      this.passwordError = password !== confirmPassword ? 'Passwords do not match!' : null;
      this.generalError = 'Please complete all required fields before creating your account.';
      if (password !== confirmPassword) {
        this.passwordError = this.translate.instant('PASSWORDS_DO_NOT_MATCH');
      } else {
        this.passwordError = null;
      }
      return;
    }

    const formValues = this.signupForm.value;
    const user: RegistrationUser = {
      login: formValues.username,
      email: formValues.email,
      password: formValues.password,
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      authorities: [this.planId || formValues.isCoach ? 'ROLE_COACH' : 'ROLE_CLIENT']
    };

    this.isSubmitting = true;
    const registration$: Observable<void | OnboardingResponse> = this.planId
      ? this.onboardingService.onboard({ user, planId: this.planId })
      : this.registerService.registerUser(user);

    registration$.pipe(
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        if (error.message.includes('already exists')) {
          this.generalError = this.translate.instant('USER_ALREADY_EXISTS');
        } else {
          this.generalError = this.translate.instant('UNEXPECTED_ERROR_RETRY');
        }
        console.error('Registration error:', error);
      }
    });
  }

  getFieldError(controlName: string): string | null {
    const control = this.signupForm.get(controlName);
    if (control?.hasError('required')) {
      return this.translate.instant('FIELD_REQUIRED', { field: this.fieldLabel(controlName) });
    }
    if (control?.hasError('email')) {
      return this.translate.instant('INVALID_EMAIL_FORMAT');
    }
    if (control?.hasError('minlength')) {
      return this.translate.instant('FIELD_MIN_LENGTH', { field: this.fieldLabel(controlName), count: control.errors?.['minlength'].requiredLength });
    }
    if (controlName === 'confirmPassword' && control?.touched && this.signupForm.hasError('passwordMismatch')) {
      return this.translate.instant('PASSWORDS_DO_NOT_MATCH');
    }
    return null;
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
