import { Injectable } from '@angular/core';
import {environment} from "@env/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Observable} from "rxjs";
import {User} from "../template/core";
import {PageDto} from "../models/pageDto";
import {UserDto, UserStatsDto} from "../components/admin/models/user-models";

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private userServiceUrl = environment.baseApiUrl;

  constructor(private http: HttpClient) { }

  getUserById(userId: string, skipLoader = false): Observable<User> {
    return this.http.get<User>(`${this.userServiceUrl}/api/users/${userId}`, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }


  searchUsers(search: string): Observable<PageDto<User>> {
    const params = new HttpParams().set('search', search);

    return this.http.get<PageDto<User>>(
      `${this.userServiceUrl}/api/users/search`,
      { params }
    );
  }

  getUsersSuggestions(page: number = 0, size: number = 5): Observable<PageDto<User>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageDto<User>>(
      `${this.userServiceUrl}/api/users/chat`,
      { params }
    );
  }


  updatePassword(passwordForm : any, id : string) : Observable<any>{
    return this.http.post<any>(`${this.userServiceUrl}/${id}/change-password`,passwordForm);
  }

  updateMyPassword(passwordForm: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.userServiceUrl}/api/users/me/change-password`, passwordForm);
  }

  getAdminUsers(params: {
    role?: string;
    activated?: boolean | '';
    search?: string;
    page?: number;
    size?: number;
  }): Observable<PageDto<UserDto>> {
    let httpParams = new HttpParams();

    if (params.role) httpParams = httpParams.set('role', params.role);
    if (params.activated !== '' && params.activated !== undefined) {
      httpParams = httpParams.set('activated', params.activated);
    }
    if (params.search) httpParams = httpParams.set('search', params.search);
    httpParams = httpParams.set('page', params.page ?? 0);
    httpParams = httpParams.set('size', params.size ?? 10);

    return this.http.get<PageDto<UserDto>>(
      `${this.userServiceUrl}/api/users/admin`,
      { params: httpParams }
    );
  }

  getAdminStats(): Observable<UserStatsDto> {
    return this.http.get<UserStatsDto>(`${this.userServiceUrl}/api/users/admin/stats`);
  }

  updateUser(id: string, user: Partial<UserDto>): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.userServiceUrl}/api/users/${id}`, user);
  }

  updateUserStatus(id: string, activated: boolean): Observable<UserDto> {
    return this.http.patch<UserDto>(
      `${this.userServiceUrl}/api/users/${id}/status`,
      {},
      { params: new HttpParams().set('activated', activated) }
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.userServiceUrl}/api/users/${id}`);
  }

  deleteMyAccount(): Observable<void> {
    return this.http.delete<void>(`${this.userServiceUrl}/api/users/me`);
  }

  banUser(id: string): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.userServiceUrl}/api/users/${id}/ban`, {});
  }

  unbanUser(id: string): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.userServiceUrl}/api/users/${id}/unban`, {});
  }

  createUser(user: Partial<UserDto> & {
    login: string;
    password: string;
    authorities: string[];
  }): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.userServiceUrl}/api/users`, user);
  }
}
