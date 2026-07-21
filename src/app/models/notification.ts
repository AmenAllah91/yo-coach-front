export class Notification {
  id?: string;
  message: string;
  title: string;
  createdAt: Date;
  seen: boolean;
  notificationType: string;
  redirectUrl?: string;
  entityId?: string;
  clientId?: string;
  source?: string;
  authorId?: string;

  constructor(data: any) {
    this.id = data.id;
    this.message = data.message;
    this.title = data.title || this.defaultTitle(data.notificationType);
    this.notificationType = data.notificationType;
    this.seen = data.seen ?? false;
    this.redirectUrl = data.redirectUrl;
    this.entityId = data.entityId;
    this.clientId = data.clientId;
    this.source = data.source;
    this.authorId = data.authorId;

    if (data.createdAt) {
      if (typeof data.createdAt === 'number') {
        this.createdAt = new Date(data.createdAt * 1000);
      }
      else if (typeof data.createdAt === 'string') {
        this.createdAt = new Date(data.createdAt);
      }
      else {
        this.createdAt = new Date();
      }
    } else {
      this.createdAt = new Date();
    }
  }

  private defaultTitle(type: string): string {
    return type === 'PUSH_NOTIF_MESSAGE' ? 'Nouveau message' : 'Notification';
  }

}

export function getTimeAgo(createdAt: Date): string {
  if (!createdAt || isNaN(createdAt.getTime())) {
    return 'Invalid date';
  }

  const now = new Date().getTime();
  const elapsedMs = now - createdAt.getTime();

  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days ago`;
  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
  return `${seconds} seconds ago`;
}
