import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FoodServing } from '@shared/models/MealPlan';
import { foodNumber } from '../custom-foods/food-validation';
import {
  draftOf,
  editableUnit,
  Prefill,
  prefillFrom,
  SERVING_EXTRAS,
  SERVING_LABELS,
  SERVING_MACROS,
  ServingDraft,
  servingErrors,
  servingFromDraft,
  ServingValueField,
} from './food-serving-rules';
import { ServingUnitPipe } from './serving-unit.pipe';

let nextListId = 0;

@Component({
  selector: 'app-food-serving-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ServingUnitPipe],
  templateUrl: './food-serving-form.component.html',
  styleUrls: ['./food-serving-form.component.scss'],
})
export class FoodServingFormComponent implements OnChanges {
  @Input() others: FoodServing[] = [];
  @Input() initial: FoodServing | null = null;
  @Input() unitSuggestions: string[] = [];
  @Input() saving = false;
  @Output() saved = new EventEmitter<FoodServing>();
  @Output() cancelled = new EventEmitter<void>();

  readonly macros = SERVING_MACROS;
  readonly extras = SERVING_EXTRAS;
  readonly labels = SERVING_LABELS;
  readonly listId = `food-serving-units-${++nextListId}`;

  draft: ServingDraft = draftOf(null, '');
  touched = new Set<string>();
  submitted = false;
  showMore = false;
  prefill: Prefill | null = null;
  private autoFilled = false;
  private initialized = false;

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges = {}): void {
    if (this.initialized && !changes['initial']) return;
    this.initialized = true;
    const unit = this.initial ? editableUnit(this.initial.unit, this.translate.instant('FOOD_UNIT_PIECE')) : '';
    this.draft = draftOf(this.initial, unit);
    if (!this.initial) this.draft.size = '1';
    this.touched.clear();
    this.submitted = false;
    this.prefill = null;
    this.autoFilled = false;
    this.showMore = this.extras.some((key) => this.draft[key].trim());
  }

  get errors(): Record<string, string> {
    return servingErrors(this.draft, this.others);
  }

  error(field: string): string {
    const error = this.errors[field];
    return error && (this.submitted || this.touched.has(field)) ? error : '';
  }

  suffix(key: ServingValueField): string {
    return key === 'energy' ? 'kcal' : 'g';
  }

  onSizeOrUnitChange(field: 'size' | 'unit'): void {
    this.touched.add(field);
    const typedByHand = !this.autoFilled && this.macros.some((key) => this.draft[key].trim());
    if (typedByHand) return;
    const prefill = prefillFrom(this.others, foodNumber(this.draft.size), this.draft.unit);
    for (const key of [...this.macros, ...this.extras]) {
      if (prefill) this.draft[key] = prefill.values[key] === null ? '' : String(prefill.values[key]);
      else if (this.autoFilled) this.draft[key] = '';
    }
    this.prefill = prefill;
    this.autoFilled = !!prefill;
  }

  onValueChange(field: ServingValueField): void {
    this.touched.add(field);
    this.autoFilled = false;
    this.prefill = null;
  }

  get isBlank(): boolean {
    return !this.draft.unit.trim() && [...this.macros, ...this.extras].every((key) => !this.draft[key].trim());
  }

  commit(): FoodServing | null {
    this.submitted = true;
    if (Object.keys(this.errors).length) return null;
    return servingFromDraft(this.draft, this.initial?.id);
  }

  submit(): void {
    if (this.saving) return;
    const serving = this.commit();
    if (serving) this.saved.emit(serving);
  }
}
