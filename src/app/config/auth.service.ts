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
    this.initUserInfo();
  }

  private async initUserInfo() {
    const loggedIn = await this.keycloak.isLoggedIn();
    if (loggedIn) {
      await this.storeUserInfo();
    }
  }

  async storeUserInfo() {
    try {
      const profile = await this.keycloak.loadUserProfile();
      const token = await this.keycloak.getToken();
      const decoded: any = jwtDecode(token);

      const username = decoded.preferred_username;
      const userId = decoded.sub;
      const roles = decoded.realm_access?.roles || [];

      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('roles', JSON.stringify(roles));

      console.log('User info stored:', { username, userId, roles });

    } catch (err) {
      console.error('Failed to store user info', err);
    }
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
    const token = this.keycloak.getToken();
    console.log('AuthService - getToken called, token exists:', !!token);
    return token;
  }


  async isLoggedIn(): Promise<boolean> {
    return await this.keycloak.isLoggedIn();
  }

  getUsername(): string {
    return this.keycloak.getKeycloakInstance()?.profile?.username as string;
  }

  public async getId(): Promise<string | null> {
    try {
      const token = await this.keycloak.getToken();
      if (!token) return null;

      const decoded: any = jwtDecode(token);
      return decoded.sub || null;
    } catch (err) {
      console.error('Failed to decode token for user ID', err);
      return null;
    }
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
