import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { NutritionService } from '../../../service/nutrition.service';
import {
  FoodReplacementGroup,
  FoodReplacementGroupItem,
  FoodReplacementGroupsService
} from "../../../service/food-replacement-groups.service";


type ViewMode = 'LIST' | 'EDITOR';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-food-replacement-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './food-replacement-groups.component.html',
  styleUrls: ['./food-replacement-groups.component.scss'],
})
export class FoodReplacementGroupsComponent implements OnInit {
  view: ViewMode = 'LIST';

  groups: FoodReplacementGroup[] = [];
  foods: any[] = [];

  searchTerm = '';
  statusFilter: StatusFilter = 'all';
  loading = false;

  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  pagesArray: number[] = [];

  editingGroup: FoodReplacementGroup | null = null;

  groupName = '';
  groupDescription = '';
  clientNote = '';
  groupFoods: FoodReplacementGroupItem[] = [];

  showAddFoodModal = false;
  foodSearchTerm = '';
  foodTab: 'all' | 'custom' = 'all';
  selectedFood: any | null = null;
  selectedQuantity = 100;
  selectedUnit = 'g';
  openGroupActionsId: string | null = null;

  constructor(
    private replacementGroupsService: FoodReplacementGroupsService,
    private nutritionService: NutritionService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadGroups();
    this.loadFoods();
  }

  @HostListener('document:click')
  closeGroupActions(): void {
    this.openGroupActionsId = null;
  }

  getGroupActionsId(group: FoodReplacementGroup): string {
    return String(group.id || group.name || '');
  }

  toggleGroupActions(group: FoodReplacementGroup, event: MouseEvent): void {
    event.stopPropagation();
    const id = this.getGroupActionsId(group);
    this.openGroupActionsId = this.openGroupActionsId === id ? null : id;
  }

  isGroupActionsOpen(group: FoodReplacementGroup): boolean {
    return this.openGroupActionsId === this.getGroupActionsId(group);
  }

  get filteredFoods(): any[] {
    const search = this.foodSearchTerm.trim().toLowerCase();

    return this.foods.filter((food) => {
      const foodId = this.getFoodId(food);
      const name = this.getFoodName(food).toLowerCase();
      const isCustom = !this.isGeneralFood(food);
      const alreadyAdded = this.groupFoods.some((item) => item.foodRefId === foodId);

      return !alreadyAdded &&
        (!search || name.includes(search)) &&
        (this.foodTab === 'all' || isCustom);
    });
  }

  get previewSourceFood(): FoodReplacementGroupItem | null {
    return this.groupFoods.length ? this.groupFoods[0] : null;
  }

  get previewReplacementFoods(): FoodReplacementGroupItem[] {
    return this.groupFoods.slice(1);
  }

  loadGroups(): void {
    this.loading = true;

    const active =
      this.statusFilter === 'all'
        ? undefined
        : this.statusFilter === 'active';

    this.replacementGroupsService
      .getGroups(this.currentPage, this.pageSize, this.searchTerm, active)
      .subscribe({
        next: (page) => {
          this.groups = page.content || [];
          this.totalElements = page.totalElements || 0;
          this.totalPages = page.totalPages || 0;
          this.currentPage = page.number ?? this.currentPage;
          this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading food replacement groups:', error);
          this.loading = false;
        },
      });
  }

