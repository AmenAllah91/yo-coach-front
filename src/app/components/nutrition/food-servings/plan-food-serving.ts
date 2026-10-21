import { Observable } from 'rxjs';
import { Food, FoodServing } from '@shared/models/MealPlan';
import { defaultServingOf, lineRatio, lineServing, Macros, servingMacros, servingsOf, zeroMacros } from '@shared/models/nutrition-math';
import { amountOf, editableUnit, portionsOf, servingKey } from './food-serving-rules';

export const NEW_SERVING_OPTION = '__new_serving__';

export class PlanFoodServing {
  food: any = null;
  servingId: string | null = null;
  portions = 1;
  formOpen = false;
  saving = false;
  error = '';
  private canEditCatalog = false;

  constructor(private readonly isAdmin: () => boolean) {}

  get options(): FoodServing[] {
    return this.food ? servingsOf(this.food) : [];
  }

  get serving(): FoodServing | null {
    return this.options.find((serving) => serving.id === this.servingId) ?? this.options[0] ?? null;
  }

  get canAdd(): boolean {
    return !!this.food?.id && (!(this.food.general ?? this.food.isGeneral) || this.canEditCatalog);
  }

  get quantity(): number {
    const serving = this.serving;
    return serving ? amountOf(this.portions, serving.size) : 0;
  }

  get macros(): Macros {
    const serving = this.serving;
    return serving ? servingMacros(serving, lineRatio(this.quantity, serving.size)) : zeroMacros();
  }

  start(food: any): void {
    this.food = food;
    this.formOpen = false;
    this.saving = false;
    this.error = '';
    this.canEditCatalog = this.isAdmin();
    this.select(defaultServingOf(food));
  }

  select(serving: FoodServing): void {
    this.servingId = serving.id ?? null;
    this.portions = 1;
  }

  choose(select: HTMLSelectElement): void {
    if (select.value === NEW_SERVING_OPTION) {
      select.value = this.servingId ?? '';
      if (this.canAdd) {
        this.formOpen = true;
        this.error = '';
      }
      return;
    }
    const serving = this.options.find((option) => option.id === select.value);
    if (serving) this.select(serving);
  }

  create(serving: FoodServing, save: (foodId: string, serving: FoodServing) => Observable<any>, updated: (food: any) => void): void {
    const food = this.food;
    if (!food?.id || this.saving) return;
    this.saving = true;
    this.error = '';
    save(food.id, serving).subscribe({
      next: (result) => {
        this.saving = false;
        if (this.food !== food) return;
        this.food = { ...food, servings: result?.servings, defaultServingId: result?.defaultServingId };
        updated(this.food);
        const key = servingKey(serving.size, serving.unit);
        const created = servingsOf(this.food).find((option) => servingKey(option.size, option.unit) === key);
        if (created) this.select(created);
        this.formOpen = false;
      },
      error: (error) => {
        this.saving = false;
        this.error = error?.status === 403 ? 'MEAL_SERVING_NOT_OWNED' : 'MEAL_SERVING_SAVE_FAILED';
      },
    });
  }

  line(pieceLabel: string): Pick<Food, 'quantity' | 'unit' | 'servingId' | 'serving'> {
    const serving = this.serving;
    return {
      quantity: this.quantity,
      unit: serving ? editableUnit(serving.unit, pieceLabel) : 'g',
      servingId: serving?.id ?? null,
      serving,
    };
  }
}

/*
 * A food already in a meal keeps the same principle as the Add Food modal: a number of servings of one of the food's
 * units (100 g, 1 egg, 4 eggs...). quantity = servings x serving size, the macros follow.
 */

/** Units the line can switch to: the food's servings, plus the line's own one if the catalog no longer has it. */
export function lineServingOptions(food: any): FoodServing[] {
  const current = lineServing(food);
  if (!current) return [];
  const options = food.foodRef ? servingsOf(food.foodRef) : [];
  const same = (option: FoodServing) =>
    (!!option.id && option.id === current.id) || servingKey(option.size, option.unit) === servingKey(current.size, current.unit);
  return options.some(same) ? options : [current, ...options];
}

/** Position of the line's unit in lineServingOptions. */
export function lineServingIndex(food: any): number {
  const current = lineServing(food);
  if (!current) return -1;
  const options = lineServingOptions(food);
  const index = options.findIndex((option) => !!option.id && option.id === current.id);
  return index >= 0 ? index : Math.max(0, options.findIndex((option) => servingKey(option.size, option.unit) === servingKey(current.size, current.unit)));
}

/** Number of servings of the line's unit. */
export function linePortions(food: any): number {
  const current = lineServing(food);
  const portions = current ? portionsOf(food.quantity, current.size) : null;
  return portions === null ? 1 : Math.round(portions * 100) / 100;
}

export function setLinePortions(food: any, portions: unknown): boolean {
  const current = lineServing(food);
  const value = Number(portions);
  if (!current || portions === null || portions === '' || !Number.isFinite(value) || value < 0) return false;
  food.quantity = amountOf(value, current.size);
  return true;
}

/** Another unit: one serving of it, like when a unit is picked in the Add Food modal. */
export function setLineServing(food: any, serving: FoodServing | undefined, pieceLabel: string): boolean {
  if (!serving) return false;
  food.serving = serving;
  food.servingId = serving.id ?? null;
  food.unit = editableUnit(serving.unit, pieceLabel);
  food.quantity = amountOf(1, serving.size);
  return true;
}
