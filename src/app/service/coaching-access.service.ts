import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '../config/auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoachingAccessService {
  readonly blocked$ = new BehaviorSubject(false);
  /** A client account with no coach yet (request waiting for an answer, or none): sent to the waiting page. */
  readonly noCoach$ = new BehaviorSubject(false);
  private revision = 0;
  /** Time of the last answer (a failed check is not kept). */
  private checkedAt = 0;
  constructor(private http: HttpClient, private auth: AuthService) {}

  /**
   * For the route guards. The app checks again every 30 s, on window focus and when the server reports an archived
   * client, so a page change reuses an answer under a minute old instead of waiting for the server.
   */
  async allowed(maxAgeMs = 60000): Promise<boolean> {
    if (Date.now() - this.checkedAt < maxAgeMs) return !this.blocked$.value;
    return this.refresh();
  }

  private clientOnly(roles: string[]): boolean {
    return roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH') && !roles.includes('ROLE_ADMIN');
  }

  /** An error about a target client must never disable the coach/admin who received it. */
  async markClientArchived(): Promise<void> {
    const revision = ++this.revision;
    const roles = this.auth.isLoggedIn() ? await this.auth.extractRoles() : [];
    if (revision === this.revision) { this.blocked$.next(this.clientOnly(roles)); this.noCoach$.next(false); this.checkedAt = Date.now(); }
  }

  async refresh(): Promise<boolean> {
    const revision = ++this.revision;
    if (!this.auth.isLoggedIn()) { this.blocked$.next(false); this.noCoach$.next(false); this.checkedAt = 0; return true; }
    const roles = await this.auth.extractRoles();
    if (revision !== this.revision) return !this.blocked$.value;
    if (!this.clientOnly(roles)) { this.blocked$.next(false); this.noCoach$.next(false); this.checkedAt = Date.now(); return true; }
    try {
      const result = await firstValueFrom(this.http.get<{status: string; coachId?: string}>(
        `${environment.baseApiUrl}/gym_coaching/clients/access`,
        { headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } }));
      const active = result.status === 'ACTIVE';
      if (revision !== this.revision) return !this.blocked$.value;
      this.blocked$.next(!active);
      // The server always sends coachId: empty = a client account without a coach yet.
      this.noCoach$.next(active && result.coachId === '');
      this.checkedAt = Date.now();
      return active;
    } catch {
      // Cached coaching content must not be exposed when access cannot be verified.
      if (revision === this.revision) { this.blocked$.next(true); this.checkedAt = 0; }
      return !this.blocked$.value;
    }
  }
}
