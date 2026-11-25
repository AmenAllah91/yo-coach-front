import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MealDay } from '@shared/models/MealPlan';
import { ToastService } from 'app/service/toast.service';
import {
  MAX_SCALE_FACTOR,
  MIN_SCALE_FACTOR,
  NutritionScaleMode,
  averageDayCalories,
  nutritionDayLocked,
  scalableDays,
  scaleChangeLabel,
  scaleDays,
  scaleFactor,
  scaleFactorAllowed,
} from '../nutrition-scale';

/**
 * « Adapter les calories » of the 3 nutrition editors: the coach types the kcal per day wanted, every day still
 * editable gets the same factor. Nothing is saved: the editor shows « Modifications non enregistrées ».
 */
@Component({
  selector: 'app-scale-calories-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="scd" role="dialog" aria-modal="true" aria-labelledby="scd-title" (keydown.escape)="onEscape($event)">
      <div class="scd__backdrop" (click)="closed.emit()"></div>
      <form class="scd__panel" (ngSubmit)="apply()">
        <header class="scd__head">
          <h3 id="scd-title">{{ 'NUTRITION_SCALE.TITLE' | translate }}</h3>
          <button type="button" class="scd__close" [attr.aria-label]="'CLOSE' | translate" (click)="closed.emit()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div class="scd__body" *ngIf="average > 0; else nothing">
          <p class="scd__current">
            {{ (targets.length === 1 ? 'NUTRITION_SCALE.CURRENT_ONE' : 'NUTRITION_SCALE.CURRENT') | translate:{ kcal: format(average), count: targets.length } }}
          </p>
          <label class="scd__field">
            <span>{{ 'NUTRITION_SCALE.TARGET' | translate }}</span>
            <span class="scd__input">
              <input #targetInput type="number" name="target" min="0" step="10" inputmode="numeric" [(ngModel)]="target" />
              <em>kcal</em>
            </span>
          </label>
          <p class="scd__change" *ngIf="factor !== null && allowed" role="status">
            {{ 'NUTRITION_SCALE.CHANGE' | translate:{ change: change } }}
          </p>
          <p class="scd__error" *ngIf="factor !== null && !allowed" role="alert">
            {{ 'NUTRITION_SCALE.OUT_OF_RANGE' | translate:{ min: format(minKcal), max: format(maxKcal) } }}
          </p>
          <p class="scd__hint">{{ 'NUTRITION_SCALE.HINT' | translate }}</p>
          <p class="scd__hint" *ngIf="lockedCount">{{ 'NUTRITION_SCALE.LOCKED_HINT' | translate }}</p>
        </div>
        <ng-template #nothing>
          <div class="scd__body"><p class="scd__current">{{ 'NUTRITION_SCALE.NOTHING' | translate }}</p></div>
        </ng-template>

        <footer class="scd__foot">
          <button type="button" class="scd__btn scd__btn--ghost" (click)="closed.emit()">{{ 'CANCEL' | translate }}</button>
          <button type="submit" class="scd__btn scd__btn--primary" *ngIf="average > 0" [disabled]="!allowed">
            {{ 'NUTRITION_SCALE.APPLY' | translate }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .scd { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .scd__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
    .scd__panel { position: relative; display: flex; flex-direction: column; width: min(440px, 100%); max-height: calc(100vh - 48px);
      overflow: auto; margin: 0; border-radius: 16px; background: light-dark(#fff, #1d2125); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25); }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .scd__head { display: flex; align-items: center; gap: 10px; padding: 18px 22px; border-bottom: 1px solid light-dark(#e6e9ee, #34383e); }
    .scd__head h3 { flex: 1; margin: 0; color: light-dark(#0f172a, #e8ecf6); font-size: 19px; font-weight: 700; }
    .scd__close { display: grid; width: 36px; height: 36px; padding: 0; place-items: center; border: 1px solid light-dark(#e6e9ee, #34383e);
      border-radius: 10px; color: light-dark(#0f172a, #e8ecf6); background: transparent; cursor: pointer; }
    .scd__body { display: grid; gap: 12px; padding: 18px 22px; }
    .scd__current { margin: 0; color: light-dark(#0f172a, #e8ecf6); font-size: 14px; font-weight: 600; }
    .scd__field { display: grid; gap: 8px; margin: 0; }
    .scd__field > span:first-child { color: light-dark(#0f172a, #e8ecf6); font-size: 14px; font-weight: 700; }
    .scd__input { position: relative; display: block; }
    .scd__input input { width: 100%; height: 46px; padding: 0 56px 0 14px; border: 1px solid light-dark(#d8dde6, #373b42); border-radius: 10px;
      color: light-dark(#0f172a, #e8ecf6); background: light-dark(#fff, #1d2125); font: inherit; font-size: 16px; }
    .scd__input input:focus { border-color: #44b4df; outline: none; box-shadow: 0 0 0 3px rgba(68, 180, 223, 0.18); }
    .scd__input em { position: absolute; top: 50%; right: 14px; transform: translateY(-50%); color: light-dark(#64748b, #a5abb4);
      font-size: 13px; font-style: normal; font-weight: 600; }
    .scd__change { margin: 0; color: light-dark(#0f766e, #5eead4); font-size: 14px; font-weight: 700; }
    .scd__error { margin: 0; color: light-dark(#ef4444, #ff7a72); font-size: 13px; font-weight: 600; }
    .scd__hint { margin: 0; color: light-dark(#64748b, #a5abb4); font-size: 13px; line-height: 1.45; }
    .scd__foot { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 14px 22px;
      border-top: 1px solid light-dark(#e6e9ee, #34383e); }
    .scd__btn { height: 44px; padding: 0 18px; border: 1px solid transparent; border-radius: 12px; font: inherit; font-size: 15px;
      font-weight: 700; cursor: pointer; }
    .scd__btn--ghost { border-color: light-dark(#e6e9ee, #34383e); color: light-dark(#0f172a, #e8ecf6); background: light-dark(#f1f5f9, #15181d); }
    .scd__btn--primary { color: #fff; background: #0f172a; }
    .scd__btn--primary:disabled { opacity: 0.45; cursor: not-allowed; }
    @media (max-width: 640px) {
      .scd { align-items: flex-end; padding: 0; }
      .scd__panel { width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0; }
    }
  `],
})
export class ScaleCaloriesDialogComponent implements OnInit, AfterViewInit {
  @Input() days: MealDay[] = [];
  @Input() mode: NutritionScaleMode = 'FOODS';
  /** A client's plan: its past and followed days keep their values. */
  @Input() clientPlan = false;
  @Output() closed = new EventEmitter<void>();
  /** The days changed (the editor recomputes their totals). */
  @Output() scaled = new EventEmitter<MealDay[]>();

  targets: MealDay[] = [];
  lockedCount = 0;
  average = 0;
  target: number | null = null;

  @ViewChild('targetInput') private targetInput?: ElementRef<HTMLInputElement>;

  constructor(private toast: ToastService, private translate: TranslateService) {}

  ngOnInit(): void {
    const locked = (day: MealDay) => nutritionDayLocked(this.clientPlan, day);
    this.targets = scalableDays(this.days, this.mode, locked);
    this.lockedCount = (this.days || []).filter((day) => !day.cheatMeal && locked(day)).length;
    this.average = averageDayCalories(this.targets, this.mode);
    this.target = this.average || null;
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.targetInput?.nativeElement.select());
  }

  get factor(): number | null {
    return scaleFactor(this.target, this.average);
  }

  get allowed(): boolean {
    return scaleFactorAllowed(this.factor);
  }

  get change(): string {
    return scaleChangeLabel(this.factor);
  }

  get minKcal(): number {
    return Math.ceil(this.average * MIN_SCALE_FACTOR);
  }

  get maxKcal(): number {
    return Math.floor(this.average * MAX_SCALE_FACTOR);
  }

  format(value: number): string {
    const lang = String(this.translate.currentLang || '').toLowerCase();
    return new Intl.NumberFormat(lang.startsWith('fr') ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  }

  onEscape(event: Event): void {
    // The editor's own Escape (calendar day window) stays as it is.
    event.stopPropagation();
    this.closed.emit();
  }

  apply(): void {
    const factor = this.factor;
    if (factor === null || !this.allowed || !this.targets.length) return;
    const changed = scaleDays(this.targets, this.mode, factor);
    this.scaled.emit(changed);
    this.toast.success(this.translate.instant('NUTRITION_SCALE.DONE', { kcal: this.format(Number(this.target)) }));
  }
}
