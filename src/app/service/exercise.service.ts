import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Exercise {
  id?: string;
  name: string;
  type: string;
  equipment: string;
  muscle: string;
  videoLink?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface EnumResponse {
  typeExercise: string[];
  equipment: string[];
  muscleGroup: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private apiUrl = `${environment.baseApiUrl}/public/exercise-ref`;
  private enumUrl = `${environment.baseApiUrl}/public/enums`;

  constructor(private http: HttpClient) {}

  createExercise(exercise: Exercise): Observable<Exercise> {
    return this.http.post<Exercise>(`${this.apiUrl}/`, exercise);
  }

  getAllExercises(
    page: number = 0, 
    size: number = 10, 
    equipment?: string, 
    muscle?: string, 
    type?: string,
    search?: string
  ): Observable<PageResponse<Exercise>> {
    let params = `page=${page}&size=${size}`;
    if (equipment) params += `&equipment=${equipment}`;
    if (muscle) params += `&muscle=${muscle}`;
    if (type) params += `&type=${type}`;
    if (search) params += `&search=${search}`;
    return this.http.get<PageResponse<Exercise>>(`${this.apiUrl}/?${params}`);
  }

  getExerciseById(id: string): Observable<Exercise> {
    return this.http.get<Exercise>(`${this.apiUrl}/${id}`);
  }

  updateExercise(id: string, exercise: Exercise): Observable<Exercise> {
    return this.http.put<Exercise>(`${this.apiUrl}/${id}`, exercise);
  }

  deleteExercise(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getEnums(): Observable<EnumResponse> {
    return this.http.get<EnumResponse>(`${this.enumUrl}/`);
  }
}