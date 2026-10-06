import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../config/auth.service';
import { AccountAccessService } from './account-access.service';
import { AccountUnavailableComponent } from '../components/account-unavailable/account-unavailable.component';
import { accountAccessGuard } from '../config/guard/account-access.guard';
import { Router, UrlTree } from '@angular/router';
import { environment } from '@env/environment';

describe('Coach blocked and disabled account experience',()=>{
  let roles:string[];let service:AccountAccessService;let http:HttpTestingController;
  const url=`${environment.baseApiUrl}/api/account/access`;
  beforeEach(()=>{
    roles=['ROLE_COACH'];
    TestBed.configureTestingModule({imports:[HttpClientTestingModule,AccountUnavailableComponent,TranslateModule.forRoot()],
      providers:[provideRouter([]),{provide:AuthService,useValue:{isLoggedIn:()=>true,extractRoles:async()=>roles,logout:jasmine.createSpy('logout')}}]});
    service=TestBed.inject(AccountAccessService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());
  it('checks account access before routing a blocked coach into private pages',fakeAsync(()=>{
    let result:any;Promise.resolve(TestBed.runInInjectionContext(()=>accountAccessGuard({} as any,{} as any))).then(value=>result=value);flushMicrotasks();
    http.expectOne(url).flush({status:'BLOCKED',reason:'PAYMENT_PROBLEM'});flushMicrotasks();
    expect(result instanceof UrlTree).toBeTrue();expect(TestBed.inject(Router).serializeUrl(result)).toBe('/account-unavailable');
    expect(service.state$.value.status).toBe('BLOCKED');
  }));
  it('handles in-session restrictions and shows distinct messages with sign out and retry',()=>{
    const translate=TestBed.inject(TranslateService);translate.setTranslation('en',{
      ACCOUNT_ACCESS_BLOCKED_TITLE:'Your account is blocked',ACCOUNT_ACCESS_BLOCKED_MESSAGE:'Contact YoCoach support.',
      ACCOUNT_ACCESS_DISABLED_TITLE:'Your account is disabled',ACCOUNT_ACCESS_DISABLED_MESSAGE:'Request reactivation.',
      ACCOUNT_ACCESS_RECHECK:'Check again',ACCOUNT_ACCESS_LOGOUT:'Sign out',COACH_REASON_PAYMENT_PROBLEM:'Payment Problem'});translate.use('en');
    service.publishIfRefusal({code:'COACH_ACCOUNT_UNAVAILABLE',status:'BLOCKED',reason:'PAYMENT_PROBLEM'});
    const fixture=TestBed.createComponent(AccountUnavailableComponent);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your account is blocked');expect(fixture.nativeElement.textContent).toContain('Payment Problem');
    expect(fixture.nativeElement.textContent).not.toContain('403');expect(fixture.nativeElement.querySelectorAll('button').length).toBe(2);
    service.publishIfRefusal({code:'COACH_ACCOUNT_UNAVAILABLE',status:'DISABLED'});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your account is disabled');expect(fixture.nativeElement.textContent).not.toContain('Payment Problem');
    fixture.nativeElement.querySelector('.secondary').click();expect(TestBed.inject(AuthService).logout).toHaveBeenCalled();
  });
  it('clears the restriction for admins with coach roles and preserves unrelated 403 errors',fakeAsync(()=>{
    service.publishIfRefusal({code:'COACH_ACCOUNT_UNAVAILABLE',status:'DISABLED'});roles=['ROLE_ADMIN','ROLE_COACH'];
    service.refresh();flushMicrotasks();expect(service.restricted).toBeFalse();http.expectNone(url);
    expect(service.publishIfRefusal({code:'FEATURE_LOCKED'})).toBeFalse();expect(service.restricted).toBeFalse();
  }));
  it('restores active accounts on recheck and distinguishes network failure from a block',fakeAsync(()=>{
    service.refresh();flushMicrotasks();http.expectOne(url).flush({}, {status:503,statusText:'Unavailable'});flushMicrotasks();
    expect(service.state$.value.status).toBe('UNAVAILABLE');
    service.refresh();flushMicrotasks();http.expectOne(url).flush({status:'DISABLED'});flushMicrotasks();expect(service.state$.value.status).toBe('DISABLED');
    service.refresh();flushMicrotasks();http.expectOne(url).flush({status:'ACTIVE'});flushMicrotasks();expect(service.restricted).toBeFalse();
  }));
});
