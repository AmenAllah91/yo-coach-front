import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { AdminCoachesComponent } from './admin-coaches.component';
import { AdminCoach } from '../../../service/admin-coaches.service';

describe('Admin coaches flow', () => {
  it('shows server limit warnings and filters all coaches before pagination while preserving detail state',()=>{
    const f=TestBed.createComponent(AdminCoachesComponent);f.detectChanges();http.expectOne(r=>r.url===url).flush(page([{...coach,clientLimitStatus:'NEAR'},{...coach,id:'full',activeClients:10,clientLimitStatus:'REACHED'},{...coach,id:'over',activeClients:11,clientLimitStatus:'EXCEEDED'},{...coach,id:'unlimited',activeClients:35,clientLimitStatus:'UNLIMITED',subscription:{...coach.subscription!,maxActiveClients:null}}]));f.detectChanges();
    const text=f.nativeElement.textContent;expect(text).toContain('COACH_USAGE_NEAR');expect(text).toContain('COACH_USAGE_REACHED');expect(text).toContain('COACH_USAGE_EXCEEDED');expect(text).toContain('35 / COACH_UNLIMITED');
    f.componentInstance.filters.usage='REACHED';f.componentInstance.applyFilters();http.expectOne(r=>r.params.get('usage')==='REACHED'&&r.params.get('page')==='0').flush(page([{...coach,clientLimitStatus:'REACHED',activeClients:10}]));f.detectChanges();
    expect(f.nativeElement.querySelector('.coach-name').getAttribute('href')).toContain('usage=REACHED');
    f.componentInstance.reset();http.expectOne(r=>r.url===url&&!r.params.has('usage')).flush(page([]));
  });
  it('assigns only after plan comparison, reason and confirmation and preserves failure/reconfirmation',()=>{
    detailId='coach-1';const f=TestBed.createComponent(AdminCoachesComponent);f.detectChanges();http.expectOne(`${url}/coach-1`).flush(coach);http.expectOne(`${url}/coach-1/invoices`).flush([]);f.detectChanges();
    const c=f.componentInstance;c.openBillingAction('ASSIGN_PLAN');http.expectOne(`${environment.baseApiUrl}/api/admin/plans`).flush([{id:20,name:'New plan',active:true,price:30,toUnits:20,billingCycle:'MONTHLY'}]);f.detectChanges();
    expect(f.nativeElement.querySelector('#billing-action-title').parentElement.textContent).toContain('Pro');http.expectNone(`${url}/coach-1/subscription/ASSIGN_PLAN`);
    c.newPlanId='20';c.confirmBillingAction();http.expectNone(`${url}/coach-1/subscription/ASSIGN_PLAN`);c.billingReason='Support';c.confirmBillingAction();c.confirmBillingAction();
    const req=http.expectOne(`${url}/coach-1/subscription/ASSIGN_PLAN`);expect(req.request.body.expectedPlanId).toBe(10);expect(req.request.body.newPlanId).toBe(20);expect(req.request.body.reason).toBe('Support');
    req.flush({}, {status:409,statusText:'Conflict'});expect(c.validBillingAction).toBeFalse();c.confirmBillingAction();http.expectNone(`${url}/coach-1/subscription/ASSIGN_PLAN`);c.closeBillingAction();
  });
  it('extends a running trial, previews coach calendar date and reloads real updated state after confirmation',()=>{
    detailId='coach-1';const trial={...coach,trialStatus:'RUNNING',subscription:{...coach.subscription!,status:'TRIAL',trialEndsAt:'2026-10-31T04:00:00Z',currentPeriodStart:null,timeZone:'America/Montreal'}};
    const f=TestBed.createComponent(AdminCoachesComponent);f.detectChanges();http.expectOne(`${url}/coach-1`).flush(trial);http.expectOne(`${url}/coach-1/invoices`).flush([]);f.detectChanges();const c=f.componentInstance;
    c.openBillingAction('EXTEND_TRIAL');expect(c.newTrialDay).toBe('2026-11-07');c.closeBillingAction();http.expectNone(`${url}/coach-1/subscription/EXTEND_TRIAL`);
    c.openBillingAction('EXTEND_TRIAL');c.extendDays=15;c.billingReason='Test extension';c.confirmBillingAction();const req=http.expectOne(`${url}/coach-1/subscription/EXTEND_TRIAL`);expect(req.request.body.days).toBe(15);expect(req.request.body.expectedTrialEnd).toBe(trial.subscription.trialEndsAt);
    req.flush({id:1});http.expectOne(`${url}/coach-1`).flush({...trial,subscription:{...trial.subscription,trialEndsAt:'2026-11-15T05:00:00Z'}});http.expectOne(`${url}/coach-1/invoices`).flush([]);expect(c.coach?.subscription?.trialEndsAt).toBe('2026-11-15T05:00:00Z');expect(c.billingSuccess).toBeTrue();
  });
  it('loads persisted subscription admin history independently from invoice errors and does not allow expired trial extension',()=>{
    detailId='coach-1';const f=TestBed.createComponent(AdminCoachesComponent);f.detectChanges();http.expectOne(`${url}/coach-1`).flush({...coach,subscription:{...coach.subscription!,status:'EXPIRED'}});http.expectOne(`${url}/coach-1/invoices`).flush({}, {status:503,statusText:'Unavailable'});const c=f.componentInstance;
    c.openBillingAction('EXTEND_TRIAL');expect(c.billingAction).toBeNull();c.selectSection('history');http.expectOne(`${url}/coach-1/subscription/history`).flush([{id:1,subscriptionId:1,action:'ASSIGN_PLAN',actor:'admin-id',reason:'Support',oldPlanName:'Old',newPlanName:'New',occurredAt:'2026-10-06T12:00:00Z'}]);f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Support');expect(f.nativeElement.textContent).toContain('admin-id');expect(f.nativeElement.textContent).toContain('Old');expect(f.nativeElement.textContent).toContain('New');
  });
  let http: HttpTestingController;
  let detailId: string | null;
  const url = `${environment.baseApiUrl}/api/admin/coaches`;
  const coach: AdminCoach = { id:'coach-1', name:'Coach One', email:'one@example.test', registeredAt:'2026-10-01T00:00:00Z',
    accountStatus:'ACTIVE', trialStatus:'NONE', activeClients:8, billingAvailable:true,
    subscription:{ subscriptionId:1, status:'ACTIVE', planId:10, planName:'Pro', maxActiveClients:10,
      trialEndsAt:null, trialDaysLeft:null, currentPeriodEnd:null, cancelAtPeriodEnd:false } };
  beforeEach(() => {
    detailId = null;
    TestBed.configureTestingModule({
      imports:[AdminCoachesComponent, HttpClientTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers:[provideRouter([]), {provide:ActivatedRoute, useValue:{get snapshot() {
        return {paramMap:convertToParamMap(detailId ? {id:detailId} : {}), queryParamMap:convertToParamMap({})};
      }}}]
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  const page = (content: AdminCoach[]) => ({content,totalElements:content.length,page:0,size:10,billingAvailable:true,plans:[{id:10,name:'Pro'}]});

  it('loads usage, debounces search, sends account/trial/plan filters and opens the correct detail link', fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(r => r.url === url).flush(page([coach])); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('8 / 10');
    expect(fixture.nativeElement.querySelector('.coach-name').getAttribute('href')).toContain('/admin/coaches/coach-1');
    fixture.componentInstance.search('One'); tick(301);
    http.expectOne(r => r.params.get('search') === 'One').flush(page([coach]));
    fixture.componentInstance.filters.account='ACTIVE'; fixture.componentInstance.filters.trial='RUNNING'; fixture.componentInstance.filters.planId='10';
    fixture.componentInstance.applyFilters();
    http.expectOne(r => r.params.get('account')==='ACTIVE' && r.params.get('trial')==='RUNNING' && r.params.get('planId')==='10').flush(page([]));
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('COACH_EMPTY');
  }));
  it('shows unlimited only for a known subscription and preserves explicit billing errors', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    const unlimited={...coach, subscription:{...coach.subscription!,maxActiveClients:null}};
    http.expectOne(`${url}/coach-1`).flush(unlimited); fixture.detectChanges();
    http.expectOne(`${url}/coach-1/invoices`).flush([]);
    fixture.componentInstance.section='clients'; fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('8 / COACH_UNLIMITED');
    expect(fixture.nativeElement.textContent).toContain('coach-1');
    fixture.componentInstance.refresh();
    http.expectOne(`${url}/coach-1`).flush({...coach,billingAvailable:false,subscription:null,trialStatus:'UNKNOWN'});
    http.expectOne(`${url}/coach-1/invoices`).flush({}, {status:503,statusText:'Unavailable'});
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('COACH_UNAVAILABLE');
    expect(fixture.nativeElement.textContent).not.toContain('COACH_UNLIMITED');
  });
  it('shows real trial dates, plan limits, invoice statuses and recorded events across sections', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(`${url}/coach-1`).flush({...coach,trialStatus:'RUNNING',subscription:{...coach.subscription!,
      status:'TRIAL',billingCycle:'YEARLY',trialStartedAt:'2026-10-01T00:00:00Z',trialEndsAt:'2026-10-15T00:00:00Z',trialDaysLeft:9,trialMaxClients:5,planMaxClients:10,maxActiveClients:5}});
    http.expectOne(`${url}/coach-1/invoices`).flush([{id:42,amount:6.667,currency:'TND',status:'PAID',invoiceDate:'2026-10-01',dueDate:'2026-10-05',planName:'Pro',events:[{id:1,eventType:'PAID',occurredAt:'2026-10-02T12:00:00'}]}]);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('COACH_TRIAL_LIMIT');
    const tabs=fixture.nativeElement.querySelectorAll('.detail-nav button');
    tabs[1].click(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('COACH_CYCLE_YEARLY');
    tabs[2].click(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('6.667 TND'); expect(fixture.nativeElement.textContent).toContain('COACH_INVOICE_PAID');
    tabs[3].click(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('8 / 5');
    tabs[4].click();http.expectOne(`${url}/coach-1/subscription/history`).flush([]); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('COACH_EVENT_PAID'); expect(fixture.nativeElement.textContent).toContain('#42');
  });
  it('keeps list request errors visible and supports retry', () => {
    const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(r=>r.url===url).flush({}, {status:503,statusText:'Unavailable'}); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.componentInstance.refresh(); http.expectOne(r=>r.url===url).flush(page([])); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
  it('keeps the account available when billing history fails and cancels stale requests on refresh', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(`${url}/coach-1`).flush(coach);
    const stale=http.expectOne(`${url}/coach-1/invoices`);
    fixture.componentInstance.refresh(); expect(stale.cancelled).toBeTrue();
    http.expectOne(`${url}/coach-1`).flush(coach);
    http.expectOne(`${url}/coach-1/invoices`).flush({}, {status:503,statusText:'Unavailable'});
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('one@example.test');
    fixture.componentInstance.section='payments'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('COACH_INVOICES_ERROR');
    expect(fixture.nativeElement.textContent).not.toContain('COACH_NO_INVOICES');
  });
  it('requires confirmation, allows cancel, validates Other and records a successful block', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(`${url}/coach-1`).flush(coach); http.expectOne(`${url}/coach-1/invoices`).flush([]); fixture.detectChanges();
    const component=fixture.componentInstance;
    fixture.nativeElement.querySelector('.account-actions button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue(); http.expectNone(`${url}/coach-1/account`);
    component.closeAccountAction(); expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse(); http.expectNone(`${url}/coach-1/account`);
    component.openAccountAction('BLOCK'); component.blockReason='OTHER'; component.blockNote=' '; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.confirm-action').disabled).toBeTrue(); component.confirmAccountAction(); http.expectNone(`${url}/coach-1/account`);
    component.blockNote='Payment under review'; fixture.detectChanges(); fixture.nativeElement.querySelector('.confirm-action').click();
    component.confirmAccountAction(); // double submission ignored
    const request=http.expectOne(`${url}/coach-1/account`); expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({action:'BLOCK',expectedStatus:'ACTIVE',reason:'OTHER',note:'Payment under review'});
    request.flush({...coach,accountStatus:'BANNED',accountHistory:[{action:'BLOCK',previousStatus:'ACTIVE',status:'BANNED',reason:'OTHER',note:'Payment under review',occurredAt:'2026-10-06T10:00:00Z',actor:'admin-id'}]});
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Payment under review');
    expect(component.accountActions).toEqual(['UNBLOCK']);
    component.section='history'; fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('admin-id');
  });
  it('confirms disable, activate and unblock and preserves existing history', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(`${url}/coach-1`).flush(coach); http.expectOne(`${url}/coach-1/invoices`).flush([]); fixture.detectChanges();
    const component=fixture.componentInstance;
    for (const [action,from,to] of [['DISABLE','ACTIVE','DISABLED'],['ACTIVATE','DISABLED','ACTIVE'],['UNBLOCK','BANNED','ACTIVE']] as const) {
      component.coach={...coach,accountStatus:from}; component.openAccountAction(action); http.expectNone(`${url}/coach-1/account`);
      component.confirmAccountAction(); const request=http.expectOne(`${url}/coach-1/account`);
      expect(request.request.body).toEqual({action,expectedStatus:from,reason:null,note:null}); request.flush({...coach,accountStatus:to});
      expect(component.coach!.accountStatus).toBe(to);
    }
  });
  it('keeps mutation errors visible and requires fresh confirmation after a conflict', () => {
    detailId='coach-1'; const fixture=TestBed.createComponent(AdminCoachesComponent); fixture.detectChanges();
    http.expectOne(`${url}/coach-1`).flush(coach); http.expectOne(`${url}/coach-1/invoices`).flush([]); fixture.detectChanges();
    const component=fixture.componentInstance; component.openAccountAction('DISABLE'); component.confirmAccountAction();
    http.expectOne(`${url}/coach-1/account`).flush('Changed',{status:409,statusText:'Conflict'}); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog [role="alert"]').textContent).toContain('COACH_ACTION_CONFLICT');
    expect(component.coach!.accountStatus).toBe('ACTIVE'); expect(component.validAction).toBeFalse();
    component.confirmAccountAction(); http.expectNone(`${url}/coach-1/account`);
    component.refresh(); http.expectOne(`${url}/coach-1`).flush({...coach,accountStatus:'DISABLED'}); http.expectOne(`${url}/coach-1/invoices`).flush([]);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
    component.openAccountAction('ACTIVATE'); component.confirmAccountAction();
    http.expectOne(`${url}/coach-1/account`).flush('Unavailable',{status:503,statusText:'Unavailable'}); fixture.detectChanges();
    expect(component.coach!.accountStatus).toBe('DISABLED'); expect(component.actionError).toBe('COACH_ACTION_ERROR'); component.closeAccountAction();
  });
});
