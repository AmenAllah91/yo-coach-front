/* eslint-disable @typescript-eslint/no-explicit-any */
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { Food, FoodServing } from '@shared/models/MealPlan';
import { nutritionFoodValidationKey } from '@shared/models/nutrition-publication';
import { Food as FoodRefDraft, NutritionService } from 'app/service/nutrition.service';
import { ToastService } from 'app/service/toast.service';
import { FoodServingFormComponent } from '../food-servings/food-serving-form.component';
import { ServingUnitPipe } from '../food-servings/serving-unit.pipe';
import { NEW_SERVING_OPTION, PlanFoodServing } from '../food-servings/plan-food-serving';
import { foodPageRange } from '../food-page-range';

/** A food chosen in the modal: a number of servings of one of its units (quantity = servings x serving size). */
export type AddedFood = Pick<Food, 'name' | 'quantity' | 'unit' | 'servingId' | 'serving'> & { foodRef: any };

/** « + Créer « riz maison » »: what the values of the short form are given for. */
export type QuickFoodBase = 'g' | 'ml' | 'portion';

export interface QuickFoodDraft {
  name: string;
  base: QuickFoodBase;
  calories: string | number | null;
  protein: string | number | null;
  carbs: string | number | null;
  fat: string | number | null;
}

function quickNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** The error key of the short form, or '' (name 1-100 characters, numbers ≥ 0, at least one value above 0). */
export function quickFoodError(draft: QuickFoodDraft): string {
  const name = String(draft.name ?? '').trim();
  if (!name) return 'AFM_CREATE.NAME_REQUIRED';
  if (Array.from(name).length > 100) return 'FOOD_VALID_NAME_LENGTH';
  const values = [draft.calories, draft.protein, draft.carbs, draft.fat].map(quickNumber);
  if (values.some((value) => value !== null && Number.isNaN(value))) return 'FOOD_VALID_NUMBER';
  if (values.some((value) => value !== null && value < 0)) return 'FOOD_VALID_NONNEGATIVE';
  if (!values.some((value) => value !== null && value > 0)) return 'AFM_CREATE.VALUE_REQUIRED';
  return '';
}

/** kcal typed, or 4/4/9 from the macros when left empty. */
export function quickFoodCalories(draft: QuickFoodDraft): number {
  const typed = quickNumber(draft.calories);
  if (typed !== null && !Number.isNaN(typed)) return typed;
  const grams = (value: unknown) => {
    const parsed = quickNumber(value);
    return parsed === null || Number.isNaN(parsed) ? 0 : parsed;
  };
  return Math.round(grams(draft.protein) * 4 + grams(draft.carbs) * 4 + grams(draft.fat) * 9);
}

