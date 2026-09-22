import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CoachSettingsConfig,
  CoachSettingsService,
  DemoWorkspaceStatus,
} from 'app/service/coach-settings.service';
import { LanguageService } from 'app/service/language.service';
import { AuthService } from 'app/config/auth.service';
import { UsersService } from 'app/service/users.service';
import { DocumentService } from 'app/service/document.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-configuration-coachng',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './configuration-coachng.component.html',
  styleUrl: './configuration-coachng.component.scss',
})
export class ConfigurationCoachngComponent implements OnInit {
  activeTab: 'account' | 'publicProfile' | 'password' | 'plan' | 'notifications' | 'preferences' = 'account';
  isClient = false;

  profile = {
    username: sessionStorage.getItem('username') || localStorage.getItem('username') || '',
    firstName: localStorage.getItem('firstName') || '',
    lastName: localStorage.getItem('lastName') || '',
    email: localStorage.getItem('email') || '',
    photoName: '',
  };
  savedProfile = { ...this.profile };

  browserNotificationsEnabled = false;

  emailNotifications = [
    { key: 'workoutCompleted', label: 'CLIENT_COMPLETES_WORKOUT', enabled: true },
    { key: 'measurementAdded', label: 'CLIENT_ADDS_MEASUREMENT', enabled: true },
    { key: 'progressPictureAdded', label: 'CLIENT_ADDS_PROGRESS_PICTURE', enabled: true },
    { key: 'messageReceived', label: 'CLIENT_SENDS_MESSAGE', enabled: true },
    { key: 'checkInSubmitted', label: 'CLIENT_RESPONDS_CHECK_IN', enabled: true },
    { key: 'programEndingSoon', label: 'PROGRAMS_FINISHING_NEXT_WEEK', enabled: true },
  ];
  passwordFormModel = { oldPassword: '', newPassword: '', confirmPassword: '' };
  passwordError = '';
  passwordSuccess = '';
  isChangingPassword = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  currentPasswordServerError = '';
  passwordFieldTouched = {
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  };
  isSavingAccount = false;
  accountServerErrors: Partial<Record<'username' | 'email', string>> = {};
  isDeletingAccount = false;
  showDeleteAccountModal = false;
  showRemovePhotoModal = false;

  config: CoachSettingsConfig = this.coachSettingsService.getDefaultConfig();
  savedConfig: CoachSettingsConfig = this.coachSettingsService.getDefaultConfig();

  loading = false;
  saving = false;
  uploadingPublicPhoto = false;
  publicPhotoDisplayUrl = '';
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
  private currentUserId = '';

  private readonly supportedPublicPhotoTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  readonly publicProfileLanguages = ['Arabic', 'English', 'French', 'German', 'Italian', 'Portuguese', 'Spanish', 'Turkish'];

  instagramLink(value: string): string {
    return value?.startsWith('@') ? `https://www.instagram.com/${value.slice(1)}/` : value;
  }

  get publicProfileValidationErrors(): Record<string, string> {
    return this.validatePublicProfile(this.config.publicProfile);
  }

  get publicProfileHasErrors(): boolean {
    return Object.keys(this.publicProfileValidationErrors).length > 0;
  }

