import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
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
    weightUnit?: 'kg' | 'lbs';
    measurementUnit?: 'cm' | 'in';
  };
  notifications: {
    enabled: boolean;
    workoutCompleted: boolean;
    measurementAdded: boolean;
    progressPictureAdded: boolean;
    messageReceived: boolean;
    checkInSubmitted: boolean;
    programEndingSoon: boolean;
  };
  publicProfile: CoachPublicProfile;
}

export interface CoachPublicProfile {
  professionalTitle: string;
  bio: string;
  specialties: string[];
  experience: string;
  certifications: string[];
  languages: string[];
  location: string;
  coachingType: string;
  instagramUrl: string;
  websiteUrl: string;
  photoUrl: string;
  photoVisible: boolean;
  introductionVisible: boolean;
  expertiseVisible: boolean;
  practicalDetailsVisible: boolean;
  socialLinksVisible: boolean;
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
  private readonly configSubject = new BehaviorSubject<CoachSettingsConfig>(this.cachedConfig);
  readonly configChanges$ = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadConfig(skipLoader = false): Observable<CoachSettingsConfig> {
    return this.http.get<CoachSettingsConfig>(
      this.baseUrl,
      skipLoader ? { headers: { 'X-Skip-Loader': 'true' } } : {},
    ).pipe(
      tap((config) => {
        this.cachedConfig = this.mergeWithDefaults(config);
        localStorage.setItem(this.cacheKey, JSON.stringify(this.cachedConfig));
        this.configSubject.next(this.cachedConfig);
      }),
    );
  }

  getConfigForCoach(coachId: string, skipLoader = false): Observable<CoachSettingsConfig> {
    return this.http
      .get<CoachSettingsConfig>(
        `${this.baseUrl}/coach/${coachId}`,
        skipLoader ? { headers: { 'X-Skip-Loader': 'true' } } : {},
      )
      .pipe(tap((config) => this.mergeWithDefaults(config)));
  }

  saveConfig(config: CoachSettingsConfig): Observable<CoachSettingsConfig> {
    const payload = this.mergeWithDefaults(config);

    return this.http.put<CoachSettingsConfig>(this.baseUrl, payload).pipe(
      tap((saved) => {
        this.cachedConfig = this.mergeWithDefaults(saved);
        localStorage.setItem(this.cacheKey, JSON.stringify(this.cachedConfig));
        this.configSubject.next(this.cachedConfig);
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
        weightUnit: 'kg',
        measurementUnit: 'cm',
      },
      notifications: {
        enabled: false,
        workoutCompleted: true,
        measurementAdded: true,
        progressPictureAdded: true,
        messageReceived: true,
        checkInSubmitted: true,
        programEndingSoon: true,
      },
      publicProfile: {
        professionalTitle: '', bio: '', specialties: [], experience: '',
        certifications: [], languages: [], location: '', coachingType: '',
        instagramUrl: '', websiteUrl: '', photoUrl: '', photoVisible: true,
        introductionVisible: true, expertiseVisible: true,
        practicalDetailsVisible: true, socialLinksVisible: true,
      },
    };
  }

  getWeightUnit(): 'kg' | 'lbs' {
    return this.getConfig().defaults.weightUnit === 'lbs' ? 'lbs' : 'kg';
  }

  getMeasurementUnit(): 'cm' | 'in' {
    return this.getConfig().defaults.measurementUnit === 'in' ? 'in' : 'cm';
  }

  convertWeightFromKg(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return this.getWeightUnit() === 'lbs' ? Number(value) * 2.2046226218 : Number(value);
  }

  convertWeightToKg(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return this.getWeightUnit() === 'lbs' ? Number(value) / 2.2046226218 : Number(value);
  }

  convertMeasurementFromCm(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return this.getMeasurementUnit() === 'in' ? Number(value) / 2.54 : Number(value);
  }

  convertMeasurementToCm(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return this.getMeasurementUnit() === 'in' ? Number(value) * 2.54 : Number(value);
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  formatWeight(valueKg: number | null | undefined): string {
    const converted = this.convertWeightFromKg(valueKg);
    return converted === null ? '--' : `${this.formatNumber(converted)} ${this.getWeightUnit()}`;
  }

  formatMeasurement(valueCm: number | null | undefined): string {
    const converted = this.convertMeasurementFromCm(valueCm);
    return converted === null ? '--' : `${this.formatNumber(converted)} ${this.getMeasurementUnit()}`;
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
        weightUnit: (config.defaults as any)?.weightUnit === 'lbs' ? 'lbs' : 'kg',
        measurementUnit: (config.defaults as any)?.measurementUnit === 'in' ? 'in' : 'cm',
      },
      notifications: {
        ...defaults.notifications,
        ...(config.notifications || {}),
      },
      publicProfile: {
        ...defaults.publicProfile,
        ...(config.publicProfile || {}),
        specialties: [...(config.publicProfile?.specialties || [])],
        certifications: [...(config.publicProfile?.certifications || [])],
        languages: [...(config.publicProfile?.languages || [])],
      },
    };
  }
}
