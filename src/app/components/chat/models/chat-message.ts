export type ChatMessageType = 'TEXT' | 'VOICE' | 'DOCUMENT';

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  conversationId: string;

  type?: ChatMessageType | string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  durationSeconds?: number;
}
