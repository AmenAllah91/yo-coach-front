import { FormBuilder } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let registerService: jasmine.SpyObj<any>;
  let authService: jasmine.SpyObj<any>;

  beforeEach(() => {
    registerService = jasmine.createSpyObj('RegisterService', ['registerUser']);
    authService = jasmine.createSpyObj('AuthService', ['login']);
    authService.login.and.returnValue(Promise.resolve());
    const onboardingService = jasmine.createSpyObj('SubscriptionOnboardingService', ['onboard', 'getPlans']);
    onboardingService.getPlans.and.returnValue(of([]));

    component = new RegisterComponent(
      new FormBuilder(),
      registerService,
      onboardingService,
      authService,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      { use: () => undefined, instant: (key: string) => key } as any,
      { getCurrentLanguage: () => 'en' } as any
    );
    component.ngOnInit();
  });

  it('enforces the username boundaries after trimming', () => {
    const control = component.signupForm.get('username')!;

    control.setValue('aa');
    expect(control.valid).toBeFalse();
    control.setValue('abc');
    expect(control.valid).toBeTrue();
    control.setValue('a'.repeat(50));
    expect(control.valid).toBeTrue();
    control.setValue('a'.repeat(51));
    expect(control.valid).toBeFalse();
    control.setValue('   ');
    expect(control.hasError('required')).toBeTrue();
  });

  it('enforces the first-name and last-name boundaries after trimming', () => {
    for (const field of ['firstName', 'lastName']) {
      const control = component.signupForm.get(field)!;
      control.setValue('a'.repeat(100));
      expect(control.valid).withContext(field).toBeTrue();
      control.setValue('a'.repeat(101));
      expect(control.valid).withContext(field).toBeFalse();
    }
  });

  it('enforces email format and the 254-character boundary', () => {
    const control = component.signupForm.get('email')!;
    const email254 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;

    expect(email254.length).toBe(254);
    control.setValue('not-an-email');
    expect(control.valid).toBeFalse();
    control.setValue(email254);
    expect(control.valid).toBeTrue();
    control.setValue(`${email254}x`);
    expect(control.valid).toBeFalse();
  });

  it('enforces password and confirmation boundaries without restricting characters', () => {
    const password = component.signupForm.get('password')!;
    const confirmation = component.signupForm.get('confirmPassword')!;

    password.setValue('a'.repeat(11));
    expect(password.valid).toBeFalse();
    password.setValue('Letters 123!');
    expect(password.value.length).toBe(12);
    expect(password.valid).toBeTrue();
    password.setValue('a'.repeat(128));
    expect(password.valid).toBeTrue();
    password.setValue('a'.repeat(129));
    expect(password.valid).toBeFalse();

    password.setValue('Letters 123!');
    confirmation.setValue('different123!');
    component.signupForm.updateValueAndValidity();
    expect(confirmation.hasError('mismatch')).toBeTrue();
    confirmation.setValue('Letters 123!');
    component.signupForm.updateValueAndValidity();
    expect(confirmation.valid).toBeTrue();
  });

  it('trims identity fields before sending them', () => {
    registerService.registerUser.and.returnValue(of(undefined));
    component.signupForm.patchValue({
      username: '  coach  ',
      firstName: '  Yo  ',
      lastName: '  Coach  ',
      email: '  coach@example.com  ',
      password: 'Letters 123!',
      confirmPassword: 'Letters 123!'
    });

    component.onSubmit();

    expect(registerService.registerUser).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      login: 'coach',
      firstName: 'Yo',
      lastName: 'Coach',
      email: 'coach@example.com'
    }));
    expect(authService.login).toHaveBeenCalledOnceWith(
      `${window.location.origin}/`,
      'coach'
    );
  });

  it('returns a newly registered coach to onboarding after authentication', () => {
    registerService.registerUser.and.returnValue(of(undefined));
    component.signupForm.patchValue({
      username: 'coach',
      firstName: 'Yo',
      lastName: 'Coach',
      email: 'coach@example.com',
      password: 'Letters 123!',
      confirmPassword: 'Letters 123!',
      isCoach: true
    });

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledOnceWith(
      `${window.location.origin}/coach-onboarding`,
      'coach'
    );
  });

  it('blocks a second create-account request while the first is pending', () => {
    const pending = new Subject<void>();
    registerService.registerUser.and.returnValue(pending);
    component.signupForm.patchValue({
      username: 'coach',
      firstName: 'Yo',
      lastName: 'Coach',
      email: 'coach@example.com',
      password: 'Letters 123!',
      confirmPassword: 'Letters 123!'
    });

    component.onSubmit();
    component.onSubmit();

    expect(registerService.registerUser).toHaveBeenCalledTimes(1);
  });

  it('places exact uniqueness errors under their fields', () => {
    const validValues = {
      username: 'coach',
      firstName: 'Yo',
      lastName: 'Coach',
      email: 'coach@example.com',
      password: 'Letters 123!',
      confirmPassword: 'Letters 123!'
    };

    registerService.registerUser.and.returnValue(
      throwError(() => new Error('This username is already in use.'))
    );
    component.signupForm.patchValue(validValues);
    component.onSubmit();
    expect(component.signupForm.get('username')?.hasError('serverConflict')).toBeTrue();

    registerService.registerUser.and.returnValue(
      throwError(() => new Error('An account already exists with this email.'))
    );
    component.signupForm.patchValue(validValues);
    component.onSubmit();
    expect(component.signupForm.get('email')?.hasError('serverConflict')).toBeTrue();
  });
});
