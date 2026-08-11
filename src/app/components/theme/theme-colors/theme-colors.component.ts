import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { environment } from '@env/environment';
import { AppThemeColors, AppThemeColorsPage } from '../../../core/models/app-theme-colors.model';
import { AppThemeColorsService } from '../../../core/service/app-theme-colors.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type ColorField = keyof Pick<
  AppThemeColors,
  | 'primary'
  | 'secondary'
  | 'background'
  | 'surface'
  | 'card'
  | 'cardSurface'
  | 'textPrimary'
  | 'textSecondary'
  | 'textHint'
  | 'success'
  | 'successLight'
  | 'error'
  | 'errorLight'
  | 'warning'
  | 'warningLight'
  | 'border'
  | 'divider'
  | 'disabled'
  | 'dragHandle'
  | 'emptyStateBg'
  | 'buttonText'
  | 'selectedTabBg'
  | 'activeBg'
  | 'headerStart'
  | 'headerMid'
  | 'headerEnd'
>;

interface ColorControl {
  key: ColorField;
  label: string;
  group: string;
}

type ThemeSection =
  | 'branding'
  | 'templates'
  | 'brand'
  | 'background'
  | 'text'
  | 'status'
  | 'navigation';

@Component({
  selector: 'app-theme-colors',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './theme-colors.component.html',
  styleUrls: ['./theme-colors.component.scss'],
})
export class ThemeColorsComponent implements OnInit {
  @ViewChild('flutterPreview') flutterPreview?: ElementRef<HTMLIFrameElement>;

  themes: AppThemeColors[] = [];
  selectedTheme: AppThemeColors = this.createDefaultTheme();

  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  iframeReady = false;
  flutterPreviewUrl: SafeResourceUrl;

  activeColorSection: ThemeSection = 'templates';
  selectedPreset = 'FitBudd';
  uploadingLogo = false;

  groupedControls: { group: string; controls: ColorControl[] }[] = [];

  readonly controls: ColorControl[] = [
    { key: 'primary', label: 'PRIMARY_COLOR', group: 'BRAND_GROUP' },
    { key: 'secondary', label: 'SECONDARY_COLOR', group: 'BRAND_GROUP' },

    { key: 'background', label: 'BACKGROUND_COLOR', group: 'BACKGROUND_GROUP' },
    { key: 'surface', label: 'SURFACE_COLOR', group: 'BACKGROUND_GROUP' },
    { key: 'card', label: 'CARD_COLOR', group: 'BACKGROUND_GROUP' },
    { key: 'cardSurface', label: 'CARD_SURFACE_COLOR', group: 'BACKGROUND_GROUP' },

    { key: 'textPrimary', label: 'PRIMARY_TEXT_COLOR', group: 'TEXT_GROUP' },
    { key: 'textSecondary', label: 'SECONDARY_TEXT_COLOR', group: 'TEXT_GROUP' },
    { key: 'textHint', label: 'HINT_TEXT_COLOR', group: 'TEXT_GROUP' },

    { key: 'success', label: 'SUCCESS_COLOR', group: 'STATUS_GROUP' },
    { key: 'successLight', label: 'SUCCESS_LIGHT_COLOR', group: 'STATUS_GROUP' },
    { key: 'error', label: 'ERROR_COLOR', group: 'STATUS_GROUP' },
    { key: 'errorLight', label: 'ERROR_LIGHT_COLOR', group: 'STATUS_GROUP' },
    { key: 'warning', label: 'WARNING_COLOR', group: 'STATUS_GROUP' },
    { key: 'warningLight', label: 'WARNING_LIGHT_COLOR', group: 'STATUS_GROUP' },

    { key: 'border', label: 'BORDER_COLOR', group: 'STRUCTURE_GROUP' },
    { key: 'divider', label: 'DIVIDER_COLOR', group: 'STRUCTURE_GROUP' },
    { key: 'disabled', label: 'DISABLED_COLOR', group: 'STRUCTURE_GROUP' },
    { key: 'dragHandle', label: 'DRAG_HANDLE_COLOR', group: 'STRUCTURE_GROUP' },
    { key: 'emptyStateBg', label: 'EMPTY_STATE_BACKGROUND_COLOR', group: 'STRUCTURE_GROUP' },

    { key: 'buttonText', label: 'BUTTON_TEXT_COLOR', group: 'BUTTONS_GROUP' },

    { key: 'selectedTabBg', label: 'SELECTED_TAB_BACKGROUND_COLOR', group: 'INTERACTIVE_GROUP' },
    { key: 'activeBg', label: 'ACTIVE_BACKGROUND_COLOR', group: 'INTERACTIVE_GROUP' },

    { key: 'headerStart', label: 'HEADER_START_COLOR', group: 'HEADER_GRADIENT_GROUP' },
    { key: 'headerMid', label: 'HEADER_MIDDLE_COLOR', group: 'HEADER_GRADIENT_GROUP' },
    { key: 'headerEnd', label: 'HEADER_END_COLOR', group: 'HEADER_GRADIENT_GROUP' },
  ];

