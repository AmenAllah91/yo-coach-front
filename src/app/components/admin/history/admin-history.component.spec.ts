import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { AdminHistoryComponent } from './admin-history.component';
describe('Admin history flow',()=>{
  let http:HttpTestingController;const url=`${environment.baseApiUrl}/api/admin/history`;
  const event={id:'account:1',action:'BLOCK',actor:'admin-id',adminName:'Admin Name',coachId:'coach-id',coachName:'Coach Name',email:'coach@example.test',planId:null,planName:null,occurredAt:'2026-10-06T12:00:00Z',reason:'Support',oldValues:{accountStatus:'ACTIVE'},newValues:{accountStatus:'BANNED'}};
  const page=(rows:any[])=>({content:rows,totalElements:rows.length,page:0,size:10,billingAvailable:true});
  beforeEach(()=>{TestBed.configureTestingModule({imports:[AdminHistoryComponent,HttpClientTestingModule,TranslateModule.forRoot(),FeatherModule.pick(allIcons)],providers:[provideRouter([])]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('shows persisted actor target before and after values and links to coach detail',()=>{
    const f=TestBed.createComponent(AdminHistoryComponent);f.detectChanges();http.expectOne(r=>r.url===url).flush(page([event]));f.detectChanges();
    for(const text of ['Admin Name','admin-id','Coach Name','coach-id','Support','ADMIN_HISTORY_BLOCK','COACH_ACCOUNT_ACTIVE','COACH_ACCOUNT_BANNED'])expect(f.nativeElement.textContent).toContain(text);
    expect(f.nativeElement.querySelector('.coach-name').getAttribute('href')).toBe('/admin/coaches/coach-id');
    expect(f.componentInstance.changes({...event,oldValues:{price:'20',name:'Pro'},newValues:{price:'30',name:'Pro'}})).toEqual([{key:'price',before:'20',after:'30'}]);
  });
  it('searches filters paginates and resets with actual requests',fakeAsync(()=>{
    const f=TestBed.createComponent(AdminHistoryComponent);f.detectChanges();http.expectOne(r=>r.url===url).flush(page([event]));const c=f.componentInstance;
    c.search('coach-id');tick(301);http.expectOne(r=>r.params.get('search')==='coach-id').flush(page([event]));
    c.filters.action='PLAN_UPDATED';c.apply();http.expectOne(r=>r.params.get('action')==='PLAN_UPDATED').flush({...page([]),totalElements:20});c.page(1);http.expectOne(r=>r.params.get('page')==='1').flush({...page([]),totalElements:20});expect(c.lastPage).toBeTrue();
    c.reset();http.expectOne(r=>!r.params.has('action')&&!r.params.has('search')&&r.params.get('page')==='0').flush(page([]));f.detectChanges();expect(f.nativeElement.textContent).toContain('ADMIN_HISTORY_EMPTY');
  }));
  it('warns about partial history and recovers from errors while cancelling old requests',()=>{
    const f=TestBed.createComponent(AdminHistoryComponent);f.detectChanges();const old=http.expectOne(r=>r.url===url);f.componentInstance.refresh();expect(old.cancelled).toBeTrue();
    http.expectOne(r=>r.url===url).flush({...page([event]),billingAvailable:false});f.detectChanges();expect(f.nativeElement.textContent).toContain('ADMIN_HISTORY_PARTIAL');expect(f.nativeElement.textContent).toContain('Coach Name');
    f.componentInstance.refresh();http.expectOne(r=>r.url===url).flush({}, {status:503,statusText:'Unavailable'});f.detectChanges();expect(f.nativeElement.textContent).toContain('ADMIN_HISTORY_ERROR');
    f.componentInstance.refresh();http.expectOne(r=>r.url===url).flush(page([]));expect(f.componentInstance.error).toBeFalse();
  });
});
