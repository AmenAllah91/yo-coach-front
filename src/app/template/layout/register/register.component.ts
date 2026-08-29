import {Component, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {RegisterService} from "../../../service/register.service";
import {Router, RouterLink} from "@angular/router";
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {LanguageService} from '../../../service/language.service';
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,TranslateModule,RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit{
  signupForm!: FormGroup;
  usernameError: string | null = null;
  passwordError: string | null = null;
  generalError: string | null = null;

  constructor(private fb: FormBuilder,
              private registerService: RegisterService,
              private router: Router,
              private translate: TranslateService,
              private languageService: LanguageService) {}

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
  }

  passwordMatchValidator(formGroup: AbstractControl): ValidationErrors | null {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword
      ? { passwordMismatch: true }
      : null;
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();

      const password = this.signupForm.get('password')?.value;
      const confirmPassword = this.signupForm.get('confirmPassword')?.value;
      if (password !== confirmPassword) {
        this.passwordError = this.translate.instant('PASSWORDS_DO_NOT_MATCH');
      } else {
        this.passwordError = null;
      }
      return;
    }

    this.usernameError = null;
    this.passwordError = null;
    this.generalError = null;

    const formValues = this.signupForm.value;
    const user = {
      login:formValues.username,
      email:formValues.email,
      password:formValues.password,
      firstName: formValues.firstName,
      lastName:formValues.lastName,
      authorities: [
        formValues.isCoach ? "ROLE_COACH" : "ROLE_CLIENT"
      ]
    }
    this.registerService.registerUser(user).subscribe({
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
}
