import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { NutritionService, Food } from '../../../service/nutrition.service';

@Component({
  selector: 'app-custom-foods',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './custom-foods.component.html',
  styleUrls: ['./custom-foods.component.scss']
})
export class CustomFoodsComponent implements OnInit {
  goBack(): void { window.history.back(); }

  getFoodIcon(name: string): string {
    const value = (name || '').toLowerCase();
    if (value.includes('egg') || value.includes('oeuf')) return 'fa-egg';
    if (value.includes('fish') || value.includes('poisson') || value.includes('tuna') || value.includes('thon')) return 'fa-fish';
    if (value.includes('chicken') || value.includes('poulet') || value.includes('nugget')) return 'fa-drumstick-bite';
    if (value.includes('rice') || value.includes('riz') || value.includes('couscous')) return 'fa-bowl-rice';
    if (value.includes('potato') || value.includes('patate')) return 'fa-seedling';
    return 'fa-apple-whole';
  }

  foods: Food[] = [];
  searchTerm = '';
  showAddModal = false;
  showDeleteModal = false;
  editingFood: Food | null = null;
  foodToDelete: Food | null = null;
  openDropdownId: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  loading = false;

  // Show all foods by default
  customOnly = false;

  // Form fields
  foodName = '';
  calories = 0;
  protein = 0;
  carbs = 0;
  fat = 0;
  fiber = 0;
  sugar = 0;
  polyols = 0;
  saturated = 0;
  polyunsaturated = 0;
  monounsaturated = 0;
  salt = 0;
  servingSize = 100;
  servingDescription = 'Grams';
  foodImageUrl = '';
  selectedImageFile: File | null = null;
  private hadExistingImage = false;

  constructor(
    private nutritionService: NutritionService,
  ) {}

  getCalculatedCalories(protein: number | null | undefined, carbs: number | null | undefined, fat: number | null | undefined): number {
    return Math.round(((Number(protein) || 0) * 4) + ((Number(carbs) || 0) * 4) + ((Number(fat) || 0) * 9));
  }

  getFoodCarbs(food: Food): number {
    return Number(food.carbs ?? (food as Food & { carbohydrates?: number }).carbohydrates ?? 0);
  }

  recalculateCalories(): void {
    this.calories = this.getCalculatedCalories(this.protein, this.carbs, this.fat);
  }