  presets: AppThemeColors[] = [
    {
      name: 'FitBudd',
      active: false,

      primary: '#39AEEF',
      secondary: '#070D12',

      background: '#F5F6FA',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      cardSurface: '#F8F8F8',

      textPrimary: '#111827',
      textSecondary: '#6B7280',
      textHint: '#9CA3AF',

      success: '#22C55E',
      successLight: '#EAF8F0',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FFF3E0',

      border: '#E5E7EB',
      divider: '#EEEEEE',
      disabled: '#BDBDBD',
      dragHandle: '#D1D5DB',
      emptyStateBg: '#F9FAFB',

      buttonText: '#FFFFFF',

      selectedTabBg: '#EAF8FF',
      activeBg: '#0D1B2A',

      headerStart: '#071018',
      headerMid: '#0B151E',
      headerEnd: '#101820',
    },
    {
      name: 'Oceanic Aura',
      active: false,

      primary: '#2563EB',
      secondary: '#1E40AF',

      background: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      cardSurface: '#F8FAFC',

      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textHint: '#94A3B8',

      success: '#22C55E',
      successLight: '#DCFCE7',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FEF3C7',

      border: '#E2E8F0',
      divider: '#E5E7EB',
      disabled: '#CBD5E1',
      dragHandle: '#CBD5E1',
      emptyStateBg: '#F1F5F9',

      buttonText: '#FFFFFF',

      selectedTabBg: '#DBEAFE',
      activeBg: '#1E3A8A',

      headerStart: '#1E3A8A',
      headerMid: '#1D4ED8',
      headerEnd: '#3B82F6',
    },
    {
      name: 'Aqua Oasis',
      active: false,

      primary: '#06B6D4',
      secondary: '#0891B2',

      background: '#ECFEFF',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      cardSurface: '#F0FDFA',

      textPrimary: '#164E63',
      textSecondary: '#64748B',
      textHint: '#94A3B8',

      success: '#10B981',
      successLight: '#D1FAE5',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FEF3C7',

      border: '#CFFAFE',
      divider: '#E0F2FE',
      disabled: '#A5F3FC',
      dragHandle: '#A5F3FC',
      emptyStateBg: '#F0FDFA',

      buttonText: '#FFFFFF',

      selectedTabBg: '#CFFAFE',
      activeBg: '#155E75',

      headerStart: '#164E63',
      headerMid: '#0891B2',
      headerEnd: '#22D3EE',
    },
    {
      name: 'Noir Elegant',
      active: false,

      primary: '#111827',
      secondary: '#000000',

      background: '#F3F4F6',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      cardSurface: '#F9FAFB',

      textPrimary: '#111827',
      textSecondary: '#6B7280',
      textHint: '#9CA3AF',

      success: '#22C55E',
      successLight: '#EAF8F0',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FFF3E0',

      border: '#E5E7EB',
      divider: '#EEEEEE',
      disabled: '#BDBDBD',
      dragHandle: '#D1D5DB',
      emptyStateBg: '#F9FAFB',

      buttonText: '#FFFFFF',

      selectedTabBg: '#E5E7EB',
      activeBg: '#000000',

      headerStart: '#000000',
      headerMid: '#111827',
      headerEnd: '#1F2937',
    },
  ];

