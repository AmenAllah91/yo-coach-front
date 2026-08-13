import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FoodReplacementGroupsService,
  FoodReplacementGroup,
  FoodReplacementGroupItem
} from 'app/service/food-replacement-groups.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  foodRefId?: string;
  category?: string;
}

@Component({
  selector: 'app-modal-replace-food',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './modal-replace-food.template.html',
  styleUrl: './modal-replace-food.component.scss',
})
export class ModalReplaceFoodComponent implements OnChanges {
  @Input() show = false;
  @Input() originalFood: Food | null = null;
  @Input() mealPlanId: string | null = null;
  @Input() mealDayId: string | null = null;
  @Input() mealId: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() replace = new EventEmitter<{
    replacementFoodRefId: string;
    quantity: number;
    unit: string;
  }>();

  groups: FoodReplacementGroup[] = [];
  selectedFoodId: string | null = null;
  selectedGroup: FoodReplacementGroup | null = null;
  selectedFood: FoodReplacementGroupItem | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private foodGroupService: FoodReplacementGroupsService,
    private translate: TranslateService
  ) {}

  get alternatives(): Array<{ food: FoodReplacementGroupItem; group: FoodReplacementGroup }> {
    const seen = new Set<string>();
    return this.groups.flatMap(group =>
      group.foods
        .filter(food => {
          if (seen.has(food.foodRefId)) return false;
          seen.add(food.foodRefId);
          return true;
        })
        .map(food => ({ food, group }))
    );
  }

  get replacementGroupLabel(): string {
    const category = (this.originalFood?.category || '').trim();
    if (!category) return 'same';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  displayMacro(value: unknown): string {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0';

    const rounded = Math.round(numericValue * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show']?.currentValue && this.originalFood) {
      this.loadReplacementGroups();
    }
  }

  private loadReplacementGroups() {
    if (!this.originalFood?.id || !this.mealPlanId || !this.mealDayId || !this.mealId) {
      this.error = this.translate.instant('MISSING_REPLACEMENT_CONTEXT');
      return;
    }

    this.loading = true;
    this.error = null;
    this.groups = [];
    this.selectedFoodId = null;
    this.selectedFood = null;
    this.selectedGroup = null;

    this.foodGroupService
      .getReplacementGroupsForAssignedFood(
        this.mealPlanId,
        this.mealDayId,
        this.mealId,
        this.originalFood.id
      )
      .subscribe({
        next: (groups) => {
          const originalFoodRefId = this.originalFood?.foodRefId;
          const originalFoodName = (this.originalFood?.name || '').trim().toLowerCase();

          this.groups = (groups || [])
            .filter((group) => group.active && group.foods?.length > 0)
            .map((group) => ({
              ...group,
              foods: group.foods.filter((food) => {
                const sameRef = originalFoodRefId && food.foodRefId === originalFoodRefId;
                const sameName = (food.name || '').trim().toLowerCase() === originalFoodName;
                return !sameRef && !sameName;
              }),
            }))
            .filter((group) => group.foods.length > 0);

          this.loading = false;

          if (this.groups.length === 0) {
            this.error = this.translate.instant('NO_REPLACEMENT_FOODS_FOUND');
          }
        },
        error: (err) => {
          console.error('Error loading replacement groups:', err);
          this.error = this.translate.instant('LOAD_REPLACEMENT_OPTIONS_ERROR');
          this.loading = false;
        },
      });
  }

  selectReplacement(food: FoodReplacementGroupItem, group: FoodReplacementGroup) {
    this.selectedFoodId = food.foodRefId;
    this.selectedFood = food;
    this.selectedGroup = group;
  }

  confirmReplace() {
    if (!this.selectedFoodId || !this.selectedFood) return;

    this.replace.emit({
      replacementFoodRefId: this.selectedFoodId,
      quantity: Number(this.selectedFood.quantity || 100),
      unit: this.selectedFood.unit || 'g',
    });
  }

  onClose() {
    this.selectedFoodId = null;
    this.selectedFood = null;
    this.selectedGroup = null;
    this.groups = [];
    this.error = null;
    this.close.emit();
  }
}
