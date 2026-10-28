import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Light / dark appearance of the whole app, chosen by each user on their device (same key as the
 * inline script of index.html, which applies it before Angular starts so there is no white flash).
 *
 * The colors follow `color-scheme`: the styles use light-dark(light, dark), Bootstrap reads
 * data-bs-theme and the client pages get the dark version of their coach's theme (ClientThemeService).
 */
@Injectable({ providedIn: 'root' })
export class ThemeModeService {
  static readonly STORAGE_KEY = 'yc-theme-mode';

  private readonly media = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  private readonly modeSubject = new BehaviorSubject<ThemeMode>(this.readStoredMode());
  private readonly systemDark = new BehaviorSubject<boolean>(!!this.media?.matches);

  readonly mode$ = this.modeSubject.asObservable();
  /** True when the dark colors are shown (chosen, or "system" on a dark device). */
  readonly dark$ = new BehaviorSubject<boolean>(this.resolve());

  constructor() {
    this.media?.addEventListener?.('change', (event) => {
      this.systemDark.next(event.matches);
      this.refresh();
    });
    // Another tab changed the choice.
    window.addEventListener('storage', (event) => {
      if (event.key === ThemeModeService.STORAGE_KEY) {
        this.modeSubject.next(this.readStoredMode());
        this.refresh();
      }
    });
    this.refresh();
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  get isDark(): boolean {
    return this.dark$.value;
  }

  setMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(ThemeModeService.STORAGE_KEY, mode);
    } catch {
      // Private browsing: the choice still applies to this tab.
    }
    this.modeSubject.next(mode);
    this.refresh();
  }

  /** Quick switch of the header button: to the opposite of what is shown. */
  toggle(): void {
    this.setMode(this.isDark ? 'light' : 'dark');
  }

  private resolve(): boolean {
    const mode = this.modeSubject.value;
    return mode === 'dark' || (mode === 'system' && this.systemDark.value);
  }

  private refresh(): void {
    const dark = this.resolve();
    const root = document.documentElement;
    // Smooth color change, without animating the first paint or every hover of the page.
    root.classList.add('yc-theme-switching');
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15181c' : '#ffffff');
    window.setTimeout(() => root.classList.remove('yc-theme-switching'), 320);
    if (this.dark$.value !== dark) this.dark$.next(dark);
  }

  private readStoredMode(): ThemeMode {
    try {
      const value = localStorage.getItem(ThemeModeService.STORAGE_KEY);
      return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
    } catch {
      return 'system';
    }
  }
}
