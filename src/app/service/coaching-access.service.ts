import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '../config/auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoachingAccessService {
  readonly blocked$ = new BehaviorSubject(false);
  private revision = 0;
  constructor(private http: HttpClient, private auth: AuthService) {}

  private clientOnly(roles: string[]): boolean {
    return roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH') && !roles.includes('ROLE_ADMIN');
  }

  /** An error about a target client must never disable the coach/admin who received it. */
  async markClientArchived(): Promise<void> {
    const revision = ++this.revision;
    const roles = this.auth.isLoggedIn() ? await this.auth.extractRoles() : [];
    if (revision === this.revision) this.blocked$.next(this.clientOnly(roles));
  }

  async refresh(): Promise<boolean> {
    const revision = ++this.revision;
    if (!this.auth.isLoggedIn()) { this.blocked$.next(false); return true; }
    const roles = await this.auth.extractRoles();
    if (revision !== this.revision) return !this.blocked$.value;
    if (!this.clientOnly(roles)) { this.blocked$.next(false); return true; }
    try {
      const result = await firstValueFrom(this.http.get<{status: string}>(
        `${environment.baseApiUrl}/gym_coaching/clients/access`,
        { headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } }));
      const active = result.status === 'ACTIVE';
      if (revision !== this.revision) return !this.blocked$.value;
      this.blocked$.next(!active);
      return active;
    } catch {
      // Cached coaching content must not be exposed when access cannot be verified.
      if (revision === this.revision) this.blocked$.next(true);
      return !this.blocked$.value;
    }
  }
}
