import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EnumResponse, Exercise } from '@shared/models/exercice.models';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private apiUrl = `${environment.baseApiUrl}/api/exercise-ref`;
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
    name?: string
  ): Observable<PageResponse<Exercise>> {
    let params = `page=${page}&size=${size}`;
    if (equipment) params += `&equipment=${equipment}`;
    if (muscle) params += `&muscle=${muscle}`;
    if (type) params += `&type=${type}`;
    if (name) params += `&name=${name}`;
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

  getTemplateExercises(
    page: number = 0,
    size: number = 10
  ): Observable<PageResponse<Exercise>> {
    return this.http.get<PageResponse<Exercise>>(
      `${this.apiUrl}/templates?page=${page}&size=${size}`
    );
  }

  getMyExercises(
    page: number = 0,
    size: number = 10
  ): Observable<PageResponse<Exercise>> {
    return this.http.get<PageResponse<Exercise>>(
      `${this.apiUrl}/my-exercises?page=${page}&size=${size}`
    );
  }

  getExercises(page: number, size: number, filters: any): Observable<PageResponse<Exercise>> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (filters.name) params = params.set('name', filters.name);
    if (filters.muscle) params = params.set('muscle', filters.muscle);
    if (filters.equipment) params = params.set('equipment', filters.equipment);
    if (filters.type) params = params.set('type', filters.type);

    return this.http.get<PageResponse<Exercise>>(this.apiUrl + '/', { params });
  }
}
