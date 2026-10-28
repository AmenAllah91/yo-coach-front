import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '@env/environment';

/** Audit chat 2026-10-27, video call. What a conversation member gets to join the LiveKit room. */
export interface VideoCallSession {
  enabled: boolean;
  serverUrl: string;
  token: string;
  roomName: string;
  identity: string;
  /** True when this press started a new call (the others ring); false when it joined one. */
  invited?: boolean;
}

/**
 * Talks to the coaching backend video-call endpoints. The backend binds the room to the conversation and only
 * mints a token for a member, so the front never handles the LiveKit secret.
 */
@Injectable({ providedIn: 'root' })
export class VideoCallService {

  private readonly apiUrl = environment.baseApiUrl + '/chat';
  private readonly silent = { headers: new HttpHeaders({ 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' }) };

  private availability$?: Observable<boolean>;

  constructor(private http: HttpClient) {}

  /** Whether the feature is turned on server-side. Read once per session; defaults to false on any error. */
  isEnabled(): Observable<boolean> {
    if (!this.availability$) {
      this.availability$ = this.http
        .get<{ enabled: boolean }>(`${this.apiUrl}/video-call/availability`, this.silent)
        .pipe(
          map((response) => !!response?.enabled),
          catchError(() => of(false)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.availability$;
  }

  /**
   * The call button: joins the call in progress, or starts a new one (invite message, ringing, push). `audio` for a
   * voice call (the camera is never turned on), `video` otherwise.
   */
  start(conversationId: string, kind: 'audio' | 'video' = 'video'): Observable<VideoCallSession> {
    return this.http.post<VideoCallSession>(
      `${this.apiUrl}/conversations/${encodeURIComponent(conversationId)}/video-call?kind=${kind}`, {}, this.silent);
  }

  /** The caller hung up before anyone answered: the others stop ringing. */
  cancel(conversationId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/conversations/${encodeURIComponent(conversationId)}/video-call/cancel`, {}, this.silent);
  }

  /** The user refused a ringing call: the caller is told. */
  decline(conversationId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/conversations/${encodeURIComponent(conversationId)}/video-call/decline`, {}, this.silent);
  }

  /** A join token for the current member (answering or rejoining), no invite message posted. */
  token(conversationId: string): Observable<VideoCallSession> {
    return this.http.get<VideoCallSession>(
      `${this.apiUrl}/conversations/${encodeURIComponent(conversationId)}/video-call/token`, this.silent);
  }
}
