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

  uploadMealPhoto(planId: string, mealDayId: string, mealId: string, file: File): Observable<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoUrl: string }>(
      `${this.apiUrl}${planId}/days/${mealDayId}/meals/${mealId}/photo`,
      formData
    );
  }

  getMealPhotoUrl(planId: string, mealDayId: string, mealId: string): Observable<{ photoUrl: string }> {
    return this.http.get<{ photoUrl: string }>(
      `${this.apiUrl}${planId}/days/${mealDayId}/meals/${mealId}/photo-url`
    );
  }
}
