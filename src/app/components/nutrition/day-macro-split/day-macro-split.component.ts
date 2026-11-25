import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MealDay } from '@shared/models/MealPlan';
import { MacroGrams, defaultMealShares, splitDayMacros } from '../nutrition-scale';

type MacroKey = keyof MacroGrams;

/**
 * « Total du jour » of the macros-per-meal editor: the coach types the day's P/C/F once and splits them over the
 * meals of the open day with the default shares (nutrition-scale.ts). « Copier le jour » then spreads the day.
 */
@Component({
  selector: 'app-day-macro-split',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dms" *ngIf="day">
      <div class="dms__head">
        <span class="dms__title">{{ 'MACRO_SPLIT.TITLE' | translate }}</span>
        <small class="dms__shares" *ngIf="mealCount">{{ 'MACRO_SPLIT.SHARES' | translate:{ shares: sharesLabel } }}</small>
      </div>
      <div class="dms__row">
        <label class="dms__field" *ngFor="let field of fields">
          <span>{{ field.label | translate }}</span>
          <span class="dms__input">
            <input type="number" min="0" step="1" inputmode="numeric" [disabled]="locked"
                   [ngModel]="value(field.key)" (ngModelChange)="typed[field.key] = $event" />
            <em>g</em>
          </span>
        </label>
        <button type="button" class="dms__btn" [disabled]="!canSplit" (click)="split()"
                [title]="(locked ? 'MACRO_SPLIT.LOCKED' : 'MACRO_SPLIT.HINT') | translate">
          {{ (mealCount === 1 ? 'MACRO_SPLIT.BUTTON_ONE' : 'MACRO_SPLIT.BUTTON') | translate:{ count: mealCount } }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin: 0 0 14px; }
    .dms { padding: 12px 14px; border: 1px dashed light-dark(#d8dde6, #373b42); border-radius: 12px; background: light-dark(#f8fafc, #171a1f); }
    .dms__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; margin-bottom: 8px; }
    .dms__title { color: light-dark(#0f172a, #e8ecf6); font-size: 14px; font-weight: 700; }
    .dms__shares { color: light-dark(#64748b, #a5abb4); font-size: 12px; font-weight: 600; }
    .dms__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: end; gap: 10px; }
    .dms__field { display: grid; gap: 4px; margin: 0; min-width: 0; }
    .dms__field > span:first-child { color: light-dark(#64748b, #a5abb4); font-size: 12px; font-weight: 600; }
    .dms__input { position: relative; display: block; }
    .dms__input input { width: 100%; height: 38px; padding: 0 26px 0 10px; border: 1px solid light-dark(#d8dde6, #373b42); border-radius: 8px;
      color: light-dark(#0f172a, #e8ecf6); background: light-dark(#fff, #1d2125); font: inherit; font-size: 14px; }
    .dms__input input:focus { border-color: #44b4df; outline: none; box-shadow: 0 0 0 3px rgba(68, 180, 223, 0.18); }
    .dms__input input:disabled { opacity: 0.6; }
    .dms__input em { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); color: light-dark(#64748b, #a5abb4);
      font-size: 12px; font-style: normal; }
    .dms__btn { height: 38px; padding: 0 14px; border: 1px solid light-dark(#0f172a, #e8ecf6); border-radius: 8px; color: light-dark(#0f172a, #e8ecf6);
      background: transparent; font: inherit; font-size: 13px; font-weight: 700; white-space: nowrap; cursor: pointer; }
    .dms__btn:hover:not(:disabled) { background: light-dark(#e8edf3, #292d31); }
    .dms__btn:disabled { opacity: 0.45; cursor: not-allowed; }
    @media (max-width: 640px) {
      .dms__row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .dms__btn { grid-column: 1 / -1; }
    }
  `],
})
export class DayMacroSplitComponent implements OnChanges {
  @Input() day: MealDay | null = null;
  /** The open day can no longer change: the fields and the button are off. */
  @Input() locked = false;
  @Output() splitDay = new EventEmitter<MacroGrams[]>();

  readonly fields: Array<{ key: MacroKey; label: string }> = [
    { key: 'proteinG', label: 'PROTEIN' },
    { key: 'carbsG', label: 'CARBS' },
    { key: 'fatG', label: 'FAT' },
  ];
  /** What the coach typed; an untouched field shows the current sum of the meals. */
  typed: Partial<Record<MacroKey, number | string | null>> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['day'] && changes['day'].previousValue !== changes['day'].currentValue) this.typed = {};
  }

  get mealCount(): number {
    return this.day?.meals?.length || 0;
  }

  get sharesLabel(): string {
    return defaultMealShares(this.mealCount).map((share) => `${Math.round(share * 10) / 10} %`).join(' · ');
  }

  /** The sum of the meals of the open day, to the gram. */
  private sum(key: MacroKey): number {
    return Math.round((this.day?.meals || []).reduce((total, meal) => total + (Number(meal.mealTargets?.[key]) || 0), 0));
  }

  value(key: MacroKey): number | string | null {
    const typed = this.typed[key];
    return typed === undefined ? this.sum(key) : typed;
  }

  private grams(key: MacroKey): number | null {
    const raw = this.value(key);
    if (raw === null || raw === '') return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  get canSplit(): boolean {
    if (this.locked || !this.mealCount) return false;
    const values = this.fields.map((field) => this.grams(field.key));
    return values.every((value) => value !== null) && values.some((value) => (value as number) > 0);
  }

  split(): void {
    if (!this.canSplit) return;
    const total: MacroGrams = { proteinG: this.grams('proteinG') || 0, carbsG: this.grams('carbsG') || 0, fatG: this.grams('fatG') || 0 };
    this.splitDay.emit(splitDayMacros(total, this.mealCount));
    this.typed = {};
  }
}
