import {
  Component, OnInit, AfterViewChecked,
  ViewChild, ElementRef, HostListener, OnDestroy, Input, OnChanges, SimpleChanges, forwardRef
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { AutoMessageItemDto, AutoMessageSequenceDto, AutoMessageSequenceRequest, ChatService } from '../../../service/chat.service';
import { ChatWebsocketService } from '../../../service/chat-websocket.service';
import { UsersService } from '../../../service/users.service';
import { ClientService } from '../../../service/client.service';
import { Conversation } from '../models/conversation';
import { ChatMessage } from '../models/chat-message';
import { ProfilClientComponent } from '../../clients/profil-client/profil-client.component';
import { Subject, Observable, take, takeUntil, forkJoin, merge, of } from 'rxjs';
import { switchMap, catchError, debounceTime, finalize, map, tap } from 'rxjs/operators';
import { environment } from '@env/environment';
import { ChatUnreadService } from '../../../service/chat-unread.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CoachSettingsService } from '../../../service/coach-settings.service';
import { DocumentService } from '../../../service/document.service';

export interface Client { id: string; name: string; avatar: string; }
export interface Member { id: string; name: string; avatar: string; }
type AutoMessageSequence = AutoMessageSequenceDto;
type ChatUiMessageType = 'TEXT' | 'VOICE' | 'DOCUMENT';


/** Last page of messages of each conversation (this session): reopening a conversation shows it at once. */
const MESSAGES_SNAPSHOT = new Map<string, ChatMessage[]>();
/** Last conversation list of the connected user (names and avatars included), this session. */
const CHAT_LIST_SNAPSHOT = new Map<string, { conversations: Conversation[]; contacts: Client[] }>();

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, forwardRef(() => ProfilClientComponent)],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  onConversationAvatarError(conversation: Conversation): void {
    conversation.avatar = '';
  }


  @ViewChild('messagesContainer') private msgContainer!: ElementRef<HTMLElement>;

  @Input() embeddedMode = false;
  @Input() embeddedClientId = '';
  @Input() embeddedCoachId = '';
  /** Coach "client view" preview: the conversation as the client sees it, read only, without the coach tools. */
  @Input() clientPreview = false;

  /** Message written by the person whose view is shown (the client in the preview). */
  isOwnMessage(message: { senderId?: string } | null | undefined): boolean {
    const viewer = this.clientPreview ? this.embeddedClientId : this.currentUserId;
    return !!message && message.senderId === viewer;
  }


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
  messageError = '';
  private scrollPending = false;
  displayMessages: any[] = [];
  private optimisticMessageSeq = 0;
  private composerDispatchLocked = false;
  private readonly voicePlaybackRequests = new Set<string>();
  private readonly voicePlaybackRetryCounts = new Map<string, number>();
  private readonly voiceObjectUrls = new Set<string>();
  private readonly imageObjectUrls = new Set<string>();
  private readonly imagePlaybackRequests = new Set<string>();
  previewImageUrl = '';
  previewImageName = '';
  readonly maxMessageLength = 5_000;
  readonly maxAttachmentSize = 20 * 1024 * 1024;
  private attachmentErrorTimer?: ReturnType<typeof setTimeout>;

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
  /**
   * Client whose profile panel was opened once: the panel (eight requests) is built only then, not each time a
   * conversation opens with the panel closed; it stays built afterwards so closing / reopening reloads nothing.
   */
  profileBuiltFor: string | null = null;

  get selectedClientId(): string {
    if (!this.selectedConv || this.selectedConv.isGroup) return '';

    if (this.currentUserId === this.selectedConv.clientId) {
      return this.selectedConv.coachId || '';
    }

    return this.selectedConv.clientId || '';
  }

  toggleClientProfile(): void {
    this.showClientProfile = !this.showClientProfile;
    if (this.showClientProfile) this.profileBuiltFor = this.selectedClientId || null;

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
  showAutoMessageModal = false;
  showManageAutoMessages = false;
  autoMessageManageSearch = '';
  editingAutoMessage: AutoMessageSequence | null = null;
  autoSequenceName = '';
  autoSequenceDate = '';
  autoSequenceTime = '05:00';
  autoMessageDraft = '';
  autoSequenceMessages: string[] = [];
  autoSequenceItems: AutoMessageItemDto[] = [];
  isUploadingAutoAttachment = false;
  isSavingAutoSequence = false;
  autoSequenceSubmitted = false;
  autoSequenceNameTouched = false;
  autoSequenceDateTouched = false;
  autoSequenceTimeTouched = false;
  autoMessageDraftTouched = false;
  autoSequenceItemTouched: boolean[] = [];
  autoSequenceTimeZone = 'Africa/Tunis';
  private autoSequenceValidationTimer: ReturnType<typeof setInterval> | null = null;
  autoMessagesByConversation: Record<string, AutoMessageSequence[]> = {};

  // ── Create Group state ────────────────────────────────────────────────────
  groupName        = '';
  groupSearchTerm  = '';
  selectedClientIds: string[] = [];
  groupSelectAll   = false;
  allClients: Client[] = [];

  // ── Real data ─────────────────────────────────────────────────────────────
  conversations: Conversation[] = [];
  currentUserId = sessionStorage.getItem('userId') || '';
  unreadCounts = new Map<string, number>();
  private destroy$ = new Subject<void>();

  get isClientUser(): boolean {
    const roles = this.getCurrentRoles();
    return roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH');
  }

  get canCreateChats(): boolean {
    if (this.clientPreview) return false;
    const roles = this.getCurrentRoles();
    return roles.includes('ROLE_COACH') || roles.includes('ROLE_ADMIN');
  }

  get currentAutoSequences(): AutoMessageSequence[] {
    if (!this.selectedConv) return [];
    return (this.autoMessagesByConversation[this.selectedConv.id] || [])
      .filter((sequence) => sequence.status !== 'COMPLETED' && sequence.status !== 'CANCELLED');
  }

  get filteredAutoSequences(): AutoMessageSequence[] {
    const term = this.autoMessageManageSearch.trim().toLowerCase();
    if (!term) return this.currentAutoSequences;
    return this.currentAutoSequences.filter((sequence) =>
      sequence.name.toLowerCase().includes(term) ||
      this.formatAutoSequenceSchedule(sequence).toLowerCase().includes(term)
    );
  }

  get conversationTimeline(): any[] {
    const messages = this.displayMessages.map((message: any) => ({
      kind: 'message',
      at: this.getTimelineTime(message.createdAtRaw),
      message,
    }));

    const autoSequences = this.currentAutoSequences.map((sequence) => ({
      kind: 'auto-sequence',
      at: this.getTimelineTime(sequence.createdAt),
      sequence,
    }));

    return [...messages, ...autoSequences].sort((a, b) => a.at - b.at);
  }

  constructor(
    private chatService: ChatService,
    private userService: UsersService,
    private clientService: ClientService,
    private wsService: ChatWebsocketService,
    private chatUnreadService: ChatUnreadService,
    private coachSettingsService: CoachSettingsService,
    private documentService: DocumentService,
    private router: Router,
    private translate: TranslateService
  ) {}

  goBack(): void {
    window.history.back();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['embeddedClientId'] || changes['embeddedCoachId']) && this.embeddedMode) {
      this.tryOpenEmbeddedConversation();
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.checkMobile();
    if (this.clientLayout) {
      const tree = this.router.parseUrl(this.router.url);
      this.clientWantsCoach = !!tree.queryParams['coach'];
      if (this.clientWantsCoach) {
        delete tree.queryParams['coach'];
        void this.router.navigateByUrl(tree, { replaceUrl: true });
      }
    }
    // The list shows as soon as the conversations and the contacts are here (names and avatars from the contacts);
    // only the missing people and the coaches' public photos are completed afterwards, in the background.
    // Back on the chat in this session: the last list is shown and the conversation opened at once, then refreshed.
    const known = this.embeddedMode ? undefined : CHAT_LIST_SNAPSHOT.get(this.currentUserId);
    if (known) {
      this.conversations = known.conversations;
      this.conversationsLoaded = true;
      this.filteredConversationsCache = known.conversations;
      this.allClients = known.contacts;
      this.subscribeToAllConversations(known.conversations);
      if (!this.openRequestedConversation()) {
        this.openExpandedConversation();
        this.openDefaultClientConversation();
      }
    }
    forkJoin({
      convs: this.loadConversations(),
      // The contacts serve the coach (new chat, names); a client only talks with their coach.
      users: this.canCreateChats ? this.loadUserSuggestions() : of(null)
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.enrichConversationsInBackground(); // also adds the people missing from the contacts
      this.tryOpenEmbeddedConversation();
      if (known) return; // already opened from the last list
      if (this.openRequestedConversation()) return;
      this.openExpandedConversation();
      this.openDefaultClientConversation();
    });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        if (!msg) return;

        const targetIdx = this.conversations.findIndex(c => c.id === msg.conversationId);
        if (targetIdx !== -1) {
          const target = this.conversations[targetIdx];
          const preview = this.normalizeMessageType(msg.type) === 'VOICE'
            ? '🎤 Voice message'
            : this.normalizeMessageType(msg.type) === 'DOCUMENT'
              ? `📎 ${msg.attachmentName || 'Document'}`
              : (msg.content || '');
          const isOpen = this.selectedConv?.id === msg.conversationId;
          this.conversations[targetIdx] = {
            ...target,
            lastMessage: preview,
            lastMessageAt: msg.createdAt,
            unreadCount: (!isOpen && msg.senderId !== this.currentUserId)
              ? (target.unreadCount || 0) + 1
              : target.unreadCount || 0
          } as Conversation;
          this.conversations = [...this.conversations];
        }

        if (!msg || !this.selectedConv || msg.conversationId !== this.selectedConv.id) return;
        this.upsertDisplayMessage(msg);
        this.updateConversationPreview(msg);
        // A message of a scheduled sequence may just have been sent: refreshed once for a burst of messages.
        this.scheduleAutoMessagesRefresh(this.selectedConv.id);
        this.scrollPending = true;
      });

    // Keep conversation previews in sync when another component updates the active
    // conversation (for example `ConversationMessagesComponent` updates its
    // `selectedConversation.lastMessage`). Subscribe to the shared selected
    // conversation stream and apply preview updates to the conversations list.
    this.chatService.selectedConversation$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sharedConv) => {
        if (!sharedConv) return;
        try {
          const keyOfShared = this.getConversationUniqueKey(sharedConv as Conversation);
          const idx = this.conversations.findIndex(c => this.getConversationUniqueKey(c) === keyOfShared);
          if (idx !== -1) {
            // update lastMessage (and keep other fields intact)
            this.conversations[idx] = {
              ...this.conversations[idx],
              lastMessage: (sharedConv as Conversation).lastMessage || this.conversations[idx].lastMessage
            } as Conversation;
            // trigger change detection by replacing the array reference
            this.conversations = [...this.conversations];
          }
        } catch (e) {
          // defensive: do not break on unexpected data
          console.error('Error syncing shared conversation preview:', e, sharedConv);
        }
      });

    this.chatService.conversationRefresh$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe((conversationId) => {
        if (this.selectedConv?.id === conversationId) {
          this.loadMessages(conversationId);
        }
      });

    // Follow unread state tracked from the (reliable) notification system
    this.chatUnreadService.unreadCounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(counts => {
        this.unreadCounts = counts;
      });

  }

  ngAfterViewChecked(): void {
    if (this.scrollPending) {
      this.scrollPending = false;
      requestAnimationFrame(() => {
        this.scrollToBottom();
        setTimeout(() => this.scrollToBottom(), 0);
      });
    }
  }

  ngOnDestroy(): void {
    if (!this.embeddedMode && this.conversations.length) {
      CHAT_LIST_SNAPSHOT.set(this.currentUserId, { conversations: this.conversations, contacts: this.allClients });
    }
    clearTimeout(this.autoMessagesRefreshTimer);
    this.stopAutoSequenceValidationClock();
    this.chatService.notifyConversationOpened(null);
    this.cancelVoiceRecording();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.attachmentErrorTimer) clearTimeout(this.attachmentErrorTimer);
    this.voiceObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.voiceObjectUrls.clear();
    this.imageObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.imageObjectUrls.clear();
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
  /** Conversations as stored: shown at once, named from the contacts list (see enrichConversationsInBackground). */
  private loadConversations(): Observable<any> {
    return this.chatService.getConversations(0, 100).pipe(
      takeUntil(this.destroy$),
      tap((pageDto) => {
        // Names and avatars already known (last list) are kept until the background enrichment refreshes them.
        const previous = new Map(this.conversations.map((conv) => [conv.id, conv]));
        const uniqueConvs = this.dedupeConversations(pageDto.content || []).map((conv) => {
          const before: any = previous.get(conv.id);
          return before ? ({ ...conv, name: conv.name || before.name, avatar: (conv as any).avatar || before.avatar } as Conversation) : conv;
        });
        this.conversations = uniqueConvs;
        this.filteredConversationsCache = uniqueConvs;
        this.conversationsLoaded = true;
        this.subscribeToAllConversations(uniqueConvs);
      }),
      catchError((err) => {
        console.error('Error loading conversations:', err);
        this.conversations = [];
        this.filteredConversationsCache = [];
        this.conversationsLoaded = true;
        return of(null);
      })
    );
  }

  /**
   * Names and avatars: from the contacts already loaded when possible (no request per conversation); the other people,
   * and a coach's public photo (seen by a client), are fetched in the background and patched in as they arrive.
   */
  private enrichConversationsInBackground(): void {
    const contacts = new Map(this.allClients.map((client) => [client.id, client]));
    const toFetch: Conversation[] = [];
    const named = this.conversations.map((conv) => {
      if (conv.isGroup) return conv;
      const otherId = this.currentUserId === conv.clientId ? conv.coachId : conv.clientId;
      const contact = otherId ? contacts.get(otherId) : undefined;
      if (contact && otherId !== conv.coachId) return { ...conv, name: contact.name, avatar: contact.avatar || '' } as Conversation;
      if (otherId) toFetch.push(conv);
      return contact ? { ...conv, name: contact.name } as Conversation : conv;
    });
    this.conversations = named;
    this.filteredConversationsCache = named;

    merge(...toFetch.map((conv) => this.enrichConversation({ ...conv })))
      .pipe(takeUntil(this.destroy$))
      .subscribe((enriched) => {
        this.patchConversation(enriched);
        // The person was not in the contacts: added now (no second request for them).
        const otherId = this.currentUserId === enriched.clientId ? enriched.coachId : enriched.clientId;
        if (otherId && otherId !== this.currentUserId && enriched.name && !this.allClients.some((client) => client.id === otherId)) {
          this.allClients = [...this.allClients, { id: otherId, name: enriched.name, avatar: enriched.avatar || '' } as Client];
        }
      });
  }

  private patchConversation(enriched: Conversation): void {
    const patch = (list: Conversation[]) => list.map((conv) => conv.id === enriched.id
      ? { ...conv, name: enriched.name || conv.name, avatar: enriched.avatar ?? conv.avatar } as Conversation
      : conv);
    this.conversations = patch(this.conversations);
    this.filteredConversationsCache = patch(this.filteredConversationsCache);
    if (this.selectedConv?.id === enriched.id) {
      this.selectedConv = { ...this.selectedConv, name: enriched.name || this.selectedConv.name, avatar: enriched.avatar ?? this.selectedConv.avatar } as Conversation;
    }
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

    const coachPhoto$ = otherUserId === conv.coachId
      ? this.coachSettingsService.getConfigForCoach(conv.coachId, true).pipe(
          switchMap(settings => {
            const profile = settings.publicProfile;
            const storedUrl = profile.photoVisible ? profile.photoUrl?.trim() : '';
            return storedUrl
              ? this.documentService.refreshStoredFileUrl(storedUrl).pipe(catchError(() => of('')))
              : of('');
          }),
          catchError(() => of('')),
        )
      : of(null);

    return forkJoin({
      user: this.userService.getUserById(otherUserId, true, true), // background: no full-screen loader nor error toast
      coachPhoto: coachPhoto$,
    }).pipe(
      map(({ user, coachPhoto }) => {
        conv.name = user.firstName + " " + user.lastName;
        if (otherUserId === conv.coachId) {
          // Never fall back to a folder/user avatar for a coach: it may point
          // to a different object. Use the exact configured public photo only.
          conv.avatar = coachPhoto || '';
        } else if (user.avatarUrl === 'not found') {
          conv.avatar = '';
        } else {
          conv.avatar = user.avatarUrl || '';
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

  private subscribeToAllConversations(convs: Conversation[]): void {
    for (const conv of convs) {
      if (conv.id) this.wsService.subscribeToConversation(conv.id);
    }
  }

  private loadUserSuggestions(): Observable<any> {
    return this.userService.getUsersSuggestions(0, 100).pipe(
      takeUntil(this.destroy$),
      tap((res) => {
        this.allClients = (res.content || []).map((user: any) => ({
          id: user.id,
          name: user.firstName + " " + user.lastName,
          avatar: user.avatarUrl && user.avatarUrl !== 'not found' ? user.avatarUrl : ''
        }));
      }),
      catchError((err) => {
        console.error('Error loading user suggestions:', err);
        return of(null);
      })
    );
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

  /**
   * Links of the coach dashboard: ?conversationId= opens that conversation, ?clientId= the existing private
   * conversation with that client (or starts it). The parameters are then removed from the address.
   */
  private openRequestedConversation(): boolean {
    if (this.embeddedMode) return false;
    const tree = this.router.parseUrl(this.router.url);
    const conversationId = tree.queryParams['conversationId'];
    const clientId = tree.queryParams['clientId'];
    if (!conversationId && !clientId) return false;
    if (this.isClientUser) this.clientOpenedDirectly = true;

    const target = conversationId
      ? this.conversations.find((conv) => conv.id === conversationId)
      : this.findExistingPrivateConversation(clientId);
    if (target) {
      this.selectConversation(target);
    } else if (clientId) {
      const client = this.allClients.find((item) => String(item.id) === String(clientId));
      if (client) this.startPrivateChat(client);
    }

    delete tree.queryParams['conversationId'];
    delete tree.queryParams['clientId'];
    void this.router.navigateByUrl(tree, { replaceUrl: true });
    return true;
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
  private openDefaultClientConversation(): void {
    if (this.embeddedMode || !this.isClientUser || this.selectedConv) return;
    // Like the mobile app: Messages shows the list; only Home's "Message" (?coach=1) opens the coach conversation.
    if (!this.clientWantsCoach) return;
    this.clientWantsCoach = false;
    this.clientOpenedDirectly = true;

    const coachConversation = this.conversations.find((conv) =>
      !conv.isGroup &&
      conv.clientId === this.currentUserId &&
      !!conv.coachId
    );

    if (coachConversation) {
      this.selectConversation(coachConversation);
      return;
    }

    this.clientService.getClientById(this.currentUserId).pipe(
      take(1),
      switchMap((client: any) => {
        const coachId = client?.coachId || client?.coach?.id || client?.coach?._id;
        if (!coachId) return of(null);

        return this.chatService.createConversation({
          coachId,
          clientId: this.currentUserId,
        }).pipe(
          switchMap((conversation) => this.enrichConversation(conversation)),
          catchError((error) => {
            console.error('Error creating default client conversation:', error);
            return of(null);
          })
        );
      }),
      takeUntil(this.destroy$),
      catchError((error) => {
        console.error('Error loading client coach for chat:', error);
        return of(null);
      })
    ).subscribe((conversation) => {
      if (!conversation || this.selectedConv) return;

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

  private getCurrentRoles(): string[] {
    try {
      const parsed = JSON.parse(sessionStorage.getItem('roles') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  filteredConversations(): Conversation[] {
    const t = this.searchTerm.trim().toLowerCase();
    if (!t) return this.conversations;
    return this.conversations.filter(c => c.name?.toLowerCase().includes(t));
  }

  get convListForDebug(): Conversation[] {
    return this.conversations;
  }

   selectConversation(conv: Conversation): void {
     this.selectedConv = conv;
     this.chatService.notifyConversationOpened(conv.id);
     conv.unreadCount = 0;
     this.chatUnreadService.markConversationRead(conv.id);
     const idx = this.conversations.findIndex(c => c.id === conv.id);
     if (idx !== -1) this.conversations = [...this.conversations];
     this.selectedConvMembers = [];
     this.showAllMembers = false;
     // Last messages seen in this conversation: shown at once, the fresh page replaces them.
     const knownMessages = MESSAGES_SNAPSHOT.get(conv.id) || [];
     this.displayMessages = [...knownMessages].reverse().map((msg: ChatMessage) => this.mapMessageToUi(msg));
     if (knownMessages.length) this.scrollPending = true;
     this.wsService.subscribeToConversation(conv.id);
     this.loadMessages(conv.id);
     // Scheduled messages are a coach tool: a client never sees them.
     if (this.canCreateChats) this.loadAutoMessageSequences(conv.id);
     if (conv.isGroup && conv.memberIds?.length) {
       this.resolveGroupMembers(conv.memberIds);
     }
     if (this.isMobile || this.embeddedMode) this.showList = false;
   }

   private resolveGroupMembers(memberIds: string[]): void {
     const requests = memberIds.map(id =>
       this.userService.getUserById(id, true, true).pipe(
         map(user => ({ id, name: user.firstName + ' ' + user.lastName, avatar: user.avatarUrl === 'not found' ? '' : user.avatarUrl })),
         catchError(() => of({ id, name: 'Unknown', avatar: '' }))
       )
     );
     forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe(members => {
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
     // The page-level loader already covered the conversation list. Messages
     // refresh inside the selected conversation without blocking the whole UI.
     this.chatService.getMessages(conversationId, 0, 50, true)
       .pipe(takeUntil(this.destroy$))
       .subscribe({
          next: (pageDto) => {
            if (this.selectedConv?.id !== conversationId) return;
            if (!pageDto.content || pageDto.content.length === 0) {
              console.log('No stored messages received');
              return;
            }
            MESSAGES_SNAPSHOT.set(conversationId, [...pageDto.content]);
            const loadedMessages = pageDto.content
             .reverse()
             .map((msg: ChatMessage) => this.mapMessageToUi(msg));
            const loadedIds = new Set(loadedMessages.map((message: any) => message.id));
            const liveMessages = this.displayMessages.filter((message: any) => !loadedIds.has(message.id));
            this.displayMessages = [...loadedMessages, ...liveMessages]
              .sort((a: any, b: any) => this.getTimelineTime(a.createdAtRaw) - this.getTimelineTime(b.createdAtRaw));
           this.scrollPending = true;
         },
         error: (err) => {
           console.error('Error loading messages:', err);
           if (!MESSAGES_SNAPSHOT.has(conversationId)) this.displayMessages = [];
         }
       });
   }

   private mapMessageToUi(msg: ChatMessage, optimistic = false): any {
     const type = this.normalizeMessageType(msg.type);
     const attachmentUrl = msg.attachmentUrl ? this.resolveFileUrl(msg.attachmentUrl) : '';
     const mapped = {
       id: msg.id,
       uiKey: msg.uiKey || msg.id,
       optimistic,
       deliveryStatus: msg.deliveryStatus || (optimistic ? 'sending' : 'sent'),
       retry: msg.retry,
        senderId: msg.senderId,
        text: msg.content || '',
        type,
        attachmentUrl,
        playbackUrl: msg.playbackUrl || (type === 'VOICE' && attachmentUrl.startsWith('blob:') ? attachmentUrl : ''),
        imageUrl: type === 'DOCUMENT' && this.isImageAttachment(msg) && attachmentUrl.startsWith('blob:') ? attachmentUrl : '',
        attachmentName: msg.attachmentName || 'Document',
        attachmentType: msg.attachmentType || '',
       attachmentSize: msg.attachmentSize || 0,
       durationSeconds: msg.durationSeconds || 0,
       createdAtRaw: msg.createdAt || '',
       timestamp: this.formatChatTimestamp(msg.createdAt),
       isRead: true,
       sender: {
         name: this.getUserName(msg.senderId),
         avatar: this.getUserAvatar(msg.senderId),
         initials: this.getInitials(msg.senderId)
       }
};
      if (type === 'VOICE' && !optimistic && !mapped.playbackUrl) {
        setTimeout(() => this.prepareVoicePlayback(mapped));
      }
      if (type === 'DOCUMENT' && this.isImageAttachment(mapped) && !optimistic) {
        setTimeout(() => this.prepareImagePlayback(mapped));
      }
      return mapped;
    }

   private createOptimisticTextMessage(conversationId: string, content: string): ChatMessage {
     const now = new Date().toISOString();
     this.optimisticMessageSeq += 1;

     return {
       id: `tmp-${Date.now()}-${this.optimisticMessageSeq}`,
       senderId: this.currentUserId,
       content,
       createdAt: now,
       conversationId,
       type: 'TEXT',
     };
   }

   private upsertDisplayMessage(msg: ChatMessage): void {
      const existingIndex = msg.id
        ? this.displayMessages.findIndex((message: any) => !!message.id && message.id === msg.id)
        : -1;
     const mappedMessage = this.mapMessageToUi(msg);

     if (existingIndex !== -1) {
       mappedMessage.uiKey = this.displayMessages[existingIndex].uiKey || mappedMessage.uiKey;
       mappedMessage.playbackUrl = this.displayMessages[existingIndex].playbackUrl || mappedMessage.playbackUrl;
       mappedMessage.imageUrl = this.displayMessages[existingIndex].imageUrl || mappedMessage.imageUrl;
       this.displayMessages = this.displayMessages.map((message: any, index: number) =>
         index === existingIndex ? mappedMessage : message
       );
       this.prepareVoicePlayback(mappedMessage);
       // A websocket/server acknowledgement can replace an optimistic image. Force the
       // persisted copy to be resolved so we never keep a revoked local blob URL.
       this.prepareImagePlayback(mappedMessage, this.isImageAttachment(mappedMessage));
       return;
     }

     const optimisticIndex = this.displayMessages.findIndex((message: any) =>
       message.optimistic &&
       message.senderId === msg.senderId &&
       message.type === this.normalizeMessageType(msg.type) &&
       message.text === (msg.content || '') &&
(!msg.attachmentName || message.attachmentName === msg.attachmentName)
     );

     if (optimisticIndex !== -1) {
       const optimisticMessage = this.displayMessages[optimisticIndex];
       mappedMessage.uiKey = optimisticMessage.uiKey || optimisticMessage.id;
       mappedMessage.playbackUrl = optimisticMessage.playbackUrl || mappedMessage.playbackUrl;
       // Keep the optimistic local blob visible only until the persisted MinIO copy is ready.
       // IMPORTANT: force a reload from the backend once the real message id exists; otherwise
       // the optimistic blob may later be revoked and Angular keeps rendering a dead blob URL.
       mappedMessage.imageUrl = optimisticMessage.imageUrl || optimisticMessage.attachmentUrl || mappedMessage.imageUrl;
       this.displayMessages = this.displayMessages.map((message: any, index: number) =>
         index === optimisticIndex ? mappedMessage : message
       );
       this.prepareVoicePlayback(mappedMessage);
       this.prepareImagePlayback(mappedMessage, this.isImageAttachment(mappedMessage));
       return;
     }

     this.displayMessages = [...this.displayMessages, mappedMessage];
     this.prepareVoicePlayback(mappedMessage);
     this.prepareImagePlayback(mappedMessage);
   }

   trackTimelineEntry(_: number, entry: any): string {
     return entry.kind === 'message'
       ? `message-${entry.message.uiKey || entry.message.id}`
       : `sequence-${entry.sequence.id}`;
   }

   prepareVoicePlayback(message: any, force = false): void {
     if (!message || message.type !== 'VOICE' || !message.id || message.id.startsWith('tmp-')) return;
     if (!force && message.playbackUrl && !message.playbackUrl.startsWith('blob:')) return;
     if (this.voicePlaybackRequests.has(message.id)) return;

     this.voicePlaybackRequests.add(message.id);
     this.chatService.getMessagePlaybackUrl(message.id)
       .pipe(takeUntil(this.destroy$))
       .subscribe({
         next: (url) => {
           const oldBlobUrl = message.playbackUrl?.startsWith('blob:') ? message.playbackUrl : '';
           this.displayMessages = this.displayMessages.map((item: any) =>
             item.id === message.id ? { ...item, playbackUrl: url } : item
           );
           if (oldBlobUrl) {
             this.voiceObjectUrls.delete(oldBlobUrl);
             setTimeout(() => URL.revokeObjectURL(oldBlobUrl), 5000);
           }
           this.voicePlaybackRequests.delete(message.id);
           this.voicePlaybackRetryCounts.delete(message.id);
         },
          error: (error) => {
            console.error('Voice playback URL could not be resolved:', error);
            this.voicePlaybackRequests.delete(message.id);
          }
        });
   }

   prepareImagePlayback(message: any, force = false): void {
     if (!message || message.type !== 'DOCUMENT' || !this.isImageAttachment(message) || !message.id || message.id.startsWith('tmp-')) return;
     if (!force && message.imageUrl) return;
     if (this.imagePlaybackRequests.has(message.id)) return;

     this.imagePlaybackRequests.add(message.id);
     message.imageLoadError = false;

     const finish = () => this.imagePlaybackRequests.delete(message.id);
     const applyUrl = (url: string) => {
       if (!url) {
         message.imageLoadError = true;
         finish();
         return;
       }
       this.displayMessages = this.displayMessages.map((item: any) =>
         item.id === message.id ? { ...item, imageUrl: url, imageLoadError: false } : item
       );
       finish();
     };

     // 1) Preferred path: authenticated backend proxy returning the real bytes.
     this.chatService.getMessageAttachmentBlob(message.id)
       .pipe(takeUntil(this.destroy$))
       .subscribe({
         next: (blob) => {
           if (blob && blob.size > 0 && (!blob.type || blob.type.toLowerCase().startsWith('image/'))) {
             const objectUrl = URL.createObjectURL(blob);
             const oldUrl = message.imageUrl?.startsWith('blob:') ? message.imageUrl : '';
             this.displayMessages = this.displayMessages.map((item: any) =>
               item.id === message.id ? { ...item, imageUrl: objectUrl, imageLoadError: false } : item
             );
             if (oldUrl && oldUrl !== objectUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
             finish();
             return;
           }
           // Proxy answered, but not with an image -> use fresh presigned URL as fallback.
           this.chatService.getMessageAttachmentUrl(message.id).pipe(takeUntil(this.destroy$)).subscribe({
             next: applyUrl,
             error: (urlError) => { console.error('Image URL fallback failed:', urlError); message.imageLoadError = true; finish(); }
           });
         },
         error: (proxyError) => {
           console.error('Image proxy failed, trying signed URL:', proxyError);
           this.chatService.getMessageAttachmentUrl(message.id).pipe(takeUntil(this.destroy$)).subscribe({
             next: applyUrl,
             error: (urlError) => { console.error('Image URL fallback failed:', urlError); message.imageLoadError = true; finish(); }
           });
         }
       });
   }

   refreshImagePlayback(message: any): void {
     if (!message || !message.id || message.id.startsWith('tmp-')) return;
     const retries = Number(message.imageLoadRetries || 0);
     if (retries >= 1) {
       message.imageLoadError = true;
       message.imageUrl = '';
       return;
     }
     message.imageLoadRetries = retries + 1;
     if (message.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(message.imageUrl);
     message.imageUrl = '';
     this.prepareImagePlayback(message, true);
   }

   refreshVoicePlayback(message: any): void {
     if (!message || message.playbackUrl?.startsWith('blob:')) return;
     const retries = this.voicePlaybackRetryCounts.get(message.id) || 0;
     if (retries >= 1) return;
     this.voicePlaybackRetryCounts.set(message.id, retries + 1);
     message.playbackUrl = '';
     this.prepareVoicePlayback(message, true);
   }

   private normalizeMessageType(type?: string): ChatUiMessageType {
     const value = (type || 'TEXT').toUpperCase();
     if (value === 'VOICE' || value === 'AUDIO') return 'VOICE';
     if (value === 'DOCUMENT' || value === 'DOC' || value === 'FILE') return 'DOCUMENT';
     return 'TEXT';
   }

   isImageAttachment(item: { attachmentType?: string; attachmentName?: string; attachmentUrl?: string }): boolean {
     const attachmentType = (item.attachmentType || '').toLowerCase();
     const name = (item.attachmentName || item.attachmentUrl || '').toLowerCase();
     return attachmentType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
   }

   resolveFileUrl(url: string): string {
     if (!url) return '';
     if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
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

   private formatChatTimestamp(date: string | undefined): string {
     if (!date) return '';
     const value = new Date(date);
     if (Number.isNaN(value.getTime())) return '';

     const locale = this.translate.currentLang || navigator.language;
     const time = value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
     const now = new Date();
     const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
     const messageDay = new Date(value.getFullYear(), value.getMonth(), value.getDate());
     const dayDifference = Math.round((today.getTime() - messageDay.getTime()) / 86_400_000);

     if (dayDifference === 0) return time;
     if (dayDifference === 1) return `${this.translate.instant('YESTERDAY')}, ${time}`;
     return `${value.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}, ${time}`;
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
    if (!this.selectedConv || this.isRecording || this.composerDispatchLocked) return;

    const content = this.messageText.trim();
    if (content.length > this.maxMessageLength) {
      this.messageError = this.translate.instant('MESSAGE_TOO_LONG');
      return;
    }

    this.composerDispatchLocked = true;
    setTimeout(() => this.composerDispatchLocked = false, 350);

    if (this.pendingDocument) {
      const file = this.pendingDocument;
      this.pendingDocument = null;
      this.messageText = '';
      this.messageError = '';
      this.uploadAttachment(file, 'DOCUMENT', undefined, content);
      return;
    }

    if (!content) return;

    this.messageText = '';
    this.messageError = '';
    const optimisticMessage = this.createOptimisticTextMessage(this.selectedConv.id, content);
    optimisticMessage.deliveryStatus = 'sending';
    optimisticMessage.retry = () => this.dispatchTextMessage(optimisticMessage, content);
    this.displayMessages = [...this.displayMessages, this.mapMessageToUi(optimisticMessage, true)];
    this.dispatchTextMessage(optimisticMessage, content);
    this.updateLocalConversationLastMessage(content);
    this.scrollPending = true;
  }

  private dispatchTextMessage(optimisticMessage: ChatMessage, content: string): void {
    this.updateDisplayDeliveryStatus(optimisticMessage.id, 'sending');
    this.chatService
      .sendMessage(this.selectedConv.id, content, this.currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (savedMessage) => {
          this.upsertDisplayMessage(savedMessage);
          this.updateConversationPreview(savedMessage);
          this.scrollPending = true;
        },
        error: (err) => {
          console.error('Message send failed:', err);
          this.updateDisplayDeliveryStatus(optimisticMessage.id, 'failed');
        }
      });
  }

  retryMessage(message: any): void {
    if (message.deliveryStatus !== 'failed' || typeof message.retry !== 'function') return;
    message.retry();
  }

  onMessageTextChange(value: string): void {
    this.messageError = value.trim().length > this.maxMessageLength
      ? this.translate.instant('MESSAGE_TOO_LONG')
      : '';
  }

  private updateDisplayDeliveryStatus(id: string, deliveryStatus: 'sending' | 'failed'): void {
    this.displayMessages = this.displayMessages.map((message: any) =>
      message.id === id ? { ...message, deliveryStatus } : message
    );
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
      this.showAttachmentError('Format non accepté. Formats acceptés : PDF, Word, Excel, PowerPoint, JPG, PNG, WEBP.');
      return;
    }

    if (file.size > this.maxAttachmentSize) {
      this.pendingDocument = null;
      this.showAttachmentError(this.translate.instant('FILE_TOO_LARGE'));
      return;
    }

    this.attachmentError = '';
    this.pendingDocument = file;
  }

  removePendingDocument(): void {
    this.pendingDocument = null;
    if (this.attachmentErrorTimer) clearTimeout(this.attachmentErrorTimer);
    this.attachmentError = '';
  }

  private showAttachmentError(message: string): void {
    if (this.attachmentErrorTimer) clearTimeout(this.attachmentErrorTimer);
    this.attachmentError = message;
    this.attachmentErrorTimer = setTimeout(() => {
      this.attachmentError = '';
      this.attachmentErrorTimer = undefined;
    }, 4_000);
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

  // ── Client layout: same as the mobile ConversationListScreen / ConversationMessagesScreen ──────────────
  clientFilter: 'ALL' | 'UNREAD' | 'GROUPS' = 'ALL';
  /** False until the first list answer: the client list shows a spinner instead of "No conversations". */
  conversationsLoaded = false;
  /** Opened on a conversation (Home "Message", a notification link): going back leaves the page. */
  private clientOpenedDirectly = false;
  clientWantsCoach = false;

  get clientLayout(): boolean { return this.isClientUser && !this.embeddedMode; }
  private get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  ct(en: string, fr: string): string { return this.fr ? fr : en; }

  clientUnreadCount(conv: Conversation): number {
    return Math.max(this.unreadCounts.get(conv.id) || 0, conv.unreadCount || 0);
  }

  get clientUnreadConversations(): number {
    return this.conversations.filter(conv => this.clientUnreadCount(conv) > 0).length;
  }

  get clientSubtitle(): string {
    const n = this.clientUnreadConversations;
    if (n > 0) return this.fr ? `${n} conversation${n === 1 ? '' : 's'} non lue${n === 1 ? '' : 's'}` : `${n} unread conversation${n === 1 ? '' : 's'}`;
    return this.ct('Your coach and your groups', 'Votre coach et vos groupes');
  }

  get clientConversations(): Conversation[] {
    return this.filteredConversations().filter(conv =>
      this.clientFilter === 'UNREAD' ? this.clientUnreadCount(conv) > 0 : this.clientFilter === 'GROUPS' ? conv.isGroup : true);
  }

  clientName(conv: Conversation | null): string {
    const name = (conv?.name || '').trim();
    if (!name) return this.ct('Unknown', 'Inconnu');
    return name.split(' ').map(word => word.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join('-')).join(' ');
  }

  clientInitials(name: string | undefined | null): string {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    return words.length ? words.slice(0, 2).map(word => word[0].toUpperCase()).join('') : '?';
  }

  /** "14:05", "Yesterday", "Oct 3" or "Oct 3 2025" (mobile _buildMetaLine). */
  clientTimeLabel(conv: Conversation): string {
    const msgs = conv.messages || [];
    const raw = msgs.length ? msgs[msgs.length - 1].createdAt : conv.lastMessageAt;
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const days = this.daysAgo(date);
    if (days === 0) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (days === 1) return this.ct('Yesterday', 'Hier');
    const label = `${new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { month: 'short' }).format(date).replace('.', '')} ${date.getDate()}`;
    return date.getFullYear() === new Date().getFullYear() ? label : `${label} ${date.getFullYear()}`;
  }

  clientMembersLabel(conv: Conversation): string {
    const n = conv.memberIds?.length || 0;
    return n > 0 ? `${n} ${this.ct(n === 1 ? 'member' : 'members', n === 1 ? 'membre' : 'membres')}` : '';
  }

  private daysAgo(date: Date): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return Math.round((today - day) / 86_400_000);
  }

  clientOpen(conv: Conversation): void {
    conv.unreadCount = 0;
    this.clientOpenedDirectly = false;
    this.selectConversation(conv);
  }

  clientBack(): void {
    if (this.clientOpenedDirectly) { window.history.back(); return; }
    this.selectedConv = null;
    this.displayMessages = [];
    this.chatService.notifyConversationOpened(null);
  }

  /** Date label shown above the first message of each day (mobile _buildDateSeparator). */
  clientDaySeparator(index: number): string {
    const entries = this.conversationTimeline;
    const current = entries[index];
    if (!current || current.kind !== 'message') return '';
    const at = new Date(current.at || current.message.createdAtRaw);
    if (Number.isNaN(at.getTime())) return '';
    const previous = index > 0 ? entries[index - 1] : null;
    if (previous) {
      const before = new Date(previous.at);
      if (before.getFullYear() === at.getFullYear() && before.getMonth() === at.getMonth() && before.getDate() === at.getDate()) return '';
    }
    const days = this.daysAgo(at);
    if (days === 0) return this.ct('Today', "Aujourd'hui");
    if (days === 1) return this.ct('Yesterday', 'Hier');
    return new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', at.getFullYear() === new Date().getFullYear()
      ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }).format(at);
  }

  /** Enter sends, Shift+Enter adds a line. */
  clientEnter(event: KeyboardEvent): void {
    if (event.shiftKey) return;
    event.preventDefault();
    this.sendMessage();
  }

  clientMessageTime(message: any): string {
    const date = message?.createdAtRaw ? new Date(message.createdAtRaw) : null;
    return date && !Number.isNaN(date.getTime()) ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';
  }

  clientDelivery(message: any): string {
    return message?.deliveryStatus === 'sending' ? this.ct('Sending', 'Envoi…')
      : message?.deliveryStatus === 'failed' ? this.ct('Failed', 'Échec') : this.ct('Sent', 'Envoyé');
  }

  // --- Helpers for conversation preview / unread state used by sidebar template ---
  getLastMessageText(conv: Conversation): string {
    try {
      const msgs = conv.messages || [];
      if (msgs.length > 0) {
        msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return msgs[msgs.length - 1].content || '';
      }
      // fallback to server-provided lastMessage string
      return conv.lastMessage || '';
    } catch (e) {
      console.error('getLastMessageText error', e);
      return conv.lastMessage || '';
    }
  }

  isConversationUnread(conv: Conversation): boolean {
    try {
      const fromNotifications = (this.unreadCounts.get(conv.id) || 0) > 0;
      if (fromNotifications) return true;

      if (conv.unreadCount != null && conv.unreadCount > 0) return true;

      const msgs = conv.messages || [];
      if (msgs.length === 0) return false;
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const last = msgs[msgs.length - 1];
      return !!(last && last.senderId && last.senderId !== this.currentUserId);
    } catch (e) {
      console.error('isConversationUnread error', e);
      return false;
    }
  }

  getConversationTimestamp(conv: Conversation): string {
    try {
      const msgs = conv.messages || [];
      if (msgs.length > 0) {
        msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return this.formatChatTimestamp(msgs[msgs.length - 1].createdAt);
      }
      // fallback if server provided a timestamp-like field
      // try to use conv['timestamp'] if present
      return this.formatChatTimestamp(conv.lastMessageAt);
    } catch (e) {
      return '';
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

    if (file.size > this.maxAttachmentSize) {
      this.showAttachmentError(this.translate.instant('FILE_TOO_LARGE'));
      return;
    }

    const optimisticId = `tmp-${Date.now()}-${++this.optimisticMessageSeq}`;
    const objectUrl = URL.createObjectURL(file);
    if (type === 'VOICE') this.voiceObjectUrls.add(objectUrl);
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      uiKey: optimisticId,
      senderId: this.currentUserId,
      content: content || '',
      createdAt: new Date().toISOString(),
      conversationId: this.selectedConv.id,
      type,
      attachmentUrl: objectUrl,
      playbackUrl: type === 'VOICE' ? objectUrl : undefined,
      attachmentName: file.name,
      attachmentType: file.type,
      attachmentSize: file.size,
      durationSeconds,
      deliveryStatus: 'sending',
    };
    optimisticMessage.retry = () => this.dispatchAttachment(optimisticMessage, file, type, durationSeconds, content);
    this.displayMessages = [...this.displayMessages, this.mapMessageToUi(optimisticMessage, true)];
    this.scrollPending = true;
    this.dispatchAttachment(optimisticMessage, file, type, durationSeconds, content);
  }

  private dispatchAttachment(optimisticMessage: ChatMessage, file: File, type: 'VOICE' | 'DOCUMENT', durationSeconds?: number, content?: string): void {
    this.updateDisplayDeliveryStatus(optimisticMessage.id, 'sending');

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
          const normalizedMessage: ChatMessage = {
            ...savedMessage,
            type: savedMessage.type || type,
            attachmentName: savedMessage.attachmentName || file.name,
            attachmentType: savedMessage.attachmentType || file.type,
            attachmentSize: savedMessage.attachmentSize || file.size,
          };
          this.upsertDisplayMessage(normalizedMessage);
          this.updateConversationPreview(normalizedMessage);
          this.scrollPending = true;
          if (type !== 'VOICE' && !this.isImageAttachment(normalizedMessage) && optimisticMessage.attachmentUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(optimisticMessage.attachmentUrl);
          }
        },
        error: (err) => {
          console.error('Attachment upload failed:', err);
          this.updateDisplayDeliveryStatus(optimisticMessage.id, 'failed');
          const serverMessage = typeof err?.error === 'string'
            ? err.error
            : (err?.error?.error || err?.error?.message || err?.error?.detail);
          if (serverMessage) this.showAttachmentError(serverMessage);
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
        lastMessageAt: new Date().toISOString(),
      };
      this.conversations = [...this.conversations];
    }
  }

  // ── Modals navigation ─────────────────────────────────────────────────────
  openNewChatModal(): void {
    if (!this.canCreateChats) return;

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

  private readonly autoMessagesLoading = new Set<string>();
  private autoMessagesRefreshTimer?: ReturnType<typeof setTimeout>;

  private scheduleAutoMessagesRefresh(conversationId: string): void {
    clearTimeout(this.autoMessagesRefreshTimer);
    this.autoMessagesRefreshTimer = setTimeout(() => this.loadAutoMessageSequences(conversationId), 1500);
  }

  /** One read at a time per conversation (opening a conversation could ask the same list twice). */
  private loadAutoMessageSequences(conversationId: string): void {
    if (this.autoMessagesLoading.has(conversationId)) return;
    this.autoMessagesLoading.add(conversationId);
    this.chatService
      .getAutoMessageSequences(conversationId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => this.autoMessagesLoading.delete(conversationId)))
      .subscribe({
        next: (sequences) => {
          this.autoMessagesByConversation = {
            ...this.autoMessagesByConversation,
            [conversationId]: sequences || [],
          };
        },
        error: (err) => {
          console.error('Error loading auto message sequences:', err);
          this.autoMessagesByConversation = {
            ...this.autoMessagesByConversation,
            [conversationId]: [],
          };
        }
      });
  }

  openAutoMessageModal(sequence?: AutoMessageSequence): void {
    if (!this.canCreateChats) return;
    if (!this.selectedConv) return;

    this.showManageAutoMessages = false;
    this.showAutoMessageModal = true;
    this.editingAutoMessage = sequence || null;
    this.resolveAutoSequenceClientTimeZone();
    this.startAutoSequenceValidationClock();

    if (sequence) {
      this.autoSequenceName = sequence.name;
      this.autoSequenceDate = sequence.date;
      this.autoSequenceTime = sequence.time;
      if (sequence.timeZone) this.autoSequenceTimeZone = sequence.timeZone;
      this.autoSequenceItems = this.getAutoSequenceItems(sequence).map((item) => ({ ...item }));
      this.autoSequenceItemTouched = this.autoSequenceItems.map(() => false);
      this.autoSequenceMessages = this.autoSequenceItems.map(item => item.content).filter(Boolean);
      this.autoMessageDraft = '';
      return;
    }

    this.resetAutoMessageForm();
  }

  closeAutoMessageModal(): void {
    this.showAutoMessageModal = false;
    this.editingAutoMessage = null;
    this.stopAutoSequenceValidationClock();
    this.resetAutoMessageForm();
  }

  openManageAutoMessages(): void {
    if (!this.canCreateChats) return;
    if (!this.selectedConv) return;
    this.showAutoMessageModal = false;
    this.showManageAutoMessages = true;
    this.autoMessageManageSearch = '';
  }

  closeManageAutoMessages(): void {
    this.showManageAutoMessages = false;
    this.autoMessageManageSearch = '';
  }

  addAutoSequenceMessage(): void {
    this.autoMessageDraftTouched = true;
    const message = this.autoMessageDraft.trim();
    if (!message || message.length > this.maxMessageLength || this.autoSequenceItems.length >= 3) return;

    this.autoSequenceItems = [...this.autoSequenceItems, { type: 'TEXT', content: message }];
    this.autoSequenceItemTouched = [...this.autoSequenceItemTouched, false];
    this.autoSequenceMessages = this.autoSequenceItems.map(item => item.content).filter(Boolean);
    this.autoMessageDraft = '';
    this.autoMessageDraftTouched = false;
  }

  removeAutoSequenceMessage(index: number): void {
    this.autoSequenceItems = this.autoSequenceItems.filter((_, i) => i !== index);
    this.autoSequenceItemTouched = this.autoSequenceItemTouched.filter((_, i) => i !== index);
    this.autoSequenceMessages = this.autoSequenceItems.map(item => item.content).filter(Boolean);
  }

  onAutoSequenceTextChanged(): void {
    this.autoSequenceMessages = this.autoSequenceItems.map(item => item.content).filter(Boolean);
  }

  deleteAutoMessageSequence(sequence: AutoMessageSequence, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!this.selectedConv) return;

    const conversationId = this.selectedConv.id;
    // Removed at once; put back if the server refuses.
    const before = this.autoMessagesByConversation[conversationId] || [];
    this.autoMessagesByConversation = {
      ...this.autoMessagesByConversation,
      [conversationId]: before.filter(item => item.id !== sequence.id),
    };
    this.chatService
      .deleteAutoMessageSequence(sequence.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => {
          console.error('Error deleting auto message sequence:', err);
          this.autoMessagesByConversation = { ...this.autoMessagesByConversation, [conversationId]: before };
        }
      });
  }

  onAutoAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || this.autoSequenceItems.length >= 3) return;

    if (!this.isAcceptedDocument(file)) {
      this.showAttachmentError('Format non accepté. Formats acceptés : PDF, Word, Excel, PowerPoint, JPG, PNG, WEBP.');
      return;
    }
    if (file.size > this.maxAttachmentSize) {
      this.showAttachmentError('File is too large. Maximum size is 20 MB.');
      return;
    }

    this.attachmentError = '';
    this.uploadAutoAttachment(file);
  }

  private uploadAutoAttachment(file: File): void {
    if (this.autoSequenceItems.length >= 3) return;

    this.isUploadingAutoAttachment = true;
    this.chatService
      .uploadAutoMessageAttachment(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (item) => {
          this.isUploadingAutoAttachment = false;
          this.autoSequenceItems = [...this.autoSequenceItems, item];
          this.autoSequenceItemTouched = [...this.autoSequenceItemTouched, false];
          this.autoSequenceMessages = this.autoSequenceItems.map(sequenceItem => sequenceItem.content).filter(Boolean);
        },
        error: (err) => {
          this.isUploadingAutoAttachment = false;
          console.error('Auto message attachment upload failed:', err);
        }
      });
  }

  saveAutoMessageSequence(): void {
    this.autoSequenceSubmitted = true;
    this.autoSequenceNameTouched = true;
    this.autoSequenceDateTouched = true;
    this.autoSequenceTimeTouched = true;
    this.autoSequenceItemTouched = this.autoSequenceItems.map(() => true);

    if (!this.selectedConv || !this.canSaveAutoSequence() || this.isSavingAutoSequence) return;

    this.isSavingAutoSequence = true;
    const conversationId = this.selectedConv.id;
    const request: AutoMessageSequenceRequest = {
      conversationId,
      name: this.autoSequenceName.trim(),
      date: this.autoSequenceDate,
      time: this.autoSequenceTime,
      timeZone: this.autoSequenceTimeZone,
      messages: this.autoSequenceItems.map(item => item.content).filter(Boolean),
      items: [...this.autoSequenceItems],
    };

    const save$ = this.editingAutoMessage
      ? this.chatService.updateAutoMessageSequence(this.editingAutoMessage.id, request)
      : this.chatService.createAutoMessageSequence(request);

    save$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.isSavingAutoSequence = false;
          this.closeAutoMessageModal();
          // The saved sequence comes back from the server: shown at once, no second request.
          if (saved?.id) {
            const current = this.autoMessagesByConversation[conversationId] || [];
            const exists = current.some(item => item.id === saved.id);
            this.autoMessagesByConversation = {
              ...this.autoMessagesByConversation,
              [conversationId]: exists ? current.map(item => (item.id === saved.id ? saved : item)) : [...current, saved],
            };
          } else {
            this.loadAutoMessageSequences(conversationId);
          }
        },
        error: (err) => {
          this.isSavingAutoSequence = false;
          console.error('Error saving auto message sequence:', err);
        }
      });
  }

  canSaveAutoSequence(): boolean {
    return !!(
      this.selectedConv &&
      !this.isSavingAutoSequence &&
      !this.getAutoSequenceNameError() &&
      !this.getAutoSequenceDateError() &&
      !this.getAutoSequenceTimeError() &&
      !this.getAutoSequenceItemsError() &&
      this.autoSequenceItems.length >= 1 &&
      this.autoSequenceItems.length <= 3
    );
  }

  getAutoSequenceNameError(): string {
    return this.autoSequenceName.trim() ? '' : 'Sequence name is required.';
  }

  getAutoSequenceDateError(): string {
    if (!this.autoSequenceDate) return 'Date is required.';
    const today = this.getNowInClientTimeZone().date;
    return this.autoSequenceDate < today ? 'Date cannot be in the past.' : '';
  }

  getAutoSequenceTimeError(): string {
    if (!this.autoSequenceTime) return 'Time is required.';
    if (!this.autoSequenceDate || this.getAutoSequenceDateError()) return '';
    const now = this.getNowInClientTimeZone();
    const selected = `${this.autoSequenceDate}T${this.autoSequenceTime}`;
    const current = `${now.date}T${now.time}`;
    return selected <= current ? 'Choose a future date and time.' : '';
  }

  getAutoSequenceItemsError(): string {
    if (this.autoSequenceItems.length < 1) return 'Add at least 1 message.';
    if (this.autoSequenceItems.length > 3) return 'A sequence can contain up to 3 messages.';
    for (const item of this.autoSequenceItems) {
      if (item.type === 'TEXT') {
        const content = item.content ?? '';
        if (!content.trim()) return 'Message cannot be empty.';
        if (content.trim().length > this.maxMessageLength) return 'Message cannot exceed 5000 characters.';
      }
      if (item.attachmentSize != null && item.attachmentSize > this.maxAttachmentSize) {
        return 'File is too large. Maximum size is 20 MB.';
      }
    }
    return '';
  }

  getAutoSequenceItemError(index: number): string {
    const item = this.autoSequenceItems[index];
    if (!item || item.type !== 'TEXT') return '';
    const content = item.content ?? '';
    if (!content.trim()) return 'Message cannot be empty.';
    if (content.trim().length > this.maxMessageLength) return 'Message cannot exceed 5000 characters.';
    return '';
  }

  getAutoMessageDraftError(): string {
    if (!this.autoMessageDraftTouched) return '';
    if (!this.autoMessageDraft.trim()) return 'Message cannot be empty.';
    if (this.autoMessageDraft.trim().length > this.maxMessageLength) return 'Message cannot exceed 5000 characters.';
    return '';
  }

  getAutoSequenceMinDate(): string {
    return this.getNowInClientTimeZone().date;
  }

  private startAutoSequenceValidationClock(): void {
    this.stopAutoSequenceValidationClock();
    // Keep the button/error state correct even when the form stays open while
    // the selected client-local time crosses into the past. setInterval runs
    // inside Angular's zone, so each tick triggers change detection.
    this.autoSequenceValidationTimer = setInterval(() => {
      if (!this.showAutoMessageModal) {
        this.stopAutoSequenceValidationClock();
        return;
      }
      // No mutation is required: the template calls the validation getters.
      // Touch the time field once the selected instant becomes invalid so the
      // required exact error is shown directly under Time.
      if (this.autoSequenceDate && this.autoSequenceTime && this.getAutoSequenceTimeError()) {
        this.autoSequenceTimeTouched = true;
      }
    }, 15_000);
  }

  private stopAutoSequenceValidationClock(): void {
    if (this.autoSequenceValidationTimer) {
      clearInterval(this.autoSequenceValidationTimer);
      this.autoSequenceValidationTimer = null;
    }
  }

  private getNowInClientTimeZone(): { date: string; time: string } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.autoSequenceTimeZone || 'Africa/Tunis',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(now).reduce((acc: Record<string, string>, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return {
      date: `${parts['year']}-${parts['month']}-${parts['day']}`,
      time: `${parts['hour']}:${parts['minute']}`
    };
  }

  private resolveAutoSequenceClientTimeZone(): void {
    const clientId = this.selectedConv?.clientId;
    if (!clientId) {
      this.autoSequenceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tunis';
      return;
    }
    this.userService.getUserById(clientId, true, true).pipe(take(1)).subscribe({
      next: (user: any) => {
        const candidate = user?.timeZone || user?.timezone || user?.zoneId || user?.zone;
        try {
          if (candidate) new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
          this.autoSequenceTimeZone = candidate || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tunis';
        } catch {
          this.autoSequenceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tunis';
        }
      },
      error: () => {
        this.autoSequenceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tunis';
      }
    });
  }

  getAutoSequenceItems(sequence: AutoMessageSequence): AutoMessageItemDto[] {
    if (sequence.items?.length) {
      return sequence.items;
    }
    return (sequence.messages || []).map((message) => ({ type: 'TEXT', content: message }));
  }

  formatAutoSequenceSchedule(sequence: AutoMessageSequence): string {
    const date = sequence.date ? new Date(`${sequence.date}T00:00:00`) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let label = sequence.date;
    if (date && !isNaN(date.getTime())) {
      const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
      if (diffDays === 0) label = 'Today';
      else if (diffDays === 1) label = 'Tomorrow';
      else label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return `${label} - ${sequence.time}`;
  }

  formatAutoSequenceStatus(sequence: AutoMessageSequence): string {
    const value = sequence.status || 'ACTIVE';
    return value.charAt(0) + value.slice(1).toLowerCase();
  }

  private getTimelineTime(value?: string): number {
    if (!value) return 0;
    const numericValue = Number(value);
    const time = !Number.isNaN(numericValue) && /^\d+(\.\d+)?$/.test(String(value))
      ? (numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue)
      : new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private resetAutoMessageForm(): void {
    this.autoSequenceName = '';
    this.autoSequenceDate = '';
    this.autoSequenceTime = '05:00';
    this.autoMessageDraft = '';
    this.autoSequenceMessages = [];
    this.autoSequenceItems = [];
    this.autoSequenceItemTouched = [];
    this.isUploadingAutoAttachment = false;
    this.isSavingAutoSequence = false;
    this.autoSequenceSubmitted = false;
    this.autoSequenceNameTouched = false;
    this.autoSequenceDateTouched = false;
    this.autoSequenceTimeTouched = false;
    this.autoMessageDraftTouched = false;
  }

  openImagePreview(msg: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!msg || !this.isImageAttachment(msg)) return;

    const open = (url: string) => {
      this.previewImageUrl = url;
      this.previewImageName = msg.attachmentName || 'Image';
    };

    if (msg.imageUrl) {
      open(msg.imageUrl);
      return;
    }

    if (msg.id && !msg.id.startsWith('tmp-')) {
      this.chatService.getMessageAttachmentBlob(msg.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.displayMessages = this.displayMessages.map((item: any) =>
              item.id === msg.id ? { ...item, imageUrl: objectUrl } : item
            );
            open(objectUrl);
          },
          error: (error) => console.error('Image preview could not be opened:', error)
        });
      return;
    }

    if (msg.attachmentUrl?.startsWith('blob:')) open(msg.attachmentUrl);
  }

  closeImagePreview(): void {
    this.previewImageUrl = '';
    this.previewImageName = '';
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
