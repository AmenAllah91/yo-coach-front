import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

export interface PaymentFilters {search:string;status:string;method:string;currency:string;cycle:string;page:number;size:number;}
export interface PaymentEntry {
  coachId:string;coachName:string;email:string;
  payment:{id:number;invoiceId:number;amount:number|null;currency:string|null;planId:number|null;planName:string|null;
    billingCycle:string|null;method:string|null;date:string|null;dateKind:string;status:string|null;};
}
export interface PaymentPage {content:PaymentEntry[];totalElements:number;page:number;size:number;methods:string[];currencies:string[];}
@Injectable({providedIn:'root'})
export class AdminPaymentsService {
  constructor(private http:HttpClient) {}
  list(filters:PaymentFilters) {
    let params=new HttpParams().set('page',filters.page).set('size',filters.size);
    for(const key of ['search','status','method','currency','cycle'] as const) if(filters[key].trim()) params=params.set(key,filters[key].trim());
    return this.http.get<PaymentPage>(`${environment.baseApiUrl}/api/admin/payments`,{params});
  }
}
