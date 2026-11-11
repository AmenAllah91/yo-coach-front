import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

export type AnnouncementLevel = 'INFO' | 'WARNING' | 'URGENT';

/** What the coach receives (CE PlatformAnnouncementService.CoachView). */
export interface CoachAnnouncement {
  id: string;
  level: AnnouncementLevel;
  messageFr: string;
  messageEn: string | null;
  messageAr: string | null;
  linkUrl: string | null;
  dismissible: boolean;
}

/** Admin list line. coachId / coachEmail null = every coach. */
export interface AdminAnnouncement {
  id: string;
  level: AnnouncementLevel;
  messageFr: string;
  messageEn: string | null;
  messageAr: string | null;
  linkUrl: string | null;
  startAt: string;
  endAt: string | null;
  coachId: string | null;
  coachEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AnnouncementRequest {
  level: AnnouncementLevel;
  messageFr: string;
  messageEn: string | null;
  messageAr: string | null;
  linkUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  coachEmail: string | null;
}

/** The text in the coach's language, French when missing. */
export function announcementText(a: Pick<CoachAnnouncement, 'messageFr' | 'messageEn' | 'messageAr'>, lang: string | undefined): string {
  if (lang === 'en' && a.messageEn) return a.messageEn;
  if (lang === 'ar' && a.messageAr) return a.messageAr;
  return a.messageFr;
}

/** Banners written by the admin for the coaches (CE /api/announcements and /api/admin/announcements). */
@Injectable({ providedIn: 'root' })
export class PlatformAnnouncementService {
  private readonly base = `${environment.baseApiUrl}/api`;

  constructor(private http: HttpClient) {}

  active() {
    return this.http.get<CoachAnnouncement[]>(`${this.base}/announcements/active`);
  }

  dismiss(id: string) {
    return this.http.post<void>(`${this.base}/announcements/${encodeURIComponent(id)}/dismiss`, {});
  }

  adminList() {
    return this.http.get<AdminAnnouncement[]>(`${this.base}/admin/announcements`);
  }

  create(request: AnnouncementRequest) {
    return this.http.post<AdminAnnouncement>(`${this.base}/admin/announcements`, request);
  }

  update(id: string, request: AnnouncementRequest) {
    return this.http.put<AdminAnnouncement>(`${this.base}/admin/announcements/${encodeURIComponent(id)}`, request);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.base}/admin/announcements/${encodeURIComponent(id)}`);
  }
}
