import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Conversation } from "../models/conversation";
import { ChatWebsocketService } from "../../../service/chat-websocket.service";
import { Subject, takeUntil } from 'rxjs';
import { NgClass, NgForOf, NgIf } from "@angular/common";
import { ChatService } from "../../../service/chat.service";
import { FormsModule } from "@angular/forms";
import { FeatherModule } from "angular-feather";
import { forkJoin, Observable, of, switchMap } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { TranslateModule } from "@ngx-translate/core";
import { UsersService } from "../../../service/users.service";
import { ChatUnreadService } from "../../../service/chat-unread.service";

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    FormsModule,
    FeatherModule,
    NgClass,
    TranslateModule
  ],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss'
})
export class ConversationListComponent implements OnInit {

  @Output() conversationSelected = new EventEmitter<Conversation>();
  @Output() closed = new EventEmitter<void>();

  conversations: Conversation[] = [];
  allConversations: Conversation[] = [];
  userSuggestions: any[] = [];
  searchUser = '';
  searchConversation = '';
  mode: 'LIST' | 'ADD' = 'LIST';

  private destroy$ = new Subject<void>();
  unreadCounts = new Map<string, number>();

  constructor(
    private chatService: ChatService,
    private userService: UsersService,
    private chatwsService: ChatWebsocketService,
    private chatUnreadService: ChatUnreadService
  ) {}

  ngOnInit(): void {
    this.loadConversations();
    // Follow unread state tracked from the (reliable) notification system
    this.chatUnreadService.unreadCounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(counts => {
        this.unreadCounts = counts;
      });
    // Keep conversation previews in sync when websocket messages arrive
    this.chatwsService.messages$.pipe(takeUntil(this.destroy$)).subscribe(msg => {
      if (!msg) return;
      const conv = this.conversations.find(c => c.id === msg.conversationId);
      if (!conv) return;
      // update preview and unread count
      conv.lastMessage = msg.content;
      try { (conv as any).timestamp = msg.createdAt || (conv as any).timestamp; } catch {}
      const currentUserId = sessionStorage.getItem('userId');
      const activeConversationId = this.chatService.getActiveConversationId();
      if (msg.senderId && msg.senderId !== currentUserId && msg.conversationId !== activeConversationId) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
      // trigger change detection by replacing array reference
      this.conversations = [...this.conversations];
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  loadConversations() {
    this.chatService.getConversations(0, 100).subscribe({
      next: (pageDto) => {

        const observables = pageDto.content.map(conv =>
          this.enrichConversation(conv)
        );

        forkJoin(observables).subscribe(finalConvs => {
          this.allConversations = finalConvs;
          this.conversations = finalConvs;
          this.subscribeToAllConversations(finalConvs);
        });
      },
      error: err => console.error(err)
    });
  }


  select(conv: Conversation) {
    conv.unreadCount = 0;
    this.chatUnreadService.markConversationRead(conv.id);
    const idx = this.conversations.findIndex(c => c.id === conv.id);
    if (idx !== -1) this.conversations = [...this.conversations];
    this.conversationSelected.emit(conv);
  }

  switchToAdd() {
    this.mode = 'ADD';
    this.loadUserSuggestions();
  }

  switchToList() {
    this.mode = 'LIST';
    this.searchUser = '';
    this.loadConversations();
  }

  loadUserSuggestions() {
    this.userService.getUsersSuggestions().subscribe({
      next: res => this.userSuggestions = res.content,
      error: err => console.error(err)
    });
  }

  searchUsers() {
    if (this.searchUser.length < 2) {
      this.loadUserSuggestions();
      return;
    }

    this.userService.searchUsers(this.searchUser).subscribe({
      next: res => this.userSuggestions = res.content,
      error: err => console.error(err)
    });
  }


  createConversationWith(user: any) {

    const request = {
      coachId: sessionStorage.getItem('userId'),
      clientId: user.id
    };

    this.chatService.createConversation(request).pipe(
      switchMap((conv: Conversation) => this.enrichConversation(conv))
    ).subscribe(convEnriched => {

      this.conversations = [convEnriched, ...this.conversations];
      this.allConversations = [convEnriched, ...this.allConversations];
      this.switchToList();
      this.select(convEnriched);

    });
  }

  private enrichConversation(conv: Conversation): Observable<Conversation> {
    if (conv.isGroup) return of(conv);

    const currentUserId = sessionStorage.getItem('userId');
    let otherUserId;
    if (currentUserId === conv.clientId){
      otherUserId = conv.coachId;
    }
    else if (currentUserId === conv.coachId) {
      otherUserId = conv.clientId;
    }
    if (!otherUserId) return of(conv);

    return this.userService.getUserById(otherUserId).pipe(
      map(user => {
        conv.name = user.firstName + " " + user.lastName;
        if(user.avatarUrl === 'not found')
          conv.avatar = null
        else
          conv.avatar = user.avatarUrl;
        return conv;
      }),
      catchError(() => of(conv))
    );
  }


  onSearchConversation() {
    const value = this.searchConversation.trim().toLowerCase();
    this.conversations = value
      ? this.allConversations.filter(c => c.name?.toLowerCase().includes(value))
      : [...this.allConversations];
  }

  closeChat() {
    this.closed.emit();
  }

  private subscribeToAllConversations(convs: Conversation[]): void {
    for (const conv of convs) {
      if (conv.id) this.chatwsService.subscribeToConversation(conv.id);
    }
  }

  // Helper: retourne le texte du dernier message réel (priorise conv.messages si présent)
  getLastMessageText(conv: Conversation): string {
    try {
      const msgs = conv.messages || [];
      if (msgs.length > 0) {
        // trier par date asc et prendre le dernier
        msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const last = msgs[msgs.length - 1];
        return last?.content || '';
      }

      // fallback si le serveur fournit déjà un champ lastMessage (string)
      if (conv.lastMessage) return conv.lastMessage as unknown as string;

      return '';
    } catch (e) {
      console.error('getLastMessageText error', e);
      return conv.lastMessage || '';
    }
  }

  // Helper: déterminer si la conversation a des messages non lus
  // La source de vérité est le système de notifications ; unreadCount est
  // utilisé en complément quand le backend le renseigne.
  isLastMessageUnread(conv: Conversation): boolean {
    try {
      const fromNotifications = (this.unreadCounts.get(conv.id) || 0) > 0;
      if (fromNotifications) return true;

      if (conv.unreadCount != null && conv.unreadCount > 0) return true;

      const msgs = conv.messages || [];
      if (msgs.length === 0) return false;

      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const last = msgs[msgs.length - 1];
      return !!(last && last.senderId && last.senderId !== sessionStorage.getItem('userId'));
    } catch (e) {
      console.error('isLastMessageUnread error', e);
      return false;
    }
  }

  getUnreadBadgeCount(conv: Conversation): number {
    return this.unreadCounts.get(conv.id) || conv.unreadCount || 0;
  }

}
