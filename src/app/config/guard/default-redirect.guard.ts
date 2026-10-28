import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@config/auth.service';

/**
 * The root URL ("/", where the sign-in and the registration send the user back) has no page of its own: without this
 * redirect the layout opened empty. Each role is sent to its home page.
 */
export const homeRedirectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = await auth.extractRoles();
  if (roles.includes('ROLE_COACH')) return router.createUrlTree(['/coach-dashboard']);
  if (roles.includes('ROLE_CLIENT')) return router.createUrlTree(['/client-dashboard']);
  if (roles.some(role => ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'].includes(role))) return router.createUrlTree(['/admin/dashboard']);
  if (roles.some(role => ['ROLE_SUPPORT', 'ROLE_FINANCE'].includes(role))) return router.createUrlTree(['/admin/coaches']);
  return router.createUrlTree(['/landing-page']);
};
