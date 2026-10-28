import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, concat, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { FoodServing, MealPlan } from '@shared/models/MealPlan';
import { Page } from 'app/models/Page.model';

export interface Food {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  polyols?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  polyunsaturatedFat?: number | null;
  monounsaturatedFat?: number | null;
  saturatedFat?: number | null;
  sodium?: number | null;
  servingSize: number;
  servingUnit: string;
  servings?: FoodServing[] | null;
  defaultServingId?: string | null;
  coachId?: string;
  isGeneral?: boolean;
  createdDate?: string;
  lastModifiedDate?: string;
  imageUrl?: string;
}

export interface FoodRef {
  id: string;
  name: string;
  energy: number | null;
  fat: number | null;
  saturatedFat: number | null;
  polyunsaturatedFat: number | null;
  monounsaturatedFat: number | null;
  tranFat: number | null;
  cholesterol: number | null;
  sodium: number | null;
  potassium: number | null;
  carbohydrates: number | null;
  fiber: number | null;
  sugar: number | null;
  protein: number | null;
  vitaminA: number | null;
  vitaminC: number | null;
  calcium: number | null;
  iron: number | null;
  omega3: number | null;
  zinc: number | null;
  coachId: string | null;
  servingSize: number | null;
  servingDescription: string | null;
  servings?: FoodServing[] | null;
  defaultServingId?: string | null;
  createdDate: Date | null;
  lastModifiedDate: Date | null;
  general: boolean;
  imageUrl?: string;
}

export interface NutritionPlan {
  publishedWeeks?: number[];
  durationWeeks?: number;
  publicationWorkflow?: boolean;
  id?: string;
  name: string;
  description?: string;
  trackingMode: 'TOTAL_FOR_DAY' | 'EACH_MEAL' | null;
  mealDays: NutritionDay[];
  coachId?: string;
  createdBy?: string;
  lastModifiedDate?: string;
  updatedAt?: Date;
  createdAt?: Date;
  startDate?: string;
  endDate?: string;
  client?: any;
  isMealPlanTemplate?: boolean;
  nutritionPlanMode?: 'APP' | 'FILE' | string;
  resourceType?: 'PDF' | 'EXCEL' | string;
  fileName?: string;
  originalFileName?: string;
  fileUrl?: string;
  fileContentType?: string;
  fileSizeBytes?: number;
  fileUploadedAt?: string;
  overlap?: boolean;
}
export interface DayTargets {
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
}

export interface NutritionDay {
  id?: string;
  dayNumber: number;
  name: string;
  description?: string;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
  dayTargets: DayTargets;
  meals?: Meal[];
}

export interface Meal {
  id?: string;
  name: string;
  foods?: FoodItem[];
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

@Injectable({
  providedIn: 'root',
})
export class NutritionService {
  private baseUrl = `${environment.baseApiUrl}/nutrition`;
  private mealPlanUrl = `${environment.baseApiUrl}/api/meal-plan/`;
  private foodRefUrl = `${environment.baseApiUrl}/api/food-ref`;

  constructor(private http: HttpClient) {}

  private fromFoodApi(food: any): Food {
    return { ...food, calories: food.energy ?? food.calories ?? null,
      carbs: food.carbohydrates ?? food.carbs ?? null,
      servingUnit: food.servingDescription ?? food.servingUnit ?? '',
      isGeneral: food.general ?? food.isGeneral };
  }
  private toFoodApi(food: Food) {
    const { calories, carbs, servingUnit, ...fields } = food;
    return { ...fields, energy: calories, carbohydrates: carbs, servingDescription: servingUnit };
  }

  // Food management
  getFoods(
    page: number = 0,
    size: number = 20,
    search?: string,
    customOnly: boolean = false,
    skipLoader: boolean = false,
  ): Observable<any> {
    let params = `page=${page}&size=${size}`;
    if (search) {
      params += `&search=${encodeURIComponent(search)}`;
    }
    if (customOnly) {
      params += `&customOnly=true`;
    }
    return this.http.get<any>(
      `${environment.baseApiUrl}/api/food-ref?${params}`,
      { headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {} },
    ).pipe(map(response => ({ ...response, content: (response.content || []).map(food => this.fromFoodApi(food)) })));
  }

