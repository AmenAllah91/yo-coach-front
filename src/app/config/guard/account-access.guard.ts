import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountAccessService } from '../../service/account-access.service';
export const accountAccessGuard:CanActivateFn=async()=>{
  const access=inject(AccountAccessService); const router=inject(Router);
  return await access.refresh() ? true : router.createUrlTree(['/account-unavailable']);
};
