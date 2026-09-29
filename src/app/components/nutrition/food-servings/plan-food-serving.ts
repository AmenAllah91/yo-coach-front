import { Observable } from 'rxjs';
import { Food, FoodServing } from '@shared/models/MealPlan';
import { defaultServingOf, lineRatio, Macros, servingMacros, servingsOf, zeroMacros } from '@shared/models/nutrition-math';
import { amountOf, editableUnit, servingKey } from './food-serving-rules';

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
