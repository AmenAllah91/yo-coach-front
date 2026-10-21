import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {map, Observable, of, shareReplay, tap} from "rxjs";
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


  /** Last answer, request in progress and last failure: the header and the chat counter both poll every 5 s. */
  private last: { userId: string; at: number; value: Notification[] } | null = null;
  private loading: { userId: string; request: Observable<Notification[]> } | null = null;
  private failedAt = 0;

  constructor(private http: HttpClient) { }

  /**
   * One request for all the pollers: an answer under 4 s old is reused, nothing is asked while the tab is hidden, and
   * after a failure (service down) the next try waits a minute instead of 5 s.
   */
  getMessagesNotifs(userId: string): Observable<Notification []> {
    const now = Date.now();
    const last = this.last?.userId === userId ? this.last : null;
    if (last && (now - last.at < 4000 || document.hidden)) return of(last.value);
    if (now - this.failedAt < 60000) return of(last?.value || []);
    if (this.loading?.userId === userId) return this.loading.request;

    const request = this.http.get<PageDto<Notification>>(`${this.apiUrl}/user/${userId}`, {
      params: { pageNumber: 0, pageSize: 100 },
      // Header polling must never activate the application-wide blocking loader.
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' }
    }).pipe(
      map(page => page.content || []),
      tap({
        next: value => { this.last = { userId, at: Date.now(), value }; this.failedAt = 0; },
        error: () => { this.failedAt = Date.now(); },
        finalize: () => { if (this.loading?.request === request) this.loading = null; },
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.loading = { userId, request };
    return request;
  }

  markNotificationsAsSeen(notificationIds: string[]) {
    return this.http.post(`${this.apiUrl}/notifications/seen`, notificationIds, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' }
    }).pipe(tap(() => { this.last = null; })); // the next read shows them as seen
  }

  sendNotification(notificationRequest: any): Observable<string> {
    return this.http.post(`${this.apiUrl}`, notificationRequest, { responseType: 'text' });
  }


}
