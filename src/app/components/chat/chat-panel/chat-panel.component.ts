import {Conversation} from "../models/conversation";
import {Component, EventEmitter, Output} from "@angular/core";
import {ConversationListComponent} from "../conversation-list/conversation-list.component";
import {NgClass, NgIf} from "@angular/common";
import {ConversationMessagesComponent} from "../conversation-messages/conversation-messages.component";
import {Router} from "@angular/router";
import {ChatService} from "../../../service/chat.service";

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.scss'],
  imports: [
    ConversationListComponent,
    NgClass,
    ConversationMessagesComponent,
    NgIf
  ]
})
export class ChatPanelComponent{

  isOpen = true;
  @Output() closed = new EventEmitter<void>();
  view: 'LIST' | 'MESSAGES' = 'LIST';

  selectedConversation: Conversation | null = null;

  constructor(
    private router: Router,
    private chatService: ChatService
  ) {}

  open() {
    this.isOpen = true;
    this.view = 'LIST';
  }

  close() {
    this.isOpen = false;
    this.closed.emit();
  }

  openConversation(conv: Conversation) {
    this.selectedConversation = conv;
    this.view = 'MESSAGES';
  }

  backToList() {
    this.view = 'LIST';
    this.selectedConversation = null;
  }

  expandConversation(): void {
    if (!this.selectedConversation) return;

    this.chatService.openConversation(this.selectedConversation);
    this.router.navigate(['/chat']);
    this.close();
  }
}
