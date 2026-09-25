import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { CoachOnboardingService } from '../../service/coach-onboarding.service';

async function isCoach(authService: AuthService): Promise<boolean> {
  const roles = await authService.extractRoles();
  return roles.includes('ROLE_COACH');
}

export const coachOnboardingGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const onboarding = inject(CoachOnboardingService);
  const router = inject(Router);

  if (!(await isCoach(authService))) {
    return true;
  }

  try {
    const state = await firstValueFrom(onboarding.load(true));
    return state.completed ? true : router.createUrlTree(['/coach-onboarding']);
  } catch (error) {
    console.error('Unable to verify coach onboarding state', error);
    return router.createUrlTree(['/coach-onboarding']);
  }
};

export const coachOnboardingEntryGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const onboarding = inject(CoachOnboardingService);
  const router = inject(Router);

  if (!(await isCoach(authService))) {
    return router.createUrlTree(['/']);
  }

  try {
    const state = await firstValueFrom(onboarding.load(true));
    return state.completed ? router.createUrlTree(['/coach-dashboard']) : true;
  } catch (error) {
    console.error('Unable to load coach onboarding state', error);
    return true;
  }
};
