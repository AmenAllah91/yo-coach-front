import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {map, Observable} from "rxjs";
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

  private apiUrl = environment.notificationApiUrl+"/api/notification"


  constructor(private http: HttpClient) { }

  getMessagesNotifs(userId: string): Observable<Notification []> {
    return this.http.get<PageDto<Notification>>(`${this.apiUrl}/user/${userId}`, {
      params: { pageNumber: 0, pageSize: 100 },
      // Header polling must never activate the application-wide blocking loader.
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' }
    }).pipe(map(page => page.content || []));
  }

  markNotificationsAsSeen(notificationIds: string[]) {
    return this.http.post(`${this.apiUrl}/notifications/seen`, notificationIds, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' }
    });
  }

  sendNotification(notificationRequest: any): Observable<string> {
    return this.http.post(`${this.apiUrl}`, notificationRequest, { responseType: 'text' });
  }


}
