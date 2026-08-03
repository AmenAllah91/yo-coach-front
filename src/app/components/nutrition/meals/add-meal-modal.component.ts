/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { NutritionService } from 'app/service/nutrition.service';
import { MealsService } from 'app/service/meals.service';

type BuilderStep = 'choice' | 'foods' | 'recipe';
type NutritionView = 'whole' | 'serving';
type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat';

interface IngredientRow {
  id: string;
  name: string;
  category?: string;
  quantity: number | null;
  unit: string;
  foodRef?: any;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  manual: boolean;
}

@Component({
  selector: 'app-add-meal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './add-meal-modal.component.html',
  styleUrls: ['./add-meal-modal.component.scss'],
})
export class AddMealModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() meal: any | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  step: BuilderStep = 'choice';
  name = '';
  mealType = 'BREAKFAST';
  servings = 1;
  totalTimeMinutes: number | null = null;
  coverImage: string | null = null;
  coverImageName = '';

  ingredients: IngredientRow[] = [];
  directions: string[] = [''];

  ingredientPickerOpen = false;
  foodSearch = '';
  foods: any[] = [];
  searchingFoods = false;

  nutritionView: NutritionView = 'whole';
  saving = false;
  saveError = '';
  imageError = '';
  submitted = false;

  draggedIngredientIndex: number | null = null;
  draggedDirectionIndex: number | null = null;

  readonly units = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice'];
  readonly mealTypes = [
    { value: 'BREAKFAST', label: 'Breakfast' },
    { value: 'LUNCH', label: 'Lunch' },
    { value: 'DINNER', label: 'Dinner' },
    { value: 'SNACK', label: 'Snack' },
    { value: 'PRE_WORKOUT', label: 'Pre workout' },
    { value: 'POST_WORKOUT', label: 'Post workout' },
  ];

  constructor(
    private nutritionService: NutritionService,
    private mealsService: MealsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue === true) {
      this.meal ? this.loadMeal(this.meal) : this.reset();
    }

    if (changes['meal'] && this.isVisible && this.meal) {
      this.loadMeal(this.meal);
    }
  }

  get isRecipe(): boolean {
    return this.step === 'recipe';
  }

  get isEditing(): boolean {
    return Boolean(this.meal?.id);
  }

  get modalTitle(): string {
    if (this.step === 'choice') return 'Choose a nutrition plan type';
    if (this.isRecipe) return this.isEditing ? 'Edit meal recipe' : 'Add meal recipe';
    return this.isEditing ? 'Edit meal' : 'Create meal';
  }

  get modalSubtitle(): string {
    if (this.step === 'choice') {
      return 'Select the option that best fits how you want to create nutrition plans for your clients.';
    }
    if (this.isRecipe) return 'Create a reusable recipe for your library.';
    return 'Build a meal by adding individual foods from your database.';
  }

  get canSave(): boolean {
    return this.formIsValid && !this.saving;
  }

  get formIsValid(): boolean {
    if (!this.name.trim() || this.ingredients.length === 0) return false;
    if (this.isRecipe && (!this.servings || Number(this.servings) < 1)) return false;

    return this.ingredients.every((ingredient) => {
      const quantityIsValid = Number(ingredient.quantity) > 0;
      const unitIsValid = Boolean(ingredient.unit);
      const nameIsValid = !ingredient.manual || Boolean(ingredient.name.trim());
      return quantityIsValid && unitIsValid && nameIsValid;
    });
  }

  choose(step: 'foods' | 'recipe'): void {
    this.step = step;
    this.ingredientPickerOpen = false;
    this.foodSearch = '';
    this.foods = [];
    this.submitted = false;
  }

  backToChoice(): void {
    if (this.isEditing) {
      this.close();
      return;
    }
    this.reset();
  }

  close(): void {
    if (this.saving) return;
    this.reset();
    this.closed.emit();
  }

  openIngredientPicker(): void {
    this.ingredientPickerOpen = true;
    this.searchFoods();
  }

  closeIngredientPicker(): void {
    this.ingredientPickerOpen = false;
    this.foodSearch = '';
    this.foods = [];
  }

  searchFoods(): void {
    this.searchingFoods = true;
    this.nutritionService.filteredFoods(0, 12, this.foodSearch.trim()).subscribe({
      next: (response: any) => {
        this.foods = Array.isArray(response) ? response : response?.content || [];
        this.searchingFoods = false;
      },
      error: () => {
        this.foods = [];
        this.searchingFoods = false;
      },
    });
  }

  addFood(food: any): void {
    if (!food) return;

    const duplicate = this.ingredients.some(
      (ingredient) => !ingredient.manual && ingredient.foodRef?.id === food.id,
    );
    if (duplicate) {
      this.closeIngredientPicker();
      return;
    }

    const servingSize = this.positiveNumber(food.servingSize, 100);
    this.ingredients.push({
      id: this.newId(),
      name: food.name || '',
      category: food.category || food.foodGroup || 'Food',
      quantity: servingSize,
      unit: this.normalizeUnit(food.servingUnit || food.unit || 'g'),
      foodRef: food,
      calories: this.nutrient(food, 'energy', 'calories'),
      protein: this.nutrient(food, 'protein'),
      carbs: this.nutrient(food, 'carbohydrates', 'carbs'),
      fat: this.nutrient(food, 'fat'),
      manual: false,
    });

    this.loadFoodImages();
    this.closeIngredientPicker();
  }

  addManualIngredient(): void {
    this.ingredients.push({
      id: this.newId(),
      name: '',
      category: 'Manual ingredient',
      quantity: null,
      unit: '',
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      manual: true,
    });
    this.closeIngredientPicker();
  }

  removeIngredient(index: number): void {
    this.ingredients.splice(index, 1);
  }

  addStep(): void {
    this.directions.push('');
  }

  removeStep(index: number): void {
    if (this.directions.length === 1) {
      this.directions[0] = '';
      return;
    }
    this.directions.splice(index, 1);
  }

  onIngredientDragStart(index: number): void {
    this.draggedIngredientIndex = index;
  }

  onIngredientDrop(index: number): void {
    if (this.draggedIngredientIndex === null || this.draggedIngredientIndex === index) {
      this.draggedIngredientIndex = null;
      return;
    }
    const [moved] = this.ingredients.splice(this.draggedIngredientIndex, 1);
    this.ingredients.splice(index, 0, moved);
    this.draggedIngredientIndex = null;
  }

  onDirectionDragStart(index: number): void {
    this.draggedDirectionIndex = index;
  }

  onDirectionDrop(index: number): void {
    if (this.draggedDirectionIndex === null || this.draggedDirectionIndex === index) {
      this.draggedDirectionIndex = null;
      return;
    }
    const [moved] = this.directions.splice(this.draggedDirectionIndex, 1);
    this.directions.splice(index, 0, moved);
    this.draggedDirectionIndex = null;
  }

  onCoverImageSelected(event: Event): void {
    this.imageError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.imageError = 'Only JPG and PNG images are accepted.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'The cover image must be 5 MB or smaller.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.coverImage = String(reader.result || '');
      this.coverImageName = file.name;
    };
    reader.onerror = () => {
      this.imageError = 'The image could not be read.';
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeCoverImage(): void {
    this.coverImage = null;
    this.coverImageName = '';
    this.imageError = '';
  }

  ingredientTotal(item: IngredientRow, key: MacroKey): number {
    const value = Number(item[key]);
    if (!Number.isFinite(value)) return 0;
    if (item.manual) return value;

    const baseServing = this.positiveNumber(item.foodRef?.servingSize, 100);
    const quantity = Number(item.quantity) || 0;
    return value * (quantity / baseServing);
  }

  nutritionTotal(key: MacroKey): number {
    const total = this.ingredients.reduce(
      (sum, ingredient) => sum + this.ingredientTotal(ingredient, key),
      0,
    );

    if (this.isRecipe && this.nutritionView === 'serving') {
      return total / Math.max(1, Number(this.servings) || 1);
    }
    return total;
  }

  save(asDraft = false): void {
    this.submitted = true;
    this.saveError = '';
    if (!this.formIsValid || this.saving) return;

    this.saving = true;
    const payload = this.buildPayload(asDraft);
    const request = this.isEditing
      ? this.mealsService.updateMeal(this.meal.id, payload)
      : this.isRecipe
        ? this.mealsService.saveTemplate(payload)
        : this.mealsService.createMeal(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit();
        this.reset();
        this.closed.emit();
      },
      error: (error: any) => {
        this.saving = false;
        this.saveError =
          error?.error?.message || error?.message || 'Unable to save this meal. Please try again.';
      },
    });
  }

  trackByIngredient(_index: number, ingredient: IngredientRow): string {
    return ingredient.id;
  }

  trackByFood(_index: number, food: any): string {
    return food?.id || food?.name;
  }

  trackByDirection(index: number): number {
    return index;
  }

  private buildPayload(asDraft: boolean): any {
    return {
      name: this.name.trim(),
      mealType: this.mealType,
      servings: this.isRecipe ? Math.max(1, Number(this.servings) || 1) : 1,
      totalTimeMinutes: this.isRecipe && this.totalTimeMinutes != null
        ? Math.max(0, Number(this.totalTimeMinutes) || 0)
        : null,
      coverImage: this.isRecipe ? this.coverImage : null,
      directions: this.isRecipe
        ? this.directions.map((step) => step.trim()).filter(Boolean)
        : [],
      template: this.isRecipe,
      draft: this.isRecipe ? asDraft : false,
      foods: this.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name.trim() || 'Manual ingredient',
        quantity: Number(ingredient.quantity),
        unit: ingredient.unit,
        manual: ingredient.manual,
        foodRef: ingredient.manual || !ingredient.foodRef?.id
          ? undefined
          : { id: ingredient.foodRef.id },
        calories: ingredient.manual ? this.nullableNumber(ingredient.calories) : undefined,
        protein: ingredient.manual ? this.nullableNumber(ingredient.protein) : undefined,
        carbohydrates: ingredient.manual ? this.nullableNumber(ingredient.carbs) : undefined,
        fat: ingredient.manual ? this.nullableNumber(ingredient.fat) : undefined,
      })),
    };
  }

  private loadMeal(meal: any): void {
    this.reset();
    this.meal = meal;
    this.step = meal?.template ? 'recipe' : 'foods';
    this.name = meal?.name || meal?.title || '';
    this.mealType = meal?.mealType || 'BREAKFAST';
    this.servings = Math.max(1, Number(meal?.servings) || 1);
    this.totalTimeMinutes = meal?.totalTimeMinutes ?? null;
    this.coverImage = meal?.coverImage || null;
    this.coverImageName = this.coverImage ? 'Current cover image' : '';
    this.directions = Array.isArray(meal?.directions) && meal.directions.length
      ? [...meal.directions]
      : [''];
    this.ingredients = (meal?.foods || []).map((food: any) => {
      const ref = food?.foodRef;
      const manual = Boolean(food?.manual) || !ref;
      return {
        id: food?.id || this.newId(),
        name: food?.name || ref?.name || '',
        category: manual ? 'Manual ingredient' : ref?.category || ref?.foodGroup || 'Food',
        quantity: food?.quantity ?? ref?.servingSize ?? 100,
        unit: this.normalizeUnit(food?.unit || ref?.servingUnit || 'g'),
        foodRef: ref,
        calories: manual ? food?.calories ?? null : this.nutrient(ref, 'energy', 'calories'),
        protein: manual ? food?.protein ?? null : this.nutrient(ref, 'protein'),
        carbs: manual ? food?.carbohydrates ?? food?.carbs ?? null : this.nutrient(ref, 'carbohydrates', 'carbs'),
        fat: manual ? food?.fat ?? null : this.nutrient(ref, 'fat'),
        manual,
      } as IngredientRow;
    });
    this.loadFoodImages();
  }

  private loadFoodImages(): void {
    this.ingredients
      .filter(
        (ingredient) =>
          !ingredient.manual &&
          ingredient.foodRef?.id &&
          !ingredient.foodRef?.image &&
          !ingredient.foodRef?.imageUrl,
      )
      .forEach((ingredient) => {
        this.nutritionService.getFoodForClient(ingredient.foodRef.id).subscribe({
          next: (detail: any) => {
            if (detail?.imageUrl) {
              ingredient.foodRef.imageUrl = detail.imageUrl;
            }
          },
          error: () => {},
        });
      });
  }

  private reset(): void {
    this.step = 'choice';
    this.name = '';
    this.mealType = 'BREAKFAST';
    this.servings = 1;
    this.totalTimeMinutes = null;
    this.coverImage = null;
    this.coverImageName = '';
    this.ingredients = [];
    this.directions = [''];
    this.ingredientPickerOpen = false;
    this.foodSearch = '';
    this.foods = [];
    this.searchingFoods = false;
    this.nutritionView = 'whole';
    this.saving = false;
    this.saveError = '';
    this.imageError = '';
    this.submitted = false;
    this.draggedIngredientIndex = null;
    this.draggedDirectionIndex = null;
  }

  private nutrient(source: any, ...keys: string[]): number {
    for (const key of keys) {
      if (source?.[key] != null) return Number(source[key]) || 0;
    }
    return 0;
  }

  private nullableNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  private normalizeUnit(unit: string): string {
    const normalized = String(unit || '').toLowerCase();
    if (this.units.includes(normalized)) return normalized;
    if (normalized.includes('gram')) return 'g';
    if (normalized.includes('millil')) return 'ml';
    return 'g';
  }

  private newId(): string {
    return globalThis.crypto?.randomUUID?.()
      || `meal-row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
