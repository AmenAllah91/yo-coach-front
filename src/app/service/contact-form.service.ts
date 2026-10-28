import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CoachContactForm {
  id?: string;
  slug: string;
  /** Absent from the public form (a visitor never gets the coach's account id). */
  coachId?: string;
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
  website?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactFormService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/contact-forms`;

  constructor(private http: HttpClient) {}

  getMine(): Observable<CoachContactForm> {
    // The page shows its own loading state: no full-screen loader.
    return this.http.get<CoachContactForm>(`${this.baseUrl}/me`, { headers: { 'X-Skip-Loader': 'true' } });
  }

  saveMine(payload: CoachContactFormPayload): Observable<CoachContactForm> {
    return this.http.put<CoachContactForm>(`${this.baseUrl}/me`, payload);
  }

  getPublic(slug: string): Observable<CoachContactForm> {
    return this.http.get<CoachContactForm>(`${this.baseUrl}/public/${encodeURIComponent(slug)}`);
  }

  submitLead(slug: string, payload: ContactLeadPayload): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/public/${encodeURIComponent(slug)}/leads`,
      payload,
    );
  }
}
