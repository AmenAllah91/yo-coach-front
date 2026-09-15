import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {Conversation} from "../models/conversation";
import {ChatMessage} from "../models/chat-message";
import {ChatService} from "../../../service/chat.service";
import {AuthService} from "@config/auth.service";
import {ChatWebsocketService} from "../../../service/chat-websocket.service";
import {FormsModule} from "@angular/forms";
import {DatePipe, NgClass, NgForOf, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault} from "@angular/common";
import {NotificationService} from "../../../service/notification.service";
import {Router} from "@angular/router";
import {UsersService} from "../../../service/users.service";
import {forkJoin, of, Subject} from "rxjs";
import {catchError, debounceTime, map, takeUntil} from "rxjs/operators";
import { environment } from "@env/environment";
import {FeatherModule} from "angular-feather";
import {TranslateModule, TranslateService} from "@ngx-translate/core";

export interface Member { id: string; name: string; avatar: string; }

@Component({
  selector: 'app-conversation-messages',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgForOf,
    DatePipe,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    FeatherModule,
    TranslateModule
  ],
  templateUrl: './conversation-messages.component.html',
  styleUrl: './conversation-messages.component.scss'
})
export class ConversationMessagesComponent implements OnInit, OnDestroy{
  @Input() selectedConversation!: Conversation;
  @Output() back = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() expanded = new EventEmitter<void>();

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
  messageError = '';
  readonly maxMessageLength = 5_000;
  readonly maxAttachmentSize = 20 * 1024 * 1024;
  private composerDispatchLocked = false;
  private attachmentErrorTimer?: ReturnType<typeof setTimeout>;

