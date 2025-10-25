import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {RegisterService} from "../../../service/register.service";
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit{
  signupForm!: FormGroup;
  usernameError: string | null = null;
  passwordError: string | null = null;
  generalError: string | null = null;

  constructor(private fb: FormBuilder,private registerService: RegisterService) {}

  ngOnInit(): void {
    this.signupForm = this.fb.group({
      username: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(formGroup: FormGroup): void {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');

    if (confirmPassword?.value && password?.value !== confirmPassword.value) {
      confirmPassword.setErrors({ mismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();

      const password = this.signupForm.get('password')?.value;
      const confirmPassword = this.signupForm.get('confirmPassword')?.value;
      if (password !== confirmPassword) {
        this.passwordError = 'Passwords do not match!';
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
        "ROLE_CLIENT"
      ]
    }
    this.registerService.registerUser(user).subscribe({
      next: (response) => {
        alert('Registration successful!');
        console.log('User registered successfully:', response);
      },
      error: (error) => {
        if (error.message.includes('already exists')) {
          this.generalError = error.message;
        } else {
          this.generalError = 'An unexpected error occurred. Please try again.';
        }
        console.error('Registration error:', error);
      }
    });
  }
  getFieldError(controlName: string): string | null {
    const control = this.signupForm.get(controlName);
    if (control?.hasError('required')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required.`;
    }
    if (control?.hasError('email')) {
      return 'Invalid email format.';
    }
    if (control?.hasError('minlength')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be at least ${control.errors?.['minlength'].requiredLength} characters.`;
    }
    if (controlName === 'confirmPassword' && control?.touched && control?.hasError('mismatch')) {
      return 'Passwords do not match!';
    }
    return null;
  }
}
