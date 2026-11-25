import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, concat, finalize, map, of, shareReplay, tap } from 'rxjs';
import { withUploadProgress } from '@shared/models/program-file-check';
import { environment } from '../../environments/environment';
import { FoodServing, MealPlan } from '@shared/models/MealPlan';
import { Page } from 'app/models/Page.model';
import { localizeFood, toServerLanguage } from '@shared/models/food-language';

export interface Food {
  id?: string;
  name: string;
  /** 2026-11-13: English name of a base catalog food; nameFr = the French one while the app is in English. */
  nameEn?: string | null;
  nameFr?: string;
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

  private fromFoodApi(raw: any): Food {
    const food: any = localizeFood(raw); // 2026-11-13: English names of the base catalog when the app is in English
    return { ...food, calories: food.energy ?? food.calories ?? null,
      carbs: food.carbohydrates ?? food.carbs ?? null,
      servingUnit: food.servingDescription ?? food.servingUnit ?? '',
      isGeneral: food.general ?? food.isGeneral };
  }
  private toFoodApi(food: Food) {
    const { calories, carbs, servingUnit, ...fields } = toServerLanguage(food);
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

  /** Foods of the Add Food modal (first 100, custom foods first), by search: kept 2 min, the modal opens at once. */
  private readonly pickerFoods = new Map<string, { at: number; foods: any[]; truncated: boolean }>();

  pickerFoodsSnapshot(search: string, maxAgeMs = 120_000): any[] | null {
    return this.pickerFoodsResult(search, maxAgeMs)?.foods ?? null;
  }

  /** The cached list of a search, and whether the server had more foods than the 100 sent. */
  pickerFoodsResult(search: string, maxAgeMs = 120_000): { foods: any[]; truncated: boolean } | null {
    const known = this.pickerFoods.get(search.trim().toLowerCase());
    return known && Date.now() - known.at < maxAgeMs ? { foods: known.foods, truncated: known.truncated } : null;
  }

  private readonly pickerRequests = new Map<string, Observable<any[]>>();

  loadPickerFoods(search: string): Observable<any[]> {
    const key = search.trim().toLowerCase();
    const running = this.pickerRequests.get(key);
    if (running) return running; // the prefetch and the modal share one request
    // The coach's own foods first (catalog: false/absent sorts before true), then by name: the 100 sent are not random.
    const params = new HttpParams()
      .set('page', 0)
      .set('size', PICKER_PAGE_SIZE)
      .set('search', search.trim())
      .append('sort', 'catalog,asc')
      .append('sort', 'name,asc');
    const request = this.http
      .get<any>(`${environment.baseApiUrl}/api/food-ref/filtered`, { params, headers: { 'X-Skip-Loader': 'true' } })
      .pipe(
        map((response) => {
          const foods = sortPickerFoods((response?.content || []).map((f: any) => localizeFood(f)), search);
          const total = Number(response?.totalElements ?? foods.length);
          return { foods, truncated: total > foods.length };
        }),
        tap(({ foods, truncated }) => {
          if (this.pickerFoods.size > 50) this.pickerFoods.clear();
          this.pickerFoods.set(key, { at: Date.now(), foods, truncated });
        }),
        map(({ foods }) => foods),
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
    if (this.frequentFoods) this.frequentFoods = this.frequentFoods.map((item) => (item.id === food?.id ? { ...item, ...food } : item));
  }

  /** « Fréquents » of the Add Food modal: the coach's most used foods, kept for the session (cleared by a new food). */
  private frequentFoods: any[] | null = null;
  private frequentRequest: Observable<any[]> | null = null;

  /** Same shape as the picker results (localizeFood); an error or an unknown route gives an empty list, quietly. */
  loadFrequentFoods(limit = FREQUENT_FOODS_LIMIT): Observable<any[]> {
    if (this.frequentFoods) return of(this.frequentFoods);
    if (this.frequentRequest) return this.frequentRequest;
    const params = new HttpParams().set('limit', limit);
    const request = this.http
      .get<any[]>(`${this.foodRefUrl}/frequent`, { params, headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } })
      .pipe(
        map((response) => (Array.isArray(response) ? response : []).filter(Boolean).map((food: any) => localizeFood(food)).slice(0, limit)),
        tap((foods) => (this.frequentFoods = foods)),
        catchError(() => of([] as any[])),
        finalize(() => {
          if (this.frequentRequest === request) this.frequentRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.frequentRequest = request;
    return request;
  }

  /** quiet: the caller shows its own error (Add Food modal), no loader nor toast from the interceptor. */
  createFood(food: Food, quiet = false): Observable<Food> {
    const options = quiet ? { headers: { 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' } } : {};
    return this.http.post<Food>(`${environment.baseApiUrl}/api/food-ref`, this.toFoodApi(food), options).pipe(
      map(result => this.fromFoodApi(result)),
      // A new food: the « Fréquents » and the searches are read again (it must show up in the picker).
      tap(() => {
        this.frequentFoods = null;
        this.pickerFoods.clear();
      }),
    );
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
    // light: no meal photos nor full food references (audit 2026-11-23, M4); the editors read a plan by its id.
    const params: any = { page, size, planType, light: true };

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
    const params: any = { page, size, light: true };

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

  /** « J'ai suivi mon plan » on a file plan, by its client (audit PDF/Excel 2026-11-23, lot 3). */
  markNutritionFileDay(id: string, date: string, done: boolean): Observable<NutritionPlan> {
    return this.http.put<NutritionPlan>(`${this.mealPlanUrl}${id}/file/done`, { date, done }, { headers: { 'X-Skip-Loader': 'true' } });
  }

  /** Renames a file plan (coach). */
  updateNutritionFileDetails(id: string, name: string, details?: string): Observable<NutritionPlan> {
    return this.http.patch<NutritionPlan>(`${this.mealPlanUrl}${id}/file/details`, { name, details: details ?? '' });
  }

  /** Replaces the PDF / Excel of a file plan (coach only): the client sees the new file. */
  replaceNutritionFile(id: string, file: File, onProgress?: (percent: number) => void): Observable<NutritionPlan> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<NutritionPlan>(`${this.mealPlanUrl}${id}/file/replace`, formData, { reportProgress: true, observe: 'events' }).pipe(withUploadProgress(onProgress));
  }

  createAndAssignFileNutritionPlanOnly(
    file: File,
    name: string,
    details: string | undefined,
    clientId: string,
    startDate: string,
    endDate: string,
    onProgress?: (percent: number) => void,
  ): Observable<NutritionPlan> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (details) formData.append('details', details);
    formData.append('clientId', clientId);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);

    return this.http.post<NutritionPlan>(`${this.mealPlanUrl}file/assign-only`, formData, { reportProgress: true, observe: 'events' }).pipe(withUploadProgress(onProgress));
  }

  createNutritionFilePlan(
    file: File,
    name: string,
    details?: string,
    startDate?: string,
    endDate?: string,
    onProgress?: (percent: number) => void
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

    return this.http.post<NutritionPlan>(`${this.mealPlanUrl}file`, formData, { reportProgress: true, observe: 'events' }).pipe(withUploadProgress(onProgress));
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
      /** 2026-11-23: the group the client picked from; CE computes the quantity itself. */
      groupId?: string | null;
    }
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.mealPlanUrl}${mealPlanId}/days/${mealDayId}/meals/${mealId}/foods/${foodId}/replace`,
      payload
    );
  }
}

const PICKER_PAGE_SIZE = 100;
const FREQUENT_FOODS_LIMIT = 12;

/** Lower case, no accents, « œ » = « oe »: « pates » matches « Pâtes », « oeuf » matches « Œuf ». */
export function foldFoodText(text: unknown): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** The coach's own foods first, then the names starting with the search (« Riz blanc » before « Farine de riz »),
 *  then alphabetical order, accents ignored. */
export function sortPickerFoods(foods: any[], search: string): any[] {
  const wanted = foldFoodText(search.trim());
  const rank = (food: any) => (food?.general ? 2 : 0) + (wanted && !foldFoodText(food?.name).startsWith(wanted) ? 1 : 0);
  return [...foods].sort((a, b) => rank(a) - rank(b) || foldFoodText(a?.name).localeCompare(foldFoodText(b?.name)));
}
