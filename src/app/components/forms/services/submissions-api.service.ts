import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import {Submission, SubmissionPayload} from "../../../models/forms.model";

/** One question of the signup form and the client's answer (all empty: optional, not answered). */
export interface SignupAnswerRow {
  label: string;
  type: 'MULTIPLE_CHOICE' | 'STAR_RATING' | 'YES_NO' | 'TEXT' | 'DATE';
  /** Text, chosen option or date (yyyy-MM-dd). */
  value: string | null;
  rating: number | null;
  maxStars: number | null;
  yes: boolean | null;
}

export interface SignupAnswers {
  formTitle: string | null;
  submittedAt: string | null;
  rows: SignupAnswerRow[];
}


@Injectable({ providedIn: 'root' })
export class SubmissionsApiService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/v1/submissions`;

  constructor(private http: HttpClient) {}

  submit(assignmentId: string, payload: SubmissionPayload): Observable<Submission> {
    const params = new HttpParams().set('assignmentId', assignmentId);
    return this.http.post<Submission>(this.baseUrl, payload, { params });
  }

  /** The client's answers to the coach's signup form (onboarding); null (204) when there are none. */
  getSignupAnswers(clientId: string): Observable<SignupAnswers | null> {
    return this.http.get<SignupAnswers | null>(`${this.baseUrl}/signup/${encodeURIComponent(clientId)}`);
  }

  getByAssignmentId(assignmentId: string): Observable<Submission> {
    return this.http.get<Submission>(`${this.baseUrl}/by-assignment/${encodeURIComponent(assignmentId)}`);
  }
}
