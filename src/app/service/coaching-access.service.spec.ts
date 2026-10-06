import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { throwError } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '../config/auth.service';
import { AuthInterceptor } from '../config/AuthInterceptor';
import { CoachingAccessService } from './coaching-access.service';

describe('Client access isolation from admin and coach sessions', () => {
  let service: CoachingAccessService;
  let http: HttpTestingController;
  let roles: string[];
  let loggedIn: boolean;
  let auth: any;
  const url=`${environment.baseApiUrl}/gym_coaching/clients/access`;
  beforeEach(() => {
    roles=['ROLE_CLIENT']; loggedIn=true;
    auth={isLoggedIn:()=>loggedIn, extractRoles:()=>Promise.resolve(roles), getToken:()=>Promise.resolve('test')};
    TestBed.configureTestingModule({imports:[HttpClientTestingModule],providers:[{provide:AuthService,useValue:auth}]});
    service=TestBed.inject(CoachingAccessService); http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());

  it('clears stale blocking for admins, including accounts with a client or coach role, without querying client access', fakeAsync(()=>{
    for (const value of [['ROLE_ADMIN'],['ROLE_ADMIN','ROLE_CLIENT'],['ROLE_ADMIN','ROLE_COACH','ROLE_CLIENT'],['ROLE_COACH','ROLE_CLIENT']]) {
      roles=value; service.blocked$.next(true);
      let allowed=false; service.refresh().then(value=>allowed=value); flushMicrotasks();
      expect(allowed).toBeTrue(); expect(service.blocked$.value).toBeFalse(); http.expectNone(url);
    }
  }));
  it('still denies archived clients and verification failures, then restores reactivated clients', fakeAsync(()=>{
    let allowed=true;
    service.refresh().then(value=>allowed=value); flushMicrotasks(); http.expectOne(url).flush({status:'ARCHIVED'}); flushMicrotasks();
    expect(allowed).toBeFalse(); expect(service.blocked$.value).toBeTrue();
    service.refresh(); flushMicrotasks(); http.expectOne(url).flush({}, {status:503,statusText:'Unavailable'}); flushMicrotasks(); expect(service.blocked$.value).toBeTrue();
    service.refresh().then(value=>allowed=value); flushMicrotasks(); http.expectOne(url).flush({status:'ACTIVE'}); flushMicrotasks();
    expect(allowed).toBeTrue(); expect(service.blocked$.value).toBeFalse();
  }));
  it('ignores a pending client response after the session becomes admin', fakeAsync(()=>{
    service.refresh(); flushMicrotasks(); const pending=http.expectOne(url);
    roles=['ROLE_ADMIN','ROLE_CLIENT']; service.refresh(); flushMicrotasks(); expect(service.blocked$.value).toBeFalse();
    pending.flush({status:'ARCHIVED'}); flushMicrotasks(); expect(service.blocked$.value).toBeFalse();
  }));
  it('does not replace the admin or coach interface when a request returns CLIENT_ARCHIVED', fakeAsync(()=>{
    const interceptor=new AuthInterceptor({show:()=>{},hide:()=>{}} as any,{error:()=>{}} as any,service,auth,
      {publishIfSubscriptionRefusal:()=>false} as any,{publishIfRefusal:()=>false} as any);
    const error=new HttpErrorResponse({status:403,error:{code:'CLIENT_ARCHIVED'}});
    for (const value of [['ROLE_ADMIN','ROLE_CLIENT'],['ROLE_COACH','ROLE_CLIENT'],['ROLE_CLIENT']]) {
      roles=value; service.blocked$.next(false); let received:unknown;
      interceptor.intercept(new HttpRequest('GET','/api/admin/coaches/example'),{handle:()=>throwError(()=>error)})
        .subscribe({error:value=>received=value}); flushMicrotasks();
      expect(received).toBe(error); expect(service.blocked$.value).toBe(value.length===1);
    }
  }));
  it('clears blocking on logout', fakeAsync(()=>{
    service.blocked$.next(true); loggedIn=false; service.refresh(); flushMicrotasks();
    expect(service.blocked$.value).toBeFalse(); http.expectNone(url);
  }));
});
