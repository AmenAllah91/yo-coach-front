/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { MealsService } from 'app/service/meals.service';
import { DeleteMealModalComponent } from './delete-meal-modal/delete-meal-modal.component';
import { AddMealModalComponent } from './add-meal-modal.component';

@Component({
  selector: 'app-meals-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    FeatherModule,
    DeleteMealModalComponent,
    AddMealModalComponent,
  ],
  templateUrl: './meals-list.component.html',
  styleUrls: ['./meals-list.component.scss'],
})
export class MealsListComponent implements OnInit, OnDestroy {
  meals: any[] = [];
  search = '';
  activeMealMenuId: string | null = null;
  loading = false;

  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  pagesArray: number[] = [];

  showDeleteModal = false;
  mealToDelete: any = null;

  showAddMealModal = false;
  mealToEdit: any | null = null;
  loadingMealToEdit = false;

  private documentClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) this.activeMealMenuId = null;
  };

  constructor(private mealsService: MealsService) {}

  ngOnInit(): void {
    this.load();
    document.addEventListener('click', this.documentClickHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.documentClickHandler);
  }

  goBack(): void {
    window.history.back();
  }

  openAddMealModal(): void {
    this.mealToEdit = null;
    this.showAddMealModal = true;
  }

  closeAddMealModal(): void {
    this.showAddMealModal = false;
    this.mealToEdit = null;
  }

  onMealSaved(): void {
    this.closeAddMealModal();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.mealsService.getMeals(this.currentPage, this.pageSize, this.search).subscribe({
      next: (response: any) => {
        this.meals = Array.isArray(response) ? response : response?.content || [];
        this.totalElements = Array.isArray(response)
          ? this.meals.length
          : response?.totalElements || 0;
        this.totalPages = Array.isArray(response) ? 1 : response?.totalPages || 0;
        this.currentPage = Array.isArray(response)
          ? 0
          : response?.number ?? this.currentPage;
        this.pagesArray = Array.from({ length: this.totalPages }, (_, index) => index);
        this.loading = false;
      },
      error: () => {
        this.meals = [];
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.load();
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.load();
  }

  previousPage(): void {
    this.onPageChange(this.currentPage - 1);
  }

  nextPage(): void {
    this.onPageChange(this.currentPage + 1);
  }

  toggleDropdown(id: string, event: Event): void {
    event.stopPropagation();
    this.activeMealMenuId = this.activeMealMenuId === id ? null : id;
  }

  editMeal(meal: any): void {
    this.loadingMealToEdit = true;
    this.activeMealMenuId = null;
    this.mealsService.getMeal(meal.id).subscribe({
      next: (fullMeal: any) => {
        this.loadingMealToEdit = false;
        this.mealToEdit = fullMeal || meal;
        this.showAddMealModal = true;
      },
      error: () => {
        this.loadingMealToEdit = false;
        this.mealToEdit = meal;
        this.showAddMealModal = true;
      },
    });
  }

  duplicateMeal(meal: any): void {
    this.mealsService.duplicateMeal(meal.id).subscribe(() => this.load());
  }

  deleteMeal(meal: any): void {
    this.mealToDelete = meal;
    this.showDeleteModal = true;
  }

  confirmDeleteMeal(): void {
    if (!this.mealToDelete) return;
    this.mealsService.deleteMeal(this.mealToDelete.id).subscribe(() => {
      this.showDeleteModal = false;
      this.mealToDelete = null;
      this.load();
    });
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.mealToDelete = null;
  }

  mealMacros(meal: any): { protein: number; carbs: number; fat: number; calories: number } {
    const targets = meal?.mealTargets;
    if (targets) {
      return {
        protein: this.round1(targets.proteinG),
        carbs: this.round1(targets.carbsG),
        fat: this.round1(targets.fatG),
        calories: Math.round(Number(targets.calories) || 0),
      };
    }

    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let calories = 0;

    for (const food of meal?.foods || []) {
      if (food?.manual) {
        protein += Number(food.protein) || 0;
        carbs += Number(food.carbohydrates ?? food.carbs) || 0;
        fat += Number(food.fat) || 0;
        calories += Number(food.calories) || 0;
        continue;
      }

      const ref = food?.foodRef;
      if (!ref) continue;
      const quantity = Number(food.quantity) || Number(ref.servingSize) || 100;
      const servingSize = Number(ref.servingSize) || 100;
      const ratio = quantity / servingSize;
      protein += (Number(ref.protein) || 0) * ratio;
      carbs += (Number(ref.carbohydrates) || 0) * ratio;
      fat += (Number(ref.fat) || 0) * ratio;
      calories += (Number(ref.energy ?? ref.calories) || 0) * ratio;
    }

    return {
      protein: this.round1(protein),
      carbs: this.round1(carbs),
      fat: this.round1(fat),
      calories: Math.round(calories),
    };
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private round1(value: unknown): number {
    return Math.round((Number(value) || 0) * 10) / 10;
  }
}
