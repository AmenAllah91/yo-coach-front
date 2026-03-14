import {Conversation} from "../models/conversation";
import {Component, EventEmitter, Output} from "@angular/core";
import {ConversationListComponent} from "../conversation-list/conversation-list.component";
import {DatePipe, NgClass, NgForOf, NgIf} from "@angular/common";
import {ConversationMessagesComponent} from "../conversation-messages/conversation-messages.component";
import {ReactiveFormsModule} from "@angular/forms";

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.scss'],
  imports: [
    ConversationListComponent,
    NgClass,
    ConversationMessagesComponent,
    NgIf,
    DatePipe,
    NgForOf,
    ReactiveFormsModule
  ]
})
export class ChatPanelComponent{

  isOpen = true;
  @Output() closed = new EventEmitter<void>();
  view: 'LIST' | 'MESSAGES' = 'LIST';

  selectedConversation: Conversation | null = null;

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
}
