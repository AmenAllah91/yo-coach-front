import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkoutPlan } from '@shared/models/workout.models';


export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}
export interface SaveWorkoutSetRequest {
  setNumber: number;
  reps: number | null;
  weight?: number | null;
  duration?: number;
  restMin: number;
  restSec: number;
  type?: 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE';
}

export interface SaveWorkoutExerciseRequest {
  name: string;
  type: 'CARDIO' | 'STRENGTH';
  description?: string;
  videoLink?: string;
  supersetGroupId?: string | null;
  sets: SaveWorkoutSetRequest[];
}

export interface SaveWorkoutDayRequest {
  title: string;
  date: string;
  restDay: boolean;
  exercises: SaveWorkoutExerciseRequest[];
}

export interface UpdateWorkoutDayRequest extends SaveWorkoutDayRequest {}

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private apiUrl = `${environment.baseApiUrl}/api/workout-plan/`;

  constructor(private http: HttpClient) {}

  getWorkouts(
    page: number = 0,
    size: number = 12,
    search?: string,
    isTemplate?: boolean
  ): Observable<PageResponse<WorkoutPlan>> {
    let params = `page=${page}&size=${size}`;
    if (search) params += `&search=${search}`;
    if (isTemplate !== undefined) params += `&isTemplate=${isTemplate}`;
    return this.http.get<PageResponse<WorkoutPlan>>(`${this.apiUrl}?${params}`);
  }

  getTemplates(
    page: number = 0,
    size: number = 12
  ): Observable<PageResponse<WorkoutPlan>> {
    return this.http.get<PageResponse<WorkoutPlan>>(
      `${this.apiUrl}templates?page=${page}&size=${size}`
    );
  }

  getMyLibrary(
    page: number = 0,
    size: number = 12
  ): Observable<PageResponse<WorkoutPlan>> {
    return this.http.get<PageResponse<WorkoutPlan>>(
      `${this.apiUrl}my-library?page=${page}&size=${size}`
    );
  }

  getAllLibrary(): Observable<PageResponse<WorkoutPlan>> {
    return this.http.get<PageResponse<WorkoutPlan>>(`${this.apiUrl}my-library`);
  }

  createWorkout(workout: WorkoutPlan): Observable<WorkoutPlan> {
    console.log('[WORKOUT SERVICE CREATE] workout =', workout);
    console.log('[WORKOUT SERVICE CREATE] workout.isWorkoutPlanTemplate =', workout.isWorkoutPlanTemplate);
    console.log('[WORKOUT SERVICE CREATE] JSON.stringify =', JSON.stringify(workout));
    return this.http.post<WorkoutPlan>(this.apiUrl, workout);
  }


  updateWorkout(id: string, workout: WorkoutPlan): Observable<WorkoutPlan> {
    console.log('[WORKOUT SERVICE UPDATE] workout =', workout);
    console.log('[WORKOUT SERVICE UPDATE] workout.isWorkoutPlanTemplate =', workout.isWorkoutPlanTemplate);
    console.log('[WORKOUT SERVICE UPDATE] JSON.stringify =', JSON.stringify(workout));
    return this.http.put<WorkoutPlan>(`${this.apiUrl}${id}`, workout);
  }

  assignWorkout(id: string, workout: WorkoutPlan): Observable<WorkoutPlan> {
    return this.http.put<WorkoutPlan>(`${this.apiUrl}assign`, workout);
  }

  deleteWorkout(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}`);
  }

  duplicateWorkout(id: string): Observable<WorkoutPlan> {
    return this.http.post<WorkoutPlan>(`${this.apiUrl}${id}/duplicate`, {});
  }


  getWorkoutById(id: string): Observable<WorkoutPlan> {
    return this.http.get<WorkoutPlan>(`${this.apiUrl}${id}`);
  }
  getWorkoutByCoachIdAndClient(
    coachId: string,
    clientId: string,
    page: number,
    size: number,
    type: 'ALL' | 'APP' | 'FILES' = 'ALL',
    period: 'ALL' | 'ACTIVE' | 'NON_ACTIVE' = 'ALL',
    statusFilter: 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP' = 'ALL',
    sort: 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC' = 'RECOMMENDED'
  ) {
    return this.http.get<PageResponse<WorkoutPlan>>(
      `${this.apiUrl}client/${clientId}/coach/${coachId}`,
      {
        params: { page, size, type, period, statusFilter, sort },
      }
    );
  }




  createAndAssignFileWorkoutOnly(
    file: File,
    name: string,
    details: string | undefined,
    clientId: string,
    startDate: string,
    endDate: string
  ): Observable<WorkoutPlan> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (details) formData.append('details', details);
    formData.append('clientId', clientId);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);

    return this.http.post<WorkoutPlan>(`${this.apiUrl}file/assign-only`, formData);
  }

  createFileWorkout(
    file: File,
    name: string,
    details?: string,
    isWorkoutPlanTemplate: boolean = false
  ): Observable<WorkoutPlan> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (details) formData.append('details', details);
    formData.append('isWorkoutPlanTemplate', String(isWorkoutPlanTemplate));
    return this.http.post<WorkoutPlan>(`${this.apiUrl}file`, formData);
  }


  replaceWorkoutFile(id: string, file: File): Observable<WorkoutPlan> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<WorkoutPlan>(`${this.apiUrl}${id}/file/replace`, formData);
  }

  updateWorkoutPlanDates(id: string, startDate: string, endDate: string): Observable<WorkoutPlan> {
    return this.http.patch<WorkoutPlan>(`${this.apiUrl}${id}/dates`, {
      startDate,
      endDate,
    });
  }

  getWorkoutFileUrl(plan?: Partial<WorkoutPlan> | null): string {
    if (!plan) return '';

    const direct = plan.fileUrl || '';

    // Absolute file URL
    if (direct && /^https?:\/\//i.test(direct)) {
      return direct;
    }

    // IMPORTANT:
    // Prefer the program id endpoint instead of /file/{fileName}.
    // Reason: after Replace File from client > Workouts, a stale library item can still contain
    // the old fileName in memory/DB. The id endpoint lets backend resolve the latest file metadata
    // and fallback to sourceWorkoutPlanId when needed.
    if (plan.id) {
      return `${this.apiUrl}${plan.id}/file/download`;
    }

    // Fallback only when we do not have an id.
    if (plan.fileName) {
      return `${this.apiUrl}file/${encodeURIComponent(plan.fileName)}`;
    }

    // Relative backend URL saved in DB, ex: /api/workout-plan/file/xxx.pdf
    // Keep it last because it can also contain an old filename.
    if (direct && direct.startsWith('/api/')) {
      return `${environment.baseApiUrl}${direct}`;
    }

    return direct;
  }

  getWorkoutFileBlob(plan?: Partial<WorkoutPlan> | null): Observable<Blob> {
    return this.http.get(this.getWorkoutFileUrl(plan), {
      responseType: 'blob',
      params: { t: Date.now().toString() },
    });
  }

  getWorkoutPlansByClient(clientId: string): Observable<WorkoutPlan[]> {
    return this.http.get<WorkoutPlan[]>(`${this.apiUrl}client/${clientId}`, {
      params: { t: Date.now().toString() },
    });
  }
  addWorkoutDay(programId: string, body: SaveWorkoutDayRequest) {
    return this.http.post(`${this.apiUrl}${programId}/days`, body);
  }

  updateWorkoutDay(
    programId: string,
    dayId: string,
    body: UpdateWorkoutDayRequest
  ) {
    return this.http.put(`${this.apiUrl}${programId}/days/${dayId}`, body);
  }

  deleteWorkoutDay(programId: string, dayId: string) {
    return this.http.delete(`${this.apiUrl}${programId}/days/${dayId}`);
  }
}