  loadFoods(): void {
    this.nutritionService.getFoods(0, 100).subscribe({
      next: (response) => {
        this.foods = response.content || [];
      },
      error: (error) => console.error('Error loading foods:', error),
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadGroups();
  }

  onStatusChange(): void {
    this.currentPage = 0;
    this.loadGroups();
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.loadGroups();
  }

  previousPage(): void {
    this.onPageChange(this.currentPage - 1);
  }

  nextPage(): void {
    this.onPageChange(this.currentPage + 1);
  }

  goBack(): void {
    if (this.view === 'EDITOR') {
      this.closeEditor();
      return;
    }

    this.location.back();
  }

  openCreateGroup(): void {
    this.editingGroup = null;
    this.groupName = '';
    this.groupDescription = '';
    this.clientNote = '';
    this.groupFoods = [];
    this.view = 'EDITOR';
  }

  openEditGroup(group: FoodReplacementGroup): void {
    this.editingGroup = group;
    this.groupName = group.name;
    this.groupDescription = group.description || '';
    this.clientNote = group.clientNote || '';
    this.groupFoods = (group.foods || []).map((food) => ({ ...food }));
    this.view = 'EDITOR';
  }

  closeEditor(): void {
    this.view = 'LIST';
    this.showAddFoodModal = false;
    this.editingGroup = null;
  }

  saveGroup(): void {
    if (!this.groupName.trim() || this.groupFoods.length < 2) {
      return;
    }

    const payload: FoodReplacementGroup = {
      id: this.editingGroup?.id,
      name: this.groupName.trim(),
      description: this.groupDescription.trim(),
      clientNote: this.clientNote.trim(),
      active: this.editingGroup?.active ?? true,
      foods: this.groupFoods.map((food) => ({
        foodRefId: food.foodRefId,
        quantity: food.quantity,
        unit: food.unit,
      })),
    };

    const request = this.editingGroup?.id
      ? this.replacementGroupsService.updateGroup(this.editingGroup.id, payload)
      : this.replacementGroupsService.createGroup(payload);

    request.subscribe({
      next: () => {
        this.loadGroups();
        this.closeEditor();
      },
      error: (error) => console.error('Error saving food replacement group:', error),
    });
  }

  deleteGroup(group: FoodReplacementGroup): void {
    if (!group.id) return;

    this.replacementGroupsService.deleteGroup(group.id).subscribe({
      next: () => this.loadGroups(),
      error: (error) => console.error('Error deleting replacement group:', error),
    });
  }

  openAddFoodModal(): void {
    this.foodSearchTerm = '';
    this.foodTab = 'all';
    this.selectedFood = null;
    this.selectedQuantity = 100;
    this.selectedUnit = 'g';
    this.showAddFoodModal = true;
  }

  closeAddFoodModal(): void {
    this.showAddFoodModal = false;
    this.selectedFood = null;
  }

  selectFood(food: any): void {
    this.selectedFood = food;
    this.selectedQuantity = this.getServingSize(food);
    this.selectedUnit = this.getServingUnit(food);
  }

  addSelectedFood(): void {
    if (!this.selectedFood) return;

    const foodRefId = this.getFoodId(this.selectedFood);
    const existingIndex = this.groupFoods.findIndex((food) => food.foodRefId === foodRefId);

    const item: FoodReplacementGroupItem = {
      foodRefId,
      quantity: this.selectedQuantity,
      unit: this.selectedUnit,
      name: this.getFoodName(this.selectedFood),
      energy: this.getCalories(this.selectedFood),
      protein: this.getProtein(this.selectedFood),
      carbohydrates: this.getCarbs(this.selectedFood),
      fat: this.getFat(this.selectedFood),
      servingSize: this.getServingSize(this.selectedFood),
      servingDescription: this.getServingUnit(this.selectedFood),
      general: this.isGeneralFood(this.selectedFood),
    };

    if (existingIndex >= 0) {
      this.groupFoods[existingIndex] = item;
    } else {
      this.groupFoods.push(item);
    }

    this.closeAddFoodModal();
  }

  editGroupFood(food: FoodReplacementGroupItem): void {
    this.selectedFood = {
      id: food.foodRefId,
      name: food.name,
      energy: food.energy,
      calories: food.energy,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      carbs: food.carbohydrates,
      fat: food.fat,
      servingSize: food.servingSize,
      servingDescription: food.servingDescription,
      servingUnit: food.servingDescription,
      general: food.general,
    };
    this.selectedQuantity = food.quantity;
    this.selectedUnit = food.unit;
    this.showAddFoodModal = true;
  }

  removeGroupFood(foodRefId: string): void {
    this.groupFoods = this.groupFoods.filter((food) => food.foodRefId !== foodRefId);
  }

  iconForGroup(group: FoodReplacementGroup): string {
    const name = group.name.toLowerCase();

    if (name.includes('protein')) return 'github';
    if (name.includes('carb')) return 'archive';
    if (name.includes('fat')) return 'droplet';
    if (name.includes('vegetable')) return 'feather';

    return 'shuffle';
  }

  getFoodId(food: any): string {
    return food.foodRefId || food.id;
  }

  getFoodName(food: any): string {
    return food.name || 'Unnamed food';
  }

  getCalories(food: any): number {
    return Number(food.energy ?? food.calories ?? 0);
  }

  getProtein(food: any): number {
    return Number(food.protein ?? 0);
  }

  getCarbs(food: any): number {
    return Number(food.carbohydrates ?? food.carbs ?? 0);
  }

  getFat(food: any): number {
    return Number(food.fat ?? 0);
  }

  getServingSize(food: any): number {
    return Number(food.servingSize ?? food.quantity ?? 100);
  }

  getServingUnit(food: any): string {
    return food.servingDescription || food.servingUnit || food.unit || 'g';
  }

  isGeneralFood(food: any): boolean {
    return Boolean(food.general ?? food.isGeneral);
  }

  foodMacroLabel(food: any): string {
    return `${this.getCalories(food)} kcal • ${this.getProtein(food)}g P • ${this.getFat(food)}g F • ${this.getCarbs(food)}g C`;
  }
}
