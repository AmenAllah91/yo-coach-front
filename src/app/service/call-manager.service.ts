import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChatWebsocketService } from './chat-websocket.service';
import { VideoCallService } from './video-call.service';

export type CallKind = 'audio' | 'video';

/** A ringing event of the backend (`/topic/calls/{userId}`). */
export interface CallEvent {
  event: 'RINGING' | 'ANSWERED' | 'DECLINED' | 'CANCELLED';
  conversationId: string;
  /** Who started (RINGING, CANCELLED), answered (ANSWERED) or refused (DECLINED). */
  userId: string;
  userName: string;
  kind?: CallKind;
  group?: boolean;
  at?: number;
}

export interface IncomingCall {
  conversationId: string;
  callerId: string;
  callerName: string;
  kind: CallKind;
  group: boolean;
}

export interface ActiveCall {
  conversationId: string;
  /** 'start': the backend joins the call in progress or starts a new one; 'join': token only. */
  mode: 'start' | 'join';
  kind: CallKind;
  peerName: string;
  /** True for the caller (ringback, "no answer", cancel when hanging up alone). */
  outgoing: boolean;
}

/** A ringing call is shown this long, then counted as missed. */
export const RINGING_TIMEOUT_MS = 45_000;

/**
 * Audit chat 2026-10-27, calls. The calls of the signed-in user, for the whole web app: the incoming call (ringing on
 * any page) and the call in progress (it goes on while the user browses other pages). The screens only call
 * {@link start}, {@link join}, {@link accept} and {@link decline}; `app-call-host` (mounted once in the app root)
 * shows them.
 */
@Injectable({ providedIn: 'root' })
export class CallManagerService {
  readonly incoming$ = new BehaviorSubject<IncomingCall | null>(null);
  readonly active$ = new BehaviorSubject<ActiveCall | null>(null);
  /** Every ringing event, for the call window (the caller learns that the call was refused). */
  readonly events$ = new Subject<CallEvent>();

  private listening = false;
  private userId = '';
  private missTimer?: ReturnType<typeof setTimeout>;

  constructor(private ws: ChatWebsocketService, private api: VideoCallService) {}

  /** Starts listening to the user's ringing topic, once (needs a signed-in user). */
  listen(): void {
    if (this.listening) return;
    this.userId = sessionStorage.getItem('userId') || '';
    if (!this.userId) return;
    this.listening = true;
    this.ws.subscribeToTopic(`/topic/calls/${this.userId}`, (body) => {
      try {
        this.onEvent(JSON.parse(body) as CallEvent);
      } catch {
        /* ignore a malformed event */
      }
    });
  }

  get currentUserId(): string {
    return this.userId || sessionStorage.getItem('userId') || '';
  }

  start(conversationId: string, kind: CallKind, peerName: string): void {
    if (!conversationId || this.active$.value) return;
    this.dismissIncoming();
    this.active$.next({ conversationId, mode: 'start', kind, peerName, outgoing: true });
  }

  join(conversationId: string, kind: CallKind, peerName: string): void {
    if (!conversationId || this.active$.value) return;
    if (this.incoming$.value?.conversationId === conversationId) this.dismissIncoming();
    this.active$.next({ conversationId, mode: 'join', kind, peerName, outgoing: false });
  }

  accept(): void {
    const call = this.incoming$.value;
    if (!call) return;
    this.dismissIncoming();
    this.join(call.conversationId, call.kind, call.callerName);
  }

  decline(): void {
    const call = this.incoming$.value;
    if (!call) return;
    this.dismissIncoming();
    this.api.decline(call.conversationId).subscribe({ error: () => undefined });
  }

  /** The call window closed. */
  end(): void {
    this.active$.next(null);
  }

  private onEvent(event: CallEvent): void {
    if (!event?.conversationId) return;
    this.events$.next(event);
    const ringing = this.incoming$.value;
    switch (event.event) {
      case 'RINGING':
        // Not for the caller's own devices, nor while already in a call.
        if (event.userId === this.currentUserId || this.active$.value) return;
        this.showIncoming({
          conversationId: event.conversationId,
          callerId: event.userId,
          callerName: event.userName || '',
          kind: event.kind === 'audio' ? 'audio' : 'video',
          group: !!event.group,
        });
        break;
      case 'CANCELLED':
        if (ringing?.conversationId === event.conversationId) this.dismissIncoming();
        break;
      case 'ANSWERED':
      case 'DECLINED':
        // Answered or refused on another device of this user: stop ringing here too.
        if (event.userId === this.currentUserId && ringing?.conversationId === event.conversationId) {
          this.dismissIncoming();
        }
        break;
    }
  }

  private showIncoming(call: IncomingCall): void {
    clearTimeout(this.missTimer);
    this.incoming$.next(call);
    this.missTimer = setTimeout(() => {
      if (this.incoming$.value?.conversationId === call.conversationId) this.dismissIncoming();
    }, RINGING_TIMEOUT_MS);
  }

  private dismissIncoming(): void {
    clearTimeout(this.missTimer);
    if (this.incoming$.value) this.incoming$.next(null);
  }
}
