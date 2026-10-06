import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged, switchMap, tap, catchError, of } from 'rxjs';
import { AdminPaymentsService, PaymentPage, PaymentFilters } from '../../../service/admin-payments.service';

@Component({selector:'app-admin-payments',standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,TranslateModule,FeatherModule],
  templateUrl:'./admin-payments.component.html',styleUrl:'./admin-payments.component.scss'})
export class AdminPaymentsComponent implements OnInit {
  filters:PaymentFilters=this.emptyFilters();
  result:PaymentPage|null=null;loading=true;error=false;
  methods:string[]=[];currencies:string[]=[];
  readonly statuses=['SUCCESS','PENDING','FAILED','REFUNDED','TO_REFUND','CANCELLED'];
  private destroyRef=inject(DestroyRef);
  private reload$=new BehaviorSubject<void>(undefined);
  private search$=new Subject<string>();
  constructor(private api:AdminPaymentsService,private location:Location) {}
  ngOnInit() {
    this.reload$.pipe(tap(()=>{this.loading=true;this.error=false;this.result=null;}),
      switchMap(()=>this.api.list({...this.filters}).pipe(catchError(()=>{this.error=true;return of(null);}))),
      takeUntilDestroyed(this.destroyRef)).subscribe(result=>{
        this.result=result;this.loading=false;if(result){this.methods=result.methods;this.currencies=result.currencies;}
      });
    this.search$.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.apply());
  }
  emptyFilters():PaymentFilters {return {search:'',status:'',method:'',currency:'',cycle:'',page:0,size:10};}
  search(value:string) {this.filters.search=value;this.search$.next(value);}
  apply() {this.filters.page=0;this.reload$.next();}
  reset() {this.filters=this.emptyFilters();this.reload$.next();}
  refresh() {this.reload$.next();}
  page(delta:number) {this.filters.page+=delta;this.reload$.next();}
  back() {this.location.back();}
  get lastPage() {return !this.result||(this.filters.page+1)*this.filters.size>=this.result.totalElements;}
}
