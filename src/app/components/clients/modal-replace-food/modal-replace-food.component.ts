import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FoodReplacementGroupsService,
  FoodReplacementGroup,
  FoodReplacementGroupItem
} from 'app/service/food-replacement-groups.service';

export interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  foodRefId?: string;
}

@Component({
  selector: 'app-modal-replace-food',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-replace-food.component.html',
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

  constructor(private foodGroupService: FoodReplacementGroupsService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show']?.currentValue && this.originalFood) {
      this.loadReplacementGroups();
    }
  }

  private loadReplacementGroups() {
    if (!this.originalFood?.id || !this.mealPlanId || !this.mealDayId || !this.mealId) {
      this.error = 'Missing replacement context';
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
            this.error = 'No replacement foods found for this food';
          }
        },
        error: (err) => {
          console.error('Error loading replacement groups:', err);
          this.error = 'Failed to load replacement options';
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