  constructor(
    private themeService: AppThemeColorsService,
    private sanitizer: DomSanitizer,
    private translate: TranslateService
  ) {
    this.flutterPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      '/assets/mobile-preview/index.html'
    );
  }

  ngOnInit(): void {
    this.groupedControls = this.buildGroupedControls();
    this.loadThemes();
  }

  get visibleControls(): ColorControl[] {
    if (this.activeColorSection === 'templates' || this.activeColorSection === 'branding') {
      return [];
    }

    if (this.activeColorSection === 'brand') {
      return this.controls.filter((c) =>
        ['primary', 'secondary', 'buttonText'].includes(c.key)
      );
    }

    if (this.activeColorSection === 'background') {
      return this.controls.filter((c) =>
        [
          'background',
          'surface',
          'card',
          'cardSurface',
          'border',
          'divider',
          'emptyStateBg',
        ].includes(c.key)
      );
    }

    if (this.activeColorSection === 'text') {
      return this.controls.filter((c) =>
        ['textPrimary', 'textSecondary', 'textHint', 'disabled'].includes(c.key)
      );
    }

    if (this.activeColorSection === 'status') {
      return this.controls.filter((c) =>
        [
          'success',
          'successLight',
          'error',
          'errorLight',
          'warning',
          'warningLight',
        ].includes(c.key)
      );
    }

    return this.controls.filter((c) =>
      [
        'selectedTabBg',
        'activeBg',
        'dragHandle',
        'headerStart',
        'headerMid',
        'headerEnd',
      ].includes(c.key)
    );
  }

  onFlutterIframeLoaded(): void {
    this.iframeReady = true;

    setTimeout(() => {
      this.sendThemeToFlutter();
    }, 800);
  }

  private sendThemeToFlutter(): void {
    if (!this.iframeReady) return;
    if (!this.flutterPreview?.nativeElement?.contentWindow) return;
    if (!this.selectedTheme) return;

    const previewTheme = {
      ...this.selectedTheme,
      mobileLogoUrl: this.getLogoPreviewUrl(this.selectedTheme.mobileLogoUrl),
    };

    this.flutterPreview.nativeElement.contentWindow.postMessage(
      JSON.stringify({
        type: 'YOCOACH_THEME_UPDATE',
        theme: previewTheme,
      }),
      '*'
    );
  }

  getLogoPreviewUrl(url?: string): string {
    if (!url) return '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const apiBase = environment.baseApiUrl.replace(/\/$/, '');

    if (url.startsWith('/')) {
      return `${apiBase}${url}`;
    }

    return `${apiBase}/${url}`;
  }

  loadThemes(): void {
    this.loading = true;
    this.error = null;
    this.success = null;

    this.themeService
      .getCurrent()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (theme) => {
          this.selectedTheme = this.normalizeTheme(theme);
          this.themes = [this.selectedTheme];

          setTimeout(() => {
            this.sendThemeToFlutter();
          }, 500);

          this.loadAllThemesSilently();
        },
        error: (err) => {
          if (err?.status === 404) {
            this.loadThemesWithoutActive();
            return;
          }

          this.error = this.extractError(err);
          this.selectedTheme = this.createDefaultTheme();
          this.sendThemeToFlutter();
        },
      });
  }

  private loadThemesWithoutActive(): void {
    this.loading = true;

    this.themeService
      .getAll(0, 50)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          const content = Array.isArray(response)
            ? response
            : (response as AppThemeColorsPage).content ?? [];

          this.themes = content.map((theme) => this.normalizeTheme(theme));

          if (this.themes.length > 0) {
            this.selectedTheme = { ...this.themes[0] };
            this.error = this.translate.instant('NO_ACTIVE_THEME_HINT');
          } else {
            this.selectedTheme = this.createDefaultTheme();
            this.themes = [];
            this.error = this.translate.instant('NO_THEME_FOUND_HINT');
          }

          this.sendThemeToFlutter();
        },
        error: (error) => {
          this.error = this.extractError(error);
          this.selectedTheme = this.createDefaultTheme();
          this.sendThemeToFlutter();
        },
      });
  }

  private loadAllThemesSilently(): void {
    this.themeService.getAll(0, 50).subscribe({
      next: (response) => {
        const content = Array.isArray(response)
          ? response
          : (response as AppThemeColorsPage).content ?? [];

        if (content.length > 0) {
          this.themes = content.map((theme) => this.normalizeTheme(theme));

          const active = this.themes.find((theme) => theme.active);
          if (active) {
            this.selectedTheme = { ...active };
            this.sendThemeToFlutter();
          }
        }
      },
      error: () => {},
    });
  }

  selectTheme(theme: AppThemeColors): void {
    this.selectedTheme = { ...theme };
    this.success = null;
    this.error = null;
    this.sendThemeToFlutter();
  }

  createNewTheme(): void {
    this.selectedTheme = {
      ...this.createDefaultTheme(),
      name: 'New Theme',
      active: false,
      id: undefined,
      createdBy: undefined,
      updatedBy: undefined,
    };

    this.success = null;
    this.error = null;
    this.selectedPreset = '';

    this.sendThemeToFlutter();
  }

  duplicateSelectedTheme(): void {
    this.selectedTheme = {
      ...this.selectedTheme,
      id: undefined,
      name: `${this.selectedTheme.name || 'Theme'} Copy`,
      active: false,
      createdBy: undefined,
      updatedBy: undefined,
    };

    this.success = null;
    this.error = null;
    this.selectedPreset = '';

    this.sendThemeToFlutter();
  }

  saveTheme(): void {
    this.error = null;
    this.success = null;
    this.normalizeAllColors();

    if (!this.selectedTheme.name?.trim()) {
      this.error = this.translate.instant('THEME_NAME_REQUIRED');
      return;
    }

    const invalid = this.controls.find(
      (control) => !this.isValidHex(this.getColor(control.key))
    );

    if (invalid) {
      this.error = this.translate.instant('INVALID_HEX_COLOR', { field: this.translate.instant(invalid.label) });
      return;
    }

    this.saving = true;

    const payload: AppThemeColors = {
      ...this.selectedTheme,
      name: this.selectedTheme.name.trim(),
    };

    const request$ = payload.id
      ? this.themeService.update(payload.id, payload)
      : this.themeService.create(payload);

    request$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (theme) => {
        this.selectedTheme = this.normalizeTheme(theme);
        this.success = this.translate.instant('THEME_SAVED_SUCCESS');
        this.sendThemeToFlutter();
        this.loadThemes();
      },
      error: (err) => {
        this.error = this.extractError(err);
      },
    });
  }

  activateTheme(theme: AppThemeColors = this.selectedTheme): void {
    if (!theme.id) {
      this.error = this.translate.instant('SAVE_THEME_BEFORE_ACTIVATING');
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    this.themeService
      .activate(theme.id)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (activated) => {
          this.selectedTheme = this.normalizeTheme(activated);
          this.success = this.translate.instant('THEME_ACTIVATED_SUCCESS');
          this.sendThemeToFlutter();
          this.loadThemes();
        },
        error: (err) => {
          this.error = this.extractError(err);
        },
      });
  }

  deleteTheme(theme: AppThemeColors): void {
    if (!theme.id) return;

    if (theme.active) {
      this.error = this.translate.instant('CANNOT_DELETE_ACTIVE_THEME');
      return;
    }

    const confirmed = confirm(this.translate.instant('DELETE_THEME_CONFIRM', { name: theme.name }));
    if (!confirmed) return;

    this.loading = true;
    this.error = null;
    this.success = null;

    this.themeService
      .delete(theme.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.success = this.translate.instant('THEME_DELETED_SUCCESS');
          this.loadThemes();
        },
        error: (err) => {
          this.error = this.extractError(err);
        },
      });
  }

  onMobileLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

    if (!allowedTypes.includes(file.type)) {
      this.error = this.translate.instant('LOGO_FILE_TYPES_ERROR');
      return;
    }

    const maxSizeMb = 2;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      this.error = this.translate.instant('LOGO_SIZE_ERROR', { size: maxSizeMb });
      return;
    }

    this.uploadingLogo = true;
    this.error = null;
    this.success = null;

    this.themeService.uploadMobileLogo(file).subscribe({
      next: (res) => {
        this.selectedTheme = {
          ...this.selectedTheme,
          mobileLogoUrl: res.url,
        };

        this.uploadingLogo = false;
        this.success = this.translate.instant('LOGO_UPLOADED_SUCCESS');
        this.sendThemeToFlutter();
      },
      error: (err) => {
        this.uploadingLogo = false;
        this.error = this.extractError(err);
      },
    });
  }

  removeMobileLogo(): void {
    this.selectedTheme = {
      ...this.selectedTheme,
      mobileLogoUrl: undefined,
    };

    this.success = this.translate.instant('LOGO_REMOVED_SUCCESS');
    this.error = null;

    this.sendThemeToFlutter();
  }

  applyPreset(preset: AppThemeColors): void {
    this.selectedPreset = preset.name;

    this.selectedTheme = {
      ...this.selectedTheme,
      ...preset,
      id: this.selectedTheme.id,
      active: this.selectedTheme.active,
      createdBy: this.selectedTheme.createdBy,
      updatedBy: this.selectedTheme.updatedBy,
      mobileLogoUrl: this.selectedTheme.mobileLogoUrl,
    };

    this.sendThemeToFlutter();
  }

  resetToDefaultColors(): void {
    const currentId = this.selectedTheme.id;
    const currentActive = this.selectedTheme.active;
    const currentName = this.selectedTheme.name || 'YoCoach Default Blue';

    this.selectedTheme = {
      ...this.createDefaultTheme(),
      id: currentId,
      active: currentActive,
      name: currentName,
      createdBy: this.selectedTheme.createdBy,
      updatedBy: this.selectedTheme.updatedBy,
    };

    this.selectedPreset = 'FitBudd';
    this.success = this.translate.instant('DEFAULT_COLORS_RESTORED');
    this.error = null;

    this.sendThemeToFlutter();
  }

  saveAndUseTheme(): void {
    this.error = null;
    this.success = null;
    this.normalizeAllColors();

    if (!this.selectedTheme.name?.trim()) {
      this.error = this.translate.instant('THEME_NAME_REQUIRED');
      return;
    }

    const invalid = this.controls.find(
      (control) => !this.isValidHex(this.getColor(control.key))
    );

    if (invalid) {
      this.error = this.translate.instant('INVALID_HEX_COLOR', { field: this.translate.instant(invalid.label) });
      return;
    }

    this.saving = true;

    const payload: AppThemeColors = {
      ...this.selectedTheme,
      name: this.selectedTheme.name.trim(),
      active: true,
    };

    const request$ = payload.id
      ? this.themeService.update(payload.id, payload)
      : this.themeService.create(payload);

    request$.subscribe({
      next: (savedTheme) => {
        if (!savedTheme.id) {
          this.saving = false;
          this.selectedTheme = this.normalizeTheme(savedTheme);
          this.success = this.translate.instant('THEME_SAVED_ID_MISSING');
          this.sendThemeToFlutter();
          return;
        }

        this.themeService
          .activate(savedTheme.id)
          .pipe(finalize(() => (this.saving = false)))
          .subscribe({
            next: (activated) => {
              this.selectedTheme = this.normalizeTheme(activated);
              this.success = this.translate.instant('THEME_SAVED_APPLIED');
              this.sendThemeToFlutter();
              this.loadThemes();
            },
            error: (err) => {
              this.error = this.extractError(err);
              this.selectedTheme = this.normalizeTheme(savedTheme);
              this.sendThemeToFlutter();
            },
          });
      },
      error: (err) => {
        this.saving = false;
        this.error = this.extractError(err);
      },
    });
  }

  getSectionTitle(): string {
    if (this.activeColorSection === 'branding') return 'MOBILE_LOGO';
    if (this.activeColorSection === 'templates') return 'THEME_TEMPLATES';
    if (this.activeColorSection === 'brand') return 'BRAND_COLORS';
    if (this.activeColorSection === 'background') return 'BACKGROUND_AND_CARDS';
    if (this.activeColorSection === 'text') return 'TEXT_COLORS';
    if (this.activeColorSection === 'status') return 'STATUS_COLORS';
    return 'NAVIGATION_AND_HEADER';
  }

  getColor(key: ColorField): string {
    return this.selectedTheme[key] || '#000000';
  }

  setColor(key: ColorField, value: string): void {
    this.selectedTheme = {
      ...this.selectedTheme,
      [key]: value,
    };

    this.selectedPreset = '';
    this.sendThemeToFlutter();
  }

  normalizeHex(key: ColorField): void {
    const normalized = this.normalizeHexValue(this.getColor(key));

    this.selectedTheme = {
      ...this.selectedTheme,
      [key]: normalized,
    };

    this.sendThemeToFlutter();
  }

  trackByThemeId(_: number, theme: AppThemeColors): string {
    return theme.id ?? theme.name;
  }

  trackByControl(_: number, control: ColorControl): string {
    return control.key;
  }

  trackByGroup(_: number, group: { group: string; controls: ColorControl[] }): string {
    return group.group;
  }

  private buildGroupedControls(): { group: string; controls: ColorControl[] }[] {
    const groups: { group: string; controls: ColorControl[] }[] = [];

    for (const control of this.controls) {
      let group = groups.find((item) => item.group === control.group);

      if (!group) {
        group = { group: control.group, controls: [] };
        groups.push(group);
      }

      group.controls.push(control);
    }

    return groups;
  }

  private createDefaultTheme(): AppThemeColors {
    return {
      name: 'YoCoach Default Blue',
      active: false,

      mobileLogoUrl: undefined,

      primary: '#39AEEF',
      secondary: '#070D12',

      background: '#F5F6FA',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      cardSurface: '#F8F8F8',

      textPrimary: '#111827',
      textSecondary: '#6B7280',
      textHint: '#9CA3AF',

      success: '#22C55E',
      successLight: '#EAF8F0',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      warning: '#F59E0B',
      warningLight: '#FFF3E0',

      border: '#E5E7EB',
      divider: '#EEEEEE',
      disabled: '#BDBDBD',
      dragHandle: '#D1D5DB',
      emptyStateBg: '#F9FAFB',

      buttonText: '#FFFFFF',

      selectedTabBg: '#EAF8FF',
      activeBg: '#0D1B2A',

      headerStart: '#071018',
      headerMid: '#0B151E',
      headerEnd: '#101820',
    };
  }

  private normalizeAllColors(): void {
    const normalizedTheme: AppThemeColors = {
      ...this.selectedTheme,
    };

    for (const control of this.controls) {
      normalizedTheme[control.key] = this.normalizeHexValue(
        normalizedTheme[control.key]
      );
    }

    this.selectedTheme = normalizedTheme;
    this.sendThemeToFlutter();
  }

  private normalizeTheme(theme: AppThemeColors): AppThemeColors {
    return {
      ...this.createDefaultTheme(),
      ...theme,
      active: theme.active ?? false,
      name: theme.name || 'Theme',
    };
  }

  private normalizeHexValue(value: string): string {
    let next = (value || '').trim().toUpperCase();

    if (!next) return '#000000';
    if (!next.startsWith('#')) next = `#${next}`;

    return next;
  }

  private isValidHex(value: string | undefined): boolean {
    if (!value) return false;

    return (
      /^#?[0-9A-Fa-f]{6}$/.test(value.trim()) ||
      /^#?[0-9A-Fa-f]{8}$/.test(value.trim())
    );
  }

  private extractError(error: any): string {
    if (error?.status === 403) {
      return this.translate.instant('THEME_ACCESS_DENIED');
    }

    if (error?.status === 404) {
      return this.translate.instant('NO_ACTIVE_THEME_BACKEND');
    }

    return (
      error?.error?.message ||
      error?.error?.detail ||
      error?.message ||
      this.translate.instant('SOMETHING_WENT_WRONG')
    );
  }
}
