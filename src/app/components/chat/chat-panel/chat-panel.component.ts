import {Conversation} from "../models/conversation";
import {Component, EventEmitter, Output} from "@angular/core";
import {Router} from "@angular/router";
import {ChatService} from "../../../service/chat.service";
import {ChatComponent} from "../chat/chat.component";

/** Header chat panel: the chat page itself (same list, messages, calls, scheduled messages) in a floating card. */
@Component({
  selector: 'app-chat-panel',
  standalone: true,
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.scss'],
  imports: [ChatComponent]
})
export class ChatPanelComponent{

  @Output() closed = new EventEmitter<void>();

  /** Conversation to open first (a message notification), set before the panel is shown. */
  initialConversationId: string | null = null;
  /** Client whose private conversation is opened first (« Send message » of the client profile). */
  initialClientId: string | null = null;

  constructor(
    private router: Router,
    private chatService: ChatService
  ) {}

  openConversation(conv: Conversation) {
    this.initialConversationId = conv.id;
  }

  openClient(clientId: string) {
    this.initialClientId = clientId;
  }

  close() {
    this.closed.emit();
  }

  expandConversation(conversation: Conversation | null): void {
    if (conversation) this.chatService.openConversation(conversation);
    // Already on the chat page: it is rebuilt so that it opens this conversation.
    if (this.router.url.split('?')[0] === '/chat') {
      void this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => this.router.navigate(['/chat']));
    } else {
      void this.router.navigate(['/chat']);
    }
    this.close();
  }
}
