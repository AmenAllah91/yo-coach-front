/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { MealsService } from 'app/service/meals.service';

export interface MealTemplateSelection {
  meal: any;
  servings: number;
}

type TemplateKind = 'recipe' | 'foods';

@Component({
  selector: 'app-meal-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './meal-template-picker.component.html',
  styleUrls: ['./meal-template-picker.component.scss'],
})
export class MealTemplatePickerComponent implements OnChanges {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() selected = new EventEmitter<MealTemplateSelection>();

  activeKind: TemplateKind = 'recipe';
  search = '';
  recipes: any[] = [];
  foodMeals: any[] = [];
  recipeTotal = 0;
  foodsTotal = 0;
  loadingRecipe = false;
  loadingFoods = false;
  recipeLimit = 3;
  foodsLimit = 3;

  servingMealId: string | null = null;
  servingCount = 1;
  previewMealId: string | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private mealsService: MealsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetAndLoad();
    }
  }

  get activeMeals(): any[] {
    return this.activeKind === 'recipe' ? this.recipes : this.foodMeals;
  }

  get activeLoading(): boolean {
    return this.activeKind === 'recipe' ? this.loadingRecipe : this.loadingFoods;
  }

  get canShowMore(): boolean {
    const total = this.activeKind === 'recipe' ? this.recipeTotal : this.foodsTotal;
    return this.activeMeals.length < total;
  }

  setKind(kind: TemplateKind): void {
    this.activeKind = kind;
    this.servingMealId = null;
    this.previewMealId = null;
  }

  close(): void {
    this.clearSearchTimer();
    this.closed.emit();
  }

  onSearchInput(): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.recipeLimit = 3;
      this.foodsLimit = 3;
      this.loadBoth();
    }, 250);
  }

  beginAdd(meal: any): void {
    this.servingMealId = this.mealKey(meal);
    this.servingCount = 1;
  }

  cancelAdd(): void {
    this.servingMealId = null;
    this.servingCount = 1;
  }

  decrementServings(): void {
    this.servingCount = Math.max(1, Number(this.servingCount || 1) - 1);
  }

  incrementServings(): void {
    this.servingCount = Math.min(99, Number(this.servingCount || 1) + 1);
  }

  normalizeServings(): void {
    this.servingCount = Math.max(1, Math.min(99, Math.floor(Number(this.servingCount) || 1)));
  }

  addToPlan(meal: any): void {
    this.normalizeServings();
    this.selected.emit({ meal, servings: this.servingCount });
    this.servingMealId = null;
  }

  togglePreview(meal: any): void {
    const key = this.mealKey(meal);
    this.previewMealId = this.previewMealId === key ? null : key;
  }

  showMore(): void {
    if (this.activeKind === 'recipe') {
      this.recipeLimit += 3;
      this.loadKind('recipe');
    } else {
      this.foodsLimit += 3;
      this.loadKind('foods');
    }
  }

  mealKey(meal: any): string {
    return String(meal?.id || meal?.name || 'meal');
  }

  mealImage(meal: any): string {
    return meal?.coverImage || meal?.imageUrl || '';
  }

  mealTypeLabel(meal: any): string {
    const value = String(meal?.mealType || '').replace(/_/g, ' ').toLowerCase();
    if (!value) return 'Meal';
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  ingredientNames(meal: any): string {
    const names = (meal?.foods || [])
      .map((food: any) => food?.name || food?.foodRef?.name)
      .filter(Boolean);
    return names.length ? names.slice(0, 5).join(', ') : 'No foods added';
  }

  macros(meal: any): { calories: number; protein: number; carbs: number; fat: number } {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const food of meal?.foods || []) {
      if (food?.manual || !food?.foodRef) {
        calories += Number(food?.calories) || 0;
        protein += Number(food?.protein) || 0;
        carbs += Number(food?.carbohydrates ?? food?.carbs) || 0;
        fat += Number(food?.fat) || 0;
        continue;
      }

      const ref = food.foodRef;
      const servingSize = Number(ref?.servingSize) || 100;
      const quantity = Number(food?.quantity) || servingSize;
      const ratio = quantity / servingSize;
      calories += (Number(ref?.energy ?? ref?.calories) || 0) * ratio;
      protein += (Number(ref?.protein) || 0) * ratio;
      carbs += (Number(ref?.carbohydrates ?? ref?.carbs) || 0) * ratio;
      fat += (Number(ref?.fat) || 0) * ratio;
    }

    return {
      calories: Math.round(calories),
      protein: this.round1(protein),
      carbs: this.round1(carbs),
      fat: this.round1(fat),
    };
  }

  trackByMeal = (_index: number, meal: any): string => this.mealKey(meal);

  private resetAndLoad(): void {
    this.activeKind = 'recipe';
    this.search = '';
    this.recipeLimit = 3;
    this.foodsLimit = 3;
    this.servingMealId = null;
    this.servingCount = 1;
    this.previewMealId = null;
    this.recipeTotal = 0;
    this.foodsTotal = 0;
    this.loadBoth();
  }

  private loadBoth(): void {
    this.loadKind('recipe');
    this.loadKind('foods');
  }

  private loadKind(kind: TemplateKind): void {
    const recipe = kind === 'recipe';
    const limit = recipe ? this.recipeLimit : this.foodsLimit;

    if (recipe) this.loadingRecipe = true;
    else this.loadingFoods = true;

    this.mealsService.getMealLibrary(recipe, 0, limit, this.search.trim()).subscribe({
      next: (response: any) => {
        const meals = Array.isArray(response) ? response : response?.content || [];
        const total = Number(response?.totalElements);
        if (recipe) {
          this.recipes = meals;
          this.recipeTotal = Number.isFinite(total) ? total : meals.length;
          this.loadingRecipe = false;
        } else {
          this.foodMeals = meals;
          this.foodsTotal = Number.isFinite(total) ? total : meals.length;
          this.loadingFoods = false;
        }
      },
      error: () => {
        if (recipe) {
          this.recipes = [];
          this.recipeTotal = 0;
          this.loadingRecipe = false;
        } else {
          this.foodMeals = [];
          this.foodsTotal = 0;
          this.loadingFoods = false;
        }
      },
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private round1(value: number): number {
    return Math.round((Number(value) || 0) * 10) / 10;
  }
}
