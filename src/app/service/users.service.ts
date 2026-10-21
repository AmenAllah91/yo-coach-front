import { Injectable } from '@angular/core';
import {environment} from "@env/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Observable, catchError, map, of, shareReplay} from "rxjs";
import {User} from "../template/core";
import {PageDto} from "../models/pageDto";
import {UserDto, UserStatsDto} from "../components/admin/models/user-models";

/** Photo links are signed for 2 hours by the document service: one is reused for 1 hour. */
export const AVATAR_REUSE_MS = 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private userServiceUrl = environment.baseApiUrl;
  private avatars = new Map<string, { until: number; url$: Observable<string> }>();

  constructor(private http: HttpClient) { }

  /** quiet: background lookup with its own fallback (a removed user answers 404): no loader, no error toast. */
  getUserById(userId: string, skipLoader = false, quiet = false): Observable<User> {
    const headers: Record<string, string> = skipLoader || quiet ? { 'X-Skip-Loader': 'true' } : {};
    if (quiet) headers['X-Skip-Toast'] = 'true';
    return this.http.get<User>(`${this.userServiceUrl}/api/users/${userId}`, { headers });
  }

  /**
   * Photo link of a user ('' when there is none), without the page loader. The client list, the client profile
   * and its client panel share it, so going from one to the other does not fetch every photo again.
   */
  getAvatarUrl(userId: string): Observable<string> {
    const known = this.avatars.get(userId);
    if (known && known.until > Date.now()) return known.url$;

    const url$ = this.getUserById(userId, true).pipe(
      map((user) => {
        const url = String(user?.avatarUrl || '').trim();
        return url.toLowerCase() === 'not found' ? '' : url;
      }),
      catchError(() => {
        this.avatars.delete(userId); // a failure is not remembered: the next read asks again
        return of('');
      }),
      shareReplay(1),
    );
    this.avatars.set(userId, { until: Date.now() + AVATAR_REUSE_MS, url$ });
    return url$;
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
      { params, headers: { 'X-Skip-Loader': 'true' } }
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
