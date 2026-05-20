import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {Conversation} from "../components/chat/models/conversation";
import {HttpClient, HttpParams} from "@angular/common/http";
import {environment} from "@env/environment";
import {ChatMessage} from "../components/chat/models/chat-message";
import {PageDto} from "../models/pageDto";
import {ChatWebsocketService} from "./chat-websocket.service";

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private apiUrl = environment.baseApiUrl+"/chat"

  private selectedConversationSubject =
    new BehaviorSubject<Conversation | null>(null);

  selectedConversation$ =
    this.selectedConversationSubject.asObservable();

  constructor(private wsService: ChatWebsocketService,
              private http: HttpClient) {

    this.wsService.messages$.subscribe(data => {
      if (!data) return;

      const current = this.selectedConversationSubject.value;
      if (!current || current.id !== data.conversationId) return;

      const exists = current.messages.some(
        m => m.id === data.id
      );

      if (!exists) {
        this.selectedConversationSubject.next({
          ...current,
          messages: [...current.messages, data]
        });
      }
    });

  }


  openConversation(conversation: Conversation) {
    this.selectedConversationSubject.next(conversation);
  }

  sendMessage(conversationId: string, content: string, senderId: string) {
    this.wsService.sendMessage(conversationId, content, senderId);
  }

  getConversations(page: number = 0, size: number = 10): Observable<PageDto<Conversation>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PageDto<Conversation>>(`${this.apiUrl}/conversations`, { params });
  }
  getGroupConversations(page: number = 0, size: number = 10): Observable<PageDto<Conversation>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PageDto<Conversation>>(`${this.apiUrl}/group/conversations`, { params });
  }
  getGroupSuggestionsConversations(page: number = 0, size: number = 5): Observable<PageDto<Conversation> | any[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PageDto<Conversation>| any[]>(`${this.apiUrl}/group/suggestions/conversations`, { params });
  }

  getGroupConversationsByAdherentId(adherentId: string): Observable<Conversation> {
    const params = new HttpParams()
      .set('adherentId', adherentId)

    return this.http.get<Conversation>(`${this.apiUrl}/group/conversations/by/adherent`, { params });
  }

  getMessages(
    conversationId: string,
    page: number,
    size = 20
  ): Observable<PageDto<ChatMessage>> {
    return this.http.get<PageDto<ChatMessage>>(
      `${this.apiUrl}/messages/${conversationId}`,
      { params: { page, size } }
    );
  }

  createConversation(request: { coachId: string, clientId: string }): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/conversations`, request);
  }

  createGroupConversation(request: { name: string, memberIds: string[] }): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/group/conversations`, request);
  }

  addUserToConversation(conv: Conversation, userId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/conversations/add-user`,
      {
        conversationId: conv.id,
        userId: userId
      }
    );
  }


}
