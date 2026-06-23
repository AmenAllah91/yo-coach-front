/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface MealTemplateDto {
  id?: string;
  name: string;
  foods: any[];
  tags?: string[];
}

@Injectable({ providedIn: 'root' })
export class MealsService {
  private base = `${environment.baseApiUrl}/api/meals`;
  private tpl = `${environment.baseApiUrl}/api/meal-templates`;

  constructor(private http: HttpClient) {}

  getMeals(page: number = 0, size: number = 10, search?: string): Observable<any> {
    const params: any = { page, size };
    if (search) params.search = search;
    return this.http.get<any>(this.base, { params });
  }

  getMeal(id: string) {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  createMeal(payload: any) {
    return this.http.post<any>(this.base, payload);
  }

  updateMeal(id: string, payload: any) {
    return this.http.put<any>(`${this.base}/${id}`, payload);
  }

  deleteMeal(id: string) {
    return this.http.delete<any>(`${this.base}/${id}`);
  }

  duplicateMeal(id: string) {
    return this.http.post<any>(`${this.base}/${id}/duplicate`, {});
  }

  getTemplates(): Observable<MealTemplateDto[]> {
    return this.http.get<MealTemplateDto[]>(this.tpl);
  }

  saveTemplate(payload: MealTemplateDto) {
    return this.http.post<any>(this.tpl, payload);
  }
}


