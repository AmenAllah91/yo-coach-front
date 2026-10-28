import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { VideoCallService, VideoCallSession } from '../../../service/video-call.service';
import { CallKind, CallManagerService, RINGING_TIMEOUT_MS } from '../../../service/call-manager.service';
import { CallTone } from './call-tones';

/**
 * connecting: getting the token / joining the room. ringing: the caller waits for an answer. waiting: in the room,
 * nobody else yet (joined a call whose caller is still connecting, or already gone). connected: talking.
 * noanswer / declined / ended: shown a moment before the window closes. error: could not join.
 */
type CallState = 'connecting' | 'ringing' | 'waiting' | 'connected' | 'noanswer' | 'declined' | 'ended' | 'error';

const LIVEKIT_SCRIPT = 'assets/livekit/livekit-client.umd.js';
/** How long "no answer", "declined" or "call ended" stays on screen before the window closes. */
const CLOSING_DELAY_MS = 2_000;
let livekitLoading: Promise<any> | null = null;

/** Adds the LiveKit UMD bundle once and resolves its global; a failed load can be retried. */
function loadLivekit(): Promise<any> {
  const ready = (window as any).LivekitClient;
  if (ready) return Promise.resolve(ready);
  if (!livekitLoading) {
    livekitLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(LIVEKIT_SCRIPT, document.baseURI).href;
      script.async = true;
      script.onload = () => {
        const sdk = (window as any).LivekitClient;
        if (sdk) resolve(sdk); else reject(new Error('LiveKit SDK did not load'));
      };
      script.onerror = () => reject(new Error('LiveKit SDK could not be downloaded'));
      document.head.appendChild(script);
    }).catch((error) => {
      livekitLoading = null;
      throw error;
    });
  }
  return livekitLoading;
}

/**
 * Audit chat 2026-10-27, calls (voice or video). The call window: full screen, or reduced to a corner so the user
 * keeps browsing (it is mounted once in the app root by `app-call-host`, so the call goes on across pages).
 *
 * The caller hears a ringback until someone answers, sees "no answer" after 45 s (the others stop ringing) or "call
 * declined". When the other person hangs up, the call ends on this side too.
 *
 * LiveKit's browser SDK (`livekit-client`, pinned in package.json) is not imported by TypeScript: its type
 * declarations need TypeScript 5.7, while Angular 17 is on 5.2. angular.json copies its ready-made UMD bundle to
 * `assets/livekit/`, and this component adds it as a script the first time a call starts (it sets
 * `window.LivekitClient`, the same global the mobile call page uses). Nothing is downloaded until then.
 */
@Component({
  selector: 'app-video-call-overlay',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './video-call-overlay.component.html',
  styleUrls: ['./video-call-overlay.component.scss'],
})
export class VideoCallOverlayComponent implements OnInit, OnDestroy {
  /** Conversation whose room we join. */
  @Input() conversationId!: string;
  /** 'start': joins the call in progress or starts a new one; 'join': token only. */
  @Input() mode: 'start' | 'join' = 'start';
  /** 'audio': the camera is never turned on. */
  @Input() kind: CallKind = 'video';
  @Input() peerName = '';
  /** True for the caller (ringback, "no answer", cancel when hanging up alone). */
  @Input() outgoing = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('remoteContainer', { static: false }) remoteContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('localVideo', { static: false }) localVideo?: ElementRef<HTMLVideoElement>;

  state: CallState = 'connecting';
  errorMessage = '';
  micEnabled = true;
  cameraEnabled = true;
  minimized = false;
  /** Talking time, in seconds. */
  elapsed = 0;
  /** The other side shows its camera (else its name is shown). */
  remoteVideo = false;

  private room: any;
  private livekit: any;
  private hadPeer = false;
  private invited = false;
  private closing = false;
  private readonly tone = new CallTone();
  private noAnswerTimer?: ReturnType<typeof setTimeout>;
  private clock?: ReturnType<typeof setInterval>;
  private events?: Subscription;

  constructor(private videoCallService: VideoCallService, private calls: CallManagerService) {}

  get isAudio(): boolean {
    return this.kind === 'audio';
  }

