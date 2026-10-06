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
  constructor(private http:HttpClient, private auth:AuthService) {}
  get restricted(): boolean { return ['BLOCKED','DISABLED','UNAVAILABLE'].includes(this.state$.value.status); }
  publishIfRefusal(body:any): boolean {
    if (body?.code !== 'COACH_ACCOUNT_UNAVAILABLE') return false;
    ++this.revision;
    this.state$.next({status:['BLOCKED','DISABLED'].includes(body.status) ? body.status : 'UNAVAILABLE',reason:body.reason});
    return true;
  }
  async refresh():Promise<boolean> {
    const revision=++this.revision;
    const roles=this.auth.isLoggedIn() ? await this.auth.extractRoles() : [];
    if(revision !== this.revision) return !this.restricted;
    if(!roles.includes('ROLE_COACH') || roles.includes('ROLE_ADMIN')) { this.state$.next({status:'ACTIVE'}); return true; }
    try {
      const data=await firstValueFrom(this.http.get<AccountAccess>(`${environment.baseApiUrl}/api/account/access`,
        {headers:{'X-Skip-Loader':'true','X-Skip-Toast':'true'}}).pipe(timeout(10000)));
      if(revision === this.revision) this.state$.next(['ACTIVE','BLOCKED','DISABLED'].includes(data.status) ? data : {status:'UNAVAILABLE'});
    } catch { if(revision === this.revision) this.state$.next({status:'UNAVAILABLE'}); }
    return this.state$.value.status === 'ACTIVE';
  }
}
