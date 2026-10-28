import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { CoachDiagnosticsComponent } from './coach-diagnostics.component';
import { CoachDiagnostics } from '../../../service/admin-coaches.service';

describe('Coach diagnostics',()=>{
  let http:HttpTestingController;
  const url=`${environment.baseApiUrl}/api/admin/coaches/coach`;
  const data:CoachDiagnostics={coach:{id:'coach',name:'John Doe',email:'john@example.test',registeredAt:null,accountStatus:'ACTIVE',trialStatus:'RUNNING',activeClients:3,billingAvailable:true,clientLimitStatus:'BELOW',
    subscription:{subscriptionId:1,status:'TRIAL',planId:1,planName:'Standard',maxActiveClients:5,trialMaxClients:5,trialStartedAt:'2026-10-01T00:00:00Z',trialEndsAt:'2026-10-15T00:00:00Z',trialDaysLeft:7,currentPeriodEnd:null,cancelAtPeriodEnd:false}},
    enabled:true,blocked:false,customerId:1,localSubscriptionId:1,archivedClients:4,pendingInvitations:2,remainingSlots:2,lastPayment:null,paymentsAvailable:true,syncStatus:'HEALTHY',checkedAt:'2026-10-08T00:00:00Z',interpreted:null,
    summary:{account:'ACTIVE',trial:'RUNNING',subscription:'TRIAL',payment:'NONE',clientLimit:'BELOW',sync:'HEALTHY'},issues:[],complimentaryHistory:[],historyAvailable:true,allowedActions:['OFFER_ACCESS','RESYNC'],diagnosticHistory:[],lastLogin:null,lastActivity:null};
  beforeEach(()=>{TestBed.configureTestingModule({imports:[CoachDiagnosticsComponent,HttpClientTestingModule,TranslateModule.forRoot()]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  function fixture(value:CoachDiagnostics=data){const f=TestBed.createComponent(CoachDiagnosticsComponent);f.componentInstance.coachId='coach';f.detectChanges();http.expectOne(`${url}/diagnostics`).flush(value);f.detectChanges();return f;}
  it('centralizes trial, client breakdown and unavailable login without attention alerts',()=>{const f=fixture();const text=f.nativeElement.textContent;expect(text).toContain('John Doe');expect(text).toContain('3 / 5');expect(text).toContain('HEALTH_UNAVAILABLE');expect(text).toContain('HEALTH_PENDING');expect(f.nativeElement.querySelector('.attention')).toBeNull();expect(f.componentInstance.events).toEqual([]);});
  it('shows YoSales outage while retaining local account, and never calls an unknown limit unlimited',()=>{const f=fixture({...data,coach:{...data.coach,billingAvailable:false,subscription:null,clientLimitStatus:'UNKNOWN'},syncStatus:'ERROR',issues:[{code:'CONNECTION_ERROR',severity:'ERROR'}]});expect(f.nativeElement.textContent).toContain('HEALTH_ISSUE_CONNECTION_ERROR');expect(f.nativeElement.textContent).toContain('John Doe');expect(f.componentInstance.countLimit).toBe('HEALTH_UNAVAILABLE');});
  it('renders payment failure, reference and actual cache mismatches',()=>{const f=fixture({...data,lastPayment:{id:1,subscriptionId:1,status:'FAILED',amount:120,currency:'TND',date:'2026-10-08T00:00:00Z',method:'FLOUCI',transactionId:'tx-123',paymentMethod:null},interpreted:{known:true,status:'ACTIVE',readOnly:false,brandingAllowed:true,maxActiveClients:20},syncStatus:'ERROR',issues:[{code:'PAYMENT_FAILED',severity:'WARNING'},{code:'LIMIT_MISMATCH',severity:'ERROR'}]});expect(f.nativeElement.textContent).toContain('tx-123');expect(f.nativeElement.textContent).toContain('120');expect(f.nativeElement.textContent).toContain('HEALTH_ISSUE_LIMIT_MISMATCH');expect(f.nativeElement.textContent).toContain('ADMIN_PAYMENT_FAILED');});
  it('never offers nor revokes an access (not available: CE answers 501), but keeps the resync',()=>{
    const f=fixture({...data,allowedActions:['OFFER_ACCESS','RESYNC','REVOKE_ACCESS']});const c=f.componentInstance;
    expect(c.availableActions).toEqual(['RESYNC']);
    const buttons=Array.from(f.nativeElement.querySelectorAll('.account-actions button')).map((b:any)=>b.textContent.trim());
    expect(buttons).toEqual(['HEALTH_ACTION_RESYNC']);
    c.open('OFFER_ACCESS');expect(c.action).toBeNull();http.expectNone(`${environment.baseApiUrl}/api/admin/plans`);
    c.open('REVOKE_ACCESS');expect(c.action).toBeNull();http.expectNone(`${url}/complimentary`);});
  it('confirms resync, keeps errors visible and hides mutations from read-only roles',()=>{const f=fixture();const c=f.componentInstance;c.open('RESYNC');http.expectNone(`${url}/diagnostics/resync`);c.confirm();http.expectOne(`${url}/diagnostics/resync`).flush({}, {status:503,statusText:'Unavailable'});expect(c.actionError).toBe('HEALTH_ACTION_ERROR');expect(c.busy).toBeFalse();c.close();c.refresh();http.expectOne(`${url}/diagnostics`).flush({...data,allowedActions:[]});f.detectChanges();expect(f.nativeElement.querySelector('.account-actions')).toBeNull();c.open('RESYNC');expect(c.action).toBeNull();});
});
