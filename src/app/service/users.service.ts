import { Injectable } from '@angular/core';
import {environment} from "@env/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Observable} from "rxjs";
import {User} from "../template/core";
import {PageDto} from "../models/pageDto";

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private userServiceUrl = environment.baseApiUrl;

  constructor(private http: HttpClient) { }

  getUserById(userId: string): Observable<User> {
    console.log('UserService - Getting user by ID:', userId);
    console.log('UserService - API URL:', `${this.userServiceUrl}/user/${userId}`);
    return this.http.get<User>(`${this.userServiceUrl}/api/users/${userId}`);
  }


  searchUsers(search: string): Observable<PageDto<User>> {
    const params = new HttpParams().set('search', search);

    return this.http.get<PageDto<User>>(
      `${this.userServiceUrl}/api/users/search`,
      { params }
    );
  }

  getUsersSuggestions(): Observable<PageDto<User>> {
    return this.http.get<PageDto<User>>(
      `${this.userServiceUrl}/api/users/chat`
    );
  }
}
