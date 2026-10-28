import { Injectable } from '@angular/core';
import { AppThemeColorsService } from './app-theme-colors.service';
import { AppThemeColors } from '../models/app-theme-colors.model';

/**
 * Applies the coach's app theme to the client pages, like the mobile client shell
 * (AppThemeLoader(useBackendTheme: true)). Only the --yc-* variables of client-ui.scss change,
 * so the coach pages and the sidebar keep their own look.
 */
@Injectable({ providedIn: 'root' })
export class ClientThemeService {
  private requested = false;

  private static readonly VARIABLES: Partial<Record<keyof AppThemeColors, string>> = {
    primary: '--yc-primary',
    secondary: '--yc-secondary',
    background: '--yc-background',
    surface: '--yc-surface',
    cardSurface: '--yc-card-surface',
    textPrimary: '--yc-text-primary',
    textSecondary: '--yc-text-secondary',
    textHint: '--yc-text-hint',
    success: '--yc-success',
    successLight: '--yc-success-light',
    error: '--yc-error',
    errorLight: '--yc-error-light',
    warning: '--yc-warning',
    warningLight: '--yc-warning-light',
    border: '--yc-border',
    divider: '--yc-divider',
    buttonText: '--yc-button-text',
    selectedTabBg: '--yc-selected-tab-bg',
    activeBg: '--yc-active-bg',
  };

  constructor(private themes: AppThemeColorsService) {}

  /** Loads the theme once per session; the defaults of client-ui.scss stay when there is none. */
  ensureLoaded(): void {
    if (this.requested) return;
    this.requested = true;
    if (this.themes.currentSnapshot) this.apply(this.themes.currentSnapshot);
    this.themes.getCurrent(true).subscribe({
      next: (theme) => this.apply(theme),
      error: () => (this.requested = false),
    });
  }

  apply(theme: Partial<AppThemeColors> | null | undefined): void {
    if (!theme) return;
    const root = document.documentElement.style;
    for (const [key, variable] of Object.entries(ClientThemeService.VARIABLES)) {
      const value = this.normalize((theme as Record<string, unknown>)[key]);
      if (value && variable) root.setProperty(variable, value);
    }
  }

  /** Same formats as AppColors._parseHex on mobile: #RRGGBB or #AARRGGBB. */
  private normalize(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const hex = value.trim().replace(/#/g, '');
    if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`;
    if (/^[0-9a-f]{8}$/i.test(hex)) return `#${hex.slice(2)}${hex.slice(0, 2)}`;
    return null;
  }
}
