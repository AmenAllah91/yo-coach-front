import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@config/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = await auth.extractRoles();
  if (roles.includes('ROLE_ADMIN')) return true;
  return router.createUrlTree([roles.includes('ROLE_COACH') ? '/coach-dashboard'
    : roles.includes('ROLE_CLIENT') ? '/client-dashboard' : '/landing-page']);
};
