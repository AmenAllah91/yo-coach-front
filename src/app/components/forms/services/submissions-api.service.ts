import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
export type UiAnswer =
  | { questionId: string; type: 'MULTIPLE_CHOICE'; selectedOptionId: string | null }
  | { questionId: string; type: 'STAR_RATING'; rating: number | null }
  | { questionId: string; type: 'YES_NO'; yes: boolean | null }
  | { questionId: string; type: 'TEXT'; text: string | null }
  | { questionId: string; type: 'DATE'; date: string | null };
export interface SubmissionPayload {
  answers: any[];
}

@Injectable({ providedIn: 'root' })
export class SubmissionsApiService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/v1/submissions`;

  constructor(private http: HttpClient) {}

  submit(assignmentId: string, payload: SubmissionPayload): Observable<any> {
    const params = new HttpParams().set('assignmentId', assignmentId);
    return this.http.post(this.baseUrl, payload, { params });
  }
}
