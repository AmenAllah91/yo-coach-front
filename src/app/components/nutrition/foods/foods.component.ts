import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { NutritionService, Food } from '../../../service/nutrition.service';
import { ScrollLoaderComponent } from '../../scroll-loader/scroll-loader.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-foods',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, ScrollLoaderComponent, TranslateModule],
  templateUrl: './foods.component.html',
  styleUrls: ['./foods.component.scss']
})
export class FoodsComponent implements OnInit {
  foods: Food[] = [];
  filteredFoods: Food[] = [];
  searchTerm = '';
  showAddModal = false;
  showDeleteModal = false;
  editingFood: Food | null = null;
  foodToDelete: Food | null = null;
  openDropdownId: string | null = null;
  isLoading = false;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Form fields
  foodName = '';
  calories = 0;
  protein = 0;
  carbs = 0;
  fat = 0;
  fiber = 0;
  sugar = 0;
  saturated = 0;
  polyunsaturated = 0;
  monounsaturated = 0;
  salt = 0;
  servingSize = 100;
  servingDescription = 'Grams';

  constructor(private nutritionService: NutritionService) {}

  ngOnInit() {
    this.loadFoods();
  }

  loadFoods() {
    this.isLoading = true;
    this.nutritionService.getFoods(this.currentPage, this.pageSize, this.searchTerm || undefined, false).subscribe({
      next: (response) => {
        this.foods = response.content || [];
        this.filteredFoods = this.foods;
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading foods:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.currentPage = 0;
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

  openAddModal() {
    this.resetForm();
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.resetForm();
  }

  editFood(food: Food) {
    this.editingFood = food;
    this.foodName = food.name;
    this.calories = food.calories;
    this.protein = food.protein;
    this.carbs = food.carbs;
    this.fat = food.fat;
    this.fiber = food.fiber || 0;
    this.sugar = food.sugar || 0;
    this.saturated = food.saturatedFat || 0;
    this.polyunsaturated = food.polyunsaturatedFat || 0;
    this.monounsaturated = food.monounsaturatedFat || 0;
    this.salt = food.sodium || 0;
    this.servingSize = food.servingSize;
    this.servingDescription = food.servingUnit;
    this.showAddModal = true;
    this.openDropdownId = null;
  }

  saveFood() {
    if (!this.foodName.trim()) return;

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
        next: () => {
          this.loadFoods();
          this.closeAddModal();
        },
        error: (error) => console.error('Error updating food:', error)
      });
    } else {
      this.nutritionService.createFood(food).subscribe({
        next: () => {
          this.loadFoods();
          this.closeAddModal();
        },
        error: (error) => console.error('Error creating food:', error)
      });
    }
  }

  deleteFood(food: Food) {
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
        error: (error) => console.error('Error deleting food:', error)
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.foodToDelete = null;
  }

  toggleDropdown(foodId: string | null) {
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
    this.saturated = 0;
    this.polyunsaturated = 0;
    this.monounsaturated = 0;
    this.salt = 0;
    this.servingSize = 100;
    this.servingDescription = 'Grams';
    this.editingFood = null;
  }
}
