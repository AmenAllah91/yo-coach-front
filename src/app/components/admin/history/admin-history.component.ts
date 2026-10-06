import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged, switchMap, tap, catchError, of } from 'rxjs';
import { AdminHistoryService, AdminHistoryEntry, AdminHistoryPage } from '../../../service/admin-history.service';
@Component({selector:'app-admin-history',standalone:true,imports:[CommonModule,FormsModule,RouterLink,TranslateModule,FeatherModule],
  templateUrl:'./admin-history.component.html',styleUrl:'./admin-history.component.scss'})
export class AdminHistoryComponent implements OnInit {
  filters={search:'',action:'',page:0,size:10};result:AdminHistoryPage|null=null;loading=true;error=false;
  readonly actions=['BLOCK','UNBLOCK','ACTIVATE','DISABLE','ASSIGN_PLAN','EXTEND_TRIAL','PLAN_CREATED','PLAN_UPDATED','PLAN_ENABLED','PLAN_DISABLED','PLAN_DELETED'];
  private destroyRef=inject(DestroyRef);private reload$=new BehaviorSubject<void>(undefined);private search$=new Subject<string>();
  constructor(private api:AdminHistoryService,private location:Location){}
  ngOnInit(){this.reload$.pipe(tap(()=>{this.loading=true;this.error=false;this.result=null;}),switchMap(()=>this.api.list({...this.filters}).pipe(catchError(()=>{this.error=true;return of(null);}))),
    takeUntilDestroyed(this.destroyRef)).subscribe(data=>{this.result=data;this.loading=false;});
    this.search$.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.apply());}
  search(value:string){this.filters.search=value;this.search$.next(value);}
  apply(){this.filters.page=0;this.refresh();}refresh(){this.reload$.next();}back(){this.location.back();}
  reset(){this.filters={search:'',action:'',page:0,size:10};this.refresh();}page(delta:number){this.filters.page+=delta;this.refresh();}
  changes(e:AdminHistoryEntry){return [...new Set([...Object.keys(e.oldValues||{}),...Object.keys(e.newValues||{})])]
    .filter(key=>e.oldValues?.[key]!==e.newValues?.[key]).map(key=>({key,before:e.oldValues?.[key],after:e.newValues?.[key]}));}
  value(key:string,value:string|undefined){if(value===undefined||value==='')return '—';if(key==='maxClients'&&(value==='2147483647'||value==='Unlimited'))return 'COACH_UNLIMITED';
    if(key==='accountStatus')return `COACH_ACCOUNT_${value}`;if(key==='active')return value==='true'?'COACH_ACCOUNT_ACTIVE':'BILLING_INACTIVE';if(key==='billingCycle')return `COACH_CYCLE_${value}`;return value;}
  get lastPage(){return !this.result||(this.filters.page+1)*this.filters.size>=this.result.totalElements;}
}
