import {inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, RouterStateSnapshot, Router, CanActivateFn} from '@angular/router';
import {KeycloakAuthGuard, KeycloakService} from 'keycloak-angular';
import {AuthService} from "@config/auth.service";

@Injectable({
  providedIn: 'root',
})
export class AuthGuard extends KeycloakAuthGuard {
  constructor(
    protected override readonly router: Router,
    private readonly keycloak: KeycloakService,
    private readonly authService: AuthService) {
    super(router, keycloak);
  }
  public  isRoleAllowed: CanActivateFn = async (route, state) => {
    const authService = inject(AuthService);
    const requiredRoles: string[] = route.data['roles'] || [];
    if (requiredRoles.length === 0) {
      return true;
    }
    const userRoles = await authService.extractRoles();
    const hasAccess = requiredRoles.some(role => userRoles.includes(role));
    if (hasAccess) {
      return true;
    } else {
      await this.router.navigate(['unauthorized']);
      return false;
    }
  };


  public async isAccessAllowed(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    const authenticated = this.keycloak.getKeycloakInstance().authenticated;
    if (!authenticated) {
      await this.authService.login(window.location.origin + state.url);
      return false;
    }

    const requiredRoles = route.data['rollen'];

    if (!(requiredRoles instanceof Array) || requiredRoles.length === 0) {
      return true;
    }

    return requiredRoles.every((role) => this.roles.includes(role));
  }

}
