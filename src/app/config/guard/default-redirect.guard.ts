import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '@config/auth.service';

@Injectable({
  providedIn: 'root'
})
export class DefaultRedirectGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    const userRoles = await this.authService.extractRoles();
    const waitForUserId = (): Promise<string> => {
      return new Promise((resolve) => {
        const check = () => {
          const id = localStorage.getItem('userId');
          if (id) {
            resolve(id);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    const userId = await waitForUserId();

    if (userRoles.some(role => ['ROLE_ADMIN','ROLE_SUPER_ADMIN','ROLE_AGENT'].includes(role))) {
      await this.router.navigate(['administration/clients']);
    } else {
      await this.router.navigate(['edit-profile', userId]);
    }

    return false;
  }

}
