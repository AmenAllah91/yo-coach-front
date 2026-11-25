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
  /** Blocked because the server could not be reached (no answer), not because the coach archived the client. */
  readonly unreachable$ = new BehaviorSubject(false);
  private revision = 0;
  /** The last answer of the server in this session: access granted, refused, or no answer yet. */
  private lastAnswer: 'ACTIVE' | 'REFUSED' | null = null;
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
    if (revision === this.revision) {
      this.blocked$.next(this.clientOnly(roles)); this.noCoach$.next(false); this.unreachable$.next(false);
      this.lastAnswer = 'REFUSED'; this.checkedAt = Date.now();
    }
  }

  async refresh(): Promise<boolean> {
    const revision = ++this.revision;
    if (!this.auth.isLoggedIn()) {
      this.blocked$.next(false); this.noCoach$.next(false); this.unreachable$.next(false);
      this.lastAnswer = null; this.checkedAt = 0; return true;
    }
    const roles = await this.auth.extractRoles();
    if (revision !== this.revision) return !this.blocked$.value;
    if (!this.clientOnly(roles)) {
      this.blocked$.next(false); this.noCoach$.next(false); this.unreachable$.next(false); this.checkedAt = Date.now(); return true;
    }
    try {
      const result = await firstValueFrom(this.http.get<{status: string; coachId?: string}>(
        `${environment.baseApiUrl}/gym_coaching/clients/access`,
        { headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } }));
      const active = result.status === 'ACTIVE';
      if (revision !== this.revision) return !this.blocked$.value;
      this.blocked$.next(!active);
      this.unreachable$.next(false);
      this.lastAnswer = active ? 'ACTIVE' : 'REFUSED';
      // The server always sends coachId: empty = a client account without a coach yet.
      this.noCoach$.next(active && result.coachId === '');
      this.checkedAt = Date.now();
      return active;
    } catch {
      // No answer (Wi-Fi down, server restarting during a deployment) is not « archived by your coach »
      // (2026-11-23). Access granted earlier in this session stays as it was: the next check (30 s, focus, page
      // change) asks again; so does a refusal. Never answered yet: nothing is shown, and the page says the server
      // cannot be reached.
      if (revision === this.revision) {
        this.checkedAt = 0;
        if (this.lastAnswer === null) { this.blocked$.next(true); this.unreachable$.next(true); }
      }
      return !this.blocked$.value;
    }
  }
}
