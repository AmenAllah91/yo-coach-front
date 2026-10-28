import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, finalize } from 'rxjs';
import { environment } from '@env/environment';
import { AppThemeColors } from '../../../core/models/app-theme-colors.model';
import { AppThemeColorsService } from '../../../core/service/app-theme-colors.service';
import { BrandingLockBannerComponent } from 'app/components/branding-lock-banner/branding-lock-banner.component';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
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
}

type ThemeSection = 'branding' | 'templates' | ColorSection;
type ColorSection = 'brand' | 'background' | 'text' | 'status' | 'navigation';

/** Messages exchanged with the Flutter preview (yo-coach-mobile/lib/services/web_theme_bridge_web.dart). */
const PREVIEW_THEME_MESSAGE = 'YOCOACH_THEME_UPDATE';
const PREVIEW_READY_MESSAGE = 'YOCOACH_PREVIEW_READY';

/** The preview says it listens within a couple of seconds; past this, something is wrong with it. */
const PREVIEW_READY_TIMEOUT_MS = 20_000;

/** Logical size of the phone frame; it is scaled down to fit the preview area. */
const PHONE_WIDTH = 360;
const PHONE_HEIGHT = 672;

/** Colors of each section. The colors the clients' app never reads (secondary, header gradient) are not offered. */
const SECTION_COLORS: Record<ColorSection, ColorField[]> = {
  brand: ['primary', 'buttonText'],
  background: ['background', 'surface', 'card', 'cardSurface', 'border', 'divider', 'emptyStateBg'],
  text: ['textPrimary', 'textSecondary', 'textHint', 'disabled'],
  status: ['success', 'successLight', 'error', 'errorLight', 'warning', 'warningLight'],
  navigation: ['selectedTabBg', 'activeBg', 'dragHandle'],
};

const SECTION_TITLES: Record<ThemeSection, string> = {
  branding: 'MOBILE_LOGO',
  templates: 'THEME_TEMPLATES',
  brand: 'BRAND_COLORS',
  background: 'BACKGROUND_AND_CARDS',
  text: 'TEXT_COLORS',
  status: 'STATUS_COLORS',
  navigation: 'NAVIGATION_AND_HEADER',
};

