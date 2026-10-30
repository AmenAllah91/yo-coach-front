import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * The coach's sign-up link (no email) and the join requests: the client asks, the coach accepts or declines. A coach
 * without a free slot gets the request on their waiting list.
 */
@Injectable({ providedIn: 'root' })
export class JoinRequestService {

  private baseUrl = environment.baseApiUrl + '/join';
  /** Address of the link page, sent to clients. */
  readonly linkBaseUrl = environment.apiUrl + '/join/';

  constructor(private http: HttpClient) {}

  // Coach

  getMyLink() {
    return this.http.get<JoinLink>(`${this.baseUrl}/link`, { headers: { 'X-Skip-Loader': 'true' } });
  }

  /** A new address: the old one stops working at once. */
  regenerateLink() {
    return this.http.post<JoinLink>(`${this.baseUrl}/link/regenerate`, null);
  }

  setLinkActive(active: boolean) {
    return this.http.put<JoinLink>(`${this.baseUrl}/link/active`, null, { params: { active } });
  }

  getRequests() {
    return this.http.get<CoachJoinRequests>(`${this.baseUrl}/requests`, { headers: { 'X-Skip-Loader': 'true' } });
  }

  /** 403 CLIENT_LIMIT_REACHED (upgrade notice shown by the interceptor) when no slot is free. */
  accept(id: string) {
    return this.http.post<void>(`${this.baseUrl}/requests/${id}/accept`, null, { headers: { 'X-Skip-Toast': 'true' } });
  }

  decline(id: string) {
    return this.http.post<void>(`${this.baseUrl}/requests/${id}/decline`, null, { headers: { 'X-Skip-Toast': 'true' } });
  }

  // Client

  getPublicLink(token: string) {
    return this.http.get<JoinLinkPublic>(`${this.baseUrl}/public/${encodeURIComponent(token)}`, {
      headers: { 'X-Skip-Toast': 'true' },
    });
  }

  request(token: string, message?: string | null, confirmedCoachId?: string) {
    return this.http.post<ClientJoinRequest>(`${this.baseUrl}/${encodeURIComponent(token)}/request`,
      { message: message || null, confirmedCoachId: confirmedCoachId || null },
      { headers: { 'X-Skip-Toast': 'true' } });
  }

  /** The client's open request; null when there is none (204). */
  getMyRequest() {
    return this.http.get<ClientJoinRequest | null>(`${this.baseUrl}/requests/mine`, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' },
    });
  }

  cancelMyRequest(id: string) {
    return this.http.post<void>(`${this.baseUrl}/requests/mine/${id}/cancel`, null);
  }
}

/** {@code limit} null = no limit; {@code full} = new requests go to the waiting list. */
export interface JoinLink {
  token: string;
  active: boolean;
  createdAt: string | null;
  limit: number | null;
  current: number;
  full: boolean;
}

export interface JoinLinkPublic {
  coachName: string;
  available: boolean;
  waitingList: boolean;
}

export interface CoachJoinRequest {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  message: string | null;
  source: 'LINK' | 'INVITATION';
  waitlisted: boolean;
  createdAt: string | null;
  expiresAt: string | null;
}

export interface CoachJoinRequests {
  requests: CoachJoinRequest[];
  limit: number | null;
  current: number;
  full: boolean;
}

export interface ClientJoinRequest {
  id: string;
  coachName: string;
  waitlisted: boolean;
  createdAt: string | null;
  expiresAt: string | null;
}
