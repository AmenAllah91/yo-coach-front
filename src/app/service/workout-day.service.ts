import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WorkoutDayService {
  private apiUrl = `${environment.baseApiUrl}/api/workout-day/`;
  constructor(private http: HttpClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateWorkoutDay(workout: any , planId :string): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.put<any>(`${this.apiUrl}${planId}/days`, workout);
  }
}
