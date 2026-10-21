import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { ChatUnreadService } from '../../../service/chat-unread.service';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { DashboardConversation, WidgetStatus } from '../../../models/coach-dashboard.model';
import { WidgetStateComponent } from '../shared/widget-state.component';
import { avatarTone, clockTime, initials, relativeTime } from '../shared/dashboard-format';

const MAX_ROWS = 5;

interface UnreadConversation extends DashboardConversation {
  unread: number;
}

/**
 * Unread conversations. Which conversations are unread comes from the notification service (same source as the
 * unread badges of the header and the chat); the backend adds the client, the preview and the time.
 */
@Component({
  selector: 'app-messages-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule, WidgetStateComponent],
  templateUrl: './messages-widget.component.html',
  styleUrl: '../shared/widget-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesWidgetComponent implements OnInit {
  @Input() lang: string | undefined;

  status: WidgetStatus = 'loading';
  conversations: UnreadConversation[] = [];
  /** All unread conversations (the list shows the first five). */
  unreadTotal = 0;
  readonly brokenAvatars = new Set<string>();

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private unread: ChatUnreadService,
    private dashboard: CoachDashboardService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    combineLatest([this.unread.synced$, this.unread.unreadCounts$])
      .pipe(
        filter(([synced]) => synced !== null),
        map(([synced, counts]) => ({ synced, counts })),
        // Only a change of the unread conversations (or of their counts) asks the backend again.
        distinctUntilChanged((a, b) => a.synced === b.synced && key(a.counts) === key(b.counts)),
        debounceTime(150),
        switchMap(({ synced, counts }) => {
          if (!synced) return of({ status: 'error' as WidgetStatus, rows: [] as UnreadConversation[], total: 0 });
          const ids = [...counts.entries()].filter(([, count]) => count > 0).map(([id]) => id);
          if (!ids.length) return of({ status: 'ready' as WidgetStatus, rows: [] as UnreadConversation[], total: 0 });
          return this.dashboard.getConversations(ids).pipe(
            map((found) => ({
              status: 'ready' as WidgetStatus,
              rows: found.map((conversation) => ({ ...conversation, unread: counts.get(conversation.id) || 0 })).slice(0, MAX_ROWS),
              total: found.length,
            })),
            catchError(() => of({ status: 'error' as WidgetStatus, rows: [] as UnreadConversation[], total: 0 })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ status, rows, total }) => {
        this.status = status;
        this.conversations = rows;
        this.unreadTotal = total;
        this.cdr.markForCheck();
      });
  }

  retry(): void {
    this.status = 'loading';
    this.unread.refresh();
  }

  initialsOf = initials;

  tone(conversation: UnreadConversation): number {
    return avatarTone(conversation.clientId || conversation.id);
  }

  /** Today: 10:24; before: relative day. */
  time(conversation: UnreadConversation): string {
    const value = conversation.lastMessageAt;
    if (!value) return '';
    return new Date(value).toDateString() === new Date().toDateString() ? clockTime(value, this.lang) : relativeTime(value, this.lang);
  }

  displayName(conversation: UnreadConversation): string {
    return conversation.group ? conversation.name || '—' : conversation.clientName || conversation.name || '—';
  }


  trackById(_: number, conversation: UnreadConversation): string {
    return conversation.id;
  }
}

function key(counts: Map<string, number>): string {
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join('|');
}
