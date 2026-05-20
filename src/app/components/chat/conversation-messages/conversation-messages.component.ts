import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Conversation} from "../models/conversation";
import {ChatMessage} from "../models/chat-message";
import {ChatService} from "../../../service/chat.service";
import {AuthService} from "@config/auth.service";
import {ChatWebsocketService} from "../../../service/chat-websocket.service";
import {FormsModule} from "@angular/forms";
import {DatePipe, NgClass, NgForOf, NgIf} from "@angular/common";
import {NotificationService} from "../../../service/notification.service";
import {Router} from "@angular/router";
import {UsersService} from "../../../service/users.service";
import {forkJoin, of} from "rxjs";
import {catchError, map} from "rxjs/operators";

export interface Member { id: string; name: string; avatar: string; }

@Component({
  selector: 'app-conversation-messages',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgForOf,
    DatePipe,
    NgIf
  ],
  templateUrl: './conversation-messages.component.html',
  styleUrl: './conversation-messages.component.scss'
})
export class ConversationMessagesComponent implements OnInit{
  @Input() selectedConversation!: Conversation;
  @Output() back = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  isOpenSidebar = true;

  currentUserId: string;
  groupMembers: Member[] = [];
  showAllGroupMembers = false;

  messages: ChatMessage[] = [];
  page = 0;
  pageSize = 20;
  hasMore = true;
  loading = false;


  messageText: string = '';

  constructor(private chatService: ChatService,
              private wsService: ChatWebsocketService,
              private notificationService: NotificationService,
              private userService: UsersService,
              private router: Router) {}

  ngOnInit(): void {
    this.currentUserId = sessionStorage.getItem("userId");
    this.messages = [];
    this.page = 0;
    this.hasMore = true;
    this.groupMembers = [];
    this.wsService.subscribeToConversation(this.selectedConversation.id);
    this.loadInitialMessages();
    if (this.selectedConversation.isGroup && this.selectedConversation.memberIds?.length) {
      this.resolveGroupMembers(this.selectedConversation.memberIds);
    }

    this.wsService.messages$.subscribe(msg => {
      if (!msg || !this.selectedConversation) return;
      if (msg.conversationId !== this.selectedConversation.id) return;

      const exists = this.messages.some(m => m.id === msg.id);
      if (!exists) {
        this.messages.push(msg);
        setTimeout(() => this.scrollToBottomIfNeeded(), 0);
      }
    });

  }

  toggleSidebar() {
    this.isOpenSidebar = !this.isOpenSidebar;
    this.closed.emit();
  }

  loadInitialMessages() {
    this.loading = true;
    this.chatService.getMessages(this.selectedConversation.id, 0).subscribe(res => {
      this.messages = res.content.reverse();
      this.loading = false;
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  private resolveGroupMembers(memberIds: string[]): void {
    const requests = memberIds.map(id =>
      this.userService.getUserById(id).pipe(
        map(user => ({ id, name: user.firstName + ' ' + user.lastName, avatar: user.avatarUrl === 'not found' ? '' : user.avatarUrl })),
        catchError(() => of({ id, name: 'Unknown', avatar: '' }))
      )
    );
    forkJoin(requests).subscribe(members => {
      this.groupMembers = members;
    });
  }

  toggleGroupMembers(): void {
    this.showAllGroupMembers = !this.showAllGroupMembers;
  }

  getSenderName(senderId: string): string {
    if (senderId === this.currentUserId) return 'You';
    const member = this.groupMembers.find(m => m.id === senderId);
    return member ? member.name : senderId.slice(0, 8);
  }

  sendMessage() {
    const text = this.messageText.trim();
    if (!text) return;
    this.chatService.sendMessage(this.selectedConversation.id, text, this.currentUserId);
    this.sendNotificationMessage([this.selectedConversation.clientId,this.selectedConversation.coachId]);

    this.messageText = '';

    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  sendNotificationMessage(userIds: string[]) {
    userIds = userIds.filter(id => id !== this.currentUserId);
    const notificationRequest = {
      notification: {
        notificationType: 'PUSH_NOTIF_MESSAGE',
        authorId: this.currentUserId
      },
      users: userIds,
    };
    this.notificationService.sendNotification(notificationRequest).subscribe();
  }


  onScroll(event: Event) {
    const el = event.target as HTMLElement;

    if (el.scrollTop === 0 && this.hasMore && !this.loading) {
      this.loadOlderMessages();
    }
  }

  loadOlderMessages() {
    if (!this.hasMore || this.loading) return;

    this.loading = true;
    const container = document.querySelector('.chat-messages') as HTMLElement;
    const previousHeight = container.scrollHeight;

    this.page++;

    this.chatService.getMessages(this.selectedConversation.id, this.page).subscribe(res => {
      if (res.content.length === 0) {
        this.hasMore = false;
        this.loading = false;
        return;
      }

      const olderMessages = res.content.reverse();
      this.messages = [...olderMessages, ...this.messages];
      setTimeout(() => {
        container.scrollTop = container.scrollHeight - previousHeight;
      }, 0);

      this.loading = false;
    });
  }


  scrollToBottom() {
    const el = document.querySelector('.chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  scrollToBottomIfNeeded() {
    const el = document.querySelector('.chat-messages');
    if (!el) return;

    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isNearBottom) {
      this.scrollToBottom();
    }
  }

  navigateTouserprofile(){
    if(this.selectedConversation.coachId === this.currentUserId) {
      this.router.navigate(['/edit-profile',this.selectedConversation.clientId]);
    }
    else {
      this.router.navigate(['/edit-profile',this.selectedConversation.coachId]);
    }
  }

}
