import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { concat, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

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
  private readonly baseUrl = `${environment.baseApiUrl}/api/food-replacement-groups`;
  private readonly groupsCache = new Map<string, Page<FoodReplacementGroup>>();

  constructor(private http: HttpClient) {}

  getGroups(
    page = 0,
    size = 20,
    search?: string,
    active?: boolean,
    skipLoader = false,
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

    const cacheKey = `${page}|${size}|${search?.trim() || ''}|${active ?? 'all'}`;
    const request = this.http.get<Page<FoodReplacementGroup>>(this.baseUrl, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    }).pipe(tap((result) => this.groupsCache.set(cacheKey, result)));
    const cached = this.groupsCache.get(cacheKey);

    // Returning cached data first makes revisits instant; the HTTP response then
    // refreshes the list without blocking the interface.
    return cached ? concat(of(cached), request) : request;
  }

  getGroup(id: string): Observable<FoodReplacementGroup> {
    return this.http.get<FoodReplacementGroup>(`${this.baseUrl}/${id}`);
  }

  createGroup(group: FoodReplacementGroup): Observable<FoodReplacementGroup> {
    return this.http.post<FoodReplacementGroup>(this.baseUrl, group).pipe(
      tap(() => this.groupsCache.clear()),
    );
  }

  updateGroup(id: string, group: FoodReplacementGroup): Observable<FoodReplacementGroup> {
    return this.http.put<FoodReplacementGroup>(`${this.baseUrl}/${id}`, group).pipe(
      tap(() => this.groupsCache.clear()),
    );
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.groupsCache.clear()),
    );
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