  duplicate(id: string, skipLoader = false): Observable<any> {
    return this.http.post<any>(`${this.mealPlanUrl}${id}/duplicate`, {}, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  filteredFoods(
    page: number = 0,
    size: number = 20,
    search?: string
  ): Observable<any> {
    let params = `page=${page}&size=${size}`;
    if (search) {
      params += `&search=${search}`;
    }

    return this.http.get<any>(
      `${environment.baseApiUrl}/api/food-ref/filtered?${params}`
    );
  }

  /** Foods of the Add Food modal (first 100, custom foods first), by search: kept 2 min, the modal opens at once. */
  private readonly pickerFoods = new Map<string, { at: number; foods: any[] }>();

  pickerFoodsSnapshot(search: string, maxAgeMs = 120_000): any[] | null {
    const known = this.pickerFoods.get(search.trim().toLowerCase());
    return known && Date.now() - known.at < maxAgeMs ? known.foods : null;
  }

  private readonly pickerRequests = new Map<string, Observable<any[]>>();

  loadPickerFoods(search: string): Observable<any[]> {
    const key = search.trim().toLowerCase();
    const running = this.pickerRequests.get(key);
    if (running) return running; // the prefetch and the modal share one request
    const params = new HttpParams().set('page', 0).set('size', 100).set('search', search.trim());
    const request = this.http
      .get<any>(`${environment.baseApiUrl}/api/food-ref/filtered`, { params, headers: { 'X-Skip-Loader': 'true' } })
      .pipe(
        map((response) => [...(response?.content || [])].sort((a: any, b: any) => Number(!!a.general) - Number(!!b.general))),
        tap((foods) => {
          if (this.pickerFoods.size > 50) this.pickerFoods.clear();
          this.pickerFoods.set(key, { at: Date.now(), foods });
        }),
        finalize(() => this.pickerRequests.delete(key)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.pickerRequests.set(key, request);
    return request;
  }

  /** Loads the first list in the background (editor opened): the Add Food modal then opens at once. */
  prefetchPickerFoods(): void {
    if (!this.pickerFoodsSnapshot('')) this.loadPickerFoods('').subscribe({ error: () => {} });
  }

  /** A serving was added to a food: the cached lists show it too. */
  rememberPickerFood(food: any): void {
    this.pickerFoods.forEach((entry) => {
      entry.foods = entry.foods.map((item) => (item.id === food?.id ? { ...item, ...food } : item));
    });
  }

  createFood(food: Food): Observable<Food> {
    return this.http.post<Food>(`${environment.baseApiUrl}/api/food-ref`, this.toFoodApi(food)).pipe(map(result => this.fromFoodApi(result)));
  }

  updateFood(id: string, food: Food): Observable<Food> {
    return this.http.put<Food>(
      `${environment.baseApiUrl}/api/food-ref/${id}`,
      this.toFoodApi(food)
    ).pipe(map(result => this.fromFoodApi(result)));
  }

  uploadFoodImage(id: string, file: File): Observable<Food> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Food>(`${environment.baseApiUrl}/api/food-ref/${id}/image`, formData).pipe(map(result => this.fromFoodApi(result)));
  }

  removeFoodImage(id: string): Observable<Food> {
    return this.http.delete<Food>(`${environment.baseApiUrl}/api/food-ref/${id}/image`).pipe(map(result => this.fromFoodApi(result)));
  }

  deleteFood(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.baseApiUrl}/api/food-ref/${id}`
    );
  }

  getFoodById(id: string): Observable<Food> {
    return this.http.get<Food>(`${environment.baseApiUrl}/api/food-ref/${id}`).pipe(map(result => this.fromFoodApi(result)));
  }

  /** quiet: background lookup (a food's picture): no loader, no error toast (a removed food answers 404). */
  getFoodForClient(id: string, quiet = false): Observable<Food> {
    const headers = quiet ? { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } : {};
    return this.http.get<Food>(`${environment.baseApiUrl}/api/food-ref/client-view/${id}`, { headers }).pipe(map(result => this.fromFoodApi(result)));
  }

  importFoods(foods: { name: string; servings: FoodServing[] }[]): Observable<any> {
    return this.http.post(`${environment.baseApiUrl}/api/food-ref/import`, foods);
  }

  addFoodServing(id: string, serving: FoodServing): Observable<Food> {
    return this.http.post<Food>(`${environment.baseApiUrl}/api/food-ref/${id}/servings`, serving).pipe(map(result => this.fromFoodApi(result)));
  }

  // Nutrition plan management
  getNutritionPlans(
    page: number = 0,
    size: number = 10,
    planType: 'ALL' | 'APP' | 'FILES' | 'PDF' | 'EXCEL' = 'ALL',
    search: string = '',
    skipLoader = false
  ): Observable<Page<NutritionPlan>> {
    const params: any = { page, size, planType };

    if (search?.trim()) {
      params.search = search.trim();
    }

    return this.http.get<Page<NutritionPlan>>(`${this.mealPlanUrl}`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }
  getNutritionPlansTemplates(
    page: number = 0,
    size: number = 10,
    search: string = '',
    skipLoader = false
  ): Observable<Page<NutritionPlan>> {
    const params: any = { page, size };

    if (search?.trim()) {
      params.search = search.trim();
    }

    return this.http.get<Page<NutritionPlan>>(`${this.mealPlanUrl}templates`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }
  getNutritionPlanById(id: string, skipLoader = false): Observable<any> {
    return this.http.get<any>(`${this.mealPlanUrl}${id}`, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  /** quiet: the editor shows its own "Saving…" state (same as the workout builder), no full-screen loader. */
  createNutritionPlan(plan: MealPlan, quiet = false): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.mealPlanUrl}`, plan, quiet ? { headers: { 'X-Skip-Loader': 'true' } } : {});
  }

  /** {@code overlap}: the coach's choice when the plan grew over the next one (backlog-programmes.md P9). */
  updateNutritionPlan(plan: MealPlan, quiet = false, overlap?: 'SHIFT' | 'REMOVE' | null): Observable<MealPlan> {
    return this.http.put<MealPlan>(`${this.mealPlanUrl}`, plan, {
      ...(quiet ? { headers: { 'X-Skip-Loader': 'true' } } : {}),
      ...(overlap ? { params: { overlap } } : {}),
    });
  }
  assignNutritionPlan(plan: any): Observable<NutritionPlan> {
    return this.http.put<NutritionPlan>(`${this.mealPlanUrl}assign`, plan);
  }

  createAndAssignFileNutritionPlanOnly(
    file: File,
    name: string,
    details: string | undefined,
    clientId: string,
    startDate: string,
    endDate: string
  ): Observable<NutritionPlan> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (details) formData.append('details', details);
    formData.append('clientId', clientId);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);

