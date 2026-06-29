/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { MealsService } from 'app/service/meals.service';
import { DeleteMealModalComponent } from './delete-meal-modal/delete-meal-modal.component';

@Component({
  selector: 'app-meals-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FeatherModule, DeleteMealModalComponent],
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

  private documentClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.activeMealMenuId = null;
    }
  };

  constructor(
    private mealsService: MealsService,
    private router: Router,
    private location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.load();
    document.addEventListener('click', this.documentClickHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.documentClickHandler);
  }

  load() {
    this.loading = true;
    this.mealsService.getMeals(this.currentPage, this.pageSize, this.search).subscribe({
      next: (res: any) => {
        this.meals = Array.isArray(res) ? res : res.content || [];
        this.totalElements = Array.isArray(res) ? this.meals.length : (res.totalElements || 0);
        this.totalPages = Array.isArray(res) ? 1 : (res.totalPages || 0);
        this.currentPage = Array.isArray(res) ? 0 : (res.number ?? this.currentPage);
        this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  onSearch() {
    this.currentPage = 0;
    this.load();
  }

  onPageChange(page: number) {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.load();
  }

  previousPage() {
    this.onPageChange(this.currentPage - 1);
  }

  nextPage() {
    this.onPageChange(this.currentPage + 1);
  }

  toggleDropdown(id: string, event: Event) {
    event.stopPropagation();
    this.activeMealMenuId = this.activeMealMenuId === id ? null : id;
  }

  editMeal(m: any) {
    this.router.navigate(['/nutrition/meals', m.id]);
  }

  duplicateMeal(m: any) {
    this.mealsService.duplicateMeal(m.id).subscribe(() => this.load());
  }

  deleteMeal(m: any) {
    this.mealToDelete = m;
    this.showDeleteModal = true;
  }

  confirmDeleteMeal() {
    if (!this.mealToDelete) return;
    this.mealsService.deleteMeal(this.mealToDelete.id).subscribe(() => {
      this.showDeleteModal = false;
      this.mealToDelete = null;
      this.load();
    });
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.mealToDelete = null;
  }

  mealMacros(m: any): { protein: number; carbs: number; fat: number; calories: number } {
    const foods: any[] = m.foods || [];
    let protein = 0, carbs = 0, fat = 0, calories = 0;
    for (const f of foods) {
      const r = f.foodRef;
      if (!r) continue;
      const qty = f.quantity || 100;
      const ss = r.servingSize || 100;
      const ratio = qty / ss;
      protein += (r.protein || 0) * ratio;
      carbs += (r.carbohydrates || 0) * ratio;
      fat += (r.fat || 0) * ratio;
      calories += (r.energy || 0) * ratio;
    }
    return {
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
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
}
