import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { NutritionService } from '../../../service/nutrition.service';
import {
  FoodReplacementGroup,
  FoodReplacementGroupItem,
  FoodReplacementGroupsService
} from "../../../service/food-replacement-groups.service";
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


type ViewMode = 'LIST' | 'EDITOR';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-food-replacement-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './food-replacement-groups.component.html',
  styleUrls: ['./food-replacement-groups.component.scss'],
})
export class FoodReplacementGroupsComponent implements OnInit, OnDestroy {
  goBack(): void { window.history.back(); }

  view: ViewMode = 'LIST';

  groups: FoodReplacementGroup[] = [];
  foods: any[] = [];
  foodsLoading = false;
  private foodsLoaded = false;

  searchTerm = '';
  statusFilter: StatusFilter = 'all';
  loading = false;
  loadingRows = [1, 2, 3, 4, 5, 6];
  groupFoodSearchTerm = '';
  private groupsRequest?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private layoutBackButton: HTMLElement | null = null;
  private layoutBackButtonDisplay = '';

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
  foodPage = 0;
  readonly foodPageSize = 3;
  openGroupActionsId: string | null = null;

  constructor(
    private replacementGroupsService: FoodReplacementGroupsService,
    private nutritionService: NutritionService,
    private hostElement: ElementRef<HTMLElement>,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  ngOnDestroy(): void {
    this.restoreLayoutBackButton();
    this.groupsRequest?.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
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
    }).sort((a, b) => Number(this.isGeneralFood(a)) - Number(this.isGeneralFood(b)));
  }

  get pagedFoods(): any[] {
    const start = this.foodPage * this.foodPageSize;
    return this.filteredFoods.slice(start, start + this.foodPageSize);
  }

  get foodTotalPages(): number {
    return Math.ceil(this.filteredFoods.length / this.foodPageSize);
  }

  onFoodSearch(): void { this.foodPage = 0; }

  changeFoodPage(page: number): void {
    if (page >= 0 && page < this.foodTotalPages) this.foodPage = page;
  }

  get previewSourceFood(): FoodReplacementGroupItem | null {
    return this.groupFoods.length ? this.groupFoods[0] : null;
  }

  get previewReplacementFoods(): FoodReplacementGroupItem[] {
    return this.groupFoods.slice(1);
  }

  get filteredGroupFoods(): FoodReplacementGroupItem[] {
    const search = this.groupFoodSearchTerm.trim().toLowerCase();
    return search
      ? this.groupFoods.filter((food) => (food.name || '').toLowerCase().includes(search))
      : this.groupFoods;
  }

  loadGroups(): void {
    this.loading = true;

    const active =
      this.statusFilter === 'all'
        ? undefined
        : this.statusFilter === 'active';

    this.groupsRequest?.unsubscribe();
    this.groupsRequest = this.replacementGroupsService
      .getGroups(this.currentPage, this.pageSize, this.searchTerm, active, true)
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
    if (this.foodsLoaded || this.foodsLoading) return;
    this.foodsLoading = true;
    this.nutritionService.getFoods(0, 100, undefined, false, true).subscribe({
      next: (response) => {
        this.foods = response.content || [];
        this.foodsLoaded = true;
        this.foodsLoading = false;
      },
      error: (error) => {
        this.foodsLoading = false;
        console.error('Error loading foods:', error);
      },
    });
  }

  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 0;
      this.loadGroups();
    }, 300);
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

  openCreateGroup(): void {
    this.editingGroup = null;
    this.groupName = '';
    this.groupDescription = '';
    this.clientNote = '';
    this.groupFoods = [];
    this.groupFoodSearchTerm = '';
    this.view = 'EDITOR';
    setTimeout(() => this.hideLayoutBackButton());
  }

  openEditGroup(group: FoodReplacementGroup): void {
    this.editingGroup = group;
    this.groupName = group.name;
    this.groupDescription = group.description || '';
    this.clientNote = group.clientNote || '';
    this.groupFoods = (group.foods || []).map((food) => ({ ...food }));
    this.groupFoodSearchTerm = '';
    this.view = 'EDITOR';
    setTimeout(() => this.hideLayoutBackButton());
  }

  closeEditor(): void {
    this.restoreLayoutBackButton();
    this.view = 'LIST';
    this.showAddFoodModal = false;
    this.editingGroup = null;
  }

  private hideLayoutBackButton(): void {
    const host = this.hostElement.nativeElement;
    const button = Array.from(document.querySelectorAll<HTMLElement>('button')).find(
      (candidate) =>
        !host.contains(candidate) && candidate.textContent?.trim().toLowerCase() === 'back',
    );

    if (!button) return;
    this.layoutBackButton = button;
    this.layoutBackButtonDisplay = button.style.display;
    button.style.setProperty('display', 'none', 'important');
  }

  private restoreLayoutBackButton(): void {
    if (!this.layoutBackButton) return;
    this.layoutBackButton.style.display = this.layoutBackButtonDisplay;
    this.layoutBackButton = null;
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
    this.loadFoods();
    this.foodSearchTerm = '';
    this.foodPage = 0;
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
    this.loadFoods();
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
    return food.name || this.translate.instant('UNNAMED_FOOD');
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
    return `${this.getCalories(food)} kcal • ${this.getProtein(food)}g ${this.translate.instant('PROTEIN_SHORT')} • ${this.getFat(food)}g ${this.translate.instant('FAT_SHORT')} • ${this.getCarbs(food)}g ${this.translate.instant('CARBS_SHORT')}`;
  }

  getFoodImage(food: any): string {
    return food?.imageUrl || food?.image || food?.photoUrl || '';
  }
}
