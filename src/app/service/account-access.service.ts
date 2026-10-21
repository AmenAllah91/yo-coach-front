import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../config/auth.service';
import { environment } from '@env/environment';

export interface AccountAccess { status: 'ACTIVE' | 'CHECKING' | 'BLOCKED' | 'DISABLED' | 'UNAVAILABLE'; reason?: string | null; }
@Injectable({providedIn:'root'})
export class AccountAccessService {
  readonly state$ = new BehaviorSubject<AccountAccess>({status:'ACTIVE'});
  private revision = 0;
  /** Time of the last answer from the server (a failed check is not kept). */
  private checkedAt = 0;
  constructor(private http:HttpClient, private auth:AuthService) {}
  /**
   * For the route guards. The app checks again every 30 s, on window focus and on any refusal from the server
   * (publishIfRefusal), so a page change reuses an answer under a minute old instead of waiting for the server.
   */
  async allowed(maxAgeMs = 60000): Promise<boolean> {
    if (Date.now() - this.checkedAt < maxAgeMs) return this.state$.value.status === 'ACTIVE';
    return this.refresh();
  }
  get restricted(): boolean { return ['BLOCKED','DISABLED','UNAVAILABLE'].includes(this.state$.value.status); }
  publishIfRefusal(body:any): boolean {
    if (body?.code !== 'COACH_ACCOUNT_UNAVAILABLE') return false;
    ++this.revision;
    this.checkedAt = Date.now();
    this.state$.next({status:['BLOCKED','DISABLED'].includes(body.status) ? body.status : 'UNAVAILABLE',reason:body.reason});
    return true;
  }
  async refresh():Promise<boolean> {
    const revision=++this.revision;
    const roles=this.auth.isLoggedIn() ? await this.auth.extractRoles() : [];
    if(revision !== this.revision) return !this.restricted;
    if(!roles.includes('ROLE_COACH') || roles.includes('ROLE_ADMIN') || roles.includes('ROLE_SUPER_ADMIN')) { this.state$.next({status:'ACTIVE'}); this.checkedAt = Date.now(); return true; }
    try {
      const data=await firstValueFrom(this.http.get<AccountAccess>(`${environment.baseApiUrl}/api/account/access`,
        {headers:{'X-Skip-Loader':'true','X-Skip-Toast':'true'}}).pipe(timeout(10000)));
      if(revision === this.revision) {
        this.state$.next(['ACTIVE','BLOCKED','DISABLED'].includes(data.status) ? data : {status:'UNAVAILABLE'});
        this.checkedAt = Date.now();
      }
    } catch { if(revision === this.revision) { this.state$.next({status:'UNAVAILABLE'}); this.checkedAt = 0; } }
    return this.state$.value.status === 'ACTIVE';
  }
}
