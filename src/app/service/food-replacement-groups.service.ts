import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FoodReplacementGroupItem {
  foodRefId: string;
  quantity: number;
  unit: string;

  name?: string;
  energy?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  servingSize?: number;
  servingDescription?: string;
  general?: boolean;
}

export interface FoodReplacementGroup {
  id?: string;
  name: string;
  description?: string;
  clientNote?: string;
  active: boolean;
  foods: FoodReplacementGroupItem[];
  coachId?: string;
  createdBy?: string;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({
  providedIn: 'root',
})
export class FoodReplacementGroupsService {
  private readonly baseUrl = '/api/food-replacement-groups';

  constructor(private http: HttpClient) {}

  getGroups(
    page = 0,
    size = 20,
    search?: string,
    active?: boolean
  ): Observable<Page<FoodReplacementGroup>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    if (active !== undefined) {
      params = params.set('active', active);
    }

    return this.http.get<Page<FoodReplacementGroup>>(this.baseUrl, { params });
  }

  getGroup(id: string): Observable<FoodReplacementGroup> {
    return this.http.get<FoodReplacementGroup>(`${this.baseUrl}/${id}`);
  }

  createGroup(group: FoodReplacementGroup): Observable<FoodReplacementGroup> {
    return this.http.post<FoodReplacementGroup>(this.baseUrl, group);
  }

  updateGroup(id: string, group: FoodReplacementGroup): Observable<FoodReplacementGroup> {
    return this.http.put<FoodReplacementGroup>(`${this.baseUrl}/${id}`, group);
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getGroupsByFood(foodRefId: string): Observable<FoodReplacementGroup[]> {
    return this.http.get<FoodReplacementGroup[]>(
      `${this.baseUrl}/by-food/${foodRefId}`
    );
  }

  getFoodRefIdsWithReplacementGroups(mealPlanId: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.baseUrl}/plan/${mealPlanId}/food-ref-ids`
    );
  }

  getReplacementGroupsForAssignedFood(
    mealPlanId: string,
    mealDayId: string,
    mealId: string,
    foodId: string
  ): Observable<FoodReplacementGroup[]> {
    return this.http.get<FoodReplacementGroup[]>(
      `${this.baseUrl}/assigned-plan/${mealPlanId}/days/${mealDayId}/meals/${mealId}/foods/${foodId}`
    );
  }
}
