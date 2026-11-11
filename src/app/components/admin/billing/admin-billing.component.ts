import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminBillingService, SalesPlan, SalesPlanQuota, SubscriptionPage } from '../../../service/admin-billing.service';

/** IA-01: same rules as YoSales (lower case code, unique on the plan, French label, limit empty or 0..1 000 000). */
const QUOTA_CODE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MAX_QUOTA_LIMIT = 1_000_000;
const quotaLimitValid = (limit: number | null | undefined) => limit == null || Number.isInteger(limit) && limit >= 0 && limit <= MAX_QUOTA_LIMIT;
export function quotasValid(quotas: SalesPlanQuota[] | null | undefined): boolean {
  const codes = new Set<string>();
  for (const q of quotas || []) {
    const code = (q.code || '').trim().toLowerCase();
    if (!QUOTA_CODE.test(code) || codes.has(code) || !(q.labelFr || '').trim()
      || !quotaLimitValid(q.monthlyLimit) || !quotaLimitValid(q.trialLimit)) return false;
    codes.add(code);
  }
  return (quotas || []).length <= 30;
}
/**
 * IA-23: the yes / no of a plan for the coach website and the branding. YoSales only stores generic quota lines
 * (0 = no, empty = yes); this screen shows them as check boxes. Without a line, the rule of before: yes once paid,
 * no during the trial.
 */
export const FEATURE_LINES = [
  {key: 'website', code: 'feature.website', labelFr: 'Site du coach', labelEn: 'Coach website'},
  {key: 'branding', code: 'feature.branding', labelFr: 'Branding (couleurs et logo)', labelEn: 'Branding (colors and logo)'},
] as const;
export type FeatureKey = typeof FEATURE_LINES[number]['key'];
export type FeatureChecks = Record<FeatureKey, {paid: boolean; trial: boolean}>;
const allowed = (limit: number | null | undefined) => limit == null || limit > 0;
export function featureChecksOf(quotas: SalesPlanQuota[] | null | undefined): FeatureChecks {
  const checks = {} as FeatureChecks;
  for (const f of FEATURE_LINES) {
    const line = (quotas || []).find(q => q.code === f.code);
    checks[f.key] = line ? {paid: allowed(line.monthlyLimit), trial: allowed(line.trialLimit)} : {paid: true, trial: false};
  }
  return checks;
}
export function featureLines(checks: FeatureChecks): SalesPlanQuota[] {
  return FEATURE_LINES.map(f => ({code: f.code, labelFr: f.labelFr, labelEn: f.labelEn, labelAr: null,
    monthlyLimit: checks[f.key].paid ? null : 0, trialLimit: checks[f.key].trial ? null : 0}));
}
const isFeatureLine = (q: SalesPlanQuota) => FEATURE_LINES.some(f => f.code === (q.code || '').trim().toLowerCase());
export function cleanQuotas(quotas: SalesPlanQuota[] | null | undefined): SalesPlanQuota[] {
  const text = (value?: string | null) => (value || '').trim() || null;
  return (quotas || []).map(q => ({code: q.code.trim().toLowerCase(), labelFr: q.labelFr.trim(), labelEn: text(q.labelEn),
    labelAr: text(q.labelAr), monthlyLimit: q.monthlyLimit ?? null, trialLimit: q.trialLimit ?? null}));
}

@Component({selector:'app-admin-billing',standalone:true,imports:[CommonModule,FormsModule,RouterModule,TranslateModule,FeatherModule],
  templateUrl:'./admin-billing.component.html',styleUrls:['./admin-billing.component.scss']})
