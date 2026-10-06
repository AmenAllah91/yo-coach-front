import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { AdminBillingComponent } from './admin-billing.component';
import { SalesPlan } from '../../../service/admin-billing.service';

describe('Admin YoSales subscriptions and plans',()=>{
  let mode:string;let http:HttpTestingController;
  const url=`${environment.baseApiUrl}/api/admin`;
  const plan:SalesPlan={id:1,name:'Pro',planCode:'PRO_MONTHLY',description:'Plan',price:20,currency:'TND',billingCycle:'MONTHLY',pricingModel:'FLAT_FEE',fromUnits:0,toUnits:10,freeTrialDays:15,trialMaxClients:5,extraFeePerUnit:0,active:true};
  beforeEach(()=>{mode='subscriptions';TestBed.configureTestingModule({imports:[AdminBillingComponent,HttpClientTestingModule,TranslateModule.forRoot(),FeatherModule.pick(allIcons)],
    providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{get snapshot(){return {data:{mode}};}}}]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  function startPlans(){mode='plans';const f=TestBed.createComponent(AdminBillingComponent);f.detectChanges();http.expectOne(`${url}/plans`).flush([plan]);f.detectChanges();return f;}
  it('loads actual backend statuses, cancellation timing and blocked coach independently; searches and paginates',fakeAsync(()=>{
    const f=TestBed.createComponent(AdminBillingComponent);f.detectChanges();http.expectOne(`${url}/plans`).flush([plan]);
    const row={coachId:'coach1',coachName:'One',email:'one@test',accountStatus:'BANNED',subscription:{id:4,planId:1,planName:'Pro',billingCycle:'YEARLY',start:'2026-10-01T00:00:00Z',end:'2027-10-01T00:00:00Z',status:'ACTIVE',cancelAtPeriodEnd:true}};
    http.expectOne(r=>r.url===`${url}/subscriptions`).flush({content:[row],totalElements:15,page:0,size:10});f.detectChanges();
    const text=f.nativeElement.textContent;expect(text).toContain('COACH_SUB_ACTIVE');expect(text).toContain('COACH_ACCOUNT_BANNED');expect(text).toContain('COACH_CYCLE_YEARLY');expect(text).toContain('BILLING_CANCEL_PERIOD_END');
    expect(f.nativeElement.querySelector('.coach-name').getAttribute('href')).toContain('/admin/coaches/coach1');
    f.componentInstance.search('One');tick(351);http.expectOne(r=>r.params.get('search')==='One').flush({content:[],totalElements:0});
    f.componentInstance.filters.status='TRIAL';f.componentInstance.filters.planId='1';f.componentInstance.filters.account='BANNED';f.componentInstance.apply();
    http.expectOne(r=>r.params.get('status')==='TRIAL'&&r.params.get('planId')==='1'&&r.params.get('account')==='BANNED'&&r.params.get('page')==='0').flush({content:[],totalElements:20});
    f.componentInstance.page(1);http.expectOne(r=>r.params.get('page')==='1').flush({content:[],totalElements:20});
  }));
  it('does not present a billing outage as an empty subscriptions list and retries',()=>{
    const f=TestBed.createComponent(AdminBillingComponent);f.detectChanges();http.expectOne(`${url}/plans`).flush([plan]);http.expectOne(r=>r.url===`${url}/subscriptions`).flush({}, {status:503,statusText:'Unavailable'});f.detectChanges();
    expect(f.nativeElement.textContent).toContain('BILLING_LOAD_ERROR');expect(f.nativeElement.textContent).not.toContain('BILLING_NO_SUBSCRIPTIONS');
    f.componentInstance.load();http.expectOne(r=>r.url===`${url}/subscriptions`).flush({content:[],totalElements:0});f.detectChanges();expect(f.nativeElement.textContent).toContain('BILLING_NO_SUBSCRIPTIONS');
  });
  it('creates a yearly unlimited plan only after confirmation and keeps a failed form available',()=>{
    const f=startPlans();const c=f.componentInstance;c.edit();expect(f.nativeElement.querySelector('dialog').open).toBeTrue();http.expectNone(r=>r.method==='POST');
    c.close();http.expectNone(r=>r.method==='POST');c.edit();c.form.name='Unlimited';c.form.planCode='PRO_YEARLY';c.form.billingCycle='YEARLY';c.form.price=180;c.unlimited=true;
    c.save();c.save();const request=http.expectOne(`${url}/plans`);expect(request.request.method).toBe('POST');expect(request.request.body.toUnits).toBe(2147483647);expect(request.request.body.billingCycle).toBe('YEARLY');
    request.flush({}, {status:409,statusText:'Conflict'});f.detectChanges();expect(c.saveError).toBe('BILLING_CODE_CONFLICT');expect(f.nativeElement.querySelector('dialog').open).toBeTrue();
    c.form.planCode='UNLIMITED_YEARLY';c.save();http.expectOne(`${url}/plans`).flush({...c.form,id:2});http.expectOne(`${url}/plans`).flush([plan,{...c.form,id:2}]);expect(f.nativeElement.querySelector('dialog').open).toBeFalse();
  });
  it('edits existing pricing/trial fields and prevents invalid client limits',()=>{
    const f=startPlans();const c=f.componentInstance;c.edit(plan);c.form.toUnits=0;c.save();http.expectNone(r=>r.method==='PUT');
    c.form.toUnits=20;c.form.trialMaxClients=0;c.save();http.expectNone(r=>r.method==='PUT');c.form.trialMaxClients=8;c.form.price=25;c.save();
    const req=http.expectOne(`${url}/plans/1`);expect(req.request.method).toBe('PUT');expect(req.request.body.trialMaxClients).toBe(8);expect(req.request.body.toUnits).toBe(20);expect(req.request.body.pricingModel).toBe('FLAT_FEE');req.flush(c.form);http.expectOne(`${url}/plans`).flush([c.form]);
  });
  it('confirms deactivate/reactivate without deleting or changing plan properties',()=>{
    const f=startPlans();const c=f.componentInstance;c.toggle(plan);http.expectNone(r=>r.method==='PATCH');c.close();http.expectNone(r=>r.method==='PATCH');
    c.toggle(plan);c.save();let req=http.expectOne(`${url}/plans/1/active`);expect(req.request.body).toEqual({active:false});req.flush({...plan,active:false});http.expectOne(`${url}/plans`).flush([{...plan,active:false}]);
    c.toggle({...plan,active:false});c.save();req=http.expectOne(`${url}/plans/1/active`);expect(req.request.body).toEqual({active:true});req.flush(plan);http.expectOne(`${url}/plans`).flush([plan]);
  });
  it('filters plans by text, status and cycle and exposes a failed plan load',()=>{
    const f=startPlans();const c=f.componentInstance;c.plans.push({...plan,id:2,name:'Yearly',billingCycle:'YEARLY',active:false});c.planCycle='YEARLY';c.planActive='INACTIVE';c.planSearch='Yearly';expect(c.visiblePlans.map(p=>p.id)).toEqual([2]);
    c.loadPlans();http.expectOne(`${url}/plans`).flush({}, {status:503,statusText:'Unavailable'});f.detectChanges();expect(f.nativeElement.textContent).toContain('BILLING_LOAD_ERROR');expect(f.nativeElement.textContent).not.toContain('BILLING_NO_PLANS');
  });
});
