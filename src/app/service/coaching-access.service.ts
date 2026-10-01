import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '../config/auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoachingAccessService {
  readonly blocked$ = new BehaviorSubject(false);
  constructor(private http: HttpClient, private auth: AuthService) {}

  async refresh(): Promise<boolean> {
    if (!this.auth.isLoggedIn()) { this.blocked$.next(false); return true; }
    const roles = await this.auth.extractRoles();
    if (!roles.includes('ROLE_CLIENT') || roles.includes('ROLE_COACH')) return true;
    try {
      const result = await firstValueFrom(this.http.get<{status: string}>(
        `${environment.baseApiUrl}/gym_coaching/clients/access`,
        { headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } }));
      const active = result.status === 'ACTIVE';
      this.blocked$.next(!active);
      return active;
    } catch {
      // Cached coaching content must not be exposed when access cannot be verified.
      this.blocked$.next(true);
      return false;
    }
  }
}
