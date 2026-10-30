import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CoachingAccessService } from '../../service/coaching-access.service';

export const coachingAccessGuard: CanActivateFn = async () => {
  const access = inject(CoachingAccessService);
  const router = inject(Router);
  if (!(await access.allowed())) return router.createUrlTree(['/coaching-unavailable']);
  // A client without a coach yet waits for the answer to their request (sign-up link, waiting list).
  return access.noCoach$.value ? router.createUrlTree(['/join-pending']) : true;
};
