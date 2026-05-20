import {
  Component, OnInit, AfterViewChecked,
  ViewChild, ElementRef, HostListener, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ChatService } from '../../../service/chat.service';
import { UsersService } from '../../../service/users.service';
import { Conversation } from '../models/conversation';
import { ChatMessage } from '../models/chat-message';
import { Subject, Observable, takeUntil, forkJoin, of } from 'rxjs';
import { switchMap, catchError, map, tap } from 'rxjs/operators';

export interface Client { id: string; name: string; avatar: string; }
export interface Member { id: string; name: string; avatar: string; }


@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {

  @ViewChild('messagesContainer') private msgContainer!: ElementRef<HTMLElement>;

  // ── Responsive ────────────────────────────────────────────────────────────
  isMobile = false;
  showList = true;

  // ── Sidebar search ────────────────────────────────────────────────────────
  searchTerm = '';
  filteredConversationsCache: Conversation[] = [];

  // ── Selected conversation + message input ─────────────────────────────────
  selectedConv: Conversation | null = null;
  selectedConvMembers: Member[] = [];
  showAllMembers = false;
  messageText = '';
  private scrollPending = false;
  displayMessages: any[] = [];

  // ── Modals ────────────────────────────────────────────────────────────────
  showNewChat     = false;
  showSelectClient = false;
  selectClientSearchTerm = '';
  showCreateGroup = false;

  // ── Create Group state ────────────────────────────────────────────────────
  groupName        = '';
  groupSearchTerm  = '';
  selectedClientIds: string[] = [];
  groupSelectAll   = false;
  allClients: Client[] = [];

  // ── Real data ─────────────────────────────────────────────────────────────
  conversations: Conversation[] = [];
  currentUserId = sessionStorage.getItem('userId') || '';
  private destroy$ = new Subject<void>();

  constructor(
    private chatService: ChatService,
    private userService: UsersService
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.checkMobile();
    forkJoin({
      convs: this.loadConversations(),
      users: this.loadUserSuggestions()
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.addMissingConvClients();
    });
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending) { this.scrollToBottom(); this.scrollPending = false; }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void { this.checkMobile(); }

  private checkMobile(): void { this.isMobile = window.innerWidth < 768; }

  private scrollToBottom(): void {
    try {
      const el = this.msgContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // ── Load Conversations ────────────────────────────────────────────────────
  private loadConversations(): Observable<any> {
    return this.chatService.getConversations(0, 20).pipe(
      takeUntil(this.destroy$),
      switchMap((pageDto) => {
        console.log('🔵 [loadConversations] RAW from backend:', JSON.parse(JSON.stringify(pageDto.content)));
        const observables = pageDto.content.map(conv =>
          this.enrichConversation(conv)
        );
        return forkJoin(observables).pipe(tap(finalConvs => {
          console.log('🔵 [loadConversations] AFTER enrich:', JSON.parse(JSON.stringify(finalConvs)));
          this.conversations = finalConvs;
          this.filteredConversationsCache = finalConvs;
        }));
      }),
      catchError((err) => {
        console.error('Error loading conversations:', err);
        this.conversations = [];
        this.filteredConversationsCache = [];
        return of(null);
      })
    );
  }

  private enrichConversation(conv: Conversation): Observable<Conversation> {
    if (conv.isGroup) return of(conv);
    let otherUserId = '';
    if (this.currentUserId === conv.clientId) {
      otherUserId = conv.coachId;
    } else if (this.currentUserId === conv.coachId) {
      otherUserId = conv.clientId;
    }
    if (!otherUserId) return of(conv);

    return this.userService.getUserById(otherUserId).pipe(
      map(user => {
        conv.name = user.firstName + " " + user.lastName;
        if (user.avatarUrl === 'not found') {
          conv.avatar = '';
        } else {
          conv.avatar = user.avatarUrl;
        }
        return conv;
      }),
      catchError(() => of(conv))
    );
  }

  private loadUserSuggestions(): Observable<any> {
    return this.userService.getUsersSuggestions(0, 100).pipe(
      takeUntil(this.destroy$),
      tap((res) => {
        console.log('🟢 [loadUserSuggestions] RAW from backend:', JSON.parse(JSON.stringify(res.content)));
        this.allClients = (res.content || []).map((user: any) => ({
          id: user.id,
          name: user.firstName + " " + user.lastName,
          avatar: user.avatarUrl && user.avatarUrl !== 'not found' ? user.avatarUrl : ''
        }));
        console.log('🟢 [loadUserSuggestions] MAPPED allClients:', JSON.parse(JSON.stringify(this.allClients)));
      }),
      catchError((err) => {
        console.error('Error loading user suggestions:', err);
        return of(null);
      })
    );
  }

  private addMissingConvClients(): void {
    const existingIds = new Set(this.allClients.map(c => c.id));
    const toFetch: string[] = [];
    for (const conv of this.conversations) {
      if (conv.isGroup) continue;
      const otherId = this.currentUserId === conv.clientId ? conv.coachId : conv.clientId;
      if (otherId && !existingIds.has(otherId) && otherId !== this.currentUserId) {
        toFetch.push(otherId);
        existingIds.add(otherId);
      }
    }
    if (!toFetch.length) return;
    forkJoin(toFetch.map(id => this.userService.getUserById(id).pipe(
      map(u => ({ id, name: u.firstName + ' ' + u.lastName, avatar: u.avatarUrl === 'not found' ? '' : u.avatarUrl })),
      catchError(() => of(null))
    ))).subscribe(users => {
      const valid = users.filter((u): u is Client => u !== null);
      if (valid.length) this.allClients = [...this.allClients, ...valid];
    });
  }

  // ── Conversations ─────────────────────────────────────────────────────────
  filteredConversations(): Conversation[] {
    const t = this.searchTerm.trim().toLowerCase();
    if (!t) return this.conversations;
    return this.conversations.filter(c => c.name?.toLowerCase().includes(t));
  }

  get convListForDebug(): Conversation[] {
    return this.conversations;
  }

   selectConversation(conv: Conversation): void {
     console.log('🟣 [selectConversation] conv:', JSON.parse(JSON.stringify(conv)));
     this.selectedConv = conv;
     this.selectedConvMembers = [];
     this.showAllMembers = false;
     this.displayMessages = [];
     this.loadMessages(conv.id);
     if (conv.isGroup && conv.memberIds?.length) {
       this.resolveGroupMembers(conv.memberIds);
     }
     if (this.isMobile) this.showList = false;
   }

   private resolveGroupMembers(memberIds: string[]): void {
     const requests = memberIds.map(id =>
       this.userService.getUserById(id).pipe(
         map(user => ({ id, name: user.firstName + ' ' + user.lastName, avatar: user.avatarUrl === 'not found' ? '' : user.avatarUrl })),
         catchError(() => of({ id, name: 'Unknown', avatar: '' }))
       )
     );
     forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe(members => {
       console.log('🟠 [resolveGroupMembers] resolved:', JSON.parse(JSON.stringify(members)));
       this.selectedConvMembers = members;
       this.displayMessages = this.displayMessages.map((m: any) => ({
         ...m,
         sender: {
           name: this.getUserName(m.senderId),
           avatar: this.getUserAvatar(m.senderId),
           initials: this.getInitials(m.senderId)
         }
       }));
     });
   }

   private loadMessages(conversationId: string): void {
     console.log('Loading messages for conversation:', conversationId);
     this.chatService.getMessages(conversationId, 0, 50)
       .pipe(takeUntil(this.destroy$))
       .subscribe({
         next: (pageDto) => {
           console.log('Messages loaded:', pageDto);
           if (!pageDto.content || pageDto.content.length === 0) {
             console.log('No messages received');
             this.displayMessages = [];
             return;
           }
           this.displayMessages = pageDto.content.map((msg: ChatMessage) => {
             console.log('Processing message:', msg);
             return {
               id: msg.id,
               senderId: msg.senderId,
               text: msg.content || '',
               timestamp: this.formatTime(msg.createdAt),
               isRead: true,
               sender: {
                 name: this.getUserName(msg.senderId),
                 avatar: this.getUserAvatar(msg.senderId),
                 initials: this.getInitials(msg.senderId)
               }
             };
           });
           console.log('🟣 [loadMessages] displayMessages:', this.displayMessages.map((m: any) => ({ id: m.id, senderId: m.senderId, text: m.text })));
           this.scrollPending = true;
         },
         error: (err) => {
           console.error('Error loading messages:', err);
           this.displayMessages = [];
         }
       });
   }

   private formatTime(date: string | undefined): string {
     try {
       if (!date) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       const d = new Date(date);
       if (isNaN(d.getTime())) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
     } catch (e) {
       console.error('Error formatting time:', e, date);
       return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
     }
   }

   private getUserName(userId: string): string {
     if (userId === this.currentUserId) return 'You';
     if (this.selectedConv?.isGroup) {
       const member = this.selectedConvMembers.find(m => m.id === userId);
       return member ? member.name : userId.slice(0, 8);
     }
     const conv = this.selectedConv;
     if (!conv) return userId || 'Unknown';
     return conv.name || userId || 'Unknown';
   }

   private getUserAvatar(userId: string): string {
     if (userId === this.currentUserId) return '';
     if (this.selectedConv?.isGroup) {
       const member = this.selectedConvMembers.find(m => m.id === userId);
       return member ? member.avatar : '';
     }
     const conv = this.selectedConv;
     if (!conv) return '';
     return conv.avatar || '';
   }

   private getInitials(userId: string): string {
     const name = this.getUserName(userId);
     return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || 'U';
   }

  backToList(): void { this.showList = true; }

  // ── Messages ──────────────────────────────────────────────────────────────
  sendMessage(): void {
    if (!this.messageText.trim() || !this.selectedConv) return;

    const content = this.messageText.trim();
    this.messageText = '';

    this.chatService.sendMessage(this.selectedConv.id, content, this.currentUserId);

    // Add message optimistically to UI
    const msg = {
      id: `msg-${Date.now()}`,
      senderId: this.currentUserId,
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      sender: {
        name: 'You',
        avatar: '',
        initials: 'YO'
      }
    };
    this.displayMessages = [...this.displayMessages, msg];
    this.scrollPending = true;

    // Update conversation last message
    const idx = this.conversations.findIndex(c => c.id === this.selectedConv!.id);
    if (idx !== -1) {
      this.conversations[idx] = {
        ...this.conversations[idx],
        lastMessage: content,
      };
      this.conversations = [...this.conversations];
    }
  }

  // ── Modals navigation ─────────────────────────────────────────────────────
  openNewChatModal(): void {
    this.showNewChat = true;
    this.showCreateGroup = false;
    this.showSelectClient = false;
  }

  closeModals(): void {
    this.showNewChat = false;
    this.showSelectClient = false;
    this.showCreateGroup = false;
    this._resetGroupForm();
    this.selectClientSearchTerm = '';
  }

  goToSelectClient(): void {
    this.showNewChat = false;
    this.showSelectClient = true;
    this.selectClientSearchTerm = '';
  }

  goToCreateGroup(): void {
    this.showNewChat = false;
    this.showCreateGroup = true;
    this._resetGroupForm();
  }

  backToNewChat(): void {
    this.showCreateGroup = false;
    this.showSelectClient = false;
    this.showNewChat = true;
    this._resetGroupForm();
  }

  startPrivateChat(client: Client): void {
    console.log('🟡 [startPrivateChat] selected client:', client);
    const request = { coachId: this.currentUserId, clientId: client.id };
    console.log('🟡 [startPrivateChat] request:', request);
    this.chatService.createConversation(request).pipe(
      takeUntil(this.destroy$),
      switchMap((conv: Conversation) => {
        console.log('🟡 [startPrivateChat] created conv (before enrich):', JSON.parse(JSON.stringify(conv)));
        return this.enrichConversation(conv);
      })
    ).subscribe({
      next: (conv: Conversation) => {
        console.log('🟡 [startPrivateChat] enriched conv:', JSON.parse(JSON.stringify(conv)));
        this.conversations = [conv, ...this.conversations];
        this.selectConversation(conv);
        this.closeModals();
      },
      error: (err) => console.error('Error creating conversation:', err)
    });
  }

  // ── Private Chat ──────────────────────────────────────────────────────────
  filteredSelectClients(): Client[] {
    const t = this.selectClientSearchTerm.trim().toLowerCase();
    if (!t) return this.allClients;
    return this.allClients.filter(c => c.name.toLowerCase().includes(t));
  }

  // ── Create Group ──────────────────────────────────────────────────────────
  filteredGroupClients(): Client[] {
    const t = this.groupSearchTerm.trim().toLowerCase();
    return t ? this.allClients.filter(c => c.name.toLowerCase().includes(t)) : this.allClients;
  }

  isClientSelected(id: string): boolean {
    return this.selectedClientIds.includes(id);
  }

  toggleClient(id: string): void {
    if (this.isClientSelected(id)) {
      this.selectedClientIds = this.selectedClientIds.filter(x => x !== id);
      this.groupSelectAll = false;
    } else {
      this.selectedClientIds = [...this.selectedClientIds, id];
      if (this.selectedClientIds.length === this.allClients.length) {
        this.groupSelectAll = true;
      }
    }
  }

  handleGroupSelectAll(): void {
    if (this.groupSelectAll) {
      this.selectedClientIds = [];
      this.groupSelectAll = false;
    } else {
      this.selectedClientIds = this.allClients.map(c => c.id);
      this.groupSelectAll = true;
    }
  }

  getClientFirstName(id: string): string {
    const client = this.allClients.find(c => c.id === id);
    return client ? client.name.split(' ')[0] : '';
  }

  createGroup(): void {
    if (!this.groupName.trim() || this.selectedClientIds.length < 2) return;

    this.chatService.createGroupConversation({
      name: this.groupName.trim(),
      memberIds: [this.currentUserId, ...this.selectedClientIds]
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newConv) => {
        this.conversations = [newConv, ...this.conversations];
        this.selectConversation(newConv);
        this.closeModals();
      },
      error: (err) => console.error('Error creating group:', err)
    });
  }

  private _resetGroupForm(): void {
    this.groupName       = '';
    this.groupSearchTerm = '';
    this.selectedClientIds = [];
    this.groupSelectAll  = false;
  }
}
