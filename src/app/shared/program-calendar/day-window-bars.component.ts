import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CalendarDayWindow } from './day-window';

const BAR_STYLES = `
  :host { display: block; position: sticky; z-index: 40; background: light-dark(#fff, #1d2125); }
  .dw-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
  .dw-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-align: center; font-size: 14px; font-weight: 700;
    color: light-dark(#0f172a, #e8ecf6); text-overflow: ellipsis; white-space: nowrap; }
  .dw-nav { display: inline-flex; align-items: center; gap: 4px; min-height: 34px; padding: 0 10px; flex: 0 0 auto;
    border: 1px solid light-dark(#dbe3ec, #353e47); border-radius: 8px; background: light-dark(#fff, #1d2125); color: light-dark(#334155, #d1d7e0);
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .dw-nav:hover:not(:disabled) { border-color: #44b4df; color: #44b4df; }
  .dw-nav:disabled { opacity: .4; cursor: default; }
  .dw-nav:focus-visible, .dw-btn:focus-visible { outline: 2px solid #44b4df; outline-offset: 2px; }
  .dw-close { width: 34px; padding: 0; justify-content: center; margin-left: 4px; }
  .dw-ico { width: 16px; height: 16px; }
  .dw-foot { justify-content: flex-end; gap: 10px; padding: 10px 16px; }
  .dw-status { flex: 1 1 auto; min-width: 0; display: inline-flex; align-items: center; overflow: hidden; font-size: 12.5px;
    color: light-dark(#64748b, #a5abb4); text-overflow: ellipsis; white-space: nowrap; }
  .dw-status.is-error { color: light-dark(#dc2626, #ff7a72); }
  .dw-status.is-unsaved { color: light-dark(#b45f00, #f0a54a); font-weight: 600; }
  .dw-dot { display: inline-block; flex: 0 0 auto; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: #e08a00; }
  .dw-btn { position: relative; min-height: 38px; padding: 0 18px; border: 1px solid light-dark(#cbd6e2, #353e47); border-radius: 8px;
    background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .dw-btn--primary { border-color: light-dark(#0f172a, #e8ecf6); background: light-dark(#0f172a, #e8ecf6); color: light-dark(#fff, #0f172a); }
  .dw-btn--primary.has-changes::after { content: ''; position: absolute; top: -4px; right: -4px; width: 11px; height: 11px; border-radius: 50%;
    background: #e08a00; box-shadow: 0 0 0 2px light-dark(#fff, #1d2125); }
  .dw-btn--danger { border-color: light-dark(#f0b4b4, #6b2c2c); color: light-dark(#c62828, #ff867b); }
  .dw-btn--danger:hover { background: light-dark(#fdecea, #412826); }
  .dw-btn:disabled { opacity: .6; cursor: default; }
  .dw-ask { flex-wrap: wrap; background: light-dark(#fff8ec, #2c2416); }
  .dw-asktext { flex: 1 1 260px; display: inline-flex; align-items: center; min-width: 0; font-size: 13.5px; font-weight: 600;
    color: light-dark(#8a4b00, #f0b45f); }
  @media (max-width: 640px) {
    .dw-navlabel { display: none; }
    .dw-ask .dw-btn { flex: 1 1 auto; padding: 0 10px; }
  }
`;

