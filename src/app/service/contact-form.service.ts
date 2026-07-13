import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CoachWebsiteLead } from './website.service';

export interface CoachContactForm {
  id?: string;
  slug: string;
  coachId: string;
  coachName: string;
  coverImage?: string;
  message: string;
  published: boolean;
}

export interface CoachContactFormPayload {
  slug: string;
  coverImage?: string;
  message: string;
  published: boolean;
}

export interface ContactLeadPayload {
  fullName: string;
  email: string;
  message: string;
  termsAccepted: boolean;
}

@Injectable({ providedIn: 'root' })
export class ContactFormService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/contact-forms`;

  constructor(private http: HttpClient) {}

  getMine(): Observable<CoachContactForm> {
    return this.http.get<CoachContactForm>(`${this.baseUrl}/me`);
  }

  saveMine(payload: CoachContactFormPayload): Observable<CoachContactForm> {
    return this.http.put<CoachContactForm>(`${this.baseUrl}/me`, payload);
  }

  getPublic(slug: string): Observable<CoachContactForm> {
    return this.http.get<CoachContactForm>(`${this.baseUrl}/public/${encodeURIComponent(slug)}`);
  }

  submitLead(slug: string, payload: ContactLeadPayload): Observable<CoachWebsiteLead> {
    return this.http.post<CoachWebsiteLead>(
      `${this.baseUrl}/public/${encodeURIComponent(slug)}/leads`,
      payload,
    );
  }
}
