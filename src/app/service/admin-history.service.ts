import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
export interface AdminHistoryEntry {id:string;action:string;actor:string|null;adminName:string|null;coachId:string|null;coachName:string|null;email:string|null;
  planId:number|null;planName:string|null;occurredAt:string|null;reason:string|null;oldValues:Record<string,string>;newValues:Record<string,string>;}
export interface AdminHistoryPage {content:AdminHistoryEntry[];totalElements:number;page:number;size:number;billingAvailable:boolean;}
@Injectable({providedIn:'root'})
export class AdminHistoryService {
  constructor(private http:HttpClient) {}
  list(filters:{search:string;action:string;page:number;size:number}) {
    let params=new HttpParams().set('page',filters.page).set('size',filters.size);
    for(const key of ['search','action'] as const)if(filters[key].trim())params=params.set(key,filters[key].trim());
    return this.http.get<AdminHistoryPage>(`${environment.baseApiUrl}/api/admin/history`,{params});
  }
}
