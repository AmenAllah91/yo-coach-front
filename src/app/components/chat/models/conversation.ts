import {ChatMessage} from "./chat-message";

export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  adherentId: string
  lastMessage: string;
  messages: ChatMessage[];
  unreadCount: number;
  clientId: string;
  coachId: string;
  isGroup: boolean;
  memberIds?: string[];
}
