import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from "@angular/common/http";
import {Observable} from "rxjs";
import {environment} from "@env/environment";
import {PageDto} from "../models/pageDto";
import {Notification} from "../models/notification";

export interface NotificationRequest {
  users: string[];
  notificationType: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private apiUrl = environment.baseApiUrl+"/api/notifications"


  constructor(private http: HttpClient) { }

  getMessagesNotifs(userId: string): Observable<Notification []> {
    return this.http.get<Notification []>(`${this.apiUrl}/user/${userId}`);
  }

  markNotificationsAsSeen(notificationIds: string[]) {
    return this.http.post(`${this.apiUrl}/seen`,notificationIds);
  }

  sendNotification(notificationRequest: any): Observable<string> {
    return this.http.post(`${this.apiUrl}`, notificationRequest, { responseType: 'text' });
  }


}
