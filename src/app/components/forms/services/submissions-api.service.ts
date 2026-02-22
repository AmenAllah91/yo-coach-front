import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import {Submission, SubmissionPayload} from "../../../models/forms.model";


@Injectable({ providedIn: 'root' })
export class SubmissionsApiService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/v1/submissions`;

  constructor(private http: HttpClient) {}

  submit(assignmentId: string, payload: SubmissionPayload): Observable<Submission> {
    const params = new HttpParams().set('assignmentId', assignmentId);
    return this.http.post<Submission>(this.baseUrl, payload, { params });
  }

  getByAssignmentId(assignmentId: string): Observable<Submission> {
    return this.http.get<Submission>(`${this.baseUrl}/by-assignment/${encodeURIComponent(assignmentId)}`);
  }
}