  ngOnInit() {
    this.loadFoods();
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.openDropdownId = null;
    });
  }

  loadFoods() {
    this.loading = true;
    this.nutritionService.getFoods(this.currentPage, this.pageSize, this.searchTerm || undefined, this.customOnly).subscribe({
      next: (response) => {
        this.foods = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading foods:', error);
        this.loading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 0;
    this.loadFoods();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadFoods();
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadFoods();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadFoods();
    }
  }

  get filteredFoods() {
    return this.foods;
  }

  openAddModal() {
    this.resetForm();
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.resetForm();
  }

  editFood(food: Food) {
    // Allow editing general foods - backend will create a copy

    this.editingFood = food;
    this.foodName = food.name;
    this.calories = food.calories;
    this.protein = food.protein;
    this.carbs = this.getFoodCarbs(food);
    this.fat = food.fat;
    this.recalculateCalories();
    this.fiber = food.fiber || 0;
    this.sugar = food.sugar || 0;
    this.polyols = 0;
    this.saturated = food.saturatedFat || 0;
    this.polyunsaturated = food.polyunsaturatedFat || 0;
    this.monounsaturated = food.monounsaturatedFat || 0;
    this.salt = food.sodium || 0;
    this.servingSize = food.servingSize;
    this.servingDescription = food.servingUnit;
    this.foodImageUrl = food.imageUrl || '';
    this.hadExistingImage = Boolean(food.imageUrl);
    this.showAddModal = true;
    this.openDropdownId = null;
  }

  saveFood() {
    if (!this.foodName.trim()) return;
    this.recalculateCalories();

    const food: Food = {
      name: this.foodName,
      calories: this.calories,
      protein: this.protein,
      carbs: this.carbs,
      fat: this.fat,
      fiber: this.fiber,
      sugar: this.sugar,
      saturatedFat: this.saturated,
      polyunsaturatedFat: this.polyunsaturated,
      monounsaturatedFat: this.monounsaturated,
      sodium: this.salt,
      servingSize: this.servingSize,
      servingUnit: this.servingDescription
    };

    if (this.editingFood) {
      this.nutritionService.updateFood(this.editingFood.id!, food).subscribe({
        next: (updatedFood) => {
          // Update the editing food ID in case a new copy was created
          if (updatedFood.id !== this.editingFood!.id) {
            this.editingFood!.id = updatedFood.id;
          }
          this.saveFoodImage(updatedFood);
        },
        error: (error) => {
          console.error('Error updating food:', error);
          let errorMessage = 'Unable to update this food item.';

          if (error.status === 403) {
            errorMessage = 'Cannot update this food item. It may be a general food or not owned by you.';
          } else if (error.status === 404) {
            errorMessage = 'Food item not found.';
          } else if (error.status === 409) {
            errorMessage = 'Cannot update this food item as it is currently in use.';
          }

          // You can replace this with a toast notification or other UI feedback
          console.error(errorMessage);
        }
      });
    } else {
      this.nutritionService.createFood(food).subscribe({
        next: (createdFood) => {
          this.saveFoodImage(createdFood);
        },
        error: (error) => console.error('Error creating food:', error)
      });
    }
  }

  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => this.foodImageUrl = String(reader.result || '');
    reader.readAsDataURL(file);
  }

  removeSelectedImage() {
    this.selectedImageFile = null;
    this.foodImageUrl = '';
  }

  private saveFoodImage(food: Food) {
    if (!food.id) return this.finishSave();
    if (this.selectedImageFile) {
      this.nutritionService.uploadFoodImage(food.id, this.selectedImageFile).subscribe({
        next: () => this.finishSave(),
        error: (error) => console.error('Error uploading food image:', error),
      });
    } else if (this.hadExistingImage && !this.foodImageUrl) {
      this.nutritionService.removeFoodImage(food.id).subscribe({
        next: () => this.finishSave(),
        error: (error) => console.error('Error removing food image:', error),
      });
    } else {
      this.finishSave();
    }
  }

  private finishSave() {
    this.loadFoods();
    this.closeAddModal();
  }

  deleteFood(food: Food) {
    // Check if this is a general food (cannot be deleted)
    if (food.isGeneral) {
      console.error('Cannot delete general food:', food.name);
      return;
    }

    this.foodToDelete = food;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  confirmDelete() {
    if (this.foodToDelete) {
      this.nutritionService.deleteFood(this.foodToDelete.id!).subscribe({
        next: () => {
          this.loadFoods();
          this.closeDeleteModal();
        },
        error: (error) => {
          console.error('Error deleting food:', error);
          let errorMessage = 'Unable to delete this food item.';

          if (error.status === 403) {
            errorMessage = 'Cannot delete this food item. It may be a general food or not owned by you.';
          } else if (error.status === 404) {
            errorMessage = 'Food item not found.';
          } else if (error.status === 409) {
            errorMessage = 'Cannot delete this food item as it is used in existing meal plans.';
          }

          // You can replace this with a toast notification or other UI feedback
          console.error(errorMessage);
        }
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.foodToDelete = null;
  }

  toggleDropdown(foodId: string | null, event: Event) {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === foodId ? null : foodId;
  }

  resetForm() {
    this.foodName = '';
    this.calories = 0;
    this.protein = 0;
    this.carbs = 0;
    this.fat = 0;
    this.fiber = 0;
    this.sugar = 0;
    this.polyols = 0;
    this.saturated = 0;
    this.polyunsaturated = 0;
    this.monounsaturated = 0;
    this.salt = 0;
    this.servingSize = 100;
    this.servingDescription = 'Grams';
    this.foodImageUrl = '';
    this.selectedImageFile = null;
    this.hadExistingImage = false;
    this.editingFood = null;
  }
}
