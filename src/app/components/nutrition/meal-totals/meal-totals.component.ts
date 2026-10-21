import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Total nutrition of a meal or a recipe: calories first, then each macro with its share of the calories
 * (protein and carbs 4 kcal/g, fat 9 kcal/g) and a split bar, so the coach reads the balance at a glance.
 */
@Component({
  selector: 'app-meal-totals',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './meal-totals.component.html',
  styleUrls: ['./meal-totals.component.scss'],
})
export class MealTotalsComponent {
  @Input() title = 'MEAL_TOTAL';
  @Input() itemCount = 0;
  @Input() calories = 0;
  @Input() protein = 0;
  @Input() carbs = 0;
  @Input() fat = 0;
  /** Recipe: switch between the whole recipe and one serving (shown when servings > 1). */
  @Input() servings: number | null = null;
  @Input() perServing = false;
  @Output() perServingChange = new EventEmitter<boolean>();

  get showServingSwitch(): boolean {
    return Number(this.servings) > 1;
  }

  private get macroCalories(): number {
    return this.protein * 4 + this.carbs * 4 + this.fat * 9;
  }

  share(grams: number, kcalPerGram: number): number {
    const total = this.macroCalories;
    return total > 0 ? Math.round(((grams || 0) * kcalPerGram * 100) / total) : 0;
  }

  setPerServing(value: boolean): void {
    if (value !== this.perServing) this.perServingChange.emit(value);
  }
}
