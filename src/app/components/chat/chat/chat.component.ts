import {
  Component, OnInit, AfterViewChecked,
  ViewChild, ElementRef, HostListener, OnDestroy, Input, OnChanges, SimpleChanges, forwardRef
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ChatService } from '../../../service/chat.service';
import { ChatWebsocketService } from '../../../service/chat-websocket.service';
import { UsersService } from '../../../service/users.service';
import { Conversation } from '../models/conversation';
import { ChatMessage } from '../models/chat-message';
import { ProfilClientComponent } from '../../clients/profil-client/profil-client.component';
import { Subject, Observable, take, takeUntil, forkJoin, of } from 'rxjs';
import { switchMap, catchError, map, tap } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface Client { id: string; name: string; avatar: string; }
export interface Member { id: string; name: string; avatar: string; }
type ChatUiMessageType = 'TEXT' | 'VOICE' | 'DOCUMENT';


@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, forwardRef(() => ProfilClientComponent)],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {

  @ViewChild('messagesContainer') private msgContainer!: ElementRef<HTMLElement>;

  @Input() embeddedMode = false;
  @Input() embeddedClientId = '';
  @Input() embeddedCoachId = '';


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

  // Attachments / voice messages
  showAttachmentMenu = false;
  isRecording = false;
  isUploadingAttachment = false;
  pendingDocument: File | null = null;
  attachmentError = '';
  readonly acceptedDocumentExtensions = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp';
  private readonly acceptedDocumentExtensionList = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];
  recordingSeconds = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingTimer: any = null;

  // ── Client Profile ─────────────────────────────────────────────────────────
  showClientProfile = false;

  get selectedClientId(): string {
    if (!this.selectedConv || this.selectedConv.isGroup) return '';

    if (this.currentUserId === this.selectedConv.clientId) {
      return this.selectedConv.coachId || '';
    }

    return this.selectedConv.clientId || '';
  }

  toggleClientProfile(): void {
    this.showClientProfile = !this.showClientProfile;

    if (this.showClientProfile && !this.isMobile) {
      this.showList = false;
    }
  }

  openClientProfilePage(): void {
    if (this.embeddedMode) {
      return;
    }

    const clientId = this.selectedClientId;

    if (!clientId || this.selectedConv?.isGroup) {
      return;
    }

    this.router.navigate(['/clients/profil-client', clientId]);
  }

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
    private userService: UsersService,
    private wsService: ChatWebsocketService,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['embeddedClientId'] || changes['embeddedCoachId']) && this.embeddedMode) {
      this.tryOpenEmbeddedConversation();
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.checkMobile();
    forkJoin({
      convs: this.loadConversations(),
      users: this.loadUserSuggestions()
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.addMissingConvClients();
      this.tryOpenEmbeddedConversation();
      this.openExpandedConversation();
    });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        if (!msg || !this.selectedConv || msg.conversationId !== this.selectedConv.id) return;
        if (this.displayMessages.some((m: any) => m.id === msg.id)) return;
        this.displayMessages = [...this.displayMessages, this.mapMessageToUi(msg)];
        this.updateConversationPreview(msg);
        this.scrollPending = true;
      });
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending) { this.scrollToBottom(); this.scrollPending = false; }
  }

  ngOnDestroy(): void {
    this.cancelVoiceRecording();
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
    return this.chatService.getConversations(0, 100).pipe(
      takeUntil(this.destroy$),
      switchMap((pageDto) => {
        console.log('🔵 [loadConversations] RAW from backend:', JSON.parse(JSON.stringify(pageDto.content)));
        const observables = pageDto.content.map(conv =>
          this.enrichConversation(conv)
        );
        return forkJoin(observables).pipe(tap(finalConvs => {
          console.log('🔵 [loadConversations] AFTER enrich:', JSON.parse(JSON.stringify(finalConvs)));
          const uniqueConvs = this.dedupeConversations(finalConvs);
          this.conversations = uniqueConvs;
          this.filteredConversationsCache = uniqueConvs;
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

  private dedupeConversations(conversations: Conversation[]): Conversation[] {
    const seen = new Set<string>();

    return conversations.filter((conv) => {
      const key = this.getConversationUniqueKey(conv);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private getConversationUniqueKey(conv: Conversation): string {
    if (conv.isGroup) {
      return `group:${conv.id}`;
    }

    const participantIds = [conv.clientId, conv.coachId].filter(Boolean).sort();
    return participantIds.length
      ? `private:${participantIds.join(':')}`
      : `private:${conv.id}`;
  }

  private findExistingPrivateConversation(clientId: string): Conversation | undefined {
    return this.conversations.find((conv) =>
      !conv.isGroup &&
      ((conv.clientId === clientId && conv.coachId === this.currentUserId) ||
       (conv.clientId === this.currentUserId && conv.coachId === clientId))
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


  private tryOpenEmbeddedConversation(): void {
    if (!this.embeddedMode || !this.embeddedClientId || !this.embeddedCoachId) {
      return;
    }

    this.showList = false;
    this.showClientProfile = false;

    const existing = this.conversations.find((conv) =>
      !conv.isGroup &&
      ((conv.clientId === this.embeddedClientId && conv.coachId === this.embeddedCoachId) ||
       (conv.clientId === this.embeddedCoachId && conv.coachId === this.embeddedClientId))
    );

    if (existing) {
      if (this.selectedConv?.id !== existing.id) {
        this.selectConversation(existing);
      }
      return;
    }

    this.chatService
      .createConversation({
        coachId: this.embeddedCoachId,
        clientId: this.embeddedClientId,
      })
      .pipe(
        switchMap((conversation) => this.enrichConversation(conversation)),
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error opening embedded chat conversation:', error);
          return of(null);
        })
      )
      .subscribe((conversation) => {
        if (!conversation) return;

        const already = this.conversations.some((item) =>
          item.id === conversation.id ||
          this.getConversationUniqueKey(item) === this.getConversationUniqueKey(conversation)
        );
        if (!already) {
          this.conversations = this.dedupeConversations([conversation, ...this.conversations]);
          this.filteredConversationsCache = this.conversations;
        }

        this.selectConversation(conversation);
      });
  }

  private openExpandedConversation(): void {
    if (this.embeddedMode) return;

    this.chatService.selectedConversation$
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((conversation) => {
        if (!conversation) return;

        const match = this.conversations.find(item => item.id === conversation.id);
        if (match) {
          this.selectConversation(match);
        }
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
     this.wsService.subscribeToConversation(conv.id);
     this.loadMessages(conv.id);
     if (conv.isGroup && conv.memberIds?.length) {
       this.resolveGroupMembers(conv.memberIds);
     }
     if (this.isMobile || this.embeddedMode) this.showList = false;
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
            this.displayMessages = pageDto.content
             .reverse()
             .map((msg: ChatMessage) => this.mapMessageToUi(msg));
           console.log('🟣 [loadMessages] displayMessages:', this.displayMessages.map((m: any) => ({ id: m.id, senderId: m.senderId, text: m.text })));
           this.scrollPending = true;
         },
         error: (err) => {
           console.error('Error loading messages:', err);
           this.displayMessages = [];
         }
       });
   }

   private mapMessageToUi(msg: ChatMessage): any {
     const type = this.normalizeMessageType(msg.type);

     return {
       id: msg.id,
       senderId: msg.senderId,
       text: msg.content || '',
       type,
       attachmentUrl: msg.attachmentUrl ? this.resolveFileUrl(msg.attachmentUrl) : '',
       attachmentName: msg.attachmentName || 'Document',
       attachmentType: msg.attachmentType || '',
       attachmentSize: msg.attachmentSize || 0,
       durationSeconds: msg.durationSeconds || 0,
       timestamp: this.formatTime(msg.createdAt),
       isRead: true,
       sender: {
         name: this.getUserName(msg.senderId),
         avatar: this.getUserAvatar(msg.senderId),
         initials: this.getInitials(msg.senderId)
       }
     };
   }

   private normalizeMessageType(type?: string): ChatUiMessageType {
     const value = (type || 'TEXT').toUpperCase();
     if (value === 'VOICE' || value === 'AUDIO') return 'VOICE';
     if (value === 'DOCUMENT' || value === 'DOC' || value === 'FILE') return 'DOCUMENT';
     return 'TEXT';
   }

   private resolveFileUrl(url: string): string {
     if (!url) return '';
     if (url.startsWith('http://') || url.startsWith('https://')) return url;
     return `${environment.baseApiUrl}${url}`;
   }

   formatFileSize(bytes?: number): string {
     if (!bytes) return '';
     if (bytes < 1024) return `${bytes} B`;
     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
     return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
   }

   formatDuration(seconds?: number): string {
     const total = Math.max(0, Math.round(seconds || 0));
     const min = Math.floor(total / 60);
     const sec = total % 60;
     return `${min}:${String(sec).padStart(2, '0')}`;
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

  backToList(): void { if (!this.embeddedMode) this.showList = true; }

  // ── Messages ──────────────────────────────────────────────────────────────
  sendMessage(): void {
    if (!this.selectedConv || this.isRecording || this.isUploadingAttachment) return;

    const content = this.messageText.trim();

    if (this.pendingDocument) {
      const file = this.pendingDocument;
      this.pendingDocument = null;
      this.messageText = '';
      this.uploadAttachment(file, 'DOCUMENT', undefined, content);
      return;
    }

    if (!content) return;

    this.messageText = '';
    this.chatService.sendMessage(this.selectedConv.id, content, this.currentUserId);
    this.updateLocalConversationLastMessage(content);
  }

  toggleAttachmentMenu(): void {
    this.showAttachmentMenu = !this.showAttachmentMenu;
  }

  onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.selectedConv) return;

    this.showAttachmentMenu = false;

    if (!this.isAcceptedDocument(file)) {
      this.pendingDocument = null;
      this.attachmentError = 'Format non accepté. Formats acceptés : PDF, Word, Excel, PowerPoint, JPG, PNG, WEBP.';
      return;
    }

    this.attachmentError = '';
    this.pendingDocument = file;
  }

  removePendingDocument(): void {
    this.pendingDocument = null;
    this.attachmentError = '';
  }

  private isAcceptedDocument(file: File): boolean {
    const extension = this.getFileExtension(file.name);
    return this.acceptedDocumentExtensionList.includes(extension);
  }

  private getFileExtension(fileName: string): string {
    return (fileName.split('.').pop() || '').toLowerCase();
  }

  async toggleVoiceRecording(): Promise<void> {
    if (this.isRecording) {
      this.stopVoiceRecording();
      return;
    }

    if (!this.selectedConv) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordingSeconds = 0;
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const duration = this.recordingSeconds;
        this.cleanupRecording();
        this.uploadAttachment(file, 'VOICE', duration);
      };

      this.recordingTimer = setInterval(() => {
        this.recordingSeconds += 1;
      }, 1000);

      this.mediaRecorder.start();
    } catch (err) {
      console.error('Microphone permission denied or unavailable:', err);
      this.cleanupRecording();
    }
  }

  stopVoiceRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }

  cancelVoiceRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.cleanupRecording();
  }

  private cleanupRecording(): void {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private uploadAttachment(file: File, type: 'VOICE' | 'DOCUMENT', durationSeconds?: number, content?: string): void {
    if (!this.selectedConv) return;

    this.isUploadingAttachment = true;

    this.chatService
      .uploadAttachment(
        this.selectedConv.id,
        this.currentUserId,
        type,
        file,
        durationSeconds,
        content
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (savedMessage) => {
          this.isUploadingAttachment = false;

          const normalizedMessage: ChatMessage = {
            ...savedMessage,
            type: savedMessage.type || type,
            attachmentName: savedMessage.attachmentName || file.name,
            attachmentType: savedMessage.attachmentType || file.type,
            attachmentSize: savedMessage.attachmentSize || file.size,
          };

          if (!this.displayMessages.some((m: any) => m.id === normalizedMessage.id)) {
            this.displayMessages = [...this.displayMessages, this.mapMessageToUi(normalizedMessage)];
          }
          this.updateConversationPreview(normalizedMessage);
          this.scrollPending = true;
        },
        error: (err) => {
          this.isUploadingAttachment = false;
          console.error('Attachment upload failed:', err);
          alert('Upload failed - Status: ' + (err.status || 'unknown') + '\nMessage: ' + (err.message || 'unknown') + '\nCheck console for details.');
        }
      });
  }

  private updateConversationPreview(msg: ChatMessage): void {
    const type = this.normalizeMessageType(msg.type);
    const preview = type === 'VOICE'
      ? '🎤 Voice message'
      : type === 'DOCUMENT'
        ? `📎 ${msg.attachmentName || 'Document'}`
        : (msg.content || '');

    this.updateLocalConversationLastMessage(preview);
  }

  private updateLocalConversationLastMessage(content: string): void {
    if (!this.selectedConv) return;

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
    const existingConversation = this.findExistingPrivateConversation(client.id);

    if (existingConversation) {
      this.selectConversation(existingConversation);
      this.closeModals();
      return;
    }

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
        const existingAfterCreate = this.findExistingPrivateConversation(client.id);
        const conversationToOpen = existingAfterCreate || conv;

        if (!existingAfterCreate) {
          this.conversations = this.dedupeConversations([conv, ...this.conversations]);
          this.filteredConversationsCache = this.conversations;
        }

        this.selectConversation(conversationToOpen);
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

  downloadDocument(msg: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const attachmentUrl = msg?.attachmentUrl || '';
    if (!attachmentUrl) {
      console.error('Document download failed: missing attachmentUrl', msg);
      return;
    }

    const fileName = msg?.attachmentName || this.extractFileNameFromUrl(attachmentUrl) || 'document';

    this.chatService.downloadAttachment(attachmentUrl, fileName).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      },
      error: (err) => {
        console.error('Document download failed:', err);

        // fallback: open static URL if the download endpoint is not reachable
        const fallbackUrl = this.resolveFileUrl
          ? this.resolveFileUrl(attachmentUrl)
          : attachmentUrl;
        if (fallbackUrl) {
          window.open(fallbackUrl, '_blank');
        }
      }
    });
  }

  private extractFileNameFromUrl(url: string): string {
    if (!url) return '';
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || 'document');
  }
}
