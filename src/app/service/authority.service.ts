import { Injectable } from '@angular/core';
import { Authority } from '../models/Authority.model';
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {environment} from "@env/environment";

@Injectable({
  providedIn: 'root'
})
export class AuthorityService {
  private user_management_service_url= environment.userManagementServiceUrl ;
  apiURL: string = this.user_management_service_url +'/role';
  constructor(private http: HttpClient) { }

  getRoles(): Observable<Authority[]> {
    return this.http.get<Authority[]>(`${this.apiURL}/all`);
  }

  getAllAuthorities() {
    return this.http.get<string[]>(`${this.apiURL}/all`);
  }

  getEmployeesRoles(): Observable<Authority[]> {
    return this.http.get<Authority[]>(`${this.apiURL}/emplyees`);
  }

}