@Component({
  selector: 'app-theme-colors',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BrandingLockBannerComponent],
  templateUrl: './theme-colors.component.html',
  styleUrls: ['./theme-colors.component.scss'],
})
export class ThemeColorsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flutterPreview') flutterPreview?: ElementRef<HTMLIFrameElement>;
  @ViewChild('previewStage') previewStage?: ElementRef<HTMLElement>;

  /** The coach's theme (or the platform theme while they have none): the one and only theme edited here. */
  selectedTheme: AppThemeColors = this.createDefaultTheme();

  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  flutterPreviewUrl: SafeResourceUrl;
  /** The preview answered (YOCOACH_PREVIEW_READY) since it was last loaded. */
  previewReady = false;
  /** Loaded, but silent for too long: an empty phone, offered to be reloaded. */
  previewStalled = false;

  activeColorSection: ThemeSection = 'templates';
  selectedPreset = '';
  uploadingLogo = false;

  /** SUB-27/29: the mobile theme is a paid feature. Visible, but nothing can be changed during the trial. */
  brandingLocked = false;

  readonly controls: ColorControl[] = [
    { key: 'primary', label: 'PRIMARY_COLOR' },
    { key: 'secondary', label: 'SECONDARY_COLOR' },

    { key: 'background', label: 'BACKGROUND_COLOR' },
    { key: 'surface', label: 'SURFACE_COLOR' },
    { key: 'card', label: 'CARD_COLOR' },
    { key: 'cardSurface', label: 'CARD_SURFACE_COLOR' },

    { key: 'textPrimary', label: 'PRIMARY_TEXT_COLOR' },
    { key: 'textSecondary', label: 'SECONDARY_TEXT_COLOR' },
    { key: 'textHint', label: 'HINT_TEXT_COLOR' },

    { key: 'success', label: 'SUCCESS_COLOR' },
    { key: 'successLight', label: 'SUCCESS_LIGHT_COLOR' },
    { key: 'error', label: 'ERROR_COLOR' },
    { key: 'errorLight', label: 'ERROR_LIGHT_COLOR' },
    { key: 'warning', label: 'WARNING_COLOR' },
    { key: 'warningLight', label: 'WARNING_LIGHT_COLOR' },

    { key: 'border', label: 'BORDER_COLOR' },
    { key: 'divider', label: 'DIVIDER_COLOR' },
    { key: 'disabled', label: 'DISABLED_COLOR' },
    { key: 'dragHandle', label: 'DRAG_HANDLE_COLOR' },
    { key: 'emptyStateBg', label: 'EMPTY_STATE_BACKGROUND_COLOR' },

    { key: 'buttonText', label: 'BUTTON_TEXT_COLOR' },

    { key: 'selectedTabBg', label: 'SELECTED_TAB_BACKGROUND_COLOR' },
    { key: 'activeBg', label: 'ACTIVE_BACKGROUND_COLOR' },

    { key: 'headerStart', label: 'HEADER_START_COLOR' },
    { key: 'headerMid', label: 'HEADER_MIDDLE_COLOR' },
    { key: 'headerEnd', label: 'HEADER_END_COLOR' },
  ];

  /** Starting points: only their colors are applied, the theme keeps its name and logo. */
  readonly presets: AppThemeColors[] = [
    this.createDefaultTheme(),
    {
      ...this.createDefaultTheme(),
      name: 'Oceanic Aura',

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
      ...this.createDefaultTheme(),
      name: 'Aqua Oasis',

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
      ...this.createDefaultTheme(),
      name: 'Noir Elegant',

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

  private readonly subscriptions = new Subscription();
  private stageObserver?: ResizeObserver;
  private successTimer?: ReturnType<typeof setTimeout>;
  private previewWatchdog?: ReturnType<typeof setTimeout>;

  constructor(
    private themeService: AppThemeColorsService,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private subscriptionState: CoachSubscriptionStateService,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {
    this.flutterPreviewUrl = this.previewSource();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.subscriptionState.brandingLocked().subscribe((locked) => (this.brandingLocked = locked))
    );
    // The preview follows the language of the page.
    this.subscriptions.add(this.translate.onLangChange.subscribe(() => this.sendThemeToFlutter()));
    window.addEventListener('message', this.onWindowMessage);
    this.loadTheme(true);
  }

  ngAfterViewInit(): void {
    const stage = this.previewStage?.nativeElement;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    // The phone keeps its 360×672 logical size and is scaled to the room left by the title and the label (the first
    // version computed this scale in CSS with a division of lengths, which is invalid: the phone was never scaled and
    // its bottom was cut off on a laptop screen).
    this.stageObserver = new ResizeObserver(() => this.fitPhone(stage));
    this.stageObserver.observe(stage);
    this.fitPhone(stage);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stageObserver?.disconnect();
    window.removeEventListener('message', this.onWindowMessage);
    if (this.successTimer) clearTimeout(this.successTimer);
    if (this.previewWatchdog) clearTimeout(this.previewWatchdog);
  }

  goBack(): void {
    window.history.back();
  }

  // --- sections ------------------------------------------------------------------------------------------------------

  get isColorSection(): boolean {
    return this.activeColorSection !== 'branding' && this.activeColorSection !== 'templates';
  }

  get visibleControls(): ColorControl[] {
    if (!this.isColorSection) return [];
    const keys = SECTION_COLORS[this.activeColorSection as ColorSection];
    return this.controls.filter((control) => keys.includes(control.key));
  }

  getSectionTitle(): string {
    return SECTION_TITLES[this.activeColorSection];
  }

  // --- preview -------------------------------------------------------------------------------------------------------

  onFlutterIframeLoaded(): void {
    // The engine is not listening yet when the document loads; the preview says when it is (YOCOACH_PREVIEW_READY).
    // This send only covers a page that does not post the ready message.
    setTimeout(() => this.sendThemeToFlutter(), 1500);
    if (this.previewWatchdog) clearTimeout(this.previewWatchdog);
    this.previewWatchdog = setTimeout(() => {
      if (!this.previewReady) this.zone.run(() => (this.previewStalled = true));
    }, PREVIEW_READY_TIMEOUT_MS);
  }

  /** Loads the preview again (a build that was running, a browser that kept an old copy). */
  reloadPreview(): void {
    this.previewReady = false;
    this.previewStalled = false;
    this.flutterPreviewUrl = this.previewSource(Date.now());
  }

  private previewSource(cacheKey?: number): SafeResourceUrl {
    const url = cacheKey ? `/assets/mobile-preview/index.html?r=${cacheKey}` : '/assets/mobile-preview/index.html';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private readonly onWindowMessage = (event: MessageEvent): void => {
    const frame = this.flutterPreview?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    let data: any = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (data?.type === PREVIEW_READY_MESSAGE) {
      this.zone.run(() => {
        this.previewReady = true;
        this.previewStalled = false;
      });
      if (this.previewWatchdog) clearTimeout(this.previewWatchdog);
      this.sendThemeToFlutter();
    }
  };

  private sendThemeToFlutter(): void {
    const target = this.flutterPreview?.nativeElement?.contentWindow;
    if (!target || !this.selectedTheme) return;

    const previewTheme = {
      ...this.selectedTheme,
      mobileLogoUrl: this.getLogoPreviewUrl(this.selectedTheme.mobileLogoUrl),
      lang: this.translate.currentLang === 'en' ? 'en' : 'fr',
    };

    target.postMessage(JSON.stringify({ type: PREVIEW_THEME_MESSAGE, theme: previewTheme }), window.location.origin);
  }

  private fitPhone(stage: HTMLElement): void {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width <= 0) return;
    const scale = Math.min(1, width / PHONE_WIDTH, height > 0 ? height / PHONE_HEIGHT : 1);
    this.host.nativeElement.style.setProperty('--phone-scale', (Math.floor(scale * 1000) / 1000).toString());
  }

  /** The API answers with a signed URL; a relative one (older theme, signing failure) is completed with the API base. */
  getLogoPreviewUrl(url?: string): string {
    const value = (url || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;

    const apiBase = environment.baseApiUrl.replace(/\/$/, '');
    return value.startsWith('/') ? `${apiBase}${value}` : `${apiBase}/${value}`;
  }

  // --- loading -------------------------------------------------------------------------------------------------------

  /**
   * The theme the clients' app shows for this coach: their own, or the platform theme while they have none (saving it
   * then creates their own copy). fromSnapshot: the theme of the last visit is shown at once, then replaced by the
   * fresh answer unless the coach already changed something.
   */
  loadTheme(fromSnapshot = false): void {
    this.error = null;
    if (fromSnapshot && this.themeService.currentSnapshot) {
      this.showTheme(this.themeService.currentSnapshot);
    }
    const shown = JSON.stringify(this.selectedTheme);
    this.loading = true;

    this.themeService
      .getCurrent(true)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (theme) => {
          if (JSON.stringify(this.selectedTheme) === shown) this.showTheme(theme);
        },
        error: (failure) => {
          if (failure?.status === 404) {
            this.selectedTheme = this.createDefaultTheme();
            this.selectedPreset = this.presets[0].name;
            this.error = this.translate.instant('NO_THEME_FOUND_HINT');
          } else {
            this.error = this.extractError(failure);
          }
          this.sendThemeToFlutter();
        },
      });
  }

  private showTheme(theme: AppThemeColors): void {
    this.selectedTheme = this.normalizeTheme(theme);
    this.selectedPreset = this.presets.find((preset) => this.sameColors(preset, this.selectedTheme))?.name ?? '';
    this.sendThemeToFlutter();
  }

  // --- saving --------------------------------------------------------------------------------------------------------

  saveAndUseTheme(): void {
    if (this.brandingLocked || this.saving) return;
    this.error = null;
    this.success = null;
    this.normalizeAllColors();

    if (!this.selectedTheme.name?.trim()) {
      this.error = this.translate.instant('THEME_NAME_REQUIRED');
      return;
    }

    const invalid = this.controls.find((control) => !this.isValidHex(this.getColor(control.key)));
    if (invalid) {
      this.error = this.translate.instant('INVALID_HEX_COLOR', { field: this.translate.instant(invalid.label) });
      return;
    }

    this.saving = true;

    // active: the API makes it the coach's current theme (and the coach's own copy when it was a platform theme).
    const payload: AppThemeColors = { ...this.selectedTheme, name: this.selectedTheme.name.trim(), active: true };
    const request$ = payload.id ? this.themeService.update(payload.id, payload) : this.themeService.create(payload);

    request$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (saved) => {
        this.themeService.currentSnapshot = saved;
        this.showTheme(saved);
        this.flash(this.translate.instant('THEME_SAVED_APPLIED'));
      },
      error: (err) => (this.error = this.extractError(err)),
    });
  }

  // --- logo ----------------------------------------------------------------------------------------------------------

  onMobileLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be picked again after an error
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      this.error = this.translate.instant('LOGO_FILE_TYPES_ERROR');
      return;
    }

    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      this.error = this.translate.instant('LOGO_SIZE_ERROR', { size: maxSizeMb });
      return;
    }

    this.uploadingLogo = true;
    this.error = null;
    this.success = null;

    this.themeService
      .uploadMobileLogo(file)
      .pipe(finalize(() => (this.uploadingLogo = false)))
      .subscribe({
        next: (res) => {
          this.selectedTheme = {
            ...this.selectedTheme,
            mobileLogoUrl: res.url,
            mobileLogoPath: res.objectPath ?? this.selectedTheme.mobileLogoPath,
          };
          this.flash(this.translate.instant('LOGO_UPLOADED_SUCCESS'));
          this.sendThemeToFlutter();
        },
        error: (err) => (this.error = this.extractError(err)),
      });
  }

  removeMobileLogo(): void {
    this.selectedTheme = { ...this.selectedTheme, mobileLogoUrl: undefined, mobileLogoPath: undefined };
    this.flash(this.translate.instant('LOGO_REMOVED_SUCCESS'));
    this.error = null;
    this.sendThemeToFlutter();
  }

  // --- colors --------------------------------------------------------------------------------------------------------

  applyPreset(preset: AppThemeColors): void {
    this.selectedPreset = preset.name;
    this.selectedTheme = this.withColorsOf(this.selectedTheme, preset);
    this.success = null;
    this.error = null;
    this.sendThemeToFlutter();
  }

  resetToDefaultColors(): void {
    const defaults = this.presets[0];
    this.selectedPreset = defaults.name;
    this.selectedTheme = this.withColorsOf(this.selectedTheme, defaults);
    this.flash(this.translate.instant('DEFAULT_COLORS_RESTORED'));
    this.error = null;
    this.sendThemeToFlutter();
  }

  getColor(key: ColorField): string {
    return this.selectedTheme[key] || '#000000';
  }

  setColor(key: ColorField, value: string): void {
    this.selectedTheme = { ...this.selectedTheme, [key]: (value || '').toUpperCase() };
    this.selectedPreset = this.presets.find((preset) => this.sameColors(preset, this.selectedTheme))?.name ?? '';
    this.sendThemeToFlutter();
  }

  /** What the color picker can show: a 6-digit color (an 8-digit one keeps its alpha in the text field only). */
  pickerValue(key: ColorField): string {
    const value = this.getColor(key).trim();
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : /^#[0-9A-Fa-f]{8}$/.test(value) ? `#${value.slice(3)}` : '#000000';
  }

  normalizeHex(key: ColorField): void {
    this.selectedTheme = { ...this.selectedTheme, [key]: this.normalizeHexValue(this.getColor(key)) };
    this.sendThemeToFlutter();
  }

  trackByControl(_: number, control: ColorControl): string {
    return control.key;
  }

  trackByPreset(_: number, preset: AppThemeColors): string {
    return preset.name;
  }

  // --- helpers -------------------------------------------------------------------------------------------------------

  /** The theme with the colors of another one; name, logo and identity are kept. */
  private withColorsOf(theme: AppThemeColors, colors: AppThemeColors): AppThemeColors {
    const next: AppThemeColors = { ...theme };
    for (const control of this.controls) {
      next[control.key] = colors[control.key];
    }
    return next;
  }

  private sameColors(a: AppThemeColors, b: AppThemeColors): boolean {
    return this.controls.every(
      (control) => (a[control.key] || '').toUpperCase() === (b[control.key] || '').toUpperCase()
    );
  }

  private flash(message: string): void {
    this.success = message;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.zone.run(() => (this.success = null)), 5000);
  }

  private createDefaultTheme(): AppThemeColors {
    return {
      name: 'YoCoach Default Blue',
      active: false,

      mobileLogoUrl: undefined,
      mobileLogoPath: undefined,

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
    const normalizedTheme: AppThemeColors = { ...this.selectedTheme };
    for (const control of this.controls) {
      normalizedTheme[control.key] = this.normalizeHexValue(normalizedTheme[control.key]);
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
    return /^#?[0-9A-Fa-f]{6}$/.test(value.trim()) || /^#?[0-9A-Fa-f]{8}$/.test(value.trim());
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
