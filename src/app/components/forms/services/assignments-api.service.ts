import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    status?: AssignmentStatus
  ) {
    const params: any = { page, size, sortBy, direction };
    if (status) params.status = status;
    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/me/page`, { params });
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
    search?: string
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

    return this.http.get<PageResponse<FormAssignment>>(`${this.baseUrl}/owner/page`, { params });
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
  hardDelete(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(assignmentId)}/hard`);
  }
}
