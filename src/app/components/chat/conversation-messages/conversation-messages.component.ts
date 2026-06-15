import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
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
import {forkJoin, of} from "rxjs";
import {catchError, map} from "rxjs/operators";
import { environment } from "@env/environment";

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
    NgSwitchDefault
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

  isUploadingAttachment = false;
  pendingDocument: File | null = null;
  attachmentError = '';
  readonly acceptedDocumentExtensions = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp';
  private readonly acceptedDocumentExtensionList = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];
  isRecordingVoice = false;
  private mediaRecorder?: MediaRecorder;
  private recordedChunks: Blob[] = [];
  private recordingStartedAt = 0;

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
    if (this.isUploadingAttachment || this.isRecordingVoice) return;

    const text = this.messageText.trim();

    if (this.pendingDocument) {
      const file = this.pendingDocument;
      this.pendingDocument = null;
      this.messageText = '';
      this.uploadAttachment(file, 'DOCUMENT', undefined, text);
      return;
    }

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

    this.isUploadingAttachment = true;

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
          this.isUploadingAttachment = false;

          const normalizedMsg: ChatMessage = {
            ...msg,
            type: msg.type || type,
            attachmentName: msg.attachmentName || file.name,
            attachmentType: msg.attachmentType || file.type,
            attachmentSize: msg.attachmentSize || file.size,
          };

          const exists = this.messages.some(m => m.id === normalizedMsg.id);
          if (!exists) {
            this.messages = [...this.messages, normalizedMsg];
            this.selectedConversation = {
              ...this.selectedConversation,
              messages: [...(this.selectedConversation.messages || []), normalizedMsg],
              lastMessage: type === 'DOCUMENT'
                ? (content || `📎 ${normalizedMsg.attachmentName || 'Document'}`)
                : '🎤 Voice message',
            } as Conversation;
            setTimeout(() => this.scrollToBottom(), 0);
          }

          this.sendNotificationMessage([this.selectedConversation.clientId, this.selectedConversation.coachId]);
        },
        error: (err) => {
          this.isUploadingAttachment = false;
          console.error('Attachment upload failed:', err);
          alert('Upload failed - Status: ' + (err.status || 'unknown') + '\nMessage: ' + (err.message || 'unknown') + '\nCheck console for details.');
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
    if(this.selectedConversation.coachId === this.currentUserId) {
      this.router.navigate(['/edit-profile',this.selectedConversation.clientId]);
    }
    else {
      this.router.navigate(['/edit-profile',this.selectedConversation.coachId]);
    }
  }

}
