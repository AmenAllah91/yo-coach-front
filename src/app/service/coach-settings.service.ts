import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface CoachSettingsConfig {
  id?: string;
  coachId?: string;

  nutrition: {
    fullMealPlan: boolean;
    macroPlanDaily: boolean;
    macroPlanMeal: boolean;
    defaultMeals: string;
    autoCreateMeals: boolean;
  };

  quickActions: {
    assignAfterNutrition: boolean;
    assignAfterWorkout: boolean;
    assignAfterCheckIn: boolean;
  };

  workout: {
    workoutSets: string;
    workoutReps: string;
    cardioSets: string;
    cardioMinutes: string;
    autoFillDefaults: boolean;
  };

  defaults: {
    language: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class CoachSettingsService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/coach-settings`;
  private readonly cacheKey = 'coach-settings-config-cache';

  private cachedConfig: CoachSettingsConfig = this.loadCachedOrDefault();

  constructor(private http: HttpClient) {}

  loadConfig(): Observable<CoachSettingsConfig> {
    return this.http.get<CoachSettingsConfig>(this.baseUrl).pipe(
      tap((config) => {
        this.cachedConfig = this.mergeWithDefaults(config);
        localStorage.setItem(this.cacheKey, JSON.stringify(this.cachedConfig));
      }),
    );
  }

  saveConfig(config: CoachSettingsConfig): Observable<CoachSettingsConfig> {
    const payload = this.mergeWithDefaults(config);

    return this.http.put<CoachSettingsConfig>(this.baseUrl, payload).pipe(
      tap((saved) => {
        this.cachedConfig = this.mergeWithDefaults(saved);
        localStorage.setItem(this.cacheKey, JSON.stringify(this.cachedConfig));
      }),
    );
  }

  getConfig(): CoachSettingsConfig {
    return this.cachedConfig;
  }

  getDefaultConfig(): CoachSettingsConfig {
    return {
      nutrition: {
        fullMealPlan: true,
        macroPlanDaily: true,
        macroPlanMeal: true,
        defaultMeals: '5',
        autoCreateMeals: true,
      },
      quickActions: {
        assignAfterNutrition: true,
        assignAfterWorkout: true,
        assignAfterCheckIn: true,
      },
      workout: {
        workoutSets: '4',
        workoutReps: '12',
        cardioSets: '3',
        cardioMinutes: '20',
        autoFillDefaults: true,
      },
      defaults: {
        language: 'French',
      },
    };
  }

  getDefaultMealsCount(): number {
    const value = Number(this.getConfig().nutrition.defaultMeals);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  getWorkoutSets(): number {
    const value = Number(this.getConfig().workout.workoutSets);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  getWorkoutReps(): string {
    const value = String(this.getConfig().workout.workoutReps || '').trim();
    return value || '8';
  }

  getCardioSets(): number {
    const value = Number(this.getConfig().workout.cardioSets);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  getCardioMinutes(): number {
    const value = Number(this.getConfig().workout.cardioMinutes);
    return Number.isFinite(value) && value > 0 ? value : 10;
  }

  shouldAutoFillWorkoutDefaults(): boolean {
    return this.getConfig().workout.autoFillDefaults;
  }

  canCreateFullMealPlan(): boolean {
    return this.getConfig().nutrition.fullMealPlan;
  }

  canCreateMacroDailyPlan(): boolean {
    return this.getConfig().nutrition.macroPlanDaily;
  }

  canCreateMacroEachMealPlan(): boolean {
    return this.getConfig().nutrition.macroPlanMeal;
  }

  canCreateAnyMacroPlan(): boolean {
    const config = this.getConfig();
    return config.nutrition.macroPlanDaily || config.nutrition.macroPlanMeal;
  }

  private loadCachedOrDefault(): CoachSettingsConfig {
    const cached = localStorage.getItem(this.cacheKey);

    if (!cached) {
      return this.getDefaultConfig();
    }

    try {
      return this.mergeWithDefaults(JSON.parse(cached));
    } catch {
      return this.getDefaultConfig();
    }
  }

  private mergeWithDefaults(
    config: Partial<CoachSettingsConfig>,
  ): CoachSettingsConfig {
    const defaults = this.getDefaultConfig();

    return {
      id: config.id,
      coachId: config.coachId,
      nutrition: {
        ...defaults.nutrition,
        ...(config.nutrition || {}),
      },
      quickActions: {
        ...defaults.quickActions,
        ...(config.quickActions || {}),
      },
      workout: {
        ...defaults.workout,
        ...(config.workout || {}),
      },
      defaults: {
        ...defaults.defaults,
        ...(config.defaults || {}),
      },
    };
  }
}
