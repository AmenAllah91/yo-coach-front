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
    return this.http.post<WorkoutPlan>(this.apiUrl, workout);
  }


  updateWorkout(id: string, workout: WorkoutPlan): Observable<WorkoutPlan> {
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
    size: number
  ) {
    return this.http.get<PageResponse<WorkoutPlan>>(
      `${this.apiUrl}client/${clientId}/coach/${coachId}`,
      {
        params: { page, size },
      }
    );
  }

  getWorkoutPlansByClient(clientId: string): Observable<WorkoutPlan[]> {
    return this.http.get<WorkoutPlan[]>(`${this.apiUrl}client/${clientId}`);
  }
}
