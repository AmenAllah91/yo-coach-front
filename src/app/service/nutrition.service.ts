import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MealPlan } from '@shared/models/MealPlan';
import { Page } from 'app/models/Page.model';

export interface Food {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  polyunsaturatedFat?: number;
  monounsaturatedFat?: number;
  saturatedFat?: number;
  sodium?: number;
  servingSize: number;
  servingUnit: string;
  coachId?: string;
  isGeneral?: boolean;
  createdDate?: string;
  lastModifiedDate?: string;
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
  createdDate: Date | null;
  lastModifiedDate: Date | null;
  general: boolean;
}

export interface NutritionPlan {
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

  // Food management
  getFoods(
    page: number = 0,
    size: number = 20,
    search?: string,
    customOnly: boolean = false
  ): Observable<any> {
    let params = `page=${page}&size=${size}`;
    if (search) {
      params += `&search=${encodeURIComponent(search)}`;
    }
    if (customOnly) {
      params += `&customOnly=true`;
    }
    return this.http.get<any>(
      `${environment.baseApiUrl}/api/food-ref?${params}`
    );
  }

  duplicate(id: string): Observable<any> {
    return this.http.post<any>(`${this.mealPlanUrl}${id}/duplicate`, {});
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

  createFood(food: Food): Observable<Food> {
    return this.http.post<Food>(`${environment.baseApiUrl}/api/food-ref`, food);
  }

  updateFood(id: string, food: Food): Observable<Food> {
    return this.http.put<Food>(
      `${environment.baseApiUrl}/api/food-ref/${id}`,
      food
    );
  }

  deleteFood(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.baseApiUrl}/api/food-ref/${id}`
    );
  }

  getFoodById(id: string): Observable<Food> {
    return this.http.get<Food>(`${environment.baseApiUrl}/api/food-ref/${id}`);
  }

  // Nutrition plan management
  getNutritionPlans(): Observable<Page<NutritionPlan>> {
    return this.http.get<Page<NutritionPlan>>(`${this.mealPlanUrl}`);
  }
  getNutritionPlansTemplates(): Observable<Page<NutritionPlan>> {
    return this.http.get<Page<NutritionPlan>>(`${this.mealPlanUrl}templates`);
  }
  getNutritionPlanById(id: string): Observable<any> {
    return this.http.get<any>(`${this.mealPlanUrl}${id}`);
  }

  createNutritionPlan(plan: MealPlan): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.mealPlanUrl}`, plan);
  }

  updateNutritionPlan(plan: any): Observable<NutritionPlan> {
    return this.http.put<NutritionPlan>(`${this.mealPlanUrl}`, plan);
  }
  assignNutritionPlan(plan: any): Observable<NutritionPlan> {
    return this.http.put<NutritionPlan>(`${this.mealPlanUrl}assign`, plan);
  }

  deleteNutritionPlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.mealPlanUrl}${id}`);
  }

  getNutritionPlanByCoachIdAndClient(
    coachId: string,
    clientId: string,
    page: number,
    size: number
  ) {
    return this.http.get<any>(
      `${this.mealPlanUrl}client/${clientId}/coach/${coachId}/all`,
      {
        params: {
          page,
          size,
        },
      }
    );
  }

  getNutritionPlanByClientId(clientId: string): Observable<any> {
    return this.http.get<any>(`${this.mealPlanUrl}client/${clientId}`);
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
    }
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.mealPlanUrl}${mealPlanId}/days/${mealDayId}/meals/${mealId}/foods/${foodId}/replace`,
      payload
    );
  }
}
