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

    this.conversationSubscription =
      this.stompClient.subscribe(
        `/topic/conversation/${conversationId}`,
        frame => {
          const backendMessage = JSON.parse(frame.body);

          const chatMessage: ChatMessage = {
            id: backendMessage.id,
            senderId: backendMessage.senderId,
            content: backendMessage.content,
            createdAt: backendMessage.createdAt,
            conversationId: conversationId
          };

          this.ngZone.run(() => {
            console.log('[CHAT SERVICE] emitting message:', chatMessage);
            this.messageSubject.next(chatMessage);
          });
        }
      );


  }

  sendMessage(conversationId: string, content: string, senderId: string): void {
    if (!this.stompClient?.connected) return;

    this.stompClient.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ conversationId, content, senderId })
    });
  }

  disconnect(): void {
    this.conversationSubscription?.unsubscribe();
    this.stompClient?.deactivate();
  }
}
