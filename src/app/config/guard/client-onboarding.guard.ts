import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { ClientOnboardingService } from '../../service/client-onboarding.service';

async function isClientOnly(auth: AuthService): Promise<boolean> {
  const roles = await auth.extractRoles();
  return roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH');
}

export const clientOnboardingGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const service = inject(ClientOnboardingService); const router = inject(Router);
  if (!(await isClientOnly(auth))) return true;
  try { return (await firstValueFrom(service.load(true))).completed ? true : router.createUrlTree(['/client-onboarding']); }
  catch (error) {
    console.error('Unable to verify client onboarding state', error);
    return true;
  }
};

export const clientOnboardingEntryGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const service = inject(ClientOnboardingService); const router = inject(Router);
  if (!(await isClientOnly(auth))) return router.createUrlTree(['/']);
  try { return (await firstValueFrom(service.load(true))).completed ? router.createUrlTree(['/client-dashboard']) : true; }
  catch (error) {
    console.error('Unable to load client onboarding state', error);
    return router.createUrlTree(['/client-dashboard']);
  }
};
