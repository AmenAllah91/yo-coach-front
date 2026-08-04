/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface MealTemplateDto {
  id?: string;
  name: string;
  mealType?: string;
  servings?: number;
  totalTimeMinutes?: number | null;
  coverImage?: string | null;
  directions?: string[];
  foods: any[];
  template?: boolean;
  draft?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MealsService {
  private readonly base = `${environment.baseApiUrl}/api/meals`;
  private readonly templatesBase = `${environment.baseApiUrl}/api/meal-templates`;

  constructor(private http: HttpClient) {}

  getMeals(page = 0, size = 10, search?: string): Observable<any> {
    const params: Record<string, string | number> = { page, size };
    if (search?.trim()) params['search'] = search.trim();
    return this.http.get<any>(this.base, { params });
  }


  getMealLibrary(recipe: boolean, page = 0, size = 3, search = ''): Observable<any> {
    let params = new HttpParams()
      .set('recipe', String(recipe))
      .set('page', String(page))
      .set('size', String(size));

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<any>(`${this.base}/library`, { params });
  }

  getMeal(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  createMeal(payload: any): Observable<any> {
    return this.http.post<any>(this.base, payload);
  }

  updateMeal(id: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.base}/${id}`, payload);
  }

  deleteMeal(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}`);
  }

  duplicateMeal(id: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/duplicate`, {});
  }

  getTemplates(): Observable<MealTemplateDto[]> {
    return this.http.get<MealTemplateDto[]>(this.templatesBase);
  }

  saveTemplate(payload: MealTemplateDto): Observable<any> {
    return this.http.post<any>(this.templatesBase, payload);
  }
}
