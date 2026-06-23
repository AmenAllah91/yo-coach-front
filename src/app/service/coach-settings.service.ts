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

    /** Controls imported nutrition files (PDF / Excel) across the app. */
    nutritionFileEnabled?: boolean;
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

    /** Controls if the weight column/input is visible in workout program editors. */
    showExerciseWeight: boolean;

    /** Controls imported workout files (PDF / Excel) across the app. */
    workoutFileEnabled: boolean;
  };

  defaults: {
    language: string;
  };
}

export interface DemoWorkspaceStatus {
  active: boolean;
  clientCount: number;
  workoutProgramCount: number;
  nutritionProgramCount: number;
  checkInCount: number;
  messageCount: number;
  notificationCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class CoachSettingsService {
  private readonly apiBase = environment.baseApiUrl.replace(/\/$/, '');
  private readonly baseUrl = `${this.apiBase}/api/coach-settings`;
  private readonly demoWorkspaceUrl = `${this.apiBase}/api/demo-workspace`;
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

  getConfigForCoach(coachId: string): Observable<CoachSettingsConfig> {
    return this.http
      .get<CoachSettingsConfig>(`${this.baseUrl}/coach/${coachId}`)
      .pipe(tap((config) => this.mergeWithDefaults(config)));
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

  getDemoWorkspaceStatus(): Observable<DemoWorkspaceStatus> {
    return this.http.get<DemoWorkspaceStatus>(`${this.demoWorkspaceUrl}/status`);
  }

  generateDemoWorkspace(): Observable<DemoWorkspaceStatus> {
    return this.http.post<DemoWorkspaceStatus>(`${this.demoWorkspaceUrl}/generate`, {});
  }

  resetDemoWorkspace(): Observable<DemoWorkspaceStatus> {
    return this.http.post<DemoWorkspaceStatus>(`${this.demoWorkspaceUrl}/reset`, {});
  }

  removeDemoWorkspace(): Observable<DemoWorkspaceStatus> {
    return this.http.delete<DemoWorkspaceStatus>(this.demoWorkspaceUrl);
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

      nutritionFileEnabled: true,},
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
        showExerciseWeight: true,
        workoutFileEnabled: true,
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

  shouldShowExerciseWeight(): boolean {
    return this.getConfig().workout.showExerciseWeight !== false;
  }

  shouldUseNutritionFiles(): boolean {
    return this.cachedConfig.nutrition.nutritionFileEnabled !== false;
  }

  shouldUseWorkoutFiles(): boolean {
    return this.getConfig().workout.workoutFileEnabled !== false;
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

  private mergeWithDefaults(config: Partial<CoachSettingsConfig>): CoachSettingsConfig {
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
        showExerciseWeight: (config.workout as any)?.showExerciseWeight !== false,
        workoutFileEnabled: (config.workout as any)?.workoutFileEnabled !== false,
      },
      defaults: {
        ...defaults.defaults,
        ...(config.defaults || {}),
      },
    };
  }
}
