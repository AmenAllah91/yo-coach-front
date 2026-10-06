import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { AdminPaymentsComponent } from './admin-payments.component';

describe('Admin payments flow',()=>{
  let http:HttpTestingController;
  const url=`${environment.baseApiUrl}/api/admin/payments`;
  const row={coachId:'coach-1',coachName:'Coach One',email:'one@example.test',payment:{id:42,invoiceId:21,amount:6.667,currency:'TND',planId:1,planName:'Pro',billingCycle:'YEARLY',method:'FLOUCI',date:'2026-10-02T09:00:00Z',dateKind:'SETTLED',status:'SUCCESS'}};
  const page=(rows:any[])=>({content:rows,totalElements:rows.length,page:0,size:10,methods:['FLOUCI'],currencies:['TND']});
  beforeEach(()=>{TestBed.configureTestingModule({imports:[AdminPaymentsComponent,HttpClientTestingModule,TranslateModule.forRoot(),FeatherModule.pick(allIcons)],providers:[provideRouter([])]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('loads actual fields, preserves three decimal amount and opens coach detail',()=>{
    const f=TestBed.createComponent(AdminPaymentsComponent);f.detectChanges();http.expectOne(r=>r.url===url).flush(page([row]));f.detectChanges();
    const text=f.nativeElement.textContent;for(const expected of ['Coach One','6.667','TND','Pro','COACH_CYCLE_YEARLY','FLOUCI','ADMIN_PAYMENT_SUCCESS','ADMIN_PAYMENT_DATE_SETTLED']) expect(text).toContain(expected);
    expect(f.nativeElement.querySelector('.coach-name').getAttribute('href')).toBe('/admin/coaches/coach-1');
    expect(f.nativeElement.querySelector('.detail-nav')).toBeNull();
  });
  it('debounces search, sends filters, paginates and resets to page zero',fakeAsync(()=>{
    const f=TestBed.createComponent(AdminPaymentsComponent);f.detectChanges();http.expectOne(r=>r.url===url).flush({...page([row]),totalElements:20});const c=f.componentInstance;
    c.search('One');tick(301);http.expectOne(r=>r.params.get('search')==='One').flush(page([row]));
    c.filters.status='REFUNDED';c.filters.method='FLOUCI';c.filters.currency='TND';c.filters.cycle='YEARLY';c.apply();
    http.expectOne(r=>r.params.get('status')==='REFUNDED'&&r.params.get('method')==='FLOUCI'&&r.params.get('currency')==='TND'&&r.params.get('cycle')==='YEARLY').flush({...page([row]),totalElements:20});
    c.page(1);http.expectOne(r=>r.params.get('page')==='1').flush({...page([row]),page:1,totalElements:20});expect(c.lastPage).toBeTrue();
    c.reset();http.expectOne(r=>r.params.get('page')==='0'&&!r.params.has('search')&&!r.params.has('status')).flush(page([]));f.detectChanges();expect(f.nativeElement.textContent).toContain('ADMIN_PAYMENTS_EMPTY');
  }));
  it('shows unavailable legacy values and failure, supports retry and cancels stale requests',()=>{
    const f=TestBed.createComponent(AdminPaymentsComponent);f.detectChanges();const old=http.expectOne(r=>r.url===url);f.componentInstance.refresh();expect(old.cancelled).toBeTrue();
    http.expectOne(r=>r.url===url).flush({}, {status:503,statusText:'Unavailable'});f.detectChanges();expect(f.nativeElement.textContent).toContain('ADMIN_PAYMENTS_ERROR');
    f.componentInstance.refresh();http.expectOne(r=>r.url===url).flush(page([{...row,payment:{...row.payment,amount:null,date:null,billingCycle:null,status:'FAILED'}}]));f.detectChanges();
    expect(f.nativeElement.textContent).toContain('COACH_NOT_RECORDED');expect(f.nativeElement.textContent).toContain('ADMIN_PAYMENT_FAILED');expect(f.nativeElement.textContent).not.toContain('6.667');
  });
});
