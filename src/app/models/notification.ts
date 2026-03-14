export class Notification {
  id?: string;
  message: string;
  createdAt: Date;
  seen: boolean;
  notificationType: 'EMAIL_NOTIF' | 'PUSH_NOTIF' | 'SMS_NOTIF' | 'PUSH_NOTIF_MESSAGE'

  constructor(data: any) {
    this.id = data.id;
    this.message = data.message;
    this.notificationType = data.notificationType;
    this.seen = data.seen ?? false;

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