  get initials(): string {
    const parts = (this.peerName || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';
  }

  get timer(): string {
    const minutes = Math.floor(this.elapsed / 60);
    const seconds = this.elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.events = this.calls.events$.subscribe((event) => {
      // The person called refused (one-to-one call, before anyone answered).
      if (event.event === 'DECLINED' && event.conversationId === this.conversationId && !event.group
        && event.userId !== this.calls.currentUserId && this.outgoing && !this.hadPeer) {
        this.finish('declined');
      }
    });
    void this.connect();
  }

  ngOnDestroy(): void {
    this.events?.unsubscribe();
    this.tone.dispose();
    clearTimeout(this.noAnswerTimer);
    clearInterval(this.clock);
    this.teardown();
  }

  private async connect(): Promise<void> {
    try {
      const session: VideoCallSession = await firstValueFrom(this.mode === 'start'
        ? this.videoCallService.start(this.conversationId, this.kind)
        : this.videoCallService.token(this.conversationId));

      if (!session?.token || !session.serverUrl) {
        throw new Error('missing token');
      }
      this.invited = !!session.invited;

      // Loaded only when a call actually starts.
      this.livekit = await loadLivekit();
      if (this.closing) return;
      const LK = this.livekit;
      const room = new LK.Room({ adaptiveStream: true, dynacast: true });
      this.room = room;

      room.on(LK.RoomEvent.TrackSubscribed, (track: any) => this.attachRemote(track));
      room.on(LK.RoomEvent.TrackUnsubscribed, (track: any) => {
        track.detach().forEach((el: HTMLElement) => el.remove());
        if (track.kind === 'video') this.remoteVideo = false;
      });
      room.on(LK.RoomEvent.ParticipantConnected, () => this.onPeerJoined());
      room.on(LK.RoomEvent.ParticipantDisconnected, () => this.onPeerLeft());
      room.on(LK.RoomEvent.Disconnected, () => this.finish('ended'));

      await room.connect(session.serverUrl, session.token);
      if (this.isAudio) {
        this.cameraEnabled = false;
        await room.localParticipant.setMicrophoneEnabled(true);
      } else {
        await room.localParticipant.enableCameraAndMicrophone();
        this.attachLocal();
      }

      if (room.remoteParticipants?.size > 0) {
        this.onPeerJoined();
      } else if (this.outgoing && this.invited) {
        this.state = 'ringing';
        this.tone.start('ringback');
        this.noAnswerTimer = setTimeout(() => this.noAnswer(), RINGING_TIMEOUT_MS);
      } else {
        this.state = 'waiting';
      }
    } catch (error: any) {
      if (this.closing) return;
      this.state = 'error';
      this.errorMessage = error?.message || 'connection failed';
    }
  }

  private onPeerJoined(): void {
    this.hadPeer = true;
    this.tone.stop();
    clearTimeout(this.noAnswerTimer);
    if (this.state !== 'connected') {
      this.state = 'connected';
      this.elapsed = 0;
      clearInterval(this.clock);
      this.clock = setInterval(() => this.elapsed++, 1000);
    }
  }

  private onPeerLeft(): void {
    // Everyone else left: the call is over on this side too.
    if (this.hadPeer && (this.room?.remoteParticipants?.size ?? 0) === 0) this.finish('ended');
  }

  private noAnswer(): void {
    if (this.hadPeer) return;
    this.videoCallService.cancel(this.conversationId).subscribe({ error: () => undefined });
    this.finish('noanswer');
  }

  private attachLocal(): void {
    const pub = this.room?.localParticipant?.getTrackPublication?.(this.livekit.Track.Source.Camera);
    const track = pub?.videoTrack;
    if (track && this.localVideo?.nativeElement) {
      track.attach(this.localVideo.nativeElement);
    }
  }

  private attachRemote(track: any): void {
    if ((track.kind === 'video' || track.kind === 'audio') && this.remoteContainer?.nativeElement) {
      const element = track.attach();
      element.classList.add('video-call__remote-media');
      if (track.kind === 'audio') element.style.display = 'none';
      else this.remoteVideo = true;
      this.remoteContainer.nativeElement.appendChild(element);
    }
  }

  async toggleMic(): Promise<void> {
    this.micEnabled = !this.micEnabled;
    await this.room?.localParticipant?.setMicrophoneEnabled(this.micEnabled);
  }

  async toggleCamera(): Promise<void> {
    if (this.isAudio) return;
    this.cameraEnabled = !this.cameraEnabled;
    await this.room?.localParticipant?.setCameraEnabled(this.cameraEnabled);
    if (this.cameraEnabled) this.attachLocal();
  }

  toggleMinimized(): void {
    this.minimized = !this.minimized;
  }

  hangUp(): void {
    // The caller hangs up before anyone answered: the others stop ringing.
    if (this.outgoing && !this.hadPeer && this.state !== 'error') {
      this.videoCallService.cancel(this.conversationId).subscribe({ error: () => undefined });
    }
    this.finish(null);
  }

  retry(): void {
    this.state = 'connecting';
    this.errorMessage = '';
    void this.connect();
  }

  /** Ends the call; with a state, shows it a moment before closing. */
  private finish(state: 'noanswer' | 'declined' | 'ended' | null): void {
    if (this.closing) return;
    this.closing = true;
    this.tone.stop();
    clearTimeout(this.noAnswerTimer);
    clearInterval(this.clock);
    this.teardown();
    if (state) {
      this.state = state;
      setTimeout(() => this.closed.emit(), CLOSING_DELAY_MS);
    } else {
      this.closed.emit();
    }
  }

  private teardown(): void {
    const room = this.room;
    this.room = undefined;
    try {
      room?.disconnect?.();
    } catch {
      /* ignore */
    }
  }
}
