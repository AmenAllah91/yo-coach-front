import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WorkoutPlan {
  id?: string;
  clientId: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[];
  createdDate?: string;
  isActive?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime?: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkoutPlanService {
  private apiUrl = `${environment.baseApiUrl}/gym_coaching/workout-plans`;

  constructor(private http: HttpClient) {}

  getWorkoutPlansByClient(clientId: string): Observable<WorkoutPlan[]> {
    return this.http.get<WorkoutPlan[]>(`${this.apiUrl}/client/${clientId}`);
  }

  createWorkoutPlan(workoutPlan: WorkoutPlan): Observable<WorkoutPlan> {
    return this.http.post<WorkoutPlan>(this.apiUrl, workoutPlan);
  }

  updateWorkoutPlan(id: string, workoutPlan: WorkoutPlan): Observable<WorkoutPlan> {
    return this.http.put<WorkoutPlan>(`${this.apiUrl}/${id}`, workoutPlan);
  }

  deleteWorkoutPlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
