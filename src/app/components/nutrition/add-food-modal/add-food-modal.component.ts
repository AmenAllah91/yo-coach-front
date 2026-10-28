/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { Food, FoodServing } from '@shared/models/MealPlan';
import { nutritionFoodValidationKey } from '@shared/models/nutrition-publication';
import { NutritionService } from 'app/service/nutrition.service';
import { FoodServingFormComponent } from '../food-servings/food-serving-form.component';
import { ServingUnitPipe } from '../food-servings/serving-unit.pipe';
import { NEW_SERVING_OPTION, PlanFoodServing } from '../food-servings/plan-food-serving';
import { foodPageRange } from '../food-page-range';

/** A food chosen in the modal: a number of servings of one of its units (quantity = servings x serving size). */
export type AddedFood = Pick<Food, 'name' | 'quantity' | 'unit' | 'servingId' | 'serving'> & { foodRef: any };

/**
 * Add Food modal shared by the meal plan editors and the meal editor: search a food, then choose a number of servings
 * of one of its units (100 g, 1 egg...) and see its nutrition values before adding it.
 */
@Component({
  selector: 'app-add-food-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FoodServingFormComponent, ServingUnitPipe],
  templateUrl: './add-food-modal.component.html',
  styleUrls: ['./add-food-modal.component.scss'],
})
export class AddFoodModalComponent implements OnInit, OnDestroy {
  /** Administrators may add a unit to a catalogue food; a coach only to their own foods. */
  @Input() canEditCatalog = false;
  /** Foods already in the meal: shown, but cannot be added twice. */
  @Input() excludedIds: string[] = [];
  @Output() added = new EventEmitter<AddedFood>();
  @Output() closed = new EventEmitter<void>();

  step: 'list' | 'detail' = 'list';
  search = '';
  foods: any[] = [];
  loading = false;
  page = 0;
  readonly pageSize = 5;
  selectedFood: any | null = null;
  validationMessage = '';
  readonly serving = new PlanFoodServing(() => this.canEditCatalog);
  readonly newServingOption = NEW_SERVING_OPTION;

  private readonly searches = new Subject<string>();
  private subscriptions = new Subscription();
  private request?: Subscription;

  constructor(private nutritionService: NutritionService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searches.pipe(debounceTime(250), distinctUntilChanged()).subscribe((search) => this.load(search)),
    );
    this.load('');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.request?.unsubscribe();
  }

  get totalPages(): number {
    return Math.ceil(this.foods.length / this.pageSize);
  }

  get pagedFoods(): any[] {
    return this.foods.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
  }

  get visiblePages(): Array<number | null> {
    return foodPageRange(this.page, this.totalPages);
  }

  get macros() {
    return this.serving.macros;
  }

  get unitSuggestions(): string[] {
    return String(this.translate.instant('FOOD_UNIT_SUGGESTIONS')).split(',').map((unit) => unit.trim()).filter(Boolean);
  }

  onSearch(): void {
    this.searches.next(this.search.trim());
  }

  changePage(page: number): void {
    if (page >= 0 && page < this.totalPages) this.page = page;
  }

  isExcluded(food: any): boolean {
    return !!food?.id && this.excludedIds.includes(String(food.id));
  }

  foodImage(food: any): string {
    return food?.imageUrl || food?.image || food?.photoUrl || '';
  }

  choose(food: any): void {
    if (this.isExcluded(food)) return;
    this.validationMessage = '';
    this.selectedFood = food;
    this.step = 'detail';
    this.serving.start(food);
  }

  backToList(): void {
    this.validationMessage = '';
    this.step = 'list';
    this.selectedFood = null;
  }

  close(): void {
    this.closed.emit();
  }

  createServing(serving: FoodServing): void {
    this.serving.create(serving, (id, draft) => this.nutritionService.addFoodServing(id, draft), (food) => {
      this.selectedFood = food;
      this.foods = this.foods.map((item) => (item.id === food.id ? food : item));
      this.nutritionService.rememberPickerFood(food);
    });
  }

  add(): void {
    if (!this.selectedFood) return;
    const line = this.serving.line(this.translate.instant('FOOD_UNIT_PIECE'));
    const food: AddedFood = { name: this.selectedFood.name, ...line, foodRef: this.selectedFood };
    const messageKey = nutritionFoodValidationKey(food as Partial<Food>);
    const message = messageKey ? this.translate.instant(messageKey) : '';
    if (message) {
      this.validationMessage = message;
      return;
    }
    this.added.emit(food);
  }

  /** Cached list shown at once, refreshed in the background. */
  private load(search: string): void {
    this.page = 0;
    // Loaded less than 30 s ago (prefetch, previous opening): used as is, no request.
    const recent = this.nutritionService.pickerFoodsSnapshot(search, 30_000);
    if (recent) {
      this.foods = recent;
      this.loading = false;
      return;
    }
    const known = this.nutritionService.pickerFoodsSnapshot(search);
    if (known) this.foods = known;
    this.loading = !known;
    this.request?.unsubscribe();
    this.request = this.nutritionService.loadPickerFoods(search).subscribe({
      next: (foods) => {
        this.foods = foods;
        this.loading = false;
        if (this.page >= this.totalPages) this.page = 0;
      },
      error: () => (this.loading = false),
    });
  }
}
