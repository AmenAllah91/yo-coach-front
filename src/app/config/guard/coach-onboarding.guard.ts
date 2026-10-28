import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { CoachOnboardingService } from '../../service/coach-onboarding.service';

async function isCoach(authService: AuthService): Promise<boolean> {
  const roles = await authService.extractRoles();
  return roles.includes('ROLE_COACH');
}

/**
 * Payment audit CE-M7: pages reached from a payment (the "Pay my invoice" link of an email, the return of the payment
 * page) open even when the onboarding is not finished; the onboarding would otherwise swallow the link.
 */
export function isOnboardingFree(url: string | null | undefined): boolean {
  const path = (url ?? '').split(/[?#]/)[0];
  return path === '/billing/pay' || path.startsWith('/billing/pay/') || path.startsWith('/payment/');
}

export const coachOnboardingGuard: CanActivateFn = async (_route, routerState) => {
  const authService = inject(AuthService);
  const onboarding = inject(CoachOnboardingService);
  const router = inject(Router);

  if (!(await isCoach(authService))) {
    return true;
  }
  if (isOnboardingFree(routerState?.url)) {
    return true;
  }

  try {
    const state = await firstValueFrom(onboarding.load(true));
    return state.completed ? true : router.createUrlTree(['/coach-onboarding']);
  } catch (error) {
    console.error('Unable to verify coach onboarding state', error);
    return true;
  }
};

/**
 * Payment audit CE-M7, review 2026-10-26: the layout guard above runs once, when the layout opens. A coach who came in
 * through a payment page and then moves to another page of the app is checked here (cached state: no extra call
 * once known), so the payment pages are the only ones open during an unfinished onboarding.
 */
export const coachOnboardingChildGuard: CanActivateChildFn = async (_route, routerState) => {
  if (isOnboardingFree(routerState?.url)) {
    return true;
  }
  const authService = inject(AuthService);
  const onboarding = inject(CoachOnboardingService);
  const router = inject(Router);
  if (!(await isCoach(authService))) {
    return true;
  }
  try {
    const state = await firstValueFrom(onboarding.load());
    return state.completed ? true : router.createUrlTree(['/coach-onboarding']);
  } catch (error) {
    console.error('Unable to verify coach onboarding state', error);
    return true;
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
    return router.createUrlTree(['/coach-dashboard']);
  }
};
