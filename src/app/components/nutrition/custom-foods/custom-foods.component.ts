import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { FoodDraft, foodErrors, foodNumber, foodImageError } from './food-validation';
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
  calories = '';
  protein = '';
  carbs = '';
  fat = '';
  fiber = '';
  sugar = '';
  polyols = '';
  saturated = '';
  polyunsaturated = '';
  monounsaturated = '';
  salt = '';
  servingSize = '100';
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

  isSaving = false;
  touched = new Set<string>();
  imageError = '';
  saveError = '';
  private savedFood: Food | null = null;

  get draft(): FoodDraft {
    return { foodName: this.foodName, servingDescription: this.servingDescription, servingSize: this.servingSize,
      calories: this.calories, protein: this.protein, carbs: this.carbs, fat: this.fat, fiber: this.fiber,
      sugar: this.sugar, polyols: this.polyols, saturated: this.saturated, polyunsaturated: this.polyunsaturated,
      monounsaturated: this.monounsaturated, salt: this.salt };
  }
  get errors(): Record<string, string> { return { ...foodErrors(this.draft), ...(this.imageError ? { image: this.imageError } : {}) }; }
  get canSave(): boolean { return !this.isSaving && Object.keys(this.errors).length === 0; }
  fieldError(field: string): string {
    const error = this.errors[field] || '';
    return this.touched.has(field) || error === 'FOOD_VALID_FAT_SUM' ? error : '';
  }
  touch(field: string) { this.touched.add(field); }

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
    if (this.isSaving) return;
    this.resetForm();
    this.showAddModal = true;
  }

  closeAddModal() {
    if (this.isSaving) return;
    this.showAddModal = false;
    this.resetForm();
  }

  editFood(food: Food) {
    if (this.isSaving) return;
    this.resetForm();
    // Allow editing general foods - backend will create a copy

    this.editingFood = food;
    this.foodName = food.name;
    this.calories = food.calories == null ? '' : String(food.calories);
    this.protein = food.protein == null ? '' : String(food.protein);
    this.carbs = food.carbs == null ? '' : String(food.carbs);
    this.fat = food.fat == null ? '' : String(food.fat);
    this.fiber = food.fiber == null ? '' : String(food.fiber);
    this.sugar = food.sugar == null ? '' : String(food.sugar);
    this.polyols = food.polyols == null ? '' : String(food.polyols);
    this.saturated = food.saturatedFat == null ? '' : String(food.saturatedFat);
    this.polyunsaturated = food.polyunsaturatedFat == null ? '' : String(food.polyunsaturatedFat);
    this.monounsaturated = food.monounsaturatedFat == null ? '' : String(food.monounsaturatedFat);
    this.salt = food.sodium == null ? '' : String(food.sodium);
    this.servingSize = food.servingSize == null ? '' : String(food.servingSize);
    this.servingDescription = food.servingUnit || '';
    this.foodImageUrl = food.imageUrl || '';
    this.hadExistingImage = Boolean(food.imageUrl);
    this.showAddModal = true;
    this.openDropdownId = null;
  }

  async saveFood() {
    if (!this.canSave) return;
    this.isSaving = true;
    this.saveError = '';
    let stage = 'save';
    try {
      const food: Food = {
        name: this.foodName.trim(), calories: foodNumber(this.calories)!, protein: foodNumber(this.protein)!,
        carbs: foodNumber(this.carbs)!, fat: foodNumber(this.fat)!, fiber: foodNumber(this.fiber),
        sugar: foodNumber(this.sugar), polyols: foodNumber(this.polyols), saturatedFat: foodNumber(this.saturated),
        polyunsaturatedFat: foodNumber(this.polyunsaturated), monounsaturatedFat: foodNumber(this.monounsaturated),
        sodium: foodNumber(this.salt), servingSize: foodNumber(this.servingSize)!, servingUnit: this.servingDescription.trim(),
      };
      // Retain the returned ID if the image request fails, so retry updates instead of creating again.
      const id = this.savedFood?.id || this.editingFood?.id;
      this.savedFood = await firstValueFrom(id ? this.nutritionService.updateFood(id, food) : this.nutritionService.createFood(food));
      if (this.selectedImageFile) {
        stage = 'image';
        this.savedFood = await firstValueFrom(this.nutritionService.uploadFoodImage(this.savedFood.id!, this.selectedImageFile));
      } else if (this.hadExistingImage && !this.foodImageUrl) {
        stage = 'image';
        this.savedFood = await firstValueFrom(this.nutritionService.removeFoodImage(this.savedFood.id!));
      }
      this.isSaving = false;
      this.loadFoods();
      this.closeAddModal();
    } catch (error) {
      if (stage === 'image') { this.imageError = 'FOOD_VALID_IMAGE_FAILED'; this.touched.add('image'); }
      else this.saveError = 'FOOD_VALID_SAVE_FAILED';
    } finally { this.isSaving = false; }
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.isSaving) return;
    this.touched.add('image');
    this.imageError = foodImageError(file);
    if (this.imageError) { this.selectedImageFile = null; return; }
    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => { if (this.selectedImageFile === file) this.foodImageUrl = String(reader.result || ''); };
    reader.readAsDataURL(file);
  }

  removeSelectedImage() {
    if (this.isSaving) return;
    this.selectedImageFile = null;
    this.foodImageUrl = '';
    this.imageError = '';
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
    this.touched.clear();
    this.imageError = '';
    this.saveError = '';
    this.savedFood = null;
    this.foodName = '';
    this.calories = '';
    this.protein = '';
    this.carbs = '';
    this.fat = '';
    this.fiber = '';
    this.sugar = '';
    this.polyols = '';
    this.saturated = '';
    this.polyunsaturated = '';
    this.monounsaturated = '';
    this.salt = '';
    this.servingSize = '100';
    this.servingDescription = 'Grams';
    this.foodImageUrl = '';
    this.selectedImageFile = null;
    this.hadExistingImage = false;
    this.editingFood = null;
  }
}
