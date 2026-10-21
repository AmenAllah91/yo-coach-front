import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CoachingAccessService } from '../../service/coaching-access.service';

export const coachingAccessGuard: CanActivateFn = async () => {
  const access = inject(CoachingAccessService);
  const router = inject(Router);
  return await access.allowed() ? true : router.createUrlTree(['/coaching-unavailable']);
};
