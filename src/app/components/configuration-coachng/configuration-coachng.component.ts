import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  CoachSettingsConfig,
  CoachSettingsService,
  DemoWorkspaceStatus,
} from 'app/service/coach-settings.service';
import { LanguageService } from 'app/service/language.service';
import { AuthService } from 'app/config/auth.service';

@Component({
  selector: 'app-configuration-coachng',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './configuration-coachng.component.html',
  styleUrl: './configuration-coachng.component.scss',
})
export class ConfigurationCoachngComponent implements OnInit {
  config: CoachSettingsConfig = this.coachSettingsService.getDefaultConfig();
  savedConfig: CoachSettingsConfig = this.coachSettingsService.getDefaultConfig();

  loading = false;
  saving = false;
  showSaveSuccessPopup = false;
  showSaveErrorPopup = false;
  isAdmin = false;

  demoLoading = false;
  demoActionLoading: 'generate' | 'reset' | 'remove' | null = null;
  demoStatus: DemoWorkspaceStatus = {
    active: false,
    clientCount: 0,
    workoutProgramCount: 0,
    nutritionProgramCount: 0,
    checkInCount: 0,
    messageCount: 0,
    notificationCount: 0,
  };

  private savePopupTimer: any = null;

  constructor(
    private coachSettingsService: CoachSettingsService,
    private languageService: LanguageService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loading = true;

    this.authService.extractRoles().then((roles) => {
      this.isAdmin = roles.includes('ROLE_ADMIN');
    });

    this.loadDemoWorkspaceStatus();

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        this.config = this.clone(config);
        this.savedConfig = this.clone(config);

        const langCode = this.languageService.languageNameToCode(
          this.config.defaults.language,
        );

        this.languageService.setLanguage(langCode);
        this.loading = false;
      },
      error: () => {
        const fallback = this.coachSettingsService.getConfig();

        this.config = this.clone(fallback);
        this.savedConfig = this.clone(fallback);

        const langCode = this.languageService.languageNameToCode(
          this.config.defaults.language,
        );

        this.languageService.setLanguage(langCode);
        this.loading = false;
      },
    });
  }

  onCancel(): void {
    this.config = this.clone(this.savedConfig);

    const langCode = this.languageService.languageNameToCode(
      this.config.defaults.language,
    );

    this.languageService.setLanguage(langCode);
  }

  onSave(): void {
    this.saving = true;
    this.showSaveSuccessPopup = false;
    this.showSaveErrorPopup = false;

    console.log('[COACH SETTINGS] Saving...', this.config);

    this.coachSettingsService.saveConfig(this.config).subscribe({
      next: (saved) => {
        console.log('[COACH SETTINGS] Saved successfully', saved);

        this.config = this.clone(saved);
        this.savedConfig = this.clone(saved);

        const langCode = this.languageService.languageNameToCode(
          saved.defaults.language,
        );

        this.languageService.setLanguage(langCode);

        this.saving = false;
        this.showPopup('success');
      },
      error: (err) => {
        console.error('[COACH SETTINGS] Save failed', err);

        this.saving = false;
        this.showPopup('error');
      },
    });
  }

  onLanguageChange(): void {
    const langCode = this.languageService.languageNameToCode(
      this.config.defaults.language,
    );

    this.languageService.setLanguage(langCode);
  }

  toggleFullMealPlan(): void {
    this.config.nutrition.fullMealPlan = !this.config.nutrition.fullMealPlan;
  }

  toggleMacroPlanDaily(): void {
    this.config.nutrition.macroPlanDaily =
      !this.config.nutrition.macroPlanDaily;
  }

  toggleMacroPlanMeal(): void {
    this.config.nutrition.macroPlanMeal =
      !this.config.nutrition.macroPlanMeal;
  }

  toggleAutoCreateMeals(): void {
    this.config.nutrition.autoCreateMeals =
      !this.config.nutrition.autoCreateMeals;
  }

  toggleAssignAfterNutrition(): void {
    this.config.quickActions.assignAfterNutrition =
      !this.config.quickActions.assignAfterNutrition;
  }

  toggleAssignAfterWorkout(): void {
    this.config.quickActions.assignAfterWorkout =
      !this.config.quickActions.assignAfterWorkout;
  }

  toggleAssignAfterCheckIn(): void {
    this.config.quickActions.assignAfterCheckIn =
      !this.config.quickActions.assignAfterCheckIn;
  }

  loadDemoWorkspaceStatus(): void {
    this.demoLoading = true;

    this.coachSettingsService.getDemoWorkspaceStatus().subscribe({
      next: (status) => {
        this.demoStatus = this.normalizeDemoStatus(status);
        this.demoLoading = false;
      },
      error: (err) => {
        console.error('[DEMO WORKSPACE] Status failed', err);
        this.demoStatus = this.normalizeDemoStatus(null);
        this.demoLoading = false;
      },
    });
  }

  onGenerateDemoData(): void {
    this.demoActionLoading = 'generate';

    this.coachSettingsService.generateDemoWorkspace().subscribe({
      next: (status) => this.handleDemoActionSuccess(status),
      error: (err) => this.handleDemoActionError(err),
    });
  }

  onResetDemoData(): void {
    const confirmed = confirm(
      'Reset demo data ? Les données demo actuelles seront supprimées puis recréées.',
    );

    if (!confirmed) {
      return;
    }

    this.demoActionLoading = 'reset';

    this.coachSettingsService.resetDemoWorkspace().subscribe({
      next: (status) => this.handleDemoActionSuccess(status),
      error: (err) => this.handleDemoActionError(err),
    });
  }

  onRemoveDemoData(): void {
    const confirmed = confirm(
      'Remove demo data ? Toutes les données avec isDemo = true seront supprimées.',
    );

    if (!confirmed) {
      return;
    }

    this.demoActionLoading = 'remove';

    this.coachSettingsService.removeDemoWorkspace().subscribe({
      next: (status) => this.handleDemoActionSuccess(status),
      error: (err) => this.handleDemoActionError(err),
    });
  }

  toggleAutoFillDefaults(): void {
    this.config.workout.autoFillDefaults =
      !this.config.workout.autoFillDefaults;
  }

  toggleShowExerciseWeight(): void {
    this.config.workout.showExerciseWeight =
      this.config.workout.showExerciseWeight === false;
  }

  toggleWorkoutFileEnabled(): void {
    this.config.workout.workoutFileEnabled =
      this.config.workout.workoutFileEnabled === false;
  }

  private handleDemoActionSuccess(status: DemoWorkspaceStatus): void {
    this.demoStatus = this.normalizeDemoStatus(status);
    this.demoActionLoading = null;
    this.showPopup('success');
  }

  private handleDemoActionError(err: unknown): void {
    console.error('[DEMO WORKSPACE] Action failed', err);
    this.demoActionLoading = null;
    this.showPopup('error');
  }

  private normalizeDemoStatus(status: Partial<DemoWorkspaceStatus> | null): DemoWorkspaceStatus {
    const normalized: DemoWorkspaceStatus = {
      active: Boolean(status?.active),
      clientCount: Number(status?.clientCount || 0),
      workoutProgramCount: Number(status?.workoutProgramCount || 0),
      nutritionProgramCount: Number(status?.nutritionProgramCount || 0),
      checkInCount: Number(status?.checkInCount || 0),
      messageCount: Number(status?.messageCount || 0),
      notificationCount: Number(status?.notificationCount || 0),
    };

    normalized.active = normalized.active || normalized.clientCount > 0;

    return normalized;
  }

  private showPopup(type: 'success' | 'error'): void {
    if (this.savePopupTimer) {
      clearTimeout(this.savePopupTimer);
    }

    this.showSaveSuccessPopup = type === 'success';
    this.showSaveErrorPopup = type === 'error';

    this.savePopupTimer = setTimeout(() => {
      this.showSaveSuccessPopup = false;
      this.showSaveErrorPopup = false;
    }, type === 'success' ? 2500 : 3500);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
