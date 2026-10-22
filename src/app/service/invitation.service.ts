import { Injectable } from '@angular/core';
import {environment} from "@env/environment";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  private baseUrl = environment.baseApiUrl + '/invitation';

  constructor(private http: HttpClient) {}

  generateInvitation(data: any) {
    return this.http.post<any>(`${this.baseUrl}/generate`, data);
  }

  getInvitationByToken(token: string) {
    return this.http.get<any>(`${this.baseUrl}/token/${token}`);
  }

  acceptInvitation(token: string, userId: string, confirmedCoachId?: string) {
    return this.http.post(`${this.baseUrl}/token/${token}/accept`, null, {
      headers: { 'X-Skip-Toast': 'true' },
      params: confirmedCoachId ? { userId, confirmedCoachId } : { userId }
    });
  }

  sendInvitation(token: string, coachId: string, email: string, resend = false) {
    return this.http.post(`${this.baseUrl}/send`, null, {
      params: { token, coachId, email, resend }
    });
  }

  deleteInvitationByToken(token: string) {
    return this.http.delete(`${this.baseUrl}/token/${token}`);
  }

  /** "Invited" tab: the connected coach's invitations not accepted yet. */
  getMyInvitations() {
    return this.http.get<CoachInvitation[]>(`${this.baseUrl}/mine`, { headers: { 'X-Skip-Loader': 'true' } });
  }

  /** New link valid again, sent to the client's email (the old link stops working). */
  resendInvitation(id: string) {
    return this.http.post<{ invitationLink: string }>(`${this.baseUrl}/${id}/resend`, null);
  }
}

export interface CoachInvitation {
  id: string;
  email: string;
  token: string;
  status: 'PENDING' | 'EXPIRED' | 'BLOCKED';
  createdAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
}