  isUploadingAttachment = false;
  pendingDocument: File | null = null;
  attachmentError = '';
  readonly acceptedDocumentExtensions = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp';
  private readonly acceptedDocumentExtensionList = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];
  isRecordingVoice = false;
  private mediaRecorder?: MediaRecorder;
  private recordedChunks: Blob[] = [];
  private recordingStartedAt = 0;
  private readonly destroy$ = new Subject<void>();
  private optimisticMessageSequence = 0;
  private readonly voicePlaybackRequests = new Set<string>();
  private readonly voicePlaybackRetryCounts = new Map<string, number>();
  private readonly voiceObjectUrls = new Set<string>();
  private readonly imagePlaybackRequests = new Set<string>();
  previewImageUrl = '';
  previewImageName = '';

  constructor(private chatService: ChatService,
              private wsService: ChatWebsocketService,
              private notificationService: NotificationService,
              private userService: UsersService,
              private router: Router,
              private translate: TranslateService) {}

  ngOnInit(): void {
    this.currentUserId = sessionStorage.getItem("userId");
    this.messages = [];
    this.page = 0;
    this.hasMore = true;
    this.groupMembers = [];
    this.wsService.subscribeToConversation(this.selectedConversation.id);
    this.chatService.notifyConversationOpened(this.selectedConversation.id);
    this.loadInitialMessages();
    if (this.selectedConversation.isGroup && this.selectedConversation.memberIds?.length) {
      this.resolveGroupMembers(this.selectedConversation.memberIds);
    }

    this.wsService.messages$.pipe(takeUntil(this.destroy$)).subscribe(msg => {
      if (!msg || !this.selectedConversation) return;
      if (msg.conversationId !== this.selectedConversation.id) return;

      const exists = !!msg.id && this.messages.some(m => !!m.id && m.id === msg.id);
      if (!exists) {
        const optimisticIndex = this.messages.findIndex(m =>
          m.id.startsWith('tmp-') &&
          m.senderId === msg.senderId &&
          m.content === msg.content &&
          m.type === msg.type &&
          (m.attachmentName || '') === (msg.attachmentName || '')
        );
        if (optimisticIndex >= 0) {
          const optimisticMessage = this.messages[optimisticIndex];
          const resolvedMessage: ChatMessage = {
            ...msg,
            deliveryStatus: 'sent',
            uiKey: optimisticMessage.uiKey || optimisticMessage.id,
            playbackUrl: optimisticMessage.playbackUrl,
          };
          this.messages = this.messages.map((message, index) => index === optimisticIndex
            ? resolvedMessage
            : message);
          this.prepareVoicePlayback(resolvedMessage);
          this.prepareImagePlayback(resolvedMessage);
        } else {
          const resolvedMessage: ChatMessage = { ...msg, deliveryStatus: 'sent' };
          this.messages = [...this.messages, resolvedMessage];
          this.prepareVoicePlayback(resolvedMessage);
          this.prepareImagePlayback(resolvedMessage);
        }
        setTimeout(() => this.scrollToBottomIfNeeded(), 0);
      }
    });

    this.chatService.conversationRefresh$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(conversationId => {
        if (conversationId === this.selectedConversation.id) {
          this.loadInitialMessages();
        }
      });

  }

  ngOnDestroy(): void {
    this.chatService.notifyConversationOpened(null);
    this.destroy$.next();
    this.destroy$.complete();
    if (this.attachmentErrorTimer) clearTimeout(this.attachmentErrorTimer);
    this.voiceObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.voiceObjectUrls.clear();
  }

  toggleSidebar() {
    this.isOpenSidebar = !this.isOpenSidebar;
    this.closed.emit();
  }

  loadInitialMessages() {
    this.loading = true;
    this.chatService.getMessages(this.selectedConversation.id, 0).subscribe(res => {
      const loadedMessages = res.content.reverse();
      const loadedIds = new Set(loadedMessages.map(message => message.id));
      const liveMessages = this.messages.filter(message => !loadedIds.has(message.id));
      this.messages = [...loadedMessages, ...liveMessages]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      this.messages.forEach(message => {
        this.prepareVoicePlayback(message);
        this.prepareImagePlayback(message);
      });
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
    if (this.isRecordingVoice || this.composerDispatchLocked) return;

    const text = this.messageText.trim();
    if (text.length > this.maxMessageLength) {
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
      this.uploadAttachment(file, 'DOCUMENT', undefined, text);
      return;
    }

    if (!text) return;

    this.messageText = '';
    this.messageError = '';

    const optimisticMessage: ChatMessage = {
      id: `tmp-${Date.now()}-${++this.optimisticMessageSequence}`,
      senderId: this.currentUserId,
      content: text,
      createdAt: new Date().toISOString(),
      conversationId: this.selectedConversation.id,
      type: 'TEXT'
    };
    optimisticMessage.deliveryStatus = 'sending';
    optimisticMessage.retry = () => this.dispatchTextMessage(optimisticMessage, text);
    this.messages = [...this.messages, optimisticMessage];

    this.dispatchTextMessage(optimisticMessage, text);

    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  private dispatchTextMessage(optimisticMessage: ChatMessage, text: string): void {
    this.updateDeliveryStatus(optimisticMessage.id, 'sending');
    this.chatService.sendMessage(this.selectedConversation.id, text, this.currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: savedMessage => {
          const alreadyReceived = this.messages.some(message => message.id === savedMessage.id);
          this.messages = alreadyReceived
            ? this.messages.filter(message => message.id !== optimisticMessage.id)
            : this.messages.map(message => message.id === optimisticMessage.id ? { ...savedMessage, deliveryStatus: 'sent' } : message);

          this.selectedConversation = {
            ...this.selectedConversation,
            lastMessage: savedMessage.content,
            messages: [...(this.selectedConversation.messages || []).filter(message => message.id !== optimisticMessage.id), savedMessage]
          };
          // inform shared service so other views (conversation list) can sync preview
          try { this.chatService.openConversation(this.selectedConversation); } catch (e) { /* ignore */ }
          setTimeout(() => this.scrollToBottom(), 0);
        },
        error: err => {
          console.error('Message send failed:', err);
          this.updateDeliveryStatus(optimisticMessage.id, 'failed');
        }
      });
  }

  retryMessage(message: ChatMessage): void {
    if (message.deliveryStatus === 'failed') message.retry?.();
  }

  onMessageTextChange(value: string): void {
    this.messageError = value.trim().length > this.maxMessageLength
      ? this.translate.instant('MESSAGE_TOO_LONG')
      : '';
  }

  private updateDeliveryStatus(id: string, deliveryStatus: 'sending' | 'failed'): void {
    this.messages = this.messages.map(message => message.id === id
      ? { ...message, deliveryStatus }
      : message);
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



  getMessageType(msg: ChatMessage): 'TEXT' | 'VOICE' | 'DOCUMENT' {
    const value = (msg?.type || 'TEXT').toString().trim().toUpperCase();

    if (value === 'VOICE' || value === 'AUDIO') return 'VOICE';
    if (value === 'DOCUMENT' || value === 'DOC' || value === 'FILE' || value === 'ATTACHMENT') return 'DOCUMENT';

    // Safety: if backend forgot type but sent an attachment, infer it from mime type/url.
    const attachmentType = (msg?.attachmentType || '').toLowerCase();
    const attachmentUrl = (msg?.attachmentUrl || '').toLowerCase();

    if (attachmentType.startsWith('audio/') || attachmentUrl.endsWith('.webm') || attachmentUrl.endsWith('.mp3') || attachmentUrl.endsWith('.wav') || attachmentUrl.endsWith('.m4a')) {
      return 'VOICE';
    }

    if (msg?.attachmentUrl) return 'DOCUMENT';

    return 'TEXT';
  }

  getAttachmentUrl(msg: ChatMessage): string {
    const url = msg?.attachmentUrl || '';
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    return `${environment.baseApiUrl}${url.startsWith('/') ? url : '/' + url}`;
  }

  getVoicePlaybackUrl(msg: ChatMessage): string {
    return msg.playbackUrl || '';
  }

  isImageAttachment(msg: ChatMessage): boolean {
    const type = (msg?.attachmentType || '').toLowerCase();
    const name = (msg?.attachmentName || msg?.attachmentUrl || '').toLowerCase();
    return type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
  }

  private prepareImagePlayback(message: ChatMessage, force = false): void {
    if (this.getMessageType(message) !== 'DOCUMENT' || !this.isImageAttachment(message) || !message.id || message.id.startsWith('tmp-')) return;
    if (!force && message.imageUrl) return;
    if (this.imagePlaybackRequests.has(message.id)) return;

    this.imagePlaybackRequests.add(message.id);
    (message as any).imageLoadError = false;
    const finish = () => this.imagePlaybackRequests.delete(message.id!);
    const applyUrl = (url: string) => {
      if (!url) { (message as any).imageLoadError = true; finish(); return; }
      this.messages = this.messages.map(current => current.id === message.id
        ? { ...current, imageUrl: url, imageLoadError: false } as any
        : current);
      finish();
    };

    this.chatService.getMessageAttachmentBlob(message.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          if (blob && blob.size > 0 && (!blob.type || blob.type.toLowerCase().startsWith('image/'))) {
            const objectUrl = URL.createObjectURL(blob);
            const oldUrl = message.imageUrl?.startsWith('blob:') ? message.imageUrl : '';
            this.messages = this.messages.map(current => current.id === message.id
              ? { ...current, imageUrl: objectUrl, imageLoadError: false } as any
              : current);
            if (oldUrl && oldUrl !== objectUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
            finish();
            return;
          }
          this.chatService.getMessageAttachmentUrl(message.id!).pipe(takeUntil(this.destroy$)).subscribe({
            next: applyUrl,
            error: err => { console.error('Image URL fallback failed:', err); (message as any).imageLoadError = true; finish(); }
          });
        },
        error: err => {
          console.error('Image proxy failed, trying signed URL:', err);
          this.chatService.getMessageAttachmentUrl(message.id!).pipe(takeUntil(this.destroy$)).subscribe({
            next: applyUrl,
            error: err2 => { console.error('Image URL fallback failed:', err2); (message as any).imageLoadError = true; finish(); }
          });
        }
      });
  }

  refreshImagePlayback(message: ChatMessage): void {
    const retries = Number((message as any).imageLoadRetries || 0);
    if (retries >= 1) {
      (message as any).imageLoadError = true;
      message.imageUrl = '';
      return;
    }
    (message as any).imageLoadRetries = retries + 1;
    if (message.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(message.imageUrl);
    message.imageUrl = '';
    this.prepareImagePlayback(message, true);
  }

  openImagePreview(message: ChatMessage, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.isImageAttachment(message)) return;

    const open = (url: string) => {
      this.previewImageUrl = url;
      this.previewImageName = message.attachmentName || 'Image';
    };

    if (message.imageUrl) {
      open(message.imageUrl);
      return;
    }

    if (message.id && !message.id.startsWith('tmp-')) {
      this.chatService.getMessageAttachmentBlob(message.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: blob => {
            const objectUrl = URL.createObjectURL(blob);
            this.messages = this.messages.map(current =>
              current.id === message.id ? { ...current, imageUrl: objectUrl } : current
            );
            open(objectUrl);
          },
          error: error => console.error('Image preview could not be opened:', error)
        });
      return;
    }

    if (message.attachmentUrl?.startsWith('blob:')) open(message.attachmentUrl);
  }

  closeImagePreview(): void {
    this.previewImageUrl = '';
    this.previewImageName = '';
  }

  private prepareVoicePlayback(message: ChatMessage, force = false): void {
    if (this.getMessageType(message) !== 'VOICE' || !message.id || message.id.startsWith('tmp-')) return;
    if (!force && message.playbackUrl && !message.playbackUrl.startsWith('blob:')) return;
    if (this.voicePlaybackRequests.has(message.id)) return;

    this.voicePlaybackRequests.add(message.id);
    this.chatService.getMessagePlaybackUrl(message.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: url => {
          this.voicePlaybackRequests.delete(message.id);
          this.voicePlaybackRetryCounts.delete(message.id);
          let previousBlobUrl = '';
          this.messages = this.messages.map(current => {
            if (current.id !== message.id) return current;
            if (current.playbackUrl?.startsWith('blob:')) previousBlobUrl = current.playbackUrl;
            return { ...current, playbackUrl: url };
          });
          if (previousBlobUrl) {
            setTimeout(() => {
              URL.revokeObjectURL(previousBlobUrl);
              this.voiceObjectUrls.delete(previousBlobUrl);
            }, 5000);
          }
        },
        error: () => this.voicePlaybackRequests.delete(message.id),
      });
  }

  refreshVoicePlayback(message: ChatMessage): void {
    if (!message.id || message.id.startsWith('tmp-')) return;
    const retries = this.voicePlaybackRetryCounts.get(message.id) || 0;
    if (retries >= 1) return;
    this.voicePlaybackRetryCounts.set(message.id, retries + 1);
    this.messages = this.messages.map(current => current.id === message.id
      ? { ...current, playbackUrl: undefined }
      : current);
    this.prepareVoicePlayback(message, true);
  }

  trackMessage(_index: number, message: ChatMessage): string {
    return message.uiKey || message.id;
  }

  formatMessageTimestamp(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDifference = Math.round((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000);
    const locale = this.translate.currentLang || this.translate.defaultLang || 'fr';
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);

    if (dayDifference === 0) return time;
    if (dayDifference === 1) return `${this.translate.instant('YESTERDAY')}, ${time}`;
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  formatDuration(seconds?: number): string {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  formatFileSize(size?: number): string {
    const bytes = Number(size || 0);
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

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
    if (this.isRecordingVoice) {
      this.stopVoiceRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.recordingStartedAt = Date.now();
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const duration = Math.max(1, Math.round((Date.now() - this.recordingStartedAt) / 1000));
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: mimeType });

        stream.getTracks().forEach(track => track.stop());
        this.isRecordingVoice = false;

        if (blob.size > 0) {
          this.uploadAttachment(file, 'VOICE', duration);
        }
      };

      this.mediaRecorder.start();
      this.isRecordingVoice = true;
    } catch (error) {
      console.error('Microphone permission / recording failed:', error);
      this.isRecordingVoice = false;
    }
  }

  stopVoiceRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private uploadAttachment(file: File, type: 'VOICE' | 'DOCUMENT', durationSeconds?: number, content?: string): void {
    if (!this.selectedConversation?.id || !this.currentUserId) return;

    if (file.size > this.maxAttachmentSize) {
      this.showAttachmentError(this.translate.instant('FILE_TOO_LARGE'));
      return;
    }

    const optimisticId = `tmp-${Date.now()}-${++this.optimisticMessageSequence}`;
    const objectUrl = URL.createObjectURL(file);
    if (type === 'VOICE') this.voiceObjectUrls.add(objectUrl);
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      uiKey: optimisticId,
      senderId: this.currentUserId,
      content: content || '',
      createdAt: new Date().toISOString(),
      conversationId: this.selectedConversation.id,
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
    this.messages = [...this.messages, optimisticMessage];
    setTimeout(() => this.scrollToBottom(), 0);
    this.dispatchAttachment(optimisticMessage, file, type, durationSeconds, content);
  }

  private dispatchAttachment(optimisticMessage: ChatMessage, file: File, type: 'VOICE' | 'DOCUMENT', durationSeconds?: number, content?: string): void {
    this.updateDeliveryStatus(optimisticMessage.id, 'sending');

    this.chatService
      .uploadAttachment(
        this.selectedConversation.id,
        this.currentUserId,
        type,
        file,
        durationSeconds,
        content
      )
      .subscribe({
        next: (msg) => {
          const normalizedMsg: ChatMessage = {
            ...msg,
            type: msg.type || type,
            attachmentName: msg.attachmentName || file.name,
            attachmentType: msg.attachmentType || file.type,
            attachmentSize: msg.attachmentSize || file.size,
            deliveryStatus: 'sent',
            uiKey: optimisticMessage.uiKey || optimisticMessage.id,
            playbackUrl: optimisticMessage.playbackUrl,
            // Keep the local preview alive until the persisted MinIO image has actually
            // been fetched. prepareImagePlayback(..., true) replaces and revokes it safely.
            imageUrl: type === 'DOCUMENT' && this.isImageAttachment({
              ...msg,
              attachmentName: msg.attachmentName || file.name,
              attachmentType: msg.attachmentType || file.type,
            } as ChatMessage)
              ? optimisticMessage.attachmentUrl
              : undefined,
          };

          const exists = this.messages.some(m => m.id === normalizedMsg.id);
          this.messages = exists
            ? this.messages.filter(m => m.id !== optimisticMessage.id)
            : this.messages.map(m => m.id === optimisticMessage.id ? normalizedMsg : m);
          if (!exists || this.messages.some(m => m.id === normalizedMsg.id)) {
            this.selectedConversation = {
              ...this.selectedConversation,
              messages: [...(this.selectedConversation.messages || []), normalizedMsg],
              lastMessage: type === 'DOCUMENT'
                ? (content || `📎 ${normalizedMsg.attachmentName || 'Document'}`)
                : '🎤 Voice message',
            } as Conversation;
            // inform shared service about the updated conversation preview
            try { this.chatService.openConversation(this.selectedConversation); } catch (e) { /* ignore */ }
            setTimeout(() => this.scrollToBottom(), 0);
          }

          this.prepareVoicePlayback(normalizedMsg);
          this.prepareImagePlayback(normalizedMsg, type === 'DOCUMENT' && this.isImageAttachment(normalizedMsg));

          // Do not revoke image blobs here. The persisted-image loader revokes the old
          // optimistic blob only after the MinIO-backed blob has loaded successfully.
          if (type !== 'VOICE' && !this.isImageAttachment(normalizedMsg) && optimisticMessage.attachmentUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(optimisticMessage.attachmentUrl);
          }

        },
        error: (err) => {
          console.error('Attachment upload failed:', err);
          this.updateDeliveryStatus(optimisticMessage.id, 'failed');
          const serverMessage = typeof err?.error === 'string'
            ? err.error
            : (err?.error?.error || err?.error?.message || err?.error?.detail);
          if (serverMessage) this.showAttachmentError(serverMessage);
        },
      });
  }


  downloadDocument(msg: ChatMessage, event?: Event): void {
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
        const fallbackUrl = this.getAttachmentUrl(msg);
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

  navigateTouserprofile(){
    if (this.selectedConversation?.isGroup) return;

    const clientId = this.selectedConversation.coachId === this.currentUserId
      ? this.selectedConversation.clientId
      : this.selectedConversation.coachId;

    if (clientId) {
      this.router.navigate(['/clients/profil-client', clientId]);
      this.closed.emit();
    }
  }

}
