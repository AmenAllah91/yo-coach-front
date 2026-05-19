/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { MealsService } from 'app/service/meals.service';
import { NutritionService } from 'app/service/nutrition.service';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './meal-editor.component.html',
  styleUrls: ['./meal-editor.component.scss'],
})
export class MealEditorComponent implements OnInit {
  id: string | null = null;
  name = '';
  foods: any[] = [];
  loading = false;

  isFoodModalOpen = false;
  foodSearch = '';
  filteredFoods: any[] = [];
  foodStep: 'list' | 'detail' = 'list';
  selectedFood: any = null;
  foodQty = 100;
  adj = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mealsService: MealsService,
    private nutritionService: NutritionService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id) {
      this.load(this.id);
    }
  }

  load(id: string) {
    this.loading = true;
    this.mealsService.getMeal(id).subscribe({
      next: (m: any) => {
        this.loading = false;
        if (!m) return;
        this.name = m.name || m.title || '';
        this.foods = (m.foods || []).map((f: any) => ({
          id: f.id || (crypto.randomUUID?.() ?? Date.now().toString()),
          name: f.name || f.foodRef?.name || '',
          quantity: f.quantity ?? 100,
          unit: f.unit || 'g',
          foodRef: f.foodRef,
          _calories: f.foodRef ? this.computeMacro(f.foodRef.energy, f.quantity ?? 100, f.foodRef.servingSize) : 0,
          _protein: f.foodRef ? this.computeMacro(f.foodRef.protein, f.quantity ?? 100, f.foodRef.servingSize) : 0,
          _carbs: f.foodRef ? this.computeMacro(f.foodRef.carbohydrates, f.quantity ?? 100, f.foodRef.servingSize) : 0,
          _fat: f.foodRef ? this.computeMacro(f.foodRef.fat, f.quantity ?? 100, f.foodRef.servingSize) : 0,
        }));
      },
      error: () => this.loading = false,
    });
  }

  computeMacro(val: number, qty: number, servingSize: number): number {
    const s = servingSize || 100;
    return ((val || 0) * qty) / s;
  }

  openFoodModal() {
    this.isFoodModalOpen = true;
    this.foodStep = 'list';
    this.foodSearch = '';
    this.filteredFoods = [];
    this.selectedFood = null;
    this.filterFoods();
  }

  closeFoodModal() {
    this.isFoodModalOpen = false;
    this.foodStep = 'list';
    this.foodSearch = '';
    this.filteredFoods = [];
    this.selectedFood = null;
    this.foodQty = 100;
  }

  filterFoods() {
    this.nutritionService.filteredFoods(0, 3, this.foodSearch || '').subscribe({
      next: (res: any) => {
        this.filteredFoods = res.content;
      },
    });
  }

  showFoodDetail(food: any) {
    this.foodStep = 'detail';
    this.selectedFood = food;
    this.foodQty = 100;
    this.recomputeAdjusted();
  }

  backToList() {
    this.foodStep = 'list';
    this.selectedFood = null;
    this.filterFoods();
  }

  recomputeAdjusted() {
    if (!this.selectedFood) return;
    const ratio = (this.foodQty || 0) / (this.selectedFood.servingSize || 100);
    this.adj = {
      calories: Math.round((this.selectedFood.energy || 0) * ratio),
      protein: Math.round(((this.selectedFood.protein || 0) * ratio) * 10) / 10,
      carbohydrates: Math.round(((this.selectedFood.carbohydrates || 0) * ratio) * 10) / 10,
      fat: Math.round(((this.selectedFood.fat || 0) * ratio) * 10) / 10,
    };
  }

  addFoodToMeal() {
    if (!this.selectedFood) return;
    const food = {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      name: this.selectedFood.name,
      quantity: this.foodQty || 100,
      unit: 'g',
      foodRef: this.selectedFood,
      _calories: this.adj.calories,
      _protein: this.adj.protein,
      _carbs: this.adj.carbohydrates,
      _fat: this.adj.fat,
    };
    this.foods.push(food);
    this.closeFoodModal();
  }

  removeFoodRow(i: number) {
    this.foods.splice(i, 1);
  }

  editFoodRow(i: number) {
    const f = this.foods[i];
    if (f.foodRef) {
      this.selectedFood = f.foodRef;
      this.foodQty = f.quantity || 100;
      this.foodStep = 'detail';
      this.isFoodModalOpen = true;
      this.recomputeAdjusted();
    }
  }

  saveMeal() {
    const payload = { name: this.name, foods: this.foods.map((f: any) => ({
      id: f.id,
      name: f.name,
      quantity: f.quantity,
      unit: f.unit,
      foodRef: f.foodRef ? { id: f.foodRef.id } : undefined,
    })) };
    this.loading = true;
    if (this.id) {
      this.mealsService.updateMeal(this.id, payload).subscribe({
        next: () => { this.loading = false; this.router.navigate(['/nutrition/meals']); },
        error: () => this.loading = false,
      });
    } else {
      this.mealsService.createMeal(payload).subscribe({
        next: () => { this.loading = false; this.router.navigate(['/nutrition/meals']); },
        error: () => this.loading = false,
      });
    }
  }

  saveAsTemplate() {
    const payload = { name: this.name, foods: this.foods.map((f: any) => ({
      name: f.name, quantity: f.quantity, unit: f.unit, foodRef: f.foodRef ? { id: f.foodRef.id } : undefined,
    })) };
    this.mealsService.saveTemplate(payload).subscribe({
      next: () => {
        alert('Template saved');
        this.router.navigate(['/nutrition/meals']);
      },
      error: (err: any) => {
        console.error('Save template failed', err);
        alert('Failed to save template. Check console for details.');
      },
    });
  }

  getTotalCalories(): number {
    return Math.round(this.foods.reduce((sum, f) => sum + (f._calories || 0), 0));
  }

  getTotalProtein(): number {
    return Math.round(this.foods.reduce((sum, f) => sum + (f._protein || 0), 0) * 10) / 10;
  }

  getTotalCarbs(): number {
    return Math.round(this.foods.reduce((sum, f) => sum + (f._carbs || 0), 0) * 10) / 10;
  }

  getTotalFat(): number {
    return Math.round(this.foods.reduce((sum, f) => sum + (f._fat || 0), 0) * 10) / 10;
  }

  cancel() {
    this.router.navigate(['/nutrition/meals']);
  }
}
