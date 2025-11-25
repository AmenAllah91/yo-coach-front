import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MealPlan } from 'app/models/MealPlan';

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
  type: 'MACRO_ONLY' | 'FULL_MEAL';
  days: NutritionDay[];
  coachId?: string;
  createdBy?: string;
  lastModifiedDate?: string;
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
  getNutritionPlans(): Observable<NutritionPlan[]> {
    return this.http.get<NutritionPlan[]>(`${this.baseUrl}/plans`);
  }

  createNutritionPlan(plan: MealPlan): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.mealPlanUrl}`, plan);
  }

  updateNutritionPlan(
    id: string,
    plan: NutritionPlan
  ): Observable<NutritionPlan> {
    return this.http.put<NutritionPlan>(`${this.baseUrl}/plans/${id}`, plan);
  }

  deleteNutritionPlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/plans/${id}`);
  }
}
