import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { MealPlan } from '@shared/models/MealPlan';

/** IA-41: what the server needs to propose calories and macros (no AI, not counted). */
export interface NutritionTargetsRequest {
  gender: 'MALE' | 'FEMALE';
  age: number;
  weightKg: number;
  heightCm: number;
  activity: 'SEDENTARY' | 'LIGHT' | 'ACTIVE' | 'VERY_ACTIVE';
  goal: 'WEIGHT_LOSS' | 'MAINTAIN' | 'MUSCLE';
  minor: boolean;
  pregnancy: boolean;
}
export interface NutritionTargets { calories: number; proteinG: number; carbsG: number; fatG: number; maintenance: number; warnings: string[]; }

/** IA-42: the answers for the AI meal plan (targets, restrictions; nothing personal). */
export interface NutritionAiDraftRequest {
  goal: NutritionTargetsRequest['goal'];
  calories: number; proteinG: number; carbsG: number; fatG: number;
  mealsPerDay: number;
  diet: 'NONE' | 'VEGETARIAN' | 'VEGAN' | 'HALAL';
  allergies: ('GLUTEN' | 'LACTOSE' | 'NUTS' | 'EGGS' | 'FISH' | 'SEAFOOD')[];
  avoid?: string | null;
  weeks: number;
  minor: boolean;
  pregnancy: boolean;
  medicalCondition: boolean;
  language: 'fr' | 'en' | 'ar';
}
/** IA-43: the draft (never saved) and the warnings to show above it (IA-53). */
export interface NutritionAiDraft { plan: MealPlan; warnings: string[]; carefulModel: boolean; }

@Injectable({ providedIn: 'root' })
export class NutritionAiService {
  private url = `${environment.baseApiUrl}/api/ai`;
  constructor(private http: HttpClient) {}

  targets(request: NutritionTargetsRequest): Observable<NutritionTargets> {
    return this.http.post<NutritionTargets>(`${this.url}/nutrition-targets`, request, { headers: { 'X-Skip-Loader': 'true' } });
  }

  draft(answers: NutritionAiDraftRequest): Observable<NutritionAiDraft> {
    return this.http.post<NutritionAiDraft>(`${this.url}/nutrition-draft`, answers, { headers: { 'X-Skip-Loader': 'true' } });
  }
}
