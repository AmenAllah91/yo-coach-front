import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subject, timer} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {NotificationService} from "./notification.service";
import {WebsocketService} from "./websocket.service";
import {Notification} from "../models/notification";

@Injectable({
  providedIn: 'root'
})
export class ChatUnreadService implements OnDestroy {

  private readonly unreadCountsSubject = new BehaviorSubject<Map<string, number>>(new Map());
  readonly unreadCounts$ = this.unreadCountsSubject.asObservable();

  private readonly destroy$ = new Subject<void>();
  private notificationCache: Notification[] = [];

  constructor(
    private notificationService: NotificationService,
    private webSocketService: WebsocketService
  ) {
    this.syncFromNotifications();
    timer(5000, 5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncFromNotifications());

    this.webSocketService.notification$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        if (!notification) return;
        if (notification.notificationType === 'PUSH_NOTIF_MESSAGE') {
          this.upsertNotification(notification);
          this.recomputeUnread();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  markConversationRead(conversationId: string): void {
    const relatedIds = this.notificationCache
      .filter(n =>
        !n.seen &&
        n.notificationType === 'PUSH_NOTIF_MESSAGE' &&
        n.entityId === conversationId &&
        !!n.id
      )
      .map(n => n.id as string);

    if (relatedIds.length) {
      this.notificationService.markNotificationsAsSeen(relatedIds)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {});
      this.webSocketService.markNotificationsAsSeen(relatedIds);
    }

    this.notificationCache.forEach(n => {
      if (n.entityId === conversationId) n.seen = true;
    });
    this.recomputeUnread();
  }

  getUnreadCount(conversationId: string): number {
    return this.unreadCountsSubject.value.get(conversationId) || 0;
  }

  private syncFromNotifications(): void {
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;

    this.notificationService.getMessagesNotifs(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications) => {
          this.notificationCache = notifications || [];
          this.recomputeUnread();
        },
        error: () => {}
      });
  }

  private upsertNotification(notification: Notification): void {
    this.notificationCache = [
      notification,
      ...this.notificationCache.filter(n => n.id !== notification.id)
    ];
  }

  private recomputeUnread(): void {
    const counts = new Map<string, number>();

    for (const notification of this.notificationCache) {
      if (
        notification.notificationType === 'PUSH_NOTIF_MESSAGE' &&
        !notification.seen &&
        notification.entityId
      ) {
        counts.set(
          notification.entityId as string,
          (counts.get(notification.entityId as string) || 0) + 1
        );
      }
    }

    this.unreadCountsSubject.next(counts);
  }

}
