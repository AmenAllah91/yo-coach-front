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
  notes: string;
  sets: WorkoutSet[];
}

export interface Exercise {
  id: string;
  name: string;
  type: string;
  muscleGroups: string[];
  equipment: string;
  instructions?: string;
  createdDate: string;
}

export interface TrainingDay {
  dayId: string;
  name: string;
  description: string;
  exercises: WorkoutExercise[];
}

export interface Program {
  id?: string;
  name: string;
  description?: string;
  createdDate?: string;
  modifiedDate?: string;
  createdBy?: string;
  trainingDays?: TrainingDay[];
  isTemplate?: boolean;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProgramService {
  private apiUrl = `${environment.baseApiUrl}/gym_coaching/programs`;

  constructor(private http: HttpClient) {}

  getPrograms(page: number = 0, size: number = 12): Observable<PageResponse<Program>> {
    return this.http.get<PageResponse<Program>>(`${this.apiUrl}?page=${page}&size=${size}`);
  }

  createProgram(program: Program): Observable<Program> {
    return this.http.post<Program>(this.apiUrl, program);
  }

  updateProgram(id: string, program: Program): Observable<Program> {
    return this.http.put<Program>(`${this.apiUrl}/${id}`, program);
  }

  deleteProgram(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  duplicateProgram(id: string): Observable<Program> {
    return this.http.post<Program>(`${this.apiUrl}/${id}/duplicate`, {});
  }
}