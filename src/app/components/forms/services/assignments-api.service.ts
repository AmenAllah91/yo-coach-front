import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type AssignmentStatus = 'ASSIGNED' | 'OPENED' | 'SUBMITTED' | 'CANCELED';

export interface FormAssignment {
  id: string;
  formId: string;
  ownerId: string;
  assigneeId: string;
  status: AssignmentStatus;
  assignedAt?: string;
  openedAt?: string;
  submittedAt?: string;
}
export interface BulkAssignResult {
  created: FormAssignment[];
  errors: Array<{ assigneeId: string; reason: string }>;
}

export interface FormAssignment {
  id: string;
  formId: string;
  ownerId: string;
  assigneeId: string;
  status: AssignmentStatus;
  assignedAt?: string;
  openedAt?: string;
  submittedAt?: string;
}


export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // page index (0-based)
  size: number;
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
  bulkAssign(formId: string, assigneeIds: string[]) {
    return this.http.post<BulkAssignResult>(
      `${this.baseUrl}/bulk/by-form/${formId}`,
      { assigneeIds }
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
}