/** The food sent to POST /api/food-ref, built as the « Mes aliments » page builds a coach food (one serving). */
export function quickFoodPayload(draft: QuickFoodDraft, portionLabel: string): FoodRefDraft {
  const size = draft.base === 'portion' ? 1 : 100;
  const unit = draft.base === 'portion' ? portionLabel : draft.base;
  const value = (raw: unknown) => {
    const parsed = quickNumber(raw);
    return parsed === null || Number.isNaN(parsed) ? 0 : parsed;
  };
  const calories = quickFoodCalories(draft);
  const protein = value(draft.protein);
  const carbs = value(draft.carbs);
  const fat = value(draft.fat);
  const extras = { fiber: null, sugar: null, polyols: null, saturatedFat: null, polyunsaturatedFat: null, monounsaturatedFat: null, sodium: null };
  const serving: FoodServing = { size, unit, energy: calories, protein, carbohydrates: carbs, fat, ...extras };
  return {
    name: String(draft.name).trim(), calories, protein, carbs, fat, ...extras,
    servingSize: size, servingUnit: unit, servings: [serving], defaultServingId: null,
  };
}

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
export class AddFoodModalComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Administrators may add a unit to a catalogue food; a coach only to their own foods. */
  @Input() canEditCatalog = false;
  /** Foods already in the meal: shown, but cannot be added twice. */
  @Input() excludedIds: string[] = [];
  /** Stays open after an add (back to the list, search selected) so several foods go in one opening; « Terminé » closes it. */
  @Input() keepOpen = false;
  /** The meal the foods go to, shown under the title. */
  @Input() targetName = '';
  @Output() added = new EventEmitter<AddedFood>();
  @Output() closed = new EventEmitter<void>();

  step: 'list' | 'detail' | 'create' = 'list';
  search = '';
  foods: any[] = [];
  /** « Fréquents »: the coach's most used foods, shown while the search is empty (nothing on an error). */
  frequent: any[] = [];
  /** « + Créer « … » »: the short form of a new coach food. */
  quick: QuickFoodDraft = { name: '', base: 'g', calories: null, protein: null, carbs: null, fat: null };
  quickSaving = false;
  quickTried = false;
  readonly quickBases: QuickFoodBase[] = ['g', 'ml', 'portion'];
  /** More foods match than the list shows (the server sends the first 100): the coach should type more. */
  truncated = false;
  loading = false;
  page = 0;
  readonly pageSize = 5;
  selectedFood: any | null = null;
  validationMessage = '';
  /** keepOpen: the foods added during this opening (ids, for the « Ajouté » badge) and the last one's name. */
  addedIds: string[] = [];
  addedCount = 0;
  lastAddedName = '';
  readonly serving = new PlanFoodServing(() => this.canEditCatalog);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('quickName') private quickName?: ElementRef<HTMLInputElement>;
  readonly newServingOption = NEW_SERVING_OPTION;

  private readonly searches = new Subject<string>();
  private subscriptions = new Subscription();
  private request?: Subscription;

  constructor(private nutritionService: NutritionService, private translate: TranslateService, private toast: ToastService) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searches.pipe(debounceTime(250), distinctUntilChanged()).subscribe((search) => this.load(search)),
    );
    this.load('');
    this.subscriptions.add(this.nutritionService.loadFrequentFoods().subscribe((foods) => (this.frequent = foods || [])));
  }

  /** The search is empty: the frequent foods come first. */
  get showFrequent(): boolean {
    return !this.search.trim() && this.frequent.length > 0;
  }

  /** At least 2 characters typed: « + Créer « riz maison » » at the bottom of the results. */
  get canCreate(): boolean {
    return this.search.trim().length >= 2;
  }

  get quickError(): string {
    return quickFoodError(this.quick);
  }

  /** kcal shown in the empty kcal field: computed from the macros (4/4/9). */
  get quickCaloriesHint(): number {
    return quickFoodCalories({ ...this.quick, calories: null });
  }

  openCreate(): void {
    this.validationMessage = '';
    this.quick = { name: this.search.trim(), base: 'g', calories: null, protein: null, carbs: null, fat: null };
    this.quickTried = false;
    this.quickSaving = false;
    this.step = 'create';
    setTimeout(() => this.quickName?.nativeElement.focus());
  }

  /** Saved as a coach food, then chosen exactly as a click on it in the results (quantity, then add). */
  saveQuick(): void {
    if (this.quickSaving) return;
    this.quickTried = true;
    if (this.quickError) return;
    this.quickSaving = true;
    const payload = quickFoodPayload(this.quick, this.translate.instant('AFM_CREATE.PORTION_UNIT'));
    this.nutritionService.createFood(payload, true).subscribe({
      next: (food) => {
        this.quickSaving = false;
        if (this.step !== 'create') return;
        // The searches were cleared by the service: back to the list, the new food is in the results.
        this.load(this.search.trim());
        this.choose(food);
      },
      error: () => {
        this.quickSaving = false;
        this.toast.error(this.translate.instant('AFM_CREATE.SAVE_ERROR'));
      },
    });
  }

  /** The cursor goes in the search at once (the autofocus attribute is ignored in a modal added after the page load). */
  ngAfterViewInit(): void {
    setTimeout(() => this.searchInput?.nativeElement.focus());
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

  /** Added during this opening: badged, still clickable (the same food may go twice in a meal). */
  wasAdded(food: any): boolean {
    return !!food?.id && this.addedIds.includes(String(food.id));
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
    this.quickTried = false;
  }

  close(): void {
    this.closed.emit();
  }

  /** Échap closes the unit form first, then the modal, and goes no further: the day window under it stays open. */
  onEscape(event: Event): void {
    event.stopPropagation();
    if (this.step === 'create') {
      // The short form of a new food: back to the results, the modal stays open.
      if (!this.quickSaving) this.backToList();
      return;
    }
    if (this.serving.formOpen) {
      this.serving.formOpen = false;
      return;
    }
    this.close();
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
    if (!this.keepOpen) return;
    if (this.selectedFood.id && !this.wasAdded(this.selectedFood)) this.addedIds.push(String(this.selectedFood.id));
    this.addedCount++;
    this.lastAddedName = this.selectedFood.name || '';
    this.backToList();
    // The next search replaces the previous one: typing « riz » after « poulet » needs no erasing.
    setTimeout(() => this.searchInput?.nativeElement.select());
  }

  /** Cached list shown at once, refreshed in the background. */
  private load(search: string): void {
    this.page = 0;
    // The answer of an older search must never replace this one (« poulet » typed, then erased quickly).
    this.request?.unsubscribe();
    // Loaded less than 30 s ago (prefetch, previous opening): used as is, no request.
    const recent = this.nutritionService.pickerFoodsResult(search, 30_000);
    if (recent) {
      this.show(recent);
      this.loading = false;
      return;
    }
    const known = this.nutritionService.pickerFoodsResult(search);
    if (known) this.show(known);
    this.loading = !known;
    this.request = this.nutritionService.loadPickerFoods(search).subscribe({
      next: () => {
        const result = this.nutritionService.pickerFoodsResult(search);
        if (result) this.show(result);
        this.loading = false;
        if (this.page >= this.totalPages) this.page = 0;
      },
      error: () => (this.loading = false),
    });
  }

  private show(result: { foods: any[]; truncated: boolean }): void {
    this.foods = result.foods;
    this.truncated = result.truncated;
  }
}