  private validatePublicProfile(profile: any): Record<string, string> {
    const errors: Record<string, string> = {};

    const professionalTitle = (profile?.professionalTitle ?? '').trim();
    if (professionalTitle && professionalTitle.length > 100) {
      errors['professionalTitle'] = 'Professional title must be 100 characters or less.';
    }
    if (!professionalTitle && (profile?.professionalTitle ?? '').trim().length === 0 && (profile?.professionalTitle ?? '').length > 0) {
      errors['professionalTitle'] = 'Professional title cannot be only spaces.';
    }

    const bio = (profile?.bio ?? '').trim();
    if (bio.length > 500) {
      errors['bio'] = 'Short bio must not exceed 500 characters.';
    }

    const specialties = (profile?.specialties ?? []) as string[];
    if (specialties.some((value) => value.trim().length > 50)) {
      errors['specialties'] = 'Each specialty must be 50 characters or less.';
    }
    if (specialties.length > 10) {
      errors['specialties'] = 'Specialties must contain 10 or fewer items.';
    }
    const specialtySet = new Set(specialties.map((value) => value.trim().toLowerCase()));
    if (specialties.length !== specialtySet.size) {
      errors['specialties'] = 'Specialties must be unique.';
    }

    const experience = (profile?.experience ?? '').trim();
    if (experience) {
      const value = experience.toLowerCase();
      const validExperienceOptions = new Set([
        '< 1 year',
        '1-2 years',
        '3-5 years',
        '6-10 years',
        '10+ years',
        '0-2 years',
      ]);
      const numericYearsMatch = /^\d+$/.test(value);
      const valueAsNumber = Number(value);
      if (!validExperienceOptions.has(value) && !numericYearsMatch) {
        errors['experience'] = 'Experience must be a whole number from 0 to 80 years or use the provided ranges.';
      }
      if (numericYearsMatch && (!Number.isInteger(valueAsNumber) || valueAsNumber < 0 || valueAsNumber > 80)) {
        errors['experience'] = 'Experience must be between 0 and 80 years.';
      }
    }

    const certifications = (profile?.certifications ?? []) as string[];
    if (certifications.some((value) => value.trim().length > 100)) {
      errors['certifications'] = 'Each certification must be 100 characters or less.';
    }
    if (certifications.length > 10) {
      errors['certifications'] = 'Certifications must contain 10 or fewer items.';
    }
    const certificationSet = new Set(certifications.map((value) => value.trim().toLowerCase()));
    if (certifications.length !== certificationSet.size) {
      errors['certifications'] = 'Certifications must be unique.';
    }

    const languages = (profile?.languages ?? []) as string[];
    if (languages.length > 10) {
      errors['languages'] = 'Languages must contain 10 or fewer items.';
    }
    const languageSet = new Set(languages.map((value) => value.trim().toLowerCase()));
    if (languages.length !== languageSet.size) {
      errors['languages'] = 'Languages must be unique.';
    }
    if (languages.some((value) => !this.publicProfileLanguages.includes(value))) {
      errors['languages'] = 'Select a language from the list.';
    }

    const location = (profile?.location ?? '').trim();
    if (location.length > 100) {
      errors['location'] = 'Location must be 100 characters or less.';
    }

    const coachingType = (profile?.coachingType ?? '').trim();
    if (coachingType && !['Online', 'In-person', 'Hybrid'].includes(coachingType)) {
      errors['coachingType'] = 'Coaching type must be Online, In-person, or Hybrid.';
    }

    const instagram = (profile?.instagramUrl ?? '').trim();
    if (instagram) {
      if (instagram.startsWith('@')) {
        if (!/^@[A-Za-z0-9._]{1,30}$/.test(instagram)) {
          errors['instagramUrl'] = 'Instagram handle is invalid.';
        }
      } else {
        try {
          const url = new URL(instagram);
          if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) || url.username || url.password) {
            errors['instagramUrl'] = 'Instagram must be a valid https:// Instagram URL.';
          }
        } catch {
          errors['instagramUrl'] = 'Instagram must be a valid https:// Instagram URL.';
        }
        if (instagram.length > 255) {
          errors['instagramUrl'] = 'Instagram URL must be 255 characters or less.';
        }
      }
    }

    const website = (profile?.websiteUrl ?? '').trim();
    if (website) {
      try {
        const url = new URL(website);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
          errors['websiteUrl'] = 'Website must use http:// or https://.';
        }
      } catch {
        errors['websiteUrl'] = 'Website must be a valid URL.';
      }
      if (website.length > 2048) {
        errors['websiteUrl'] = 'Website cannot exceed 2048 characters.';
      }
    }

    return errors;
  }

  private normalizeCollectionValue(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  constructor(
    private coachSettingsService: CoachSettingsService,
    private languageService: LanguageService,
    private authService: AuthService,
    private usersService: UsersService,
    private documentService: DocumentService,
    private translate: TranslateService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.loadCurrentUserProfile();

    this.authService.extractRoles().then((roles) => {
      this.isAdmin = roles.includes('ROLE_ADMIN');
      this.isClient = roles.includes('ROLE_CLIENT') && !roles.includes('ROLE_COACH');
    });

    this.loadDemoWorkspaceStatus();

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        this.config = this.clone(config);
        this.savedConfig = this.clone(config);
        this.refreshPublicPhoto(config.publicProfile.photoUrl);
        this.syncNotificationToggles();

        this.loading = false;
      },
      error: () => {
        const fallback = this.coachSettingsService.getConfig();

        this.config = this.clone(fallback);
        this.savedConfig = this.clone(fallback);
        this.refreshPublicPhoto(fallback.publicProfile.photoUrl);
        this.syncNotificationToggles();

        this.loading = false;
      },
    });
  }

  goBack(): void { window.history.back(); }

  private async loadCurrentUserProfile(): Promise<void> {
    const account = await this.authService.getCurrentUserDetails();

    if (account) {
      this.profile.username = account.username || this.profile.username;
      this.profile.firstName = account.firstName || this.profile.firstName;
      this.profile.lastName = account.lastName || this.profile.lastName;
      this.profile.email = account.email || this.profile.email;
      this.savedProfile = { ...this.profile };

      if (account.id) {
        sessionStorage.setItem('userId', account.id);
      }
    }

    const currentUserId = account?.id || sessionStorage.getItem('userId') || '';
    if (!currentUserId) return;
    this.currentUserId = currentUserId;

    this.usersService.getUserById(currentUserId).subscribe({
      next: (user: any) => {
        this.profile.username = user.login || user.username || this.profile.username;
        this.profile.firstName = user.firstName || this.profile.firstName;
        this.profile.lastName = user.lastName || this.profile.lastName;
        this.profile.email = user.email || this.profile.email;
        this.savedProfile = { ...this.profile };
      },
      error: () => undefined,
    });
  }

  onCancel(): void {
    this.config = this.clone(this.savedConfig);
    this.refreshPublicPhoto(this.config.publicProfile.photoUrl);
    this.syncNotificationToggles();

    const langCode = this.languageService.languageNameToCode(
      this.config.defaults.language,
    );

    this.languageService.setLanguage(langCode);
  }

  onSave(): void {
    if (this.saving || !this.hasConfigChanges || this.publicProfileHasErrors || this.preferencesHaveErrors) return;
    const p = this.config.publicProfile;
    for (const key of ['professionalTitle', 'bio', 'experience', 'location', 'coachingType', 'instagramUrl', 'websiteUrl'] as const) {
      p[key] = (p[key] || '').trim();
    }
    this.saving = true;
    this.showSaveSuccessPopup = false;
    this.showSaveErrorPopup = false;

    console.log('[COACH SETTINGS] Saving...', this.config);

    const payload = this.clone(this.config);
    if (!payload.nutrition.autoCreateMeals && this.preferenceNumberError(payload.nutrition.defaultMeals, 1, 10)) {
      payload.nutrition.defaultMeals = this.savedConfig.nutrition.defaultMeals;
    }
    if (!payload.workout.autoFillDefaults) {
      if (this.preferenceNumberError(payload.workout.workoutSets, 1, 20)) {
        payload.workout.workoutSets = this.savedConfig.workout.workoutSets;
      }
      if (this.preferenceNumberError(payload.workout.workoutReps, 1, 100)) {
        payload.workout.workoutReps = this.savedConfig.workout.workoutReps;
      }
      if (this.preferenceNumberError(payload.workout.cardioSets, 1, 20)) {
        payload.workout.cardioSets = this.savedConfig.workout.cardioSets;
      }
      if (this.preferenceNumberError(payload.workout.cardioMinutes, 1, 300)) {
        payload.workout.cardioMinutes = this.savedConfig.workout.cardioMinutes;
      }
    }

    this.coachSettingsService.saveConfig(payload).subscribe({
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
    const confirmed = confirm(this.translate.instant('RESET_DEMO_CONFIRM'));

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
    const confirmed = confirm(this.translate.instant('REMOVE_DEMO_CONFIRM'));

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


  setActiveTab(tab: 'account' | 'publicProfile' | 'password' | 'plan' | 'notifications' | 'preferences'): void {
    this.activeTab = tab;
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  get hasConfigChanges(): boolean {
    return JSON.stringify(this.config) !== JSON.stringify(this.savedConfig);
  }

  get publicProfileSaveDisabled(): boolean {
    return this.saving || this.uploadingPublicPhoto || !this.hasConfigChanges || this.publicProfileHasErrors;
  }

  get hasAccountChanges(): boolean {
    return ['username', 'firstName', 'lastName', 'email'].some(
      (key) => String((this.profile as any)[key] ?? '').trim() !== String((this.savedProfile as any)[key] ?? '').trim(),
    );
  }

  onPreferenceNumberKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const allowedKeys = new Set([
      'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
    ]);
    if (allowedKeys.has(event.key) || /^\d$/.test(event.key)) return;
    event.preventDefault();
  }

  preferenceNumberError(value: unknown, min: number, max: number, enabled = true): string {
    const normalized = String(value ?? '').trim();
    if (!enabled && !normalized) return '';
    const parsed = Number(normalized);
    if (!/^\d+$/.test(normalized) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
      return this.translate.instant('COACH_SETTINGS_NUMBER_RANGE_ERROR', { min, max });
    }
    return '';
  }

  get preferencesHaveErrors(): boolean {
    const nutrition = this.config.nutrition;
    const workout = this.config.workout;
    return Boolean(
      this.preferenceNumberError(nutrition.defaultMeals, 1, 10, nutrition.autoCreateMeals) ||
      this.preferenceNumberError(workout.workoutSets, 1, 20, workout.autoFillDefaults) ||
      this.preferenceNumberError(workout.workoutReps, 1, 100, workout.autoFillDefaults) ||
      this.preferenceNumberError(workout.cardioSets, 1, 20, workout.autoFillDefaults) ||
      this.preferenceNumberError(workout.cardioMinutes, 1, 300, workout.autoFillDefaults)
    );
  }

  get preferencesSaveDisabled(): boolean {
    return this.saving || this.loading || !this.hasConfigChanges || this.preferencesHaveErrors || this.publicProfileHasErrors;
  }

  get accountValidationErrors(): Partial<Record<'username' | 'firstName' | 'lastName' | 'email', string>> {
    const errors: Partial<Record<'username' | 'firstName' | 'lastName' | 'email', string>> = {};
    const username = this.profile.username.trim();
    const firstName = this.profile.firstName.trim();
    const lastName = this.profile.lastName.trim();
    const email = this.profile.email.trim();

    if (!username) errors.username = this.translate.instant('ACCOUNT_USERNAME_REQUIRED');
    else if (username.length < 3) errors.username = this.translate.instant('ACCOUNT_USERNAME_MIN_LENGTH');
    else if (username.length > 50) errors.username = this.translate.instant('ACCOUNT_USERNAME_MAX_LENGTH');
    else if (!/^[A-Za-z0-9._-]+$/.test(username)) errors.username = this.translate.instant('ACCOUNT_USERNAME_INVALID');

    if (!firstName) errors.firstName = this.translate.instant('ACCOUNT_FIRST_NAME_REQUIRED');
    else if (firstName.length > 100) errors.firstName = this.translate.instant('ACCOUNT_FIRST_NAME_MAX_LENGTH');

    if (!lastName) errors.lastName = this.translate.instant('ACCOUNT_LAST_NAME_REQUIRED');
    else if (lastName.length > 100) errors.lastName = this.translate.instant('ACCOUNT_LAST_NAME_MAX_LENGTH');

    if (!email) errors.email = this.translate.instant('ACCOUNT_EMAIL_REQUIRED');
    else if (email.length > 254) errors.email = this.translate.instant('ACCOUNT_EMAIL_MAX_LENGTH');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = this.translate.instant('ACCOUNT_EMAIL_INVALID');

    return { ...errors, ...this.accountServerErrors };
  }

  get accountSaveDisabled(): boolean {
    return this.isSavingAccount || !this.hasAccountChanges || Object.keys(this.accountValidationErrors).length > 0;
  }

  get hasPasswordChanges(): boolean {
    return Object.values(this.passwordFormModel).some((value) => Boolean(value));
  }

  get passwordValidationErrors(): Partial<Record<'oldPassword' | 'newPassword' | 'confirmPassword', string>> {
    const errors: Partial<Record<'oldPassword' | 'newPassword' | 'confirmPassword', string>> = {};
    const { oldPassword, newPassword, confirmPassword } = this.passwordFormModel;
    const commonPasswords = new Set(['password', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'azerty123']);

    if (!oldPassword) errors.oldPassword = this.translate.instant('PASSWORD_CURRENT_REQUIRED');
    if (this.currentPasswordServerError) errors.oldPassword = this.currentPasswordServerError;

    if (!newPassword) errors.newPassword = this.translate.instant('PASSWORD_NEW_REQUIRED');
    else if (newPassword.length < 10) errors.newPassword = this.translate.instant('PASSWORD_MIN_LENGTH_10');
    else if (newPassword.length > 128) errors.newPassword = this.translate.instant('PASSWORD_MAX_LENGTH_128');
    else if (newPassword === oldPassword) errors.newPassword = this.translate.instant('PASSWORD_MUST_DIFFER');
    else if (commonPasswords.has(newPassword.toLowerCase())) errors.newPassword = this.translate.instant('PASSWORD_TOO_COMMON');

    if (!confirmPassword) errors.confirmPassword = this.translate.instant('PASSWORD_CONFIRM_REQUIRED');
    else if (confirmPassword !== newPassword) errors.confirmPassword = this.translate.instant('PASSWORDS_DO_NOT_MATCH');

    return errors;
  }

  get passwordSaveDisabled(): boolean {
    return this.isChangingPassword || Object.keys(this.passwordValidationErrors).length > 0;
  }

  cancelProfile(): void {
    this.profile = { ...this.savedProfile };
    this.accountServerErrors = {};
  }

  clearAccountServerError(field: 'username' | 'email'): void {
    if (!this.accountServerErrors[field]) return;
    const { [field]: _removed, ...remaining } = this.accountServerErrors;
    this.accountServerErrors = remaining;
  }

  cancelPassword(): void {
    this.passwordFormModel = { oldPassword: '', newPassword: '', confirmPassword: '' };
    this.passwordError = '';
    this.passwordSuccess = '';
    this.currentPasswordServerError = '';
    this.passwordFieldTouched = {
      oldPassword: false,
      newPassword: false,
      confirmPassword: false,
    };
  }

  onPasswordInput(field: 'oldPassword' | 'newPassword' | 'confirmPassword'): void {
    this.passwordFieldTouched[field] = true;
    this.passwordError = '';
    this.passwordSuccess = '';
    if (field === 'oldPassword') this.currentPasswordServerError = '';
  }

  addProfileItem(field: 'specialties' | 'certifications' | 'languages', input: HTMLInputElement | HTMLSelectElement): void {
    const rawValue = this.normalizeCollectionValue(input.value);
    if (!rawValue) return;
    if (field === 'languages' && !this.publicProfileLanguages.includes(rawValue)) return;

    const maxItems = field === 'specialties' ? 10 : field === 'certifications' ? 10 : 10;
    const maxLength = field === 'specialties' ? 50 : field === 'certifications' ? 100 : 50;
    const duplicate = this.config.publicProfile[field].some(
      (item) => item.trim().toLowerCase() === rawValue.toLowerCase(),
    );

    if (duplicate) {
      input.value = '';
      return;
    }

    if (rawValue.length > maxLength) {
      input.value = '';
      return;
    }

    if (this.config.publicProfile[field].length >= maxItems) {
      input.value = '';
      return;
    }

    this.config.publicProfile[field] = [...this.config.publicProfile[field], rawValue];
    input.value = '';
  }

  removeProfileItem(field: 'specialties' | 'certifications' | 'languages', value: string): void {
    this.config.publicProfile[field] = this.config.publicProfile[field].filter((item) => item !== value);
  }

  toggleNotification(item: { key: string; enabled: boolean }): void {
    item.enabled = !item.enabled;
    (this.config.notifications as any)[item.key] = item.enabled;
  }

  private syncNotificationToggles(): void {
    this.browserNotificationsEnabled = this.config.notifications.enabled === true;
    this.emailNotifications.forEach((item) => {
      item.enabled = (this.config.notifications as any)[item.key] !== false;
    });
  }

  changePassword(): void {
    if (this.passwordSaveDisabled) return;
    this.passwordError = '';
    this.passwordSuccess = '';
    this.currentPasswordServerError = '';
    this.isChangingPassword = true;
    this.usersService.updateMyPassword(this.passwordFormModel).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.passwordSuccess = this.translate.instant('PASSWORD_CHANGED_SUCCESSFULLY');
        this.passwordFormModel = { oldPassword: '', newPassword: '', confirmPassword: '' };
        this.passwordFieldTouched = {
          oldPassword: false,
          newPassword: false,
          confirmPassword: false,
        };
      },
      error: (error) => {
        this.isChangingPassword = false;
        const details = JSON.stringify(error?.error ?? error ?? '').toLowerCase();
        if (details.includes('current password is incorrect')) {
          this.currentPasswordServerError = this.translate.instant('PASSWORD_CURRENT_INCORRECT');
        } else {
          this.passwordError = this.translate.instant('PASSWORD_CHANGE_ERROR');
        }
      },
    });
  }

  saveProfile(): void {
    const currentUserId = this.currentUserId || sessionStorage.getItem('userId') || '';
    if (!currentUserId || this.accountSaveDisabled) return;
    this.isSavingAccount = true;
    this.accountServerErrors = {};
    const normalizedProfile = {
      username: this.profile.username.trim(),
      firstName: this.profile.firstName.trim(),
      lastName: this.profile.lastName.trim(),
      email: this.profile.email.trim(),
      photoName: this.profile.photoName,
    };
    this.usersService.updateUser(currentUserId, {
      login: normalizedProfile.username,
      firstName: normalizedProfile.firstName,
      lastName: normalizedProfile.lastName,
      email: normalizedProfile.email,
    } as any).subscribe({
      next: () => {
        this.profile = normalizedProfile;
        localStorage.setItem('username', normalizedProfile.username);
        localStorage.setItem('firstName', normalizedProfile.firstName);
        localStorage.setItem('lastName', normalizedProfile.lastName);
        localStorage.setItem('email', normalizedProfile.email);
        this.savedProfile = { ...normalizedProfile };
        this.isSavingAccount = false;
        this.showPopup('success');
      },
      error: (error) => {
        this.isSavingAccount = false;
        const details = JSON.stringify(error?.error ?? error ?? '').toLowerCase();
        if (details.includes('email')) {
          this.accountServerErrors = { email: this.translate.instant('ACCOUNT_EMAIL_IN_USE') };
        } else if (details.includes('username') || details.includes('login') || details.includes('userexists')) {
          this.accountServerErrors = { username: this.translate.instant('ACCOUNT_USERNAME_IN_USE') };
        } else {
          this.showPopup('error');
        }
      },
    });
  }

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.profile.photoName = input.files?.[0]?.name || '';
  }

  onPublicPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const currentUserId = this.currentUserId || sessionStorage.getItem('userId') || '';
    input.value = '';
    if (!file || !currentUserId) return;
    if (!this.supportedPublicPhotoTypes.has(file.type)) {
      this.toastr.warning('Unsupported image format.');
      return;
    }
    if (file.size >= 5 * 1024 * 1024) {
      this.toastr.warning('Image must be smaller than 5 MB.');
      return;
    }
    this.uploadingPublicPhoto = true;
    this.documentService.uploadPublicProfilePhoto(file).subscribe({
      next: ({ photoUrl }) => {
        this.config.publicProfile.photoUrl = photoUrl;
        this.publicPhotoDisplayUrl = photoUrl;
        this.config.publicProfile.photoVisible = true;
        this.uploadingPublicPhoto = false;
      },
      error: (error) => {
        this.uploadingPublicPhoto = false;
        if (error?.status === 413) this.toastr.warning('Image must be smaller than 5 MB.');
        else if (String(error?.error || '').includes('400 × 400')) this.toastr.warning('Image must be at least 400 × 400 px.');
        else this.toastr.warning('Unsupported image format.');
      },
    });
  }

  removePublicPhoto(): void {
    if (!this.config.publicProfile.photoUrl || this.uploadingPublicPhoto || this.saving) return;
    this.showRemovePhotoModal = true;
  }

  closeRemovePhotoModal(): void {
    this.showRemovePhotoModal = false;
  }

  confirmRemovePublicPhoto(): void {
    if (!this.showRemovePhotoModal) return;
    this.showRemovePhotoModal = false;
    this.config.publicProfile.photoUrl = '';
    this.publicPhotoDisplayUrl = '';
  }

  onPublicPhotoLoadError(): void {
    this.publicPhotoDisplayUrl = '';
  }

  private refreshPublicPhoto(storedUrl: string): void {
    this.publicPhotoDisplayUrl = storedUrl || '';
    if (!storedUrl) return;

    this.documentService.refreshStoredFileUrl(storedUrl).subscribe({
      next: (freshUrl) => { this.publicPhotoDisplayUrl = freshUrl; },
      error: () => { this.publicPhotoDisplayUrl = ''; },
    });
  }

  enableBrowserNotifications(): void {
    if (this.browserNotificationsEnabled) {
      this.browserNotificationsEnabled = false;
      this.config.notifications.enabled = false;
      return;
    }

    this.browserNotificationsEnabled = true;
    this.config.notifications.enabled = true;
  }

  logout(): void {
    sessionStorage.clear();
    window.location.href = '/';
  }

  requestDeleteAccount(): void {
    if (this.isDeletingAccount) return;
    this.showDeleteAccountModal = true;
  }

  closeDeleteAccountModal(): void {
    if (this.isDeletingAccount) return;
    this.showDeleteAccountModal = false;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showRemovePhotoModal) this.closeRemovePhotoModal();
    if (this.showDeleteAccountModal) this.closeDeleteAccountModal();
  }

  confirmDeleteAccount(): void {
    if (this.isDeletingAccount) return;

    this.isDeletingAccount = true;
    this.usersService.deleteMyAccount().subscribe({
      next: () => {
        sessionStorage.clear();
        this.authService.logout();
      },
      error: (err) => {
        console.error('[ACCOUNT] Account deletion failed', err);
        this.isDeletingAccount = false;
        this.showDeleteAccountModal = false;
        this.showPopup('error');
      },
    });
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