    return this.http.post<NutritionPlan>(`${this.mealPlanUrl}file/assign-only`, formData);
  }

  createNutritionFilePlan(
    file: File,
    name: string,
    details?: string,
    startDate?: string,
    endDate?: string
  ): Observable<NutritionPlan> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    if (details) {
      formData.append('details', details);
    }

    if (startDate) {
      formData.append('startDate', startDate);
    }

    if (endDate) {
      formData.append('endDate', endDate);
    }

    return this.http.post<NutritionPlan>(`${this.mealPlanUrl}file`, formData);
  }

  getNutritionFileUrl(plan: NutritionPlan | MealPlan | any): string {
    if (!plan) return '';

    const direct = plan.fileUrl ? String(plan.fileUrl) : '';

    if (direct && /^https?:\/\//i.test(direct)) {
      return direct;
    }

    // Same behavior as Workout: prefer id endpoint so backend resolves the real stored file.
    if (plan.id) {
      return `${this.mealPlanUrl}${plan.id}/file/download`;
    }

    if (plan.fileName) {
      return `${this.mealPlanUrl}file/download?objectPath=${encodeURIComponent(plan.fileName)}`;
    }

    if (direct && direct.startsWith('/api/')) {
      return `${environment.baseApiUrl}${direct}`;
    }

    return direct;
  }

  downloadNutritionFile(plan: NutritionPlan | MealPlan | any): Observable<Blob> {
    return this.http.get(this.getNutritionFileUrl(plan), {
      responseType: 'blob',
      params: { t: Date.now().toString() },
    });
  }


  deleteNutritionPlan(id: string, skipLoader = false): Observable<void> {
    return this.http.delete<void>(`${this.mealPlanUrl}${id}`, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  /** « Modifier les dates » (backlog-programmes.md CD-01): the next plans are shifted unless `overlap` is REMOVE. */
  updateNutritionPlanDates(id: string, startDate: string, endDate: string, overlap: 'SHIFT' | 'REMOVE' = 'SHIFT'): Observable<NutritionPlan> {
    return this.http.patch<NutritionPlan>(`${this.mealPlanUrl}${id}/dates`, {
      startDate,
      endDate,
    }, { params: { overlap } });
  }

  getNutritionPlanByCoachIdAndClient(
    coachId: string,
    clientId: string,
    page: number,
    size: number,
    planType: 'ALL' | 'APP' | 'FILES' = 'ALL',
    period: 'ALL' | 'ACTIVE' | 'NON_ACTIVE' = 'ALL',
    statusFilter: 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP' = 'ALL',
    sort: 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC' = 'RECOMMENDED',
    skipLoader = false
  ) {
    return this.http.get<any>(
      `${this.mealPlanUrl}client/${clientId}/coach/${coachId}/all`,
      {
        params: {
          page,
          size,
          planType,
          period,
          statusFilter,
          sort,
        },
        headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
      }
    );
  }

  /** Last plans of each client (client app): a revisit shows them at once, the fresh answer follows. */
  private readonly clientPlans = new Map<string, any>();

  getNutritionPlanByClientId(clientId: string, skipLoader = false): Observable<any> {
    const known = this.clientPlans.get(clientId);
    const request$ = this.http
      .get<any>(`${this.mealPlanUrl}client/${clientId}`, known || skipLoader ? { headers: { 'X-Skip-Loader': 'true' } } : {})
      .pipe(tap((response) => this.clientPlans.set(clientId, response)));
    return known ? concat(of(known), request$) : request$;
  }

  replaceAssignedMealFood(
    mealPlanId: string,
    mealDayId: string,
    mealId: string,
    foodId: string,
    payload: {
      replacementFoodRefId: string;
      quantity: number;
      unit: string;
      servingId?: string | null;
    }
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.mealPlanUrl}${mealPlanId}/days/${mealDayId}/meals/${mealId}/foods/${foodId}/replace`,
      payload
    );
  }
}
