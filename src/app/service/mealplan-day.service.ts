import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MealplanDayService {
  private apiUrl = `${environment.baseApiUrl}/api/meal-day/`;
  constructor(private http: HttpClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatePlanDay(mealPlan: any, planId: string): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.put<any>(`${this.apiUrl}${planId}/days`, mealPlan);
  }
}
