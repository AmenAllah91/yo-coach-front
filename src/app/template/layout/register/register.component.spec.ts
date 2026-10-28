import { FormBuilder } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let registerService: jasmine.SpyObj<any>;
  let authService: jasmine.SpyObj<any>;
  let onboardingService: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;

  function create(query: Record<string, string>): RegisterComponent {
    const created = new RegisterComponent(
      new FormBuilder(),
      registerService,
      onboardingService,
      authService,
      { snapshot: { queryParamMap: { get: (key: string) => query[key] ?? null } } } as any,
      router,
      { use: () => undefined, instant: (key: string) => key } as any,
      { getCurrentLanguage: () => 'en' } as any
    );
    created.ngOnInit();
    return created;
  }

  beforeEach(() => {
    registerService = jasmine.createSpyObj('RegisterService', ['registerUser']);
    authService = jasmine.createSpyObj('AuthService', ['login']);
    authService.login.and.returnValue(Promise.resolve());
    onboardingService = jasmine.createSpyObj('SubscriptionOnboardingService', ['onboard', 'getPlans']);
    onboardingService.getPlans.and.returnValue(of([]));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));

    // By default an invited client: the only sign-up without a plan.
    component = create({ invitationToken: 'tok' });
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
      email: 'coach@example.com',
      authorities: ['ROLE_CLIENT']
    }));
    expect(authService.login).toHaveBeenCalledOnceWith(
      `${window.location.origin}/invitation/tok?accept=1`,
      'coach'
    );
  });

  it('sends a coach without a plan to the plan choice instead of creating an account', () => {
    component = create({});
    expect(router.navigate).toHaveBeenCalledWith(['/plans-landing'], { replaceUrl: true });
    component.signupForm.patchValue({
      username: 'coach', firstName: 'Yo', lastName: 'Coach', email: 'coach@example.com',
      password: 'Letters 123!', confirmPassword: 'Letters 123!'
    });

    component.onSubmit();

    expect(registerService.registerUser).not.toHaveBeenCalled();
    expect(onboardingService.onboard).not.toHaveBeenCalled();
  });

  it('registers a coach with their plan and returns them to onboarding after authentication', () => {
    onboardingService.onboard.and.returnValue(of({}));
    component = create({ planId: '42' });
    component.signupForm.patchValue({
      username: 'coach',
      firstName: 'Yo',
      lastName: 'Coach',
      email: 'coach@example.com',
      password: 'Letters 123!',
      confirmPassword: 'Letters 123!'
    });

    component.onSubmit();

    expect(registerService.registerUser).not.toHaveBeenCalled();
    expect(onboardingService.onboard).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      planId: 42,
      user: jasmine.objectContaining({ authorities: ['ROLE_COACH'] })
    }));

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

  describe('refusal codes, read before the generic 409 / 429', () => {
    const coach = {
      username: 'coach', firstName: 'Yo', lastName: 'Coach', email: 'coach@example.com',
      password: 'Letters 123!', confirmPassword: 'Letters 123!'
    };

    function submitWith(error: unknown): RegisterComponent {
      onboardingService.onboard.and.returnValue(throwError(() => error));
      const c = create({ planId: '42' });
      c.signupForm.patchValue(coach);
      c.onSubmit();
      return c;
    }

    it('a plan no longer offered (409 PLAN_ARCHIVED) is not shown as an existing account', () => {
      const c = submitWith({ status: 409, error: { code: 'PLAN_ARCHIVED', error: 'This plan is no longer offered.' } });
      expect(c.generalError).toBe('CHECKOUT_PLAN_ARCHIVED');
    });

    it('too many sign-ups from the network (429) asks to try again later', () => {
      expect(submitWith({ status: 429, error: { code: 'TOO_MANY_SIGN_UPS' } }).generalError).toBe('PLEASE_TRY_AGAIN_LATER');
      expect(submitWith({ status: 429, error: null }).generalError).toBe('PLEASE_TRY_AGAIN_LATER');
    });

    it('USERNAME_TAKEN goes under the username field', () => {
      const c = submitWith({ status: 409, error: { code: 'USERNAME_TAKEN', error: 'Taken' } });
      expect(c.usernameError).toBe('USERNAME_ALREADY_IN_USE');
      expect(c.signupForm.get('username')?.hasError('serverConflict')).toBeTrue();
    });

    it('a 409 without code stays an existing account; an unknown code gets the generic error', () => {
      expect(submitWith({ status: 409, error: { error: 'A user with this username or email already exists' } }).generalError)
        .toBe('USER_ALREADY_EXISTS');
      expect(submitWith({ status: 409, error: { code: 'SUBSCRIPTION_ALREADY_RUNNING' } }).generalError)
        .toBe('UNEXPECTED_ERROR_RETRY');
    });
  });
});
