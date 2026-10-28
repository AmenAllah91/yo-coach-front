import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
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
  private conversationSubscriptions = new Map<string, StompSubscription>();
  private trackedConversationIds = new Set<string>();
  /** Other topics (the user's own ringing topic): subscribed again after each reconnection. */
  private topicHandlers = new Map<string, (body: string) => void>();
  private topicSubscriptions = new Map<string, StompSubscription>();

  private messageSubject = new BehaviorSubject<ChatMessage | null>(null);
  public readonly messages$: Observable<ChatMessage | null> =
    this.messageSubject.asObservable();

  /** Emits after each reconnection (not the first connection): what was sent meanwhile is not replayed by the broker. */
  private reconnectedSubject = new Subject<void>();
  public readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();
  private wasConnected = false;

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
      // A reconnection drops every subscription: the conversations and the other topics are subscribed again.
      this.conversationSubscriptions.clear();
      this.topicSubscriptions.clear();
      this.subscribeTrackedConversations();
      this.subscribeTrackedTopics();
      if (this.wasConnected) this.ngZone.run(() => this.reconnectedSubject.next());
      this.wasConnected = true;
    };

    this.stompClient.activate();
  }

  subscribeToConversation(conversationId: string): void {
    if (!conversationId) return;

    this.trackedConversationIds.add(conversationId);

    if (!this.stompClient?.connected) {
      console.log('[CHAT SERVICE] STOMP not connected, pending subscription for conversation:', conversationId);
      return;
    }

    if (this.conversationSubscriptions.has(conversationId)) return;

    console.log('[CHAT SERVICE] subscribing to conversation:', conversationId);

    this.conversationSubscriptions.set(
      conversationId,
      this.stompClient.subscribe(
        `/topic/conversation/${conversationId}`,
        frame => this.handleFrame(conversationId, frame)
      )
    );
  }

  private subscribeTrackedConversations(): void {
    if (!this.stompClient?.connected) return;

    for (const conversationId of this.trackedConversationIds) {
      if (this.conversationSubscriptions.has(conversationId)) continue;

      console.log('[CHAT SERVICE] subscribing to conversation:', conversationId);

      this.conversationSubscriptions.set(
        conversationId,
        this.stompClient.subscribe(
          `/topic/conversation/${conversationId}`,
          frame => this.handleFrame(conversationId, frame)
        )
      );
    }
  }

  /**
   * Any other topic of the chat broker (the user's own ringing topic `/topic/calls/{userId}`). The handler runs in the
   * Angular zone; the subscription survives reconnections.
   */
  subscribeToTopic(destination: string, handler: (body: string) => void): void {
    if (!destination) return;
    this.topicHandlers.set(destination, handler);
    this.subscribeTrackedTopics();
  }

  private subscribeTrackedTopics(): void {
    if (!this.stompClient?.connected) return;
    for (const [destination, handler] of this.topicHandlers) {
      if (this.topicSubscriptions.has(destination)) continue;
      this.topicSubscriptions.set(destination, this.stompClient.subscribe(destination, frame =>
        this.ngZone.run(() => handler(frame.body))));
    }
  }

  private handleFrame(conversationId: string, frame: any): void {
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

  disconnect(): void {
    this.conversationSubscriptions.forEach(subscription => subscription?.unsubscribe());
    this.conversationSubscriptions.clear();
    this.stompClient?.deactivate();
  }
}
