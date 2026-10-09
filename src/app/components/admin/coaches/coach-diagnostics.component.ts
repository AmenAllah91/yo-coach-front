import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, ViewChild, ElementRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';
import { AdminCoachesService, CoachDiagnostics, CoachAccountAction } from '../../../service/admin-coaches.service';
import { AdminBillingService, SalesPlan } from '../../../service/admin-billing.service';

@Component({selector:'app-coach-diagnostics',standalone:true,imports:[CommonModule,FormsModule,TranslateModule],
  templateUrl:'./coach-diagnostics.component.html',styleUrl:'./coach-diagnostics.component.scss'})
export class CoachDiagnosticsComponent implements OnInit {
  @Input({required:true}) coachId='';
  @Output() accountAction=new EventEmitter<CoachAccountAction>();
  @Output() billingAction=new EventEmitter<'ASSIGN_PLAN'|'EXTEND_TRIAL'>();
  @Output() openHistory=new EventEmitter<void>();
  @Output() changed=new EventEmitter<void>();
  @ViewChild('confirmDialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
  data:CoachDiagnostics|null=null;loading=true;error=false;busy=false;actionError='';
  action:'OFFER_ACCESS'|'REVOKE_ACCESS'|'RESYNC'|null=null;
  plans:SalesPlan[]=[];plansLoading=false;plansError=false;
  planId='';duration='DAYS';amount=30;endDate='';reason='COLLABORATION';note='';
  private destroyRef=inject(DestroyRef);
  private reload$=new BehaviorSubject<void>(undefined);
  constructor(private api:AdminCoachesService,private billing:AdminBillingService){}
  ngOnInit(){this.reload$.pipe(tap(()=>{this.loading=true;this.error=false;this.data=null;}),
    switchMap(()=>this.api.diagnostics(this.coachId).pipe(catchError(()=>{this.error=true;return of(null);}))),
    takeUntilDestroyed(this.destroyRef)).subscribe(data=>{this.data=data;this.loading=false;});}
  refresh(){if(!this.busy)this.reload$.next();}
  get health(){return this.data?.issues.some(i=>i.severity==='ERROR')?'ERROR':this.data?.issues.length?'WARNING':'HEALTHY';}
  get s(){return this.data?.coach.subscription;}
  get countLimit(){if(!this.data?.coach.billingAvailable)return 'HEALTH_UNAVAILABLE';
    if(!this.s?.subscriptionId&&!this.s?.complimentary)return 'COACH_NO_PLAN';
    return this.s?.maxActiveClients==null||this.s?.maxActiveClients===2147483647?'COACH_UNLIMITED':String(this.s.maxActiveClients);}
  get summaries(){const d=this.data;if(!d)return [];return [
    {label:'COACH_ACCOUNT',value:`COACH_ACCOUNT_${d.summary.account}`,tone:d.summary.account==='ACTIVE'?'HEALTHY':'WARNING'},
    {label:'COACH_TRIAL_STATUS',value:`COACH_TRIAL_${d.summary.trial}`,tone:d.summary.trial==='ENDED'?'WARNING':'HEALTHY'},
    {label:'COACH_SECTION_SUBSCRIPTION',value:d.summary.subscription==='COMPLIMENTARY'?'HEALTH_COMPLIMENTARY':`COACH_SUB_${d.summary.subscription}`,tone:d.summary.subscription==='ACTIVE'||d.summary.subscription==='COMPLIMENTARY'?'HEALTHY':'WARNING'},
    {label:'HEALTH_LAST_PAYMENT',value:`ADMIN_PAYMENT_${d.summary.payment}`,tone:d.summary.payment==='SUCCESS'?'HEALTHY':d.summary.payment==='NONE'?'NEUTRAL':'WARNING'},
    {label:'COACH_CLIENTS',value:`COACH_USAGE_${d.summary.clientLimit}`,tone:['REACHED','EXCEEDED'].includes(d.summary.clientLimit)?'WARNING':'HEALTHY'},
    {label:'HEALTH_SYNC',value:`HEALTH_${d.syncStatus}`,tone:d.syncStatus}];}
  get events(){const d=this.data;if(!d)return [];return [
    ...(d.coach.accountHistory||[]).map(e=>({label:`COACH_ACTION_${e.action}`,date:e.occurredAt,actor:e.actor,detail:[e.reason,e.note].filter(Boolean).join(' · ')})),
    ...(d.subscriptionEvents||[]).map(e=>({label:`ADMIN_HISTORY_${e.action}`,date:e.occurredAt,actor:e.actor,detail:e.reason})),
    ...(d.diagnosticHistory||[]).map(e=>({label:`HEALTH_ACTION_${e.action}`,date:e.occurredAt,actor:e.actor,detail:''})),
    ...d.complimentaryHistory.flatMap(g=>[{label:'HEALTH_ACTION_OFFER_ACCESS',date:g.startsAt,actor:g.actor,detail:`${g.planName} · ${g.reason}${g.note?' · '+g.note:''}`},
      ...(g.revokedAt?[{label:'HEALTH_ACTION_REVOKE_ACCESS',date:g.revokedAt,actor:g.revokedBy,detail:g.planName}]:[])]),
    ...(d.lastPayment?.date?[{label:`ADMIN_PAYMENT_${d.lastPayment.status}`,date:d.lastPayment.date,actor:null,detail:`${d.lastPayment.amount} ${d.lastPayment.currency}`}]:[])
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);}
  open(action:'OFFER_ACCESS'|'REVOKE_ACCESS'|'RESYNC'){
    if(this.busy||!this.data?.allowedActions.includes(action))return;
    this.action=action;this.actionError='';this.planId='';this.duration='DAYS';this.amount=30;this.endDate='';this.reason='COLLABORATION';this.note='';
    this.dialog.nativeElement.showModal();
    if(action==='OFFER_ACCESS') {this.plans=[];this.plansLoading=true;this.plansError=false;
      this.billing.plans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:p=>{this.plans=p.filter(v=>v.active!==false&&!v.archived);this.plansLoading=false;},error:()=>{this.plansError=true;this.plansLoading=false;}});}
  }
  close(){if(!this.busy){this.action=null;this.dialog.nativeElement.close();}}
  get valid(){return !!this.action&&!this.busy&&(this.action!=='OFFER_ACCESS'||!!this.planId&&this.note.length<=1000&&(this.reason!=='OTHER'||!!this.note.trim())
    &&(this.duration==='INDEFINITE'||this.duration==='DATE'&&!!this.endDate||['DAYS','MONTHS'].includes(this.duration)&&Number.isInteger(this.amount)&&this.amount>0&&this.amount<=36500));}
  confirm(){if(!this.valid||!this.data)return;this.busy=true;this.actionError='';
    const request=this.action==='RESYNC'?this.api.resync(this.coachId):this.action==='REVOKE_ACCESS'?this.api.revokeAccess(this.coachId,this.s!.complimentaryId!):
      this.api.offerAccess(this.coachId,{planId:Number(this.planId),duration:this.duration,amount:['DAYS','MONTHS'].includes(this.duration)?this.amount:null,
        endDate:this.duration==='DATE'?this.endDate:null,reason:this.reason,note:this.note.trim()||null});
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.busy=false;this.close();this.refresh();this.changed.emit();},
      error:e=>{this.busy=false;this.actionError=e.status===409?'HEALTH_CONFLICT':'HEALTH_ACTION_ERROR';}});
  }
  managed(){return !!this.data?.allowedActions.includes('OFFER_ACCESS');}
}
