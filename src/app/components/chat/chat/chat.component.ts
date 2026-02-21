import {
  Component, OnInit, AfterViewChecked,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';

export interface Client { id: string; name: string; avatar: string; }
export interface Member { id: string; name: string; avatar: string; }

export interface Conversation {
  id: string; name: string; avatar: string;
  lastMessage?: string; timestamp: string;
  unread?: boolean; isGroup?: boolean;
  memberCount?: number; members?: Member[];
}

export interface Message {
  id: string; senderId: string; text: string;
  timestamp: string; isRead: boolean;
  sender: { name: string; avatar: string; initials: string; };
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, AfterViewChecked {

  @ViewChild('messagesContainer') private msgContainer!: ElementRef<HTMLElement>;

  // ── Responsive ────────────────────────────────────────────────────────────
  isMobile = false;
  showList = true;

  // ── Sidebar search ────────────────────────────────────────────────────────
  searchTerm = '';

  // ── Selected conversation + message input ─────────────────────────────────
  selectedConv: Conversation | null = null;
  messageText = '';
  private scrollPending = false;

  // ── Modals ────────────────────────────────────────────────────────────────
  showNewChat     = false;
  showCreateGroup = false;

  // ── Create Group state ────────────────────────────────────────────────────
  groupName        = '';
  groupSearchTerm  = '';
  selectedClientIds: string[] = [];
  groupSelectAll   = false;

  readonly allClients: Client[] = [
    { id: '1', name: 'Tom Gibson',      avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png' },
    { id: '2', name: 'John Doe',        avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/74vJDmLBHjWEBB7KaSSJt2/e5787ede-7920-455a-8759-6c46c743404b.jpg' },
    { id: '3', name: 'Sarah Smith',     avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80' },
    { id: '4', name: 'Michael Johnson', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=256&q=80' },
  ];

  // ── Conversations (mock) ──────────────────────────────────────────────────
  conversations: Conversation[] = [
    {
      id: '1', name: 'Tom Gibson',
      avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png',
      lastMessage: 'I just finished my workout! Feeling great 💪',
      timestamp: '9:07pm, 17 Aug 2025', unread: false, isGroup: false,
    },
    {
      id: 'group-1', name: 'Weight Loss Group', avatar: '',
      lastMessage: 'Sarah: Great progress everyone! Keep it up 🎉',
      timestamp: '8:30pm, 17 Aug 2025', unread: true, isGroup: true, memberCount: 4,
      members: [
        { id: '1', name: 'Tom Gibson',      avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png' },
        { id: '3', name: 'Sarah Smith',     avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80' },
        { id: '2', name: 'John Doe',        avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/74vJDmLBHjWEBB7KaSSJt2/e5787ede-7920-455a-8759-6c46c743404b.jpg' },
        { id: '4', name: 'Michael Johnson', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=256&q=80' },
      ],
    },
    {
      id: 'group-2', name: 'Muscle Building Squad', avatar: '',
      lastMessage: 'Michael: Just hit a new PR on bench press! 💪',
      timestamp: '7:15pm, 17 Aug 2025', unread: false, isGroup: true, memberCount: 3,
      members: [
        { id: '2', name: 'John Doe',        avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/74vJDmLBHjWEBB7KaSSJt2/e5787ede-7920-455a-8759-6c46c743404b.jpg' },
        { id: '4', name: 'Michael Johnson', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=256&q=80' },
        { id: '1', name: 'Tom Gibson',      avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png' },
      ],
    },
  ];

  // ── Messages (mock) ───────────────────────────────────────────────────────
  messages: Message[] = [
    { id: '1',  senderId: 'coach', text: 'Welcome to the Weight Loss Group! Let me know if you have any questions.', timestamp: '10:07pm', isRead: true, sender: { name: 'Coach', avatar: '', initials: 'CC' } },
    { id: '2',  senderId: '1',     text: 'Thanks coach! Excited to get started 💪', timestamp: '10:14pm', isRead: true, sender: { name: 'Tom Gibson', avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png', initials: 'TG' } },
    { id: '3',  senderId: '3',     text: 'Me too! Looking forward to working with everyone', timestamp: '10:22pm', isRead: true, sender: { name: 'Sarah Smith', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80', initials: 'SS' } },
    { id: '4',  senderId: '2',     text: 'Just finished my first workout! Feeling great 🔥', timestamp: '10:30pm', isRead: true, sender: { name: 'John Doe', avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/74vJDmLBHjWEBB7KaSSJt2/e5787ede-7920-455a-8759-6c46c743404b.jpg', initials: 'JD' } },
    { id: '5',  senderId: 'coach', text: 'Amazing work John! Keep that momentum going 💪', timestamp: '10:45pm', isRead: true, sender: { name: 'Coach', avatar: '', initials: 'CC' } },
    { id: '6',  senderId: '4',     text: 'Quick question - should we be tracking our meals in the app?', timestamp: '10:52pm', isRead: true, sender: { name: 'Michael Johnson', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=256&q=80', initials: 'MJ' } },
    { id: '7',  senderId: 'coach', text: 'Yes! Tracking your meals will help us monitor your progress and make adjustments as needed.', timestamp: '11:05pm', isRead: true, sender: { name: 'Coach', avatar: '', initials: 'CC' } },
    { id: '8',  senderId: '3',     text: "I've been tracking everything and it's really helping me stay accountable!", timestamp: '11:13pm', isRead: true, sender: { name: 'Sarah Smith', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80', initials: 'SS' } },
    { id: '9',  senderId: '1',     text: 'Same here! The app makes it so easy', timestamp: '11:20pm', isRead: true, sender: { name: 'Tom Gibson', avatar: 'https://uploadthingy.s3.us-west-1.amazonaws.com/suFuTUvrUcrdykrZJMfjVZ/image.png', initials: 'TG' } },
    { id: '10', senderId: 'coach', text: "That's great to hear! Remember, consistency is key. Keep up the great work everyone! 🎯", timestamp: '11:25pm', isRead: true, sender: { name: 'Coach', avatar: '', initials: 'CC' } },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void { this.checkMobile(); }

  ngAfterViewChecked(): void {
    if (this.scrollPending) { this.scrollToBottom(); this.scrollPending = false; }
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

  // ── Conversations ─────────────────────────────────────────────────────────
  filteredConversations(): Conversation[] {
    const t = this.searchTerm.trim().toLowerCase();
    return t ? this.conversations.filter(c => c.name.toLowerCase().includes(t)) : this.conversations;
  }

  selectConversation(conv: Conversation): void {
    this.selectedConv = conv;
    conv.unread = false;
    this.scrollPending = true;
    if (this.isMobile) this.showList = false;
  }

  backToList(): void { this.showList = true; }

  // ── Messages ──────────────────────────────────────────────────────────────
  sendMessage(): void {
    if (!this.messageText.trim() || !this.selectedConv) return;
    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'coach',
      text: this.messageText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      sender: { name: 'Coach', avatar: '', initials: 'CC' },
    };
    this.messages = [...this.messages, msg];
    this.messageText = '';
    this.scrollPending = true;
    const idx = this.conversations.findIndex(c => c.id === this.selectedConv!.id);
    if (idx !== -1) {
      this.conversations[idx] = { ...this.conversations[idx], lastMessage: msg.text, timestamp: msg.timestamp };
      this.conversations = [...this.conversations];
    }
  }

  // ── Modals navigation ─────────────────────────────────────────────────────
  openNewChatModal(): void {
    this.showNewChat = true;
    this.showCreateGroup = false;
  }

  closeModals(): void {
    this.showNewChat = false;
    this.showCreateGroup = false;
    this._resetGroupForm();
  }

  goToSelectClient(): void { this.closeModals(); /* brancher logique réelle */ }

  goToCreateGroup(): void {
    this.showNewChat = false;
    this.showCreateGroup = true;
    this._resetGroupForm();
  }

  backToNewChat(): void {
    this.showCreateGroup = false;
    this.showNewChat = true;
    this._resetGroupForm();
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

    const members: Member[] = this.allClients
      .filter(c => this.selectedClientIds.includes(c.id));

    const newConv: Conversation = {
      id: `group-${Date.now()}`,
      name: this.groupName.trim(),
      avatar: '',
      lastMessage: 'Group created',
      timestamp: 'Just now',
      unread: false,
      isGroup: true,
      memberCount: members.length,
      members,
    };

    this.conversations = [newConv, ...this.conversations];
    this.selectConversation(newConv);
    this.closeModals();
  }

  private _resetGroupForm(): void {
    this.groupName       = '';
    this.groupSearchTerm = '';
    this.selectedClientIds = [];
    this.groupSelectAll  = false;
  }
}