/** The top of the day window: previous / next day, its title, « Tout le programme », ✕. */
@Component({
  selector: 'app-day-window-head',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="dw-bar">
      <button type="button" class="dw-nav" [disabled]="!win.canPrev" (click)="win.step(-1)">
        <i-feather name="chevron-left" class="dw-ico"></i-feather><span class="dw-navlabel">{{ ht('Previous day', 'Jour précédent') }}</span>
      </button>
      <strong class="dw-title">{{ win.title }}</strong>
      <button type="button" class="dw-nav" [disabled]="!win.canNext" (click)="win.step(1)">
        <span class="dw-navlabel">{{ ht('Next day', 'Jour suivant') }}</span><i-feather name="chevron-right" class="dw-ico"></i-feather>
      </button>
      <button type="button" class="dw-nav" (click)="win.whole()" [title]="ht('See the whole program, on this day', 'Voir tout le programme, sur ce jour')">
        <i-feather name="list" class="dw-ico"></i-feather><span class="dw-navlabel">{{ ht('Whole program', 'Tout le programme') }}</span>
      </button>
      <button type="button" class="dw-nav dw-close" [attr.aria-label]="ht('Close', 'Fermer')" [title]="ht('Close', 'Fermer')" (click)="win.requestClose()">
        <i-feather name="x" class="dw-ico"></i-feather>
      </button>
    </div>
  `,
  styles: [BAR_STYLES + ' :host { top: 0; border-bottom: 1px solid light-dark(#e5e7eb, #34393f); }'],
})
export class DayWindowHeadComponent {
  @Input({ required: true }) win!: CalendarDayWindow<unknown>;
  private readonly translate = inject(TranslateService);
  ht(en: string, fr: string): string { return this.translate.currentLang === 'en' ? en : fr; }
}

/** The bottom of the day window: the save state, « Fermer », « Enregistrer »; the question when closing with changes. */
@Component({
  selector: 'app-day-window-foot',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="dw-bar dw-foot dw-ask" *ngIf="win.ask; else plain" role="alertdialog" [attr.aria-label]="ht('Unsaved changes', 'Changements non enregistrés')">
      <span class="dw-asktext"><span class="dw-dot" aria-hidden="true"></span>{{ ht('You changed this program without saving.', 'Vous avez modifié le programme sans enregistrer.') }}</span>
      <button type="button" class="dw-btn dw-btn--danger" (click)="win.discard()">{{ ht('Discard changes', 'Abandonner les changements') }}</button>
      <button type="button" class="dw-btn" (click)="win.ask = false">{{ ht('Keep editing', 'Continuer') }}</button>
      <button type="button" class="dw-btn dw-btn--primary" [disabled]="saving" (click)="win.saveAndClose()">{{ ht('Save and close', 'Enregistrer et fermer') }}</button>
    </div>
    <ng-template #plain>
      <div class="dw-bar dw-foot">
        <span class="dw-status" [class.is-error]="!saving && error" [class.is-unsaved]="!saving && !error && unsaved" role="status" aria-live="polite">
          <ng-container *ngIf="saving">{{ 'SAVING' | translate }}</ng-container>
          <ng-container *ngIf="!saving && error">{{ error }}</ng-container>
          <ng-container *ngIf="!saving && !error && unsaved"><span class="dw-dot" aria-hidden="true"></span>{{ ht('Unsaved changes', 'Modifications non enregistrées') }}</ng-container>
          <ng-container *ngIf="!saving && !error && !unsaved && savedAt">✓ {{ 'WORKOUT_SAVED' | translate }} {{ savedAt | date:'HH:mm' }}</ng-container>
        </span>
        <button type="button" class="dw-btn" (click)="win.requestClose()">{{ ht('Close', 'Fermer') }}</button>
        <button type="button" class="dw-btn dw-btn--primary" [class.has-changes]="unsaved && !saving" [disabled]="saving" (click)="win.saveInWindow()">
          {{ (saving ? 'SAVING' : 'SAVE') | translate }}
        </button>
      </div>
    </ng-template>
  `,
  styles: [BAR_STYLES + ' :host { bottom: 0; margin-top: auto; border-top: 1px solid light-dark(#e5e7eb, #34393f); }'],
})
export class DayWindowFootComponent {
  @Input({ required: true }) win!: CalendarDayWindow<unknown>;
  @Input() saving = false;
  @Input() error: string | null | undefined = '';
  @Input() unsaved = false;
  @Input() savedAt: Date | null | undefined = null;
  private readonly translate = inject(TranslateService);
  ht(en: string, fr: string): string { return this.translate.currentLang === 'en' ? en : fr; }
}

/** « Liste | Calendrier »: the two ways to see a program, in the editor's toolbar. */
@Component({
  selector: 'app-view-switch',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="vs" role="group" [attr.aria-label]="ht('Display', 'Affichage')">
      <button type="button" class="vs__btn" [class.is-on]="mode === 'list'" [attr.aria-pressed]="mode === 'list'" (click)="pick('list')" [title]="ht('List', 'Liste')">
        <i-feather name="list" class="vs__ico"></i-feather><span class="vs__label">{{ ht('List', 'Liste') }}</span>
      </button>
      <button type="button" class="vs__btn" [class.is-on]="mode === 'calendar'" [attr.aria-pressed]="mode === 'calendar'" (click)="pick('calendar')" [title]="ht('Calendar', 'Calendrier')">
        <i-feather name="calendar" class="vs__ico"></i-feather><span class="vs__label">{{ ht('Calendar', 'Calendrier') }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; flex: 0 0 auto; }
    .vs { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid light-dark(#cbd6e2, #353e47); border-radius: 9px; background: light-dark(#f1f5f9, #171a1e); }
    .vs__btn { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent;
      color: light-dark(#475569, #bfc5ce); font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; }
    .vs__ico { width: 15px; height: 15px; }
    .vs__btn:hover { color: #44b4df; }
    .vs__btn.is-on { background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); box-shadow: 0 1px 2px rgba(15, 23, 42, .12); }
    .vs__btn.is-on .vs__ico { color: #44b4df; }
    .vs__btn:focus-visible { outline: 2px solid #44b4df; outline-offset: 1px; }
    @media (max-width: 900px) { .vs__label { display: none; } .vs__btn { padding: 0 8px; } }
  `],
})
export class ViewSwitchComponent {
  @Input() mode: 'list' | 'calendar' = 'list';
  @Output() modeChange = new EventEmitter<'list' | 'calendar'>();
  private readonly translate = inject(TranslateService);
  ht(en: string, fr: string): string { return this.translate.currentLang === 'en' ? en : fr; }
  pick(mode: 'list' | 'calendar'): void {
    if (mode !== this.mode) this.modeChange.emit(mode);
  }
}

/** The editor's choices kept in this browser: the view (Liste / Calendrier) and the cards' content. */
export const CALENDAR_PREFS = {
  view(key: string): 'list' | 'calendar' {
    try { return localStorage.getItem(key) === 'calendar' ? 'calendar' : 'list'; } catch { return 'list'; }
  },
  setView(key: string, mode: 'list' | 'calendar'): void {
    try { localStorage.setItem(key, mode); } catch { /* private browsing: kept for this page */ }
  },
  detailed(key: string): boolean {
    try { return localStorage.getItem(key) !== '1'; } catch { return true; }
  },
  setDetailed(key: string, on: boolean): void {
    try { localStorage.setItem(key, on ? '0' : '1'); } catch { /* idem */ }
  },
};