export class AdminBillingComponent implements OnInit, OnDestroy {
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  plansMode = false; loading = false; error = false; plansError = false; busy = false; saveError = ''; success = false;
  plans: SalesPlan[] = []; result: SubscriptionPage | null = null;
  filters = {search:'',status:'',planId:'',account:'',page:0,size:10};
  planSearch = ''; planActive = ''; planCycle = '';
  readonly statuses = ['TRIAL','ACTIVE','EXPIRED','CANCELLED','PENDING','PAST_DUE'];
  readonly pricing = ['FLAT_FEE','STAIR_STEP','FEATURE_BASED'];
  form: SalesPlan = this.emptyPlan(); unlimited = false; togglePlan: SalesPlan | null = null;
  readonly featureLines = FEATURE_LINES; features: FeatureChecks = featureChecksOf([]);
  private loadRequest?: Subscription; private plansRequest?: Subscription; private saveRequest?: Subscription;
  private search$ = new Subject<string>(); private searchRequest?: Subscription;
  constructor(private api:AdminBillingService,private route:ActivatedRoute,private location:Location) {}
  ngOnInit() {this.plansMode=this.route.snapshot.data['mode']==='plans';this.refresh();
    this.searchRequest=this.search$.pipe(debounceTime(350),distinctUntilChanged()).subscribe(()=>{this.filters.page=0;this.load();});}
  ngOnDestroy() {this.loadRequest?.unsubscribe();this.plansRequest?.unsubscribe();this.searchRequest?.unsubscribe();this.saveRequest?.unsubscribe();}
  back() {this.location.back();}
  search(value:string) {this.filters.search=value;this.search$.next(value);}
  apply() {this.filters.page=0;this.load();}
  page(delta:number) {this.filters.page+=delta;this.load();}
  refresh() {this.loadPlans();if(!this.plansMode)this.load();}
  loadPlans() {this.plansRequest?.unsubscribe();this.plansError=false;if(this.plansMode)this.loading=true;
    this.plansRequest=this.api.plans().subscribe({next:plans=>{this.plans=plans;if(this.plansMode)this.loading=false;},
      error:()=>{this.plans=[];this.plansError=true;if(this.plansMode)this.loading=false;}});}
  load() {this.loadRequest?.unsubscribe();this.loading=true;this.error=false;this.result=null;
    this.loadRequest=this.api.subscriptions(this.filters).subscribe({next:result=>{this.result=result;this.loading=false;},error:()=>{this.error=true;this.loading=false;}});}
  get visiblePlans() {const term=this.planSearch.trim().toLowerCase();return this.plans.filter(p=>(!term||`${p.name} ${p.planCode}`.toLowerCase().includes(term))
    &&(!this.planActive||(p.active!==false?'ACTIVE':'INACTIVE')===this.planActive)&&(!this.planCycle||p.billingCycle===this.planCycle));}
  emptyPlan():SalesPlan {return {id:null,planCode:'',name:'',description:'',price:0,billingCycle:'MONTHLY',pricingModel:'FLAT_FEE',fromUnits:0,toUnits:10,freeTrialDays:0,trialMaxClients:5,extraFeePerUnit:0,active:true,quotas:[]};}
  edit(plan?:SalesPlan) {this.togglePlan=null;this.form=plan?{...plan,description:plan.description||'',price:plan.price??0,fromUnits:plan.fromUnits??0,toUnits:plan.toUnits??2147483647,
    freeTrialDays:plan.freeTrialDays??0,trialMaxClients:plan.trialMaxClients??5,extraFeePerUnit:plan.extraFeePerUnit??0,active:plan.active!==false,
    quotas:(plan.quotas||[]).filter(q=>!isFeatureLine(q)).map(q=>({...q}))}:this.emptyPlan();
    this.features=featureChecksOf(plan?.quotas);
    this.unlimited=this.form.toUnits===2147483647;this.open();}
  /** IA-23: "yes" / "no" of a plan for its table cell. */
  featureLabel(plan:SalesPlan,key:FeatureKey,when:'paid'|'trial'):boolean {return featureChecksOf(plan.quotas)[key][when];}
  otherQuotas(plan:SalesPlan):SalesPlanQuota[] {return (plan.quotas||[]).filter(q=>!isFeatureLine(q));}
  /** IA-01: a new quota allows nothing until the administrator sets its limits (an empty limit means no limit). */
  addQuota() {(this.form.quotas??=[]).push({code:'',labelFr:'',labelEn:'',monthlyLimit:0,trialLimit:0});}
  removeQuota(index:number) {this.form.quotas?.splice(index,1);}
  toggle(plan:SalesPlan) {this.togglePlan=plan;this.open();}
  private open() {this.saveError='';this.success=false;this.dialog?.nativeElement.showModal();}
  close() {if(!this.busy)this.dialog?.nativeElement.close();}
  cancel(event:Event) {if(this.busy)event.preventDefault();}
  get valid():boolean {const f=this.form;return !!f.name.trim()&&!!f.planCode.trim()&&Number.isFinite(f.price)&&f.price>=0
    &&['MONTHLY','YEARLY'].includes(f.billingCycle)&&this.pricing.includes(f.pricingModel)
    &&Number.isInteger(f.fromUnits)&&f.fromUnits>=0&&f.fromUnits<=2147483647&&(this.unlimited||Number.isInteger(f.toUnits)&&f.toUnits>=Math.max(1,f.fromUnits)&&f.toUnits<=2147483647)
    &&Number.isInteger(f.freeTrialDays)&&f.freeTrialDays>=0&&Number.isFinite(f.extraFeePerUnit)&&f.extraFeePerUnit>=0
    &&(f.freeTrialDays===0||Number.isInteger(f.trialMaxClients)&&f.trialMaxClients!>=1)&&quotasValid(f.quotas);}
  save() {if(this.busy||!this.togglePlan&&!this.valid)return;this.busy=true;this.saveError='';
    const request=this.togglePlan?this.api.active(this.togglePlan.id!,this.togglePlan.active===false):this.api.save({...this.form,
      name:this.form.name.trim(),planCode:this.form.planCode.trim(),toUnits:this.unlimited?2147483647:this.form.toUnits,
      quotas:[...featureLines(this.features),...cleanQuotas((this.form.quotas||[]).filter(q=>!isFeatureLine(q)))]});
    this.saveRequest=request.subscribe({next:()=>{this.busy=false;this.dialog?.nativeElement.close();this.success=true;this.loadPlans();},
      error:e=>{this.busy=false;this.saveError=e.status===409?'BILLING_CODE_CONFLICT':'BILLING_SAVE_ERROR';}});}
}
