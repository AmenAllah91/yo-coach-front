import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WorkoutSet {
  setNumber: number;
  reps: number;
  restMin: number;
  restSec: number;
}

export interface WorkoutExercise {
  exerciseRef: string; // ObjectId reference to exercises collection
  isSuperset: boolean;
  supersetWith?: string;
  supersetId?: string;
  notes: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  name: string;
  exercises: WorkoutExercise[];
}

export interface TrainingDay {
  dayId: string;
  name: string;
  description: string;
  dayNumber?: number;
  restDay?: boolean;
  date?: string;
  dayOfWeek?: string;
  title?: string;
  status?: string;
  exercises?: WorkoutExercise[];
  workoutSessions?: WorkoutSession[];
}

export interface Workout {
  id?: string;
  name: string;
  details?: string;
  workoutDays?: TrainingDay[];
  startDate?: string;
  endDate?: string;
  client?: any;
  coach?: any;
  isWorkoutPlanTemplate?: boolean;
  typeWorkoutPlan?: string;
}

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
  ): Observable<PageResponse<Workout>> {
    let params = `page=${page}&size=${size}`;
    if (search) params += `&search=${search}`;
    if (isTemplate !== undefined) params += `&isTemplate=${isTemplate}`;
    return this.http.get<PageResponse<Workout>>(`${this.apiUrl}?${params}`);
  }

  getTemplates(
    page: number = 0,
    size: number = 12
  ): Observable<PageResponse<Workout>> {
    return this.http.get<PageResponse<Workout>>(
      `${this.apiUrl}templates?page=${page}&size=${size}`
    );
  }

  getMyLibrary(
    page: number = 0,
    size: number = 12
  ): Observable<PageResponse<Workout>> {
    return this.http.get<PageResponse<Workout>>(
      `${this.apiUrl}my-library?page=${page}&size=${size}`
    );
  }

  createWorkout(workout: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, workout);
  }

  updateWorkout(id: string, workout: any): Observable<Workout> {
    return this.http.put<Workout>(`${this.apiUrl}${id}`, workout);
  }

  deleteWorkout(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}`);
  }

  duplicateWorkout(id: string): Observable<Workout> {
    return this.http.post<Workout>(`${this.apiUrl}${id}/duplicate`, {});
  }

  getWorkoutById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}`);
  }
  getWorkoutByCoachIdAndClient(coachId: string, clientId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}client/${clientId}/coach/${coachId}`
    );
  }
}
