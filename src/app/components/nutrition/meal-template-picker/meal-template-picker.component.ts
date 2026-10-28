/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Subscription } from 'rxjs';
import { MealsService } from 'app/service/meals.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { totalMacros } from '@shared/models/nutrition-math';

export interface MealTemplateSelection {
  meal: any;
  servings: number;
}

type TemplateKind = 'recipe' | 'foods';

/** One library list: loaded page by page, kept between openings of the modal. */
interface LibraryList {
  meals: any[];
  total: number;
  /** First load (nothing to show yet): skeleton rows. */
  loading: boolean;
  /** Next page or a new search: the current rows stay visible. */
  refreshing: boolean;
  loaded: boolean;
  request?: Subscription;
}

const PAGE_SIZE = 8;
/** Picture of a meal without photo (recipe or meal of foods). */
export const MEAL_PLACEHOLDER = 'assets/images/meal-placeholder.svg';

@Component({
  selector: 'app-meal-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './meal-template-picker.component.html',
  styleUrls: ['./meal-template-picker.component.scss'],
})
export class MealTemplatePickerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() selected = new EventEmitter<MealTemplateSelection>();

  activeKind: TemplateKind = 'recipe';
  search = '';
  readonly skeletons = [0, 1, 2];

  readonly lists: Record<TemplateKind, LibraryList> = {
    recipe: { meals: [], total: 0, loading: false, refreshing: false, loaded: false },
    foods: { meals: [], total: 0, loading: false, refreshing: false, loaded: false },
  };

  /** Portions chosen per meal, right on its row (1 by default): one click adds it. */
  private servings = new Map<string, number>();
  previewMealId: string | null = null;
  /** Meals added since the modal opened (per meal and in total). */
  private added = new Map<string, number>();
  addedTotal = 0;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Search the lists were loaded with: reopening with the same one reuses them. */
  private loadedSearch = '';

  constructor(private mealsService: MealsService, private translate: TranslateService) {}

  /**
   * The picker lives with the builder: the library is fetched once, before the coach opens it. Rows already seen in
   * this session show at once and are refreshed quietly.
   */
  ngOnInit(): void {
    (Object.keys(this.lists) as TemplateKind[]).forEach((kind) => {
      const known = this.mealsService.librarySnapshot(kind === 'recipe');
      if (known) Object.assign(this.lists[kind], { meals: known.meals, total: known.total, loaded: true });
      this.loadKind(kind, false, !!known);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) this.onOpen();
  }

  ngOnDestroy(): void {
    this.clearSearchTimer();
    (Object.keys(this.lists) as TemplateKind[]).forEach((kind) => this.lists[kind].request?.unsubscribe());
  }

  get active(): LibraryList {
    return this.lists[this.activeKind];
  }

  get canShowMore(): boolean {
    return this.active.meals.length < this.active.total;
  }

  get searching(): boolean {
    return this.lists.recipe.refreshing || this.lists.foods.refreshing;
  }

  setKind(kind: TemplateKind): void {
    this.activeKind = kind;
    this.previewMealId = null;
  }

  close(): void {
    this.clearSearchTimer();
    this.closed.emit();
  }

  onSearchInput(): void {
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => this.loadBoth(), 250);
  }

  clearSearch(): void {
    this.search = '';
    this.onSearchInput();
  }

  servingsOf(meal: any): number {
    return this.servings.get(this.mealKey(meal)) ?? 1;
  }

  changeServings(meal: any, delta: number): void {
    this.setServings(meal, this.servingsOf(meal) + delta);
  }

  setServings(meal: any, value: any): void {
    // Half servings: 1, 1.5, 2, 2.5…
    this.servings.set(this.mealKey(meal), Math.max(1, Math.min(99, Math.round((Number(value) || 1) * 2) / 2)));
  }

  /** The modal stays open (several meals can be added): the row shows how many times it was added. */
  addToPlan(meal: any): void {
    const key = this.mealKey(meal);
    this.selected.emit({ meal, servings: this.servingsOf(meal) });
    this.servings.delete(key);
    this.added.set(key, (this.added.get(key) || 0) + 1);
    this.addedTotal++;
  }

  addedCount(meal: any): number {
    return this.added.get(this.mealKey(meal)) || 0;
  }

  togglePreview(meal: any): void {
    const key = this.mealKey(meal);
    this.previewMealId = this.previewMealId === key ? null : key;
  }

  /** Next page appended under the current rows (they used to be reloaded from the first one). */
  showMore(): void {
    this.loadKind(this.activeKind, true);
  }

  mealKey(meal: any): string {
    return String(meal?.id || meal?.name || 'meal');
  }

  /** Meal photo, else the first food photo, else the illustration: every card has a picture. */
  mealImage(meal: any): string {
    const food = (meal?.foods || []).find((item: any) => item?.foodRef?.imageUrl || item?.imageUrl);
    return meal?.coverImage || meal?.imageUrl || food?.foodRef?.imageUrl || food?.imageUrl || MEAL_PLACEHOLDER;
  }

  usePlaceholder(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(MEAL_PLACEHOLDER)) image.src = MEAL_PLACEHOLDER;
  }

  initial(meal: any): string {
    return String(meal?.name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  mealTypeLabel(meal: any): string {
    const type = String(meal?.mealType || '').toUpperCase();
    if (type && this.translate.instant(type) !== type) return this.translate.instant(type);
    const value = String(meal?.mealType || '').replace(/_/g, ' ').toLowerCase();
    if (!value) return '';
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  ingredientNames(meal: any): string {
    const names = (meal?.foods || [])
      .map((food: any) => food?.name || food?.foodRef?.name)
      .filter(Boolean);
    return names.length ? names.slice(0, 5).join(', ') : this.translate.instant('NO_FOODS_ADDED');
  }

  /** Per serving: a recipe lists its quantities for its yield (meal.servings), the stepper counts servings. */
  macros(meal: any): { calories: number; protein: number; carbs: number; fat: number } {
    const { calories, protein, carbs, fat } = totalMacros(meal?.foods);
    const yieldServings = Number(meal?.servings) > 0 ? Number(meal.servings) : 1;
    return {
      calories: Math.round(calories / yieldServings),
      protein: this.round1(protein / yieldServings),
      carbs: this.round1(carbs / yieldServings),
      fat: this.round1(fat / yieldServings),
    };
  }

  trackByMeal = (_index: number, meal: any): string => this.mealKey(meal);

  /** Cached lists show at once; they are refreshed quietly (a meal saved meanwhile appears). */
  private onOpen(): void {
    this.activeKind = 'recipe';
    this.previewMealId = null;
    this.servings.clear();
    this.added.clear();
    this.addedTotal = 0;
    if (this.search) this.search = '';
    if (this.loadedSearch !== '') { this.loadBoth(); return; }
    (Object.keys(this.lists) as TemplateKind[]).forEach((kind) => {
      const list = this.lists[kind];
      if (!list.loaded && !list.loading) this.loadKind(kind, false);
      else if (list.loaded) this.loadKind(kind, false, true);
    });
  }

  private loadBoth(): void {
    this.loadKind('recipe', false);
    this.loadKind('foods', false);
  }

  /**
   * append: next page under the current rows. quiet: refresh of the first rows already shown.
   * A newer request (typing, tab switch) cancels the previous one, so an old answer never wins.
   */
  private loadKind(kind: TemplateKind, append: boolean, quiet = false): void {
    const list = this.lists[kind];
    const search = this.search.trim();
    const page = append ? Math.floor(list.meals.length / PAGE_SIZE) : 0;
    const size = append || !list.loaded ? PAGE_SIZE : Math.max(PAGE_SIZE, list.meals.length);

    list.request?.unsubscribe();
    list.loading = !list.loaded;
    list.refreshing = list.loaded && !quiet;

    list.request = this.mealsService.getMealLibrary(kind === 'recipe', page, size, search).subscribe({
      next: (response: any) => {
        const meals = Array.isArray(response) ? response : response?.content || [];
        const total = Number(response?.totalElements);
        list.meals = append ? [...list.meals, ...meals] : meals;
        list.total = Number.isFinite(total) ? total : list.meals.length;
        list.loading = false;
        list.refreshing = false;
        list.loaded = true;
        this.loadedSearch = search;
        if (!search) this.mealsService.rememberLibrary(kind === 'recipe', list.meals, list.total);
      },
      error: () => {
        list.loading = false;
        list.refreshing = false;
        if (!append) { list.meals = []; list.total = 0; }
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
