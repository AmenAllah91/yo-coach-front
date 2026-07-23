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
import { UsersService } from 'app/service/users.service';

@Component({
  selector: 'app-configuration-coachng',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './configuration-coachng.component.html',
  styleUrl: './configuration-coachng.component.scss',
})
export class ConfigurationCoachngComponent implements OnInit {
  activeTab: 'profile' | 'password' | 'plan' | 'notifications' | 'preferences' = 'profile';
  isClient = false;

  profile = {
    username: localStorage.getItem('username') || '',
    firstName: localStorage.getItem('firstName') || '',
    lastName: localStorage.getItem('lastName') || '',
    email: localStorage.getItem('email') || '',
    photoName: '',
  };

  browserNotificationsEnabled = false;

  emailNotifications = [
    { key: 'workoutCompleted', label: 'Client completes a workout', enabled: true },
    { key: 'measurementAdded', label: 'Client adds a new measurement', enabled: true },
    { key: 'progressPictureAdded', label: 'Client adds a progress picture', enabled: true },
    { key: 'messageReceived', label: 'Client sends you a message', enabled: true },
    { key: 'checkInSubmitted', label: 'Client responds to a check-in', enabled: true },
    { key: 'programEndingSoon', label: 'Programs finishing next week', enabled: true },
  ];
  passwordFormModel = { oldPassword: '', newPassword: '', confirmPassword: '' };
  passwordError = '';
  passwordSuccess = '';
  isChangingPassword = false;

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
    private usersService: UsersService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    const currentUserId = sessionStorage.getItem('userId') || '';
    if (currentUserId) {
      this.usersService.getUserById(currentUserId).subscribe({
        next: (user: any) => {
          this.profile.username = user.login || user.username || '';
          this.profile.firstName = user.firstName || '';
          this.profile.lastName = user.lastName || '';
          this.profile.email = user.email || '';
        },
        error: () => undefined,
      });
    }

    this.authService.extractRoles().then((roles) => {
      this.isAdmin = roles.includes('ROLE_ADMIN');
      this.isClient = roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH');
    });

    this.loadDemoWorkspaceStatus();

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        this.config = this.clone(config);
        this.savedConfig = this.clone(config);
        this.syncNotificationToggles();

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
        this.syncNotificationToggles();

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
  toggleNutritionFileEnabled(): void {
    this.config.nutrition.nutritionFileEnabled =
      this.config.nutrition.nutritionFileEnabled === false;
  }


  setActiveTab(tab: 'profile' | 'password' | 'plan' | 'notifications' | 'preferences'): void {
    this.activeTab = tab;
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  toggleNotification(item: { key: string; enabled: boolean }): void {
    item.enabled = !item.enabled;
    (this.config.notifications as any)[item.key] = item.enabled;
    this.onSave();
  }

  private syncNotificationToggles(): void {
    this.browserNotificationsEnabled = this.config.notifications.enabled === true;
    this.emailNotifications.forEach((item) => {
      item.enabled = (this.config.notifications as any)[item.key] !== false;
    });
  }

  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.passwordFormModel.oldPassword || !this.passwordFormModel.newPassword || !this.passwordFormModel.confirmPassword) {
      this.passwordError = 'All fields are required.';
      return;
    }
    if (this.passwordFormModel.newPassword !== this.passwordFormModel.confirmPassword) {
      this.passwordError = 'Password confirmation does not match.';
      return;
    }
    this.isChangingPassword = true;
    this.usersService.updateMyPassword(this.passwordFormModel).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.passwordSuccess = 'Password updated successfully.';
        this.passwordFormModel = { oldPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: () => {
        this.isChangingPassword = false;
        this.passwordError = 'Unable to update password.';
      },
    });
  }

  saveProfile(): void {
    const currentUserId = sessionStorage.getItem('userId') || '';
    if (!currentUserId) return;
    this.usersService.updateUser(currentUserId, {
      login: this.profile.username.trim(),
      firstName: this.profile.firstName.trim(),
      lastName: this.profile.lastName.trim(),
      email: this.profile.email.trim(),
    } as any).subscribe({
      next: () => {
        localStorage.setItem('username', this.profile.username.trim());
        localStorage.setItem('firstName', this.profile.firstName.trim());
        localStorage.setItem('lastName', this.profile.lastName.trim());
        localStorage.setItem('email', this.profile.email.trim());
        this.showPopup('success');
      },
      error: () => this.showPopup('error'),
    });
  }

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.profile.photoName = input.files?.[0]?.name || '';
  }

  enableBrowserNotifications(): void {
    if (this.browserNotificationsEnabled) {
      this.browserNotificationsEnabled = false;
      this.config.notifications.enabled = false;
      this.onSave();
      return;
    }

    this.browserNotificationsEnabled = true;
    this.config.notifications.enabled = true;
    this.onSave();
  }

  logout(): void {
    sessionStorage.clear();
    window.location.href = '/';
  }

  requestDeleteAccount(): void {
    const confirmed = confirm('Delete your account? This action cannot be undone.');
    if (confirmed) {
      console.warn('[ACCOUNT] Delete account confirmed. Connect this action to the account deletion endpoint.');
    }
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
