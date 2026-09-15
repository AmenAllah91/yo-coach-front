export type ChatMessageType = 'TEXT' | 'VOICE' | 'DOCUMENT';
export type ChatMessageDeliveryStatus = 'sending' | 'sent' | 'failed';

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

  // Client-only optimistic delivery state. Server messages default to `sent`.
  deliveryStatus?: ChatMessageDeliveryStatus;
  retry?: () => void;
  uiKey?: string;
  playbackUrl?: string;
  imageUrl?: string;
  imageLoadError?: boolean;
  imageLoadRetries?: number;
}
