import { Injectable } from '@angular/core';
import { AppThemeColorsService } from './app-theme-colors.service';
import { AppThemeColors } from '../models/app-theme-colors.model';
import { ThemeModeService } from './theme-mode.service';
import { darkThemeColors, parseHexColor, toHex } from '../theme/dark-palette';

/**
 * Applies the coach's app theme to the client pages, like the mobile client shell
 * (AppThemeLoader(useBackendTheme: true)). Only the --yc-* variables of client-ui.scss change,
 * so the coach pages and the sidebar keep their own look.
 *
 * In dark mode the client gets the dark version of the same theme (darkThemeColors): the coach's
 * brand colors stay, the neutrals become dark surfaces tinted with the primary color.
 */
@Injectable({ providedIn: 'root' })
export class ClientThemeService {
  private requested = false;
  private theme: Partial<AppThemeColors> | null = null;

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

  constructor(private themes: AppThemeColorsService, private mode: ThemeModeService) {
    this.mode.dark$.subscribe(() => this.render());
  }

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
    this.theme = theme;
    this.render();
  }

  private render(): void {
    if (!this.theme) return;
    const light: Record<string, string> = {};
    for (const key of Object.keys(ClientThemeService.VARIABLES)) {
      const rgb = parseHexColor((this.theme as Record<string, unknown>)[key] as string);
      if (rgb) light[key] = toHex(rgb);
    }
    const colors = this.mode.isDark ? darkThemeColors(light) : light;
    const root = document.documentElement.style;
    for (const [key, variable] of Object.entries(ClientThemeService.VARIABLES)) {
      const value = colors[key];
      if (value && variable) root.setProperty(variable, value);
    }
    if (this.mode.isDark && colors['divider']) root.setProperty('--yc-hairline', colors['divider']);
    else root.removeProperty('--yc-hairline');
  }
}
