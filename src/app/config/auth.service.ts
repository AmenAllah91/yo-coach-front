import {inject, Injectable} from '@angular/core';
import {KeycloakService} from 'keycloak-angular';
import {from, Observable} from 'rxjs';
import {jwtDecode} from "jwt-decode";
import {environment} from "@env/environment";

export interface AuthConfig {
  redirectUrlLogin: string;
  redirectUrlLogout: string;
}
function isPublicCoachHostname(host: string): boolean {
  if (!host) return false;

  const normalized = host.toLowerCase();

  if (normalized === 'localhost' || normalized.startsWith('localhost:')) {
    return false;
  }

  if (normalized === 'integration.yo-coach.app' || normalized === 'www.integration.yo-coach.app') {
    return false;
  }

  if (normalized === 'account.yo-coach.app' || normalized === 'www.account.yo-coach.app') {
    return false;
  }

  if (normalized === 'login.yo-coach.app' || normalized === 'www.login.yo-coach.app') {
    return false;
  }

  if (normalized === 'login-int.yo-coach.app' || normalized === 'www.login-int.yo-coach.app') {
    return false;
  }

  if (normalized === 'minio.yo-coach.app' || normalized === 'www.minio.yo-coach.app') {
    return false;
  }

  if (normalized === 'minio-console.yo-coach.app' || normalized === 'www.minio-console.yo-coach.app') {
    return false;
  }

  if (normalized === 'minio-console-int.yo-coach.app' || normalized === 'www.minio-console-int.yo-coach.app') {
    return false;
  }

  if (normalized === 'yo-coach.app' || normalized === 'www.yo-coach.app') {
    return false;
  }

  return normalized.endsWith('.yo-coach.app');
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  keycloak:KeycloakService = inject(KeycloakService);

  constructor() {
    const host = window.location.hostname;

    if (!isPublicCoachHostname(host)) {
      this.initUserInfo();
    } else {
      console.log('Public site detected → skip auth');
    }
  }

  private async initUserInfo() {
    const loggedIn = await this.keycloak.isLoggedIn();
    if (loggedIn) {
      await this.storeUserInfo();
    }
  }

  async storeUserInfo() {
    if (!this.isAuthEnabled()) return;

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

    } catch (err) {
      console.error('Failed to store user info', err);
    }
  }  public logout(): void {
    this.keycloak.logout(environment.apiUrl).then(()=>{
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('roles');
    });
  }

  login() {
    this.keycloak.login({redirectUri: "http://localhost:4200/#/dashboard/main"}).then();
  }

  async getToken(): Promise<string | null> {
    if (!this.isAuthEnabled()) return null;

    return await this.keycloak.getToken();
  }

  isLoggedIn():  boolean {
    const loggedIn = this.keycloak.isLoggedIn();
    console.log('AuthService - isLoggedIn:', loggedIn);
    return loggedIn;
  }

  getUsername(): string {
    return this.keycloak.getKeycloakInstance()?.profile?.username as string;
  }

  async getCurrentUserDetails(): Promise<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const decoded: any = jwtDecode(token);
      const profile: any = this.keycloak.getKeycloakInstance()?.profile || {};

      return {
        id: decoded.sub || '',
        username: decoded.preferred_username || profile.username || '',
        firstName: decoded.given_name || profile.firstName || '',
        lastName: decoded.family_name || profile.lastName || '',
        email: decoded.email || profile.email || '',
      };
    } catch (err) {
      console.error('Failed to load current user details', err);
      return null;
    }
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


  private isAuthEnabled(): boolean {
    const host = window.location.hostname;
    return !isPublicCoachHostname(host);
  }
}
