import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '@config/auth.service';
import { environment } from "@env/environment";
import {Notification} from "../models/notification";

@Injectable({
  providedIn: 'root',
})
export class WebsocketService {

  private WEBSOCKET_URL = environment.notificationApiUrl + "/ws";
  private stompClient: Client | null = null;

  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  constructor(private authService: AuthService) {
    this.connect();
  }


  private async connect(): Promise<void> {
    try {
      const token = await this.authService.getToken();
      this.connectSTOMP(token);
    } catch (error) {
      console.error('Error getting token:', error);
    }
  }

  private connectSTOMP(token: string): void {

    const socketFactory = () => new SockJS(this.WEBSOCKET_URL);

    this.stompClient = new Client({
      webSocketFactory: socketFactory,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    this.stompClient.onConnect = () => {
      console.log('STOMP connected');
      this.subscribeToNotifications();
    };

    this.stompClient.onStompError = (frame) => {
      console.error('Notification STOMP error:', frame.headers['message'], frame.body, frame);
      if (this.stompClient) {
        this.stompClient.reconnectDelay = 0;
        void this.stompClient.deactivate();
      }
    };

    this.stompClient.onWebSocketClose = (event) => {
      console.warn('Notification WebSocket closed:', event.code, event.reason);
    };

    this.stompClient.onWebSocketError = (event) => {
      console.error('Notification WebSocket transport error:', event);
    };

    this.stompClient.activate();
  }

  private subscribeToNotifications(): void {
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      console.warn('Notification WebSocket subscription skipped: missing userId');
      return;
    }
    const endpoint = `/topic/notifications/${userId}`;

    this.stompClient?.subscribe(endpoint, message => {
      const notification: Notification = JSON.parse(message.body);
      this.notificationSubject.next(notification);
    });
  }

  public markNotificationsAsSeen(notificationIds: string[]): void {
    if (notificationIds.length > 0 && this.stompClient?.connected) {
      this.stompClient.publish({
        destination: "/app/notifications/seen",
        body: JSON.stringify(notificationIds)
      });
    }
  }

  public sendMessage(destination: string, body: any): void {
    if (this.stompClient?.connected) {
      this.stompClient.publish({
        destination,
        body: JSON.stringify(body)
      });
    }
  }

  public disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }

  public isConnected(): boolean {
    return this.stompClient?.connected || false;
  }

}
