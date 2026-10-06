import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, tap } from 'rxjs';
import { AdminCoach, AdminCoachesService, CoachFilters, CoachPage, CoachInvoice, CoachAccountAction, SubscriptionAdminEvent } from '../../../service/admin-coaches.service';
import { AdminBillingService, SalesPlan } from '../../../service/admin-billing.service';

@Component({
  selector: 'app-admin-coaches', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, FeatherModule],
  templateUrl: './admin-coaches.component.html', styleUrl: './admin-coaches.component.scss'
})
export class AdminCoachesComponent implements OnInit {
  filters: CoachFilters = { search: '', account: '', trial: '', planId: '', usage:'', page: 0, size: 10 };
  result: CoachPage | null = null;
  plans: { id: number; name: string }[] = [];
  listQuery: Record<string, string | number> = {};
  coach: AdminCoach | null = null;
  loading = true;
  error = false;
  detailId: string | null = null;
  section = 'overview';
  readonly sections = ['overview', 'subscription', 'payments', 'clients', 'history'];
  invoices: CoachInvoice[] = [];
  invoicesLoading = false;
  invoicesError = false;
  pendingAction: CoachAccountAction | null = null;
  blockReason = 'MANUAL_ADMIN_BLOCK';
  blockNote = '';
  actionBusy = false;
  actionError = '';
  actionSuccess = false;
  billingAction: 'ASSIGN_PLAN'|'EXTEND_TRIAL'|null = null;
  billingBusy=false; billingError=''; billingSuccess=false; billingReason=''; newPlanId=''; extendDays=7;
  billingPlans:SalesPlan[]=[]; billingPlansLoading=false; billingPlansError=false;
  subscriptionEvents:SubscriptionAdminEvent[]=[]; historyLoading=false; historyError=false;
  private billingSnapshot:AdminCoach['subscription']=null;
  private historyRevision=0;
  @ViewChild('billingDialog',{static:true}) billingDialog!:ElementRef<HTMLDialogElement>;
  get canExtend() {return this.coach?.billingAvailable&&this.coach.subscription?.status==='TRIAL'&&!!this.coach.subscription.trialEndsAt&&!this.coach.subscription.currentPeriodStart;}
  get selectedNewPlan() {return this.billingPlans.find(p=>String(p.id)===this.newPlanId);}
  get validBillingAction() {return !!this.billingAction&&!this.billingBusy&&this.billingError!=='COACH_BILLING_CONFLICT'&&!!this.billingReason.trim()&&this.billingReason.length<=1000
    &&(this.billingAction==='EXTEND_TRIAL'?[7,15,30].includes(this.extendDays):!!this.selectedNewPlan&&this.selectedNewPlan.id!==this.billingSnapshot?.planId);}
  get newTrialDay() {
    if(!this.billingSnapshot?.trialEndsAt)return '';
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:this.billingSnapshot.timeZone||'Africa/Tunis',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(this.billingSnapshot.trialEndsAt));
    const val=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
    return new Date(Date.UTC(val('year'),val('month')-1,val('day')+this.extendDays)).toISOString().slice(0,10);
  }
  openBillingAction(action:'ASSIGN_PLAN'|'EXTEND_TRIAL') {
    if(this.actionBusy||this.billingBusy||!this.coach?.billingAvailable||!this.coach.subscription?.subscriptionId||action==='EXTEND_TRIAL'&&!this.canExtend)return;
    this.billingSnapshot={...this.coach.subscription};this.billingAction=action;this.billingError='';this.billingSuccess=false;this.billingReason='';this.newPlanId='';this.extendDays=7;
    this.billingDialog.nativeElement.showModal();
    if(action==='ASSIGN_PLAN') {this.billingPlans=[];this.billingPlansLoading=true;this.billingPlansError=false;
      this.billingApi.plans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:plans=>{this.billingPlans=plans.filter(p=>p.active!==false);this.billingPlansLoading=false;},error:()=>{this.billingPlansLoading=false;this.billingPlansError=true;}});}
  }
  closeBillingAction() {if(!this.billingBusy){this.billingAction=null;this.billingDialog.nativeElement.close();}}
  confirmBillingAction() {
    if(!this.validBillingAction||!this.coach||!this.billingSnapshot)return;
    const s=this.billingSnapshot;this.billingBusy=true;this.billingError='';
    this.service.subscriptionChange(this.coach.id,this.billingAction!,{subscriptionId:s.subscriptionId,expectedPlanId:s.planId,expectedStatus:s.status,
      expectedTrialEnd:s.trialEndsAt,reason:this.billingReason.trim(),newPlanId:this.billingAction==='ASSIGN_PLAN'?Number(this.newPlanId):null,days:this.billingAction==='EXTEND_TRIAL'?this.extendDays:null})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.billingBusy=false;this.closeBillingAction();this.billingSuccess=true;this.reload$.next();},
        error:e=>{this.billingBusy=false;this.billingError=e.status===409?'COACH_BILLING_CONFLICT':e.status===400?'COACH_BILLING_INVALID':'COACH_BILLING_ACTION_ERROR';}});
  }
  selectSection(tab:string) {this.section=tab;if(tab==='history')this.loadSubscriptionHistory();}
  loadSubscriptionHistory() {
    if(!this.coach)return;this.historyLoading=true;this.historyError=false;
    const revision=++this.historyRevision;
    this.service.subscriptionHistory(this.coach.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:events=>{if(revision===this.historyRevision){this.subscriptionEvents=events;this.historyLoading=false;}},error:()=>{if(revision===this.historyRevision){this.historyLoading=false;this.historyError=true;}}});
  }
  readonly blockReasons = ['MANUAL_ADMIN_BLOCK', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_PROBLEM', 'OTHER'];
  private confirmedStatus = '';
  @ViewChild('accountDialog', {static:true}) accountDialog!: ElementRef<HTMLDialogElement>;
  get accountActions(): CoachAccountAction[] {
    if (!this.coach) return [];
    return this.coach.accountStatus === 'BANNED' ? ['UNBLOCK'] : this.coach.accountStatus === 'DISABLED' ? ['ACTIVATE', 'BLOCK'] : ['BLOCK', 'DISABLE'];
  }
  get currentBlock() {
    return this.coach?.accountStatus === 'BANNED' ? [...(this.coach.accountHistory || [])].reverse().find(e => e.action === 'BLOCK') : null;
  }
  get accountHistory() { return [...(this.coach?.accountHistory || [])].reverse(); }
  get validAction(): boolean { return !!this.pendingAction && this.actionError !== 'COACH_ACTION_CONFLICT' && (this.pendingAction !== 'BLOCK'
    || !!this.blockReason && (this.blockReason !== 'OTHER' || !!this.blockNote.trim())) && this.blockNote.length <= 1000; }
  openAccountAction(action: CoachAccountAction): void {
    if (this.actionBusy || !this.coach || !this.accountActions.includes(action)) return;
    this.pendingAction = action; this.confirmedStatus = this.coach.accountStatus;
    this.blockReason = 'MANUAL_ADMIN_BLOCK'; this.blockNote = ''; this.actionError = ''; this.actionSuccess = false;
    this.accountDialog.nativeElement.showModal();
  }
  closeAccountAction(): void { if (!this.actionBusy) { this.pendingAction = null; this.accountDialog.nativeElement.close(); } }
  confirmAccountAction(): void {
    if (!this.coach || !this.validAction || this.actionBusy) return;
    this.actionBusy = true; this.actionError = '';
    this.service.changeAccount(this.coach.id, {action:this.pendingAction!,expectedStatus:this.confirmedStatus,
      reason:this.pendingAction === 'BLOCK' ? this.blockReason : null, note:this.pendingAction === 'BLOCK' ? this.blockNote.trim() : null})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:coach => {
        this.coach = coach; this.actionBusy = false; this.closeAccountAction(); this.actionSuccess = true;
      },error:error => { this.actionBusy = false; this.actionError = error.status === 409 ? 'COACH_ACTION_CONFLICT' : 'COACH_ACTION_ERROR'; }});
  }
  get history() {
    return this.invoices.flatMap(invoice => (invoice.events || []).map(event => ({ ...event, invoiceId: invoice.id })))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  private destroyRef = inject(DestroyRef);
  private reload$ = new BehaviorSubject<void>(undefined);
  private search$ = new Subject<string>();
  constructor(private service: AdminCoachesService, private route: ActivatedRoute, private location: Location,private billingApi:AdminBillingService) {}

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.filters = { search: query.get('search') || '', account: query.get('account') || '',
      trial: query.get('trial') || '', planId: query.get('planId') || '', usage:query.get('usage')||'',
      page: Math.max(0, Math.floor(Number(query.get('page')) || 0)), size: 10 };
    this.listQuery = { ...this.filters };
    this.detailId = this.route.snapshot.paramMap.get('id');
    if (this.detailId) {
      this.reload$.pipe(tap(() => {++this.historyRevision;this.subscriptionEvents=[]; this.loading = true; this.error = false; this.coach = null; this.invoices = []; this.invoicesError = false; }),
        switchMap(() => this.service.detail(this.detailId!).pipe(catchError(() => { this.error = true; return of(null); }),
        tap(coach => { this.coach = coach; this.loading = false; this.invoicesLoading = !!coach;if(coach&&this.section==='history')this.loadSubscriptionHistory(); }),
        switchMap(coach => coach ? this.service.invoices(coach.id).pipe(catchError(() => { this.invoicesError = true; return of([]); })) : of([])))),
        takeUntilDestroyed(this.destroyRef)).subscribe(invoices => { this.invoices = invoices; this.invoicesLoading = false; });
    } else {
      this.reload$.pipe(tap(() => { this.loading = true; this.error = false; this.result = null; }),
        switchMap(() => this.service.list({ ...this.filters }).pipe(catchError(() => { this.error = true; return of(null); }))),
        takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          this.result = result; if (result) this.plans = result.plans;
          this.listQuery = { ...this.filters }; this.loading = false;
        });
      this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.applyFilters());
    }
  }
  search(value: string): void { this.filters.search = value; this.search$.next(value); }
  applyFilters(): void { this.filters.page = 0; this.reload$.next(); }
  reset(): void { this.filters = { search: '', account: '', trial: '', planId: '', usage:'', page: 0, size: 10 }; this.reload$.next(); }
  refresh(): void { if (!this.actionBusy&&!this.billingBusy) { this.closeAccountAction();this.closeBillingAction(); this.actionSuccess = false;this.billingSuccess=false; this.reload$.next(); } }
  page(delta: number): void { this.filters.page += delta; this.reload$.next(); }
  goBack(): void { this.location.back(); }
  label(group: string, value: string | null | undefined): string { return `COACH_${group}_${value || 'NONE'}`; }
  initials(name: string): string { return (name || '').split(' ').filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase(); }
  limit(coach: AdminCoach): string {
    if (!coach.billingAvailable) return 'COACH_UNAVAILABLE';
    if (!coach.subscription?.subscriptionId) return 'COACH_NO_PLAN';
    return coach.subscription.maxActiveClients == null ? 'COACH_UNLIMITED' : String(coach.subscription.maxActiveClients);
  }
  get lastPage(): boolean { return !this.result || (this.filters.page + 1) * this.filters.size >= this.result.totalElements; }
}
