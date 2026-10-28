import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutritionTotals } from './client-plan-utils';

/** Circumference of the calories ring (r = 47). */
const RING = 2 * Math.PI * 47;

/**
 * The day's calories in a ring (« 1 250 sur 2 000 »), protein, carbs and fat in bars next to it: the summary of the
 * nutrition day, also shown on the client's home (mobile NutritionMacrosSummary).
 */
@Component({
  selector: 'app-nutrition-macros-summary',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nms">
      <div class="nms__ring">
        <svg viewBox="0 0 104 104" aria-hidden="true">
          <circle cx="52" cy="52" r="47" class="nms__track"></circle>
          <circle cx="52" cy="52" r="47" class="nms__value" [attr.stroke-dasharray]="ring"
                  [attr.stroke-dashoffset]="ring * (1 - ratio(consumed.calories, target.calories))"></circle>
        </svg>
        <span class="nms__label">
          <strong>{{ number(consumed.calories) }}</strong>
          <small>{{ fr ? 'sur' : 'of' }} {{ number(target.calories) }}</small>
        </span>
      </div>
      <div class="nms__bars">
        <div *ngFor="let macro of macros" class="nms__bar">
          <div class="nms__row"><span>{{ macro.label }}</span><strong>{{ macro.value }} / {{ macro.goal }}g</strong></div>
          <div class="nms__track-bar"><span [style.width.%]="ratio(macro.value, macro.goal) * 100" [style.background]="macro.color"></span></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .nms { display: flex; align-items: center; gap: 18px; }
    .nms__ring { position: relative; flex: none; width: 104px; height: 104px; }
    .nms__ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .nms__ring circle { fill: none; stroke-width: 10; }
    .nms__track { stroke: #e8ebf0; }
    .nms__value { stroke: var(--yc-primary); stroke-linecap: round; transition: stroke-dashoffset 0.3s ease; }
    .nms__label {
      position: absolute; inset: 0 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; color: var(--yc-text-primary);
    }
    .nms__label strong { font-size: 22px; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px; white-space: nowrap; }
    .nms__label small { font-size: 12px; font-weight: 500; color: var(--yc-text-secondary); white-space: nowrap; }
    .nms__bars { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
    .nms__row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .nms__row span {
      flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--yc-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .nms__row strong { font-size: 12px; font-weight: 600; color: var(--yc-text-primary); white-space: nowrap; }
    .nms__track-bar { height: 6px; border-radius: 99px; background: #e8ebf0; overflow: hidden; }
    .nms__track-bar span { display: block; height: 100%; border-radius: inherit; transition: width 0.3s ease; }
    /* A narrow card (small phone): a smaller ring leaves room for the bars. */
    @container (max-width: 290px) {
      .nms { gap: 14px; }
      .nms__ring { width: 92px; height: 92px; }
      .nms__label strong { font-size: 20px; }
    }
  `],
})
export class NutritionMacrosSummaryComponent {
  @Input({ required: true }) consumed!: NutritionTotals;
  @Input({ required: true }) target!: NutritionTotals;
  @Input() fr = false;

  readonly ring = RING;

  get macros(): { label: string; value: number; goal: number; color: string }[] {
    return [
      { label: this.fr ? 'Protéines' : 'Protein', value: this.consumed.protein, goal: this.target.protein, color: 'var(--yc-primary)' },
      { label: this.fr ? 'Glucides' : 'Carbs', value: this.consumed.carbs, goal: this.target.carbs, color: '#D97706' },
      { label: this.fr ? 'Lipides' : 'Fat', value: this.consumed.fat, goal: this.target.fat, color: '#7455D9' },
    ];
  }

  ratio(value: number, goal: number): number { return goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0; }
  number(value: number): string { return new Intl.NumberFormat(this.fr ? 'fr-FR' : 'en-US').format(Math.round(value)); }
}
