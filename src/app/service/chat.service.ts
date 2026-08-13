import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {Conversation} from "../components/chat/models/conversation";
import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {environment} from "@env/environment";
import {ChatMessage} from "../components/chat/models/chat-message";
import {PageDto} from "../models/pageDto";
import {ChatWebsocketService} from "./chat-websocket.service";
import {ClientService} from "./client.service";
import {TranslateService} from '@ngx-translate/core';

export interface AutoMessageSequenceDto {
  id: string;
  conversationId: string;
  ownerId?: string;
  name: string;
  date: string;
  time: string;
  createdAt?: string;
  messages: string[];
  items?: AutoMessageItemDto[];
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

export interface AutoMessageItemDto {
  content: string;
  type: 'TEXT' | 'DOCUMENT' | string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
}

export interface AutoMessageSequenceRequest {
  conversationId: string;
  name: string;
  date: string;
  time: string;
  messages: string[];
  items?: AutoMessageItemDto[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private apiUrl = environment.baseApiUrl+"/chat"

  private selectedConversationSubject =
    new BehaviorSubject<Conversation | null>(null);

  selectedConversation$ =
    this.selectedConversationSubject.asObservable();

  private conversationRefreshSubject = new Subject<string>();
  conversationRefresh$ = this.conversationRefreshSubject.asObservable();

  private conversationOpenedSubject = new BehaviorSubject<string | null>(null);
  conversationOpened$ = this.conversationOpenedSubject.asObservable();


  constructor(private wsService: ChatWebsocketService,
              private http: HttpClient,
               private clientService: ClientService,
               private translate: TranslateService) {

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

  requestConversationRefresh(conversationId?: string): void {
    if (conversationId) this.conversationRefreshSubject.next(conversationId);
  }

  notifyConversationOpened(conversationId: string | null): void {
    this.conversationOpenedSubject.next(conversationId);
  }

  getActiveConversationId(): string | null {
    return this.conversationOpenedSubject.value;
  }

  sendMessage(conversationId: string, content: string, senderId: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/messages`, {
      conversationId,
      content,
      senderId,
      type: 'TEXT'
    });
  }

  getConversations(page: number = 0, size: number = 10): Observable<PageDto<Conversation>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    const conversations$ = this.http.get<PageDto<Conversation>>(`${this.apiUrl}/conversations`, { params });
    if (!this.isClientUser()) return conversations$;

    const clientId = sessionStorage.getItem('userId') || '';
    if (!clientId) return of(this.emptyConversationPage(page, size));

    return this.clientService.getClientById(clientId).pipe(
      switchMap(client => {
        const coachId = client.coachId || client.coach?.id || '';
        if (!coachId) return of(this.emptyConversationPage(page, size));

        return conversations$.pipe(
          map(result => {
            const content = (result.content || []).filter(conversation =>
              conversation.isGroup
                ? conversation.coachId === coachId && !!conversation.memberIds?.includes(clientId)
                : conversation.clientId === clientId && conversation.coachId === coachId
            );

            return {
              ...result,
              content,
              totalElements: content.length,
              totalPages: content.length ? 1 : 0,
            };
          })
        );
      }),
      catchError(error => {
        console.error('Unable to scope client conversations to the current coach:', error);
        return of(this.emptyConversationPage(page, size));
      })
    );
  }

  private isClientUser(): boolean {
    try {
      const roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
      return Array.isArray(roles) && roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH');
    } catch {
      return false;
    }
  }

  private emptyConversationPage(page: number, size: number): PageDto<Conversation> {
    return { content: [], totalElements: 0, totalPages: 0, number: page, size };
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
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('_ts', Date.now().toString());

    return this.http.get<PageDto<ChatMessage>>(
      `${this.apiUrl}/messages/${conversationId}`,
      {
        params,
        headers: new HttpHeaders({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        })
      }
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

  uploadMessageAttachment(formData: FormData): Observable<ChatMessage> {
    const url = `${this.apiUrl}/messages/upload`;

    console.log('UPLOAD URL =', url);

    formData.forEach((value, key) => {
      console.log('UPLOAD FIELD:', key, value);
    });

    return this.http.post<ChatMessage>(url, formData).pipe(
      catchError((err) => {
        console.error('UPLOAD ERROR STATUS =', err.status);
        console.error('UPLOAD ERROR URL =', err.url);
        console.error('UPLOAD ERROR MESSAGE =', err.message);
        console.error('UPLOAD ERROR BODY =', err.error);
        console.error('UPLOAD ERROR FULL =', err);

        alert(this.translate.instant('UPLOAD_FAILED_DETAILS', {
          status: err.status || this.translate.instant('UNKNOWN'),
          message: err.message || this.translate.instant('UNKNOWN'),
        }));

        return throwError(() => err);
      })
    );
  }

  uploadAttachment(
    conversationId: string,
    senderId: string,
    type: 'VOICE' | 'DOCUMENT',
    file: File,
    durationSeconds?: number,
    content?: string
  ): Observable<ChatMessage> {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    formData.append('senderId', senderId);
    formData.append('type', type);
    formData.append('file', file, file.name);

    const cleanContent = (content || '').trim();
    if (cleanContent) {
      formData.append('content', cleanContent);
    }

    if (durationSeconds != null) {
      formData.append('durationSeconds', String(durationSeconds));
    }

    return this.uploadMessageAttachment(formData);
  }


  downloadAttachment(attachmentUrl: string, downloadName?: string): Observable<Blob> {
    let params = new HttpParams().set('attachmentUrl', attachmentUrl);
    if (downloadName) {
      params = params.set('downloadName', downloadName);
    }

    return this.http.get(`${this.apiUrl}/messages/download`, {
      params,
      responseType: 'blob'
    }).pipe(
      catchError((err) => {
        console.error('DOWNLOAD ERROR STATUS =', err.status);
        console.error('DOWNLOAD ERROR URL =', err.url);
        console.error('DOWNLOAD ERROR MESSAGE =', err.message);
        console.error('DOWNLOAD ERROR BODY =', err.error);
        console.error('DOWNLOAD ERROR FULL =', err);

        return throwError(() => err);
      })
    );
  }

  getAutoMessageSequences(conversationId: string): Observable<AutoMessageSequenceDto[]> {
    return this.http.get<AutoMessageSequenceDto[]>(
      `${this.apiUrl}/conversations/${conversationId}/auto-messages`
    );
  }

  createAutoMessageSequence(request: AutoMessageSequenceRequest): Observable<AutoMessageSequenceDto> {
    return this.http.post<AutoMessageSequenceDto>(`${this.apiUrl}/auto-messages`, request);
  }

  updateAutoMessageSequence(id: string, request: AutoMessageSequenceRequest): Observable<AutoMessageSequenceDto> {
    return this.http.put<AutoMessageSequenceDto>(`${this.apiUrl}/auto-messages/${id}`, request);
  }

  deleteAutoMessageSequence(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/auto-messages/${id}`);
  }

  uploadAutoMessageAttachment(file: File): Observable<AutoMessageItemDto> {
    const formData = new FormData();
    formData.append('type', 'DOCUMENT');
    formData.append('file', file, file.name);

    return this.http.post<AutoMessageItemDto>(`${this.apiUrl}/auto-messages/attachments`, formData);
  }

}

