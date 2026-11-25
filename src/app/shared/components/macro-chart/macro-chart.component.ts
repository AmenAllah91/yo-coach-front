import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

export type MacroKey = 'protein' | 'carbs' | 'fat';

interface DonutSegment {
  key: MacroKey;
  dash: string;
  offset: number;
}

interface MacroRow {
  key: MacroKey;
  label: string;
  grams: number;
  share: number;
  goal: number;
  /** 0..1, how much of the goal is eaten (capped at 1 for the ring). */
  ratio: number;
  over: number;
  dash: string;
}

const KCAL_PER_GRAM: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };
const LABELS: Record<MacroKey, string> = { protein: 'PROTEIN', carbs: 'CARBS', fat: 'FAT' };
const KEYS: MacroKey[] = ['protein', 'carbs', 'fat'];

/** Big ring: radius 48 in a 120 viewBox. Small macro rings: radius 22 in a 56 viewBox. */
const R_BIG = 48;
const C_BIG = 2 * Math.PI * R_BIG;
const R_SMALL = 22;
const C_SMALL = 2 * Math.PI * R_SMALL;

/**
 * Macros as a chart, like MyFitnessPal.
 * - `split`: a donut cut by each macro's share of the calories (protein and carbs 4 kcal/g, fat 9 kcal/g),
 *   the calories in the middle, a legend with grams and %. `compact` gives a small donut for meal cards.
 * - `progress`: eaten against the goal: a big calories ring and one small ring per macro.
 * The rings draw themselves when they appear and slide when a value changes (no motion if the user asked for less).
 */
@Component({
  selector: 'app-macro-chart',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './macro-chart.component.html',
  styleUrls: ['./macro-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MacroChartComponent implements AfterViewInit, OnDestroy {
  @Input() mode: 'split' | 'progress' = 'split';
  /** Small donut without legend (meal cards). */
  @Input() compact = false;
  @Input() legend = true;

  @Input() calories: number | null | undefined = 0;
  @Input() protein: number | null | undefined = 0;
  @Input() carbs: number | null | undefined = 0;
  @Input() fat: number | null | undefined = 0;

  @Input() goalCalories: number | null | undefined = 0;
  @Input() goalProtein: number | null | undefined = 0;
  @Input() goalCarbs: number | null | undefined = 0;
  @Input() goalFat: number | null | undefined = 0;

  readonly rBig = R_BIG;
  readonly cBig = C_BIG;
  readonly rSmall = R_SMALL;

  /** false until the first paint, so the rings grow from empty. */
  drawn = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly langSub: Subscription;
  private formatters = new Map<string, Intl.NumberFormat>();

  constructor(private readonly cdr: ChangeDetectorRef, private readonly translate: TranslateService) {
    // Numbers follow the app language (« 2 510 » and « 22,5 » in French), not the browser's.
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.formatters.clear();
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.timer = setTimeout(() => {
      this.drawn = true;
      this.cdr.markForCheck();
    }, 30);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.langSub.unsubscribe();
  }

  /** Number in the app language: 2 510 / 22,5 in French, 2,510 / 22.5 in English. */
  fmt(value: number | null | undefined, maxDigits = 0): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'fr';
    const key = `${lang}|${maxDigits}`;
    let formatter = this.formatters.get(key);
    if (!formatter) {
      try {
        formatter = new Intl.NumberFormat(lang, { maximumFractionDigits: maxDigits });
      } catch {
        formatter = new Intl.NumberFormat('fr', { maximumFractionDigits: maxDigits });
      }
      this.formatters.set(key, formatter);
    }
    const n = Number(value);
    return formatter.format(Number.isFinite(n) ? n : 0);
  }

  private num(value: number | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private grams(key: MacroKey): number {
    return this.num(key === 'protein' ? this.protein : key === 'carbs' ? this.carbs : this.fat);
  }

  private goal(key: MacroKey): number {
    return this.num(key === 'protein' ? this.goalProtein : key === 'carbs' ? this.goalCarbs : this.goalFat);
  }

  private get macroKcal(): number {
    return KEYS.reduce((sum, key) => sum + this.grams(key) * KCAL_PER_GRAM[key], 0);
  }

  /** Calories shown in the middle: the typed value, or 4/4/9 when it is missing. */
  get kcal(): number {
    return Math.round(this.num(this.calories) || this.macroKcal);
  }

  get goalKcal(): number {
    return Math.round(this.num(this.goalCalories));
  }

  get isEmpty(): boolean {
    return this.macroKcal <= 0;
  }

  share(key: MacroKey): number {
    const total = this.macroKcal;
    return total > 0 ? Math.round((this.grams(key) * KCAL_PER_GRAM[key] * 100) / total) : 0;
  }

  /** Donut pieces, with a small gap between them when there is more than one. */
  get segments(): DonutSegment[] {
    const total = this.macroKcal;
    if (total <= 0) return [];
    const parts = KEYS.map((key) => ({ key, part: (this.grams(key) * KCAL_PER_GRAM[key]) / total })).filter((p) => p.part > 0);
    const gap = parts.length > 1 ? 2.2 : 0;
    let start = 0;
    return parts.map(({ key, part }) => {
      const full = part * C_BIG;
      const len = this.drawn ? Math.max(full - gap, 0.5) : 0;
      const segment = { key, dash: `${len} ${C_BIG}`, offset: -start };
      start += full;
      return segment;
    });
  }

  get rows(): MacroRow[] {
    return KEYS.map((key) => {
      const grams = this.grams(key);
      const goal = this.goal(key);
      const ratio = goal > 0 ? Math.min(grams / goal, 1) : 0;
      return {
        key,
        label: LABELS[key],
        grams,
        share: this.share(key),
        goal,
        ratio,
        over: goal > 0 && grams > goal ? grams - goal : 0,
        dash: `${(this.drawn ? ratio : 0) * C_SMALL} ${C_SMALL}`,
      };
    });
  }

  /** Calories ring in progress mode. */
  get kcalDash(): string {
    const goal = this.goalKcal;
    const ratio = goal > 0 ? Math.min(this.kcal / goal, 1) : 0;
    return `${(this.drawn ? ratio : 0) * C_BIG} ${C_BIG}`;
  }

  get kcalLeft(): number {
    return this.goalKcal - this.kcal;
  }

  get kcalOver(): number {
    return Math.max(this.kcal - this.goalKcal, 0);
  }

  get ariaLabel(): string {
    const g = (key: MacroKey) => Math.round(this.grams(key));
    return `${this.kcal} kcal · P ${g('protein')} g · C ${g('carbs')} g · F ${g('fat')} g`;
  }

  trackByKey(_: number, item: { key: MacroKey }): MacroKey {
    return item.key;
  }
}
