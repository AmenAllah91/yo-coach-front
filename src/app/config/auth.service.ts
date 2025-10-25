import {inject, Injectable} from '@angular/core';
import {KeycloakService} from 'keycloak-angular';
import {from, Observable} from 'rxjs';
import {jwtDecode} from "jwt-decode";
import {environment} from "@env/environment";

export interface AuthConfig {
  redirectUrlLogin: string;
  redirectUrlLogout: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  keycloak:KeycloakService = inject(KeycloakService);

  constructor() {
    if (this.keycloak.isLoggedIn()) {
      this.storeUserInfo();
    }
  }
  storeUserInfo() {
    let token : string ;
    let roles : string[] ;
    let username = this.getUsername();
    let userId= this.getId();
    this.extractUserName().then(u => username = u)
    this.extractUserId().then(u=>userId=u)
    this.getToken().then(t => token = t);
    this.extractRoles().then(userRoles => roles = userRoles)

    this.keycloak.loadUserProfile().then(userProfile => {
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('roles', JSON.stringify(roles));
    });
  }
  public logout(): void {
    this.keycloak.logout(environment.apiUrl).then(()=>{
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('roles');
    });
  }

  login() {
    this.keycloak.login({redirectUri: "http://localhost:4200/#/dashboard/main"}).then();
  }

  getToken(){
    return this.keycloak.getToken()
  }

  isLoggedIn():  boolean {
    return this.keycloak.isLoggedIn();
  }

  getUsername(): string {
    return this.keycloak.getKeycloakInstance()?.profile?.username as string;
  }

  getId(): string {
    return this.keycloak?.getKeycloakInstance()?.profile?.id as string;
  }

  getTokenExpirationDate(): number {
    return (this.keycloak.getKeycloakInstance().refreshTokenParsed as { exp: number })['exp'] as number;
  }

  refresh(): Observable<any> {
    return from(this.keycloak.getKeycloakInstance().updateToken(1800));
  }

  isExpired(): boolean {
    return this.keycloak.getKeycloakInstance().isTokenExpired();
  }

  public async extractUserName(): Promise<any> {
    try {
      const token = await this.getToken();
      const decodedToken = jwtDecode(token);
      const userName = decodedToken['preferred_username'];
      return userName;
    } catch (error) {
      console.error('Erreur lors de l’extraction des rôles:', error);
      return null;
    }
  }
  public async extractUserId(): Promise<any> {
    try {
      const token = await this.getToken();
      const decodedToken = jwtDecode(token);
      return decodedToken['sub'];
    } catch (error) {
      console.error('Erreur lors de l’extraction des rôles:', error);
      return null;
    }
  }
  public async extractRoles(): Promise<string[]> {
    try {
      const token = await this.getToken();
      const decodedToken = jwtDecode(token);
      const realmAccess = decodedToken['realm_access'];
      if (realmAccess && realmAccess['roles']) {
        return  realmAccess['roles'];
      } else {
        return  [];
      }
    } catch (error) {
      console.error('Erreur lors de l’extraction des rôles:', error);
      return [];
    }
  }
  public async updateToken(): Promise<boolean> {
    try {
      return await this.keycloak.updateToken(20);
    } catch (error) {
      console.error('Failed to refresh token', error);
      return false;
    }
  }
}
