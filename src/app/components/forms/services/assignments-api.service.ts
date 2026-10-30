import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CheckinInsights } from 'app/components/clients/shared/celebration';
import { environment } from '@env/environment';

export type AssignmentStatus =
  | 'ASSIGNED'
  | 'OPENED'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'CANCELED';
export interface FormAssignment {
  id: string;
  formId: string;
  formName?: string;
  ownerId: string;
  assigneeId: string;
  status: AssignmentStatus;
  assignedAt?: string;
  openedAt?: string;
  submittedAt?: string;
  dueAt?: string;
  endDate?: string | null;
  reviewedAt?: string | null;
  coachFeedback?: string | null;
  /** Coach who left the comment. */
  coachName?: string | null;
  /** When the client read the current comment (null: new comment). */
  feedbackSeenAt?: string | null;
  /** Answers in progress (page by page) and the part the client was on: they resume there. */
  draftAnswers?: any[] | null;
  draftSectionId?: string | null;
}
export interface BulkAssignResult {
  created: FormAssignment[];
  errors: Array<{ assigneeId: string; reason: string }>;
}



export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // page index (0-based)
  size: number;
}

export interface AssignFormRequest {
  assigneeIds: string[];
  dueDate?: string | null;
  endDate?: string | null;   // ✅ ADD THIS
}
@Injectable({ providedIn: 'root' })
export class AssignmentsApiService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/v1/assignments`;

  constructor(private http: HttpClient) {}

  assign(formId: string, assigneeId: string): Observable<FormAssignment> {
    const params = new HttpParams().set('formId', formId).set('assigneeId', assigneeId);
    return this.http.post<FormAssignment>(this.baseUrl, null, { params });
  }

  listByForm(formId: string): Observable<FormAssignment[]> {
    return this.http.get<FormAssignment[]>(`${this.baseUrl}/by-form/${formId}`);
  }

  cancel(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}`);
  }

  bulkAssign(formId: string, body: AssignFormRequest) {
    return this.http.post<BulkAssignResult>(
      `${this.baseUrl}/bulk/by-form/${formId}`,
      body
    );
  }

  getById(assignmentId: string): Observable<FormAssignment> {
    return this.http.get<FormAssignment>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}`);
  }
  pageMyAssignments(
    page: number,
    size: number,
    sortBy = 'assignedAt',
    direction: 'ASC' | 'DESC' = 'DESC',
    status?: AssignmentStatus,
    skipLoader = false,
    statuses: AssignmentStatus[] = []
  ) {
    let params = new HttpParams().set('page', page).set('size', size).set('sortBy', sortBy).set('direction', direction);
    if (status) params = params.set('status', status);
    // Repeated: the backend takes several statuses at once (client "Submitted" tab: SUBMITTED and REVIEWED).
    statuses.forEach(value => { params = params.append('status', value); });
    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/me/page`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }


  listMyAssignments(status?: AssignmentStatus) {
    const params: any = {};
    if (status) params.status = status;
    return this.http.get<FormAssignment[]>(`${this.baseUrl}/me`, { params });
  }


  markOpened(assignmentId: string) {
    return this.http.post<FormAssignment>(`${this.baseUrl}/${assignmentId}/open`, null);
  }

  pageOwnerAssignmentsByAsigneeId(
    page: number,
    size: number,
    sortBy = 'assignedAt',
    direction: 'ASC' | 'DESC' = 'DESC',
    assigneeId?: string,
    status?: AssignmentStatus
  ): Observable<PageResponse<FormAssignment>> {
    const params: any = { page, size, sortBy, direction };
    if (assigneeId) params.assigneeId = assigneeId;
    if (status) params.status = status;

    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/owner/page`, { params });
  }

  pageOwnerAssignmentsByAssigneeIdStatuses(
    page: number,
    size: number,
    sortBy = 'assignedAt',
    direction: 'ASC' | 'DESC' = 'DESC',
    assigneeId?: string,
    statuses: AssignmentStatus[] = [],
    search?: string,
    skipLoader = false
  ): Observable<PageResponse<FormAssignment>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (assigneeId) params = params.set('assigneeId', assigneeId);
    statuses.forEach((status) => {
      params = params.append('status', status);
    });
    if (search?.trim()) params = params.set('search', search.trim());

    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/owner/page`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  pageOwnerAssignments(
    page: number,
    size: number,
    sortBy = 'dueAt',
    direction: 'ASC' | 'DESC' = 'ASC',
    skipLoader = false
  ): Observable<PageResponse<FormAssignment>> {
    const params: any = { page, size, sortBy, direction };
    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/owner/page`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  reviewAssignment(assignmentId: string, feedback: string | null) {
    return this.http.post<FormAssignment>(
      `${this.baseUrl}/${encodeURIComponent(assignmentId)}/review`,
      { feedback }
    );
  }
  /** Change since the previous check-in of the form and the on-time streak (« Check-in sent » screen). */
  getInsights(assignmentId: string): Observable<CheckinInsights> {
    return this.http.get<CheckinInsights>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}/insights`, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' },
    });
  }

  /** The client's on-time check-in streak (CE is the single source). */
  getMyStreak(): Observable<{ streak: number }> {
    return this.http.get<{ streak: number }>(`${this.baseUrl}/me/streak`, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' },
    });
  }

  /** The client opened the coach's comment: the "New" badge goes away. */
  markFeedbackSeen(assignmentId: string): Observable<FormAssignment> {
    return this.http.post<FormAssignment>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}/feedback-seen`, null, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' },
    });
  }

  /** Keeps the client's answers in progress and the part they are on (silent: saved while they answer). */
  saveDraft(assignmentId: string, answers: any[], sectionId: string | null): Observable<FormAssignment> {
    return this.http.put<FormAssignment>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}/draft`, { answers, sectionId }, {
      headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' },
    });
  }

  hardDelete(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}/hard`);
  }
}
