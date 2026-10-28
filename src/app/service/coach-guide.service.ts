import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export type CoachGuideChoice = 'EXAMPLE' | 'SCRATCH';
export type CoachGuideDiscoverStep = 'OPEN_CLIENT' | 'VIEW_PROGRAM' | 'REPLY_MESSAGE' | 'REVIEW_CHECKIN';
export type CoachGuideStartStep = 'PROFILE' | 'BRANDING' | 'WEBSITE' | 'PROGRAM' | 'INVITE';

export interface CoachGuideStep<K extends string> {
  key: K;
  done: boolean;
  optional: boolean;
}

/** The "first steps" guide of the connected coach (see CoachGuideService on the server). */
export interface CoachGuideStatus {
  /** The coach went through the welcome screen. */
  started: boolean;
  startChoice: CoachGuideChoice | null;
  hidden: boolean;
  /** Biggest challenge answered in the onboarding questionnaire. */
  challenge: string;
  coachFirstName: string;
  example: { active: boolean; clientId?: string; clientName?: string };
  /** Empty when the example client does not exist. */
  discover: CoachGuideStep<CoachGuideDiscoverStep>[];
  start: CoachGuideStep<CoachGuideStartStep>[];
  /** Every required "start for real" step is done. */
  completed: boolean;
}

@Injectable({ providedIn: 'root' })
export class CoachGuideService {
  private readonly baseUrl = `${environment.baseApiUrl.replace(/\/$/, '')}/api/coach-guide`;
  private readonly quiet = new HttpHeaders({ 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' });
  private last: CoachGuideStatus | null = null;

  constructor(private readonly http: HttpClient) {}

  get current(): CoachGuideStatus | null {
    return this.last;
  }

  load(): Observable<CoachGuideStatus> {
    return this.http.get<CoachGuideStatus>(this.baseUrl, { headers: this.quiet }).pipe(tap((status) => (this.last = status)));
  }

  /** Keeps (or brings back) the example client, or removes it and starts from scratch. */
  start(choice: CoachGuideChoice): Observable<CoachGuideStatus> {
    return this.http.post<CoachGuideStatus>(`${this.baseUrl}/start`, { choice }).pipe(tap((status) => (this.last = status)));
  }

  /** A discovery step the coach opened (the reply to the example client is read from the conversation). */
  visit(step: Exclude<CoachGuideDiscoverStep, 'REPLY_MESSAGE'>): Observable<CoachGuideStatus> {
    return this.http.post<CoachGuideStatus>(`${this.baseUrl}/visit/${step}`, {}, { headers: this.quiet })
      .pipe(tap((status) => (this.last = status)));
  }

  setHidden(hidden: boolean): Observable<CoachGuideStatus> {
    return this.http.put<CoachGuideStatus>(`${this.baseUrl}/hidden`, { hidden }, { headers: this.quiet })
      .pipe(tap((status) => (this.last = status)));
  }
}
