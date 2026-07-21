import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '@config/auth.service';
import { environment } from '@env/environment';
import {ChatMessage} from "../components/chat/models/chat-message";

export interface ChatEvent {
  conversationId: string;
  message: any;
}

@Injectable({ providedIn: 'root' })
export class ChatWebsocketService {

  private CHAT_WS_URL = environment.baseApiUrl + '/ws';

  private stompClient!: Client;
  private conversationSubscription?: StompSubscription;
  private pendingConversationId: string | null = null;

  private messageSubject = new BehaviorSubject<ChatMessage | null>(null);
  public readonly messages$: Observable<ChatMessage | null> =
    this.messageSubject.asObservable();

  constructor(
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.connect();
  }

  private async connect(): Promise<void> {
    const token = await this.authService.getToken();

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(this.CHAT_WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.stompClient.onConnect = () => {
      console.log('[CHAT] STOMP connected');

      if (this.pendingConversationId) {
        this.subscribeToConversation(this.pendingConversationId);
        this.pendingConversationId = null;
      }
    };

    this.stompClient.activate();
  }

  subscribeToConversation(conversationId: string): void {

    if (!this.stompClient.connected) {
      console.log('[CHAT SERVICE] STOMP not connected, pending subscription for conversation:', conversationId);
      this.pendingConversationId = conversationId;
      return;
    }

    console.log('[CHAT SERVICE] subscribing to conversation:', conversationId);

    this.conversationSubscription?.unsubscribe();

    this.conversationSubscription =
      this.stompClient.subscribe(
        `/topic/conversation/${conversationId}`,
        frame => {
          const backendMessage = JSON.parse(frame.body);
          const createdAt = this.normalizeCreatedAt(backendMessage.createdAt);
          const messageId = backendMessage.id
            || backendMessage._id
            || `ws-${conversationId}-${backendMessage.senderId}-${createdAt}-${backendMessage.content || ''}`;

          const chatMessage: ChatMessage = {
            id: messageId,
            senderId: backendMessage.senderId,
            content: backendMessage.content,
            createdAt,
            conversationId: backendMessage.conversationId || conversationId,
            type: backendMessage.type || 'TEXT',
            attachmentUrl: backendMessage.attachmentUrl,
            attachmentName: backendMessage.attachmentName,
            attachmentType: backendMessage.attachmentType,
            attachmentSize: backendMessage.attachmentSize,
            durationSeconds: backendMessage.durationSeconds
          };

          this.ngZone.run(() => {
            console.log('[CHAT SERVICE] emitting message:', JSON.stringify(chatMessage));
            this.messageSubject.next(chatMessage);
          });
        }
      );


  }

  private normalizeCreatedAt(value: unknown): string {
    if (typeof value === 'number') {
      const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
      return new Date(milliseconds).toISOString();
    }

    if (Array.isArray(value) && value.length >= 3) {
      const [year, month, day, hour = 0, minute = 0, second = 0] = value.map(Number);
      return new Date(year, month - 1, day, hour, minute, second).toISOString();
    }

    if (typeof value === 'string' && value) {
      const numericValue = Number(value);
      if (!Number.isNaN(numericValue) && /^\d+(\.\d+)?$/.test(value)) {
        const milliseconds = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
        return new Date(milliseconds).toISOString();
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    return new Date().toISOString();
  }

  sendMessage(conversationId: string, content: string, senderId: string): void {
    if (!this.stompClient?.connected) return;

    this.stompClient.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ conversationId, content, senderId, type: 'TEXT' })
    });
  }

  disconnect(): void {
    this.conversationSubscription?.unsubscribe();
    this.stompClient?.deactivate();
  }
}
