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
import { finalize } from 'rxjs/operators';
import {
  hasUniqueReplacementGroupFoods,
  isReplacementGroupFoodValid,
  isReplacementGroupGuidanceValid,
  isReplacementGroupNameValid,
  isReplacementGroupValid,
  REPLACEMENT_GROUP_GUIDANCE_MAX_LENGTH,
  REPLACEMENT_GROUP_NAME_MAX_LENGTH,
} from './food-replacement-group-validation';
import { FoodServing } from '@shared/models/MealPlan';
import { defaultServingOf, lineRatio, Macros, servingMacros, servingsOf } from '@shared/models/nutrition-math';
import { amountOf, editableUnit, portionsOf } from '../food-servings/food-serving-rules';
import { ServingUnitPipe } from '../food-servings/serving-unit.pipe';
import { ToastService } from 'app/service/toast.service';
import { DeleteConfirmModalComponent } from '../delete-confirm-modal/delete-confirm-modal.component';


type ViewMode = 'LIST' | 'EDITOR';

interface FoodSelection {
  food: any;
  servingId: string | null;
  portions: number;
}
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-food-replacement-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, ServingUnitPipe, DeleteConfirmModalComponent],
  templateUrl: './food-replacement-groups.component.html',
  styleUrls: ['./food-replacement-groups.component.scss', './_replacement-add-modal.scss', './_replacement-editor.scss'],
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
  /** Foods ticked in the Add Food modal, each with its number of servings of one of its units. */
  selections: FoodSelection[] = [];
  /** The last ticked food: the single-food API below (selectedFood, selectedQuantity...) works on it. */
  private activeSelection: FoodSelection | null = null;
  editingFoodRefId: string | null = null;
  saving = false;
  readonly groupNameMaxLength = REPLACEMENT_GROUP_NAME_MAX_LENGTH;
  readonly clientGuidanceMaxLength = REPLACEMENT_GROUP_GUIDANCE_MAX_LENGTH;
  foodPage = 0;
  readonly foodPageSize = 6;
  openGroupActionsId: string | null = null;

  constructor(
    private replacementGroupsService: FoodReplacementGroupsService,
    private nutritionService: NutritionService,
    private hostElement: ElementRef<HTMLElement>,
    private translate: TranslateService,
    private toast?: ToastService,
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

  /** Errors appear once the coach left the field or tried to save, never on an untouched form. */
  submitted = false;
  nameTouched = false;

  get nameError(): string {
    if (!this.groupName.trim()) return 'REPLACEMENT_GROUP_NAME_REQUIRED';
    return this.groupNameValid ? '' : 'REPLACEMENT_GROUP_NAME_MAX_LENGTH';
  }

  get nameErrorShown(): boolean {
    return !!this.nameError && (this.submitted || this.nameTouched || this.groupName.length > this.groupNameMaxLength);
  }

  get foodsStepDone(): boolean {
    return this.groupFoods.length >= 2 && this.groupFoodsUnique && this.groupFoodsValid;
  }

  get foodsErrorShown(): boolean {
    return (this.submitted && this.groupFoods.length < 2) || !this.groupFoodsUnique || !this.groupFoodsValid;
  }

  get groupNameValid(): boolean {
    return isReplacementGroupNameValid(this.groupName);
  }

  get clientGuidanceValid(): boolean {
    return isReplacementGroupGuidanceValid(this.groupDescription);
  }

  get groupFoodsUnique(): boolean {
    return hasUniqueReplacementGroupFoods(this.groupFoods);
  }

  get groupFoodsValid(): boolean {
    return this.groupFoods.every(isReplacementGroupFoodValid);
  }

  get canSaveGroup(): boolean {
    return !this.saving && isReplacementGroupValid(
      this.groupName,
      this.groupDescription,
      this.groupFoods,
    );
  }

  get selectedFood(): any | null {
    return this.activeSelection?.food ?? null;
  }

  get selectedServingId(): string | null {
    return this.activeSelection?.servingId ?? null;
  }

  get selectedQuantity(): number {
    return this.activeSelection?.portions ?? 1;
  }

  set selectedQuantity(portions: number) {
    if (this.activeSelection) this.activeSelection.portions = portions;
  }

  get selectedUnit(): string {
    return this.activeSelection ? this.unitOf(this.activeSelection) : 'g';
  }

  /** Every ticked food is valid (servings > 0, a unit) and none is already in the group. */
  get canAddSelectedFood(): boolean {
    return this.selections.length > 0 && this.selections.every((selection) =>
      !!this.getFoodId(selection.food) && this.portionsValid(selection) && !!this.servingOf(selection)
      && !this.groupFoods.some((food) => food.foodRefId === this.getFoodId(selection.food) && food.foodRefId !== this.editingFoodRefId));
  }

  /** quiet: refresh after a change, the list stays on screen (no skeleton). */
  loadGroups(quiet = false): void {
    this.loading = !quiet;

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
    this.saving = false;
    this.submitted = false;
    this.nameTouched = false;
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
    this.saving = false;
    this.submitted = false;
    this.nameTouched = false;
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

  /** Save is always clickable: with something missing, it shows what to complete and goes to it. */
  saveGroup(): void {
    if (this.saving) return;
    this.submitted = true;
    if (!this.canSaveGroup) {
      this.toast?.error(this.translate.instant('RGE_FIX_ERRORS'));
      this.focusFirstError();
      return;
    }

    this.saving = true;

    const payload: FoodReplacementGroup = {
      id: this.editingGroup?.id,
      name: this.groupName.trim(),
      description: this.groupDescription.trim(),
      clientNote: this.clientNote.trim(),
      active: this.editingGroup?.active ?? true,
      foods: this.groupFoods.map((food) => ({
        foodRefId: food.foodRefId,
        servingId: food.servingId ?? null,
        quantity: Number(food.quantity),
        unit: food.unit.trim(),
      })),
    };

    const request = this.editingGroup?.id
      ? this.replacementGroupsService.updateGroup(this.editingGroup.id, payload)
      : this.replacementGroupsService.createGroup(payload);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: (saved) => {
        this.toast?.success(this.translate.instant('RGE_SAVED'));
        if (saved?.id) {
          const index = this.groups.findIndex((group) => group.id === saved.id);
          if (index >= 0) this.groups[index] = saved;
          else if (this.currentPage === 0) this.groups = [saved, ...this.groups].slice(0, this.pageSize);
        }
        this.closeEditor();
        this.loadGroups(true);
      },
      error: (error) => {
        console.error('Error saving food replacement group:', error);
        this.toast?.error(this.translate.instant('RGE_SAVE_ERROR'));
      },
    });
  }

  private focusFirstError(): void {
    setTimeout(() => {
      const host = this.hostElement.nativeElement;
      const target = !this.groupNameValid ? host.querySelector<HTMLElement>('#rge-name')
        : !this.clientGuidanceValid ? host.querySelector<HTMLElement>('#rge-guidance')
        : host.querySelector<HTMLElement>('#rge-foods');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus({ preventScroll: true });
    });
  }

  /** Group waiting for the coach's confirmation in the delete modal. */
  groupToDelete: FoodReplacementGroup | null = null;
  /** Kept while the modal slides out, so its text does not empty during the animation. */
  groupToDeleteName = '';

  deleteGroup(group: FoodReplacementGroup): void {
    if (!group.id) return;
    this.groupToDelete = group;
    this.groupToDeleteName = group.name;
  }

  cancelDeleteGroup(): void {
    this.groupToDelete = null;
  }

  /** The group leaves the list at once; it comes back if the server refuses. */
  confirmDeleteGroup(): void {
    const group = this.groupToDelete;
    this.groupToDelete = null;
    if (!group?.id) return;
    const index = this.groups.indexOf(group);
    this.groups = this.groups.filter((item) => item !== group);
    this.totalElements = Math.max(0, this.totalElements - 1);
    this.replacementGroupsService.deleteGroup(group.id).subscribe({
      next: () => {
        this.toast?.success(this.translate.instant('GROUP_DELETED'));
        if (!this.groups.length && this.currentPage > 0) this.onPageChange(this.currentPage - 1);
      },
      error: (error) => {
        console.error('Error deleting replacement group:', error);
        const groups = [...this.groups];
        groups.splice(Math.min(index, groups.length), 0, group);
        this.groups = groups;
        this.totalElements++;
        this.toast?.error(this.translate.instant('GROUP_DELETE_ERROR'));
      },
    });
  }

  openAddFoodModal(): void {
    this.loadFoods();
    this.foodSearchTerm = '';
    this.foodPage = 0;
    this.foodTab = 'all';
    this.selections = [];
    this.activeSelection = null;
    this.editingFoodRefId = null;
    this.showAddFoodModal = true;
  }

  closeAddFoodModal(): void {
    this.showAddFoodModal = false;
    this.selections = [];
    this.activeSelection = null;
    this.editingFoodRefId = null;
  }

  isFoodSelected(food: any): boolean {
    const foodRefId = this.getFoodId(food);
    return this.selections.some((selection) => this.getFoodId(selection.food) === foodRefId);
  }

  /** A click on a food of the list ticks it (one serving of its main unit) or unticks it. */
  toggleFood(food: any): void {
    const foodRefId = this.getFoodId(food);
    const ticked = this.selections.find((selection) => this.getFoodId(selection.food) === foodRefId);
    if (ticked) {
      this.removeSelection(ticked);
      return;
    }
    this.selectFood(food);
  }

  /** Ticks a food (or makes it the active one when already ticked). */
  selectFood(food: any): void {
    const foodRefId = this.getFoodId(food);
    if (!foodRefId || this.groupFoods.some(
      (item) => item.foodRefId === foodRefId && item.foodRefId !== this.editingFoodRefId,
    )) return;
    let selection = this.selections.find((item) => this.getFoodId(item.food) === foodRefId);
    if (!selection) {
      const serving = defaultServingOf(food);
      selection = { food, servingId: serving.id ?? null, portions: 1 };
      this.selections = [...this.selections, selection];
    }
    this.activeSelection = selection;
  }

  removeSelection(selection: FoodSelection): void {
    this.selections = this.selections.filter((item) => item !== selection);
    if (this.activeSelection === selection) this.activeSelection = this.selections[this.selections.length - 1] ?? null;
  }

  optionsOf(selection: FoodSelection): FoodServing[] {
    return servingsOf(selection.food);
  }

  servingOf(selection: FoodSelection): FoodServing | null {
    const options = this.optionsOf(selection);
    return options.find((serving) => serving.id === selection.servingId) ?? options[0] ?? null;
  }

  unitOf(selection: FoodSelection): string {
    const serving = this.servingOf(selection);
    return serving ? editableUnit(serving.unit, this.translate.instant('FOOD_UNIT_PIECE')) : 'g';
  }

  amountOfSelection(selection: FoodSelection): number {
    const serving = this.servingOf(selection);
    return serving ? amountOf(selection.portions, serving.size) : 0;
  }

  macrosOf(selection: FoodSelection): Macros | null {
    const serving = this.servingOf(selection);
    return serving ? servingMacros(serving, lineRatio(this.amountOfSelection(selection), serving.size)) : null;
  }

  portionsValid(selection: FoodSelection): boolean {
    return Number.isFinite(Number(selection.portions)) && Number(selection.portions) > 0;
  }

  /** Another unit: one serving of it, as when the food is ticked. */
  setSelectionServing(selection: FoodSelection, servingId: string): void {
    if (!this.optionsOf(selection).some((serving) => serving.id === servingId)) return;
    selection.servingId = servingId;
    selection.portions = 1;
  }

  get servingOptions(): FoodServing[] {
    return this.activeSelection ? this.optionsOf(this.activeSelection) : [];
  }

  get selectedServing(): FoodServing | null {
    return this.activeSelection ? this.servingOf(this.activeSelection) : null;
  }

  get selectedPreview(): Macros | null {
    return this.activeSelection ? this.macrosOf(this.activeSelection) : null;
  }

  get selectedAmount(): number {
    return this.activeSelection ? this.amountOfSelection(this.activeSelection) : 0;
  }

  selectServing(servingId: string): void {
    if (this.activeSelection) this.setSelectionServing(this.activeSelection, servingId);
  }

  /** Number of servings of the item unit (quantity / serving size). */
  itemPortions(food: FoodReplacementGroupItem): number {
    return portionsOf(food.quantity, food.servingSize) ?? 1;
  }

  itemMacros(food: FoodReplacementGroupItem): Macros {
    return servingMacros(food, lineRatio(food.quantity, food.servingSize));
  }

  /** Adds every ticked food to the group (or replaces the food being edited). */
  addSelectedFood(): void {
    if (!this.canAddSelectedFood) return;

    const items = this.selections.map((selection) => this.itemOf(selection));
    const editingIndex = this.editingFoodRefId
      ? this.groupFoods.findIndex((food) => food.foodRefId === this.editingFoodRefId)
      : -1;
    if (editingIndex >= 0) {
      this.groupFoods.splice(editingIndex, 1, ...items);
    } else {
      this.groupFoods.push(...items);
    }

    this.closeAddFoodModal();
  }

  private itemOf(selection: FoodSelection): FoodReplacementGroupItem {
    const serving = this.servingOf(selection) ?? defaultServingOf(selection.food);
    return {
      foodRefId: this.getFoodId(selection.food),
      servingId: serving.id ?? null,
      quantity: amountOf(selection.portions, serving.size),
      unit: editableUnit(serving.unit, this.translate.instant('FOOD_UNIT_PIECE')).trim(),
      name: this.getFoodName(selection.food),
      energy: this.getCalories(serving),
      protein: this.getProtein(serving),
      carbohydrates: this.getCarbs(serving),
      fat: this.getFat(serving),
      servingSize: Number(serving.size),
      servingDescription: serving.unit,
      general: this.isGeneralFood(selection.food),
    };
  }

  editGroupFood(food: FoodReplacementGroupItem): void {
    this.loadFoods();
    this.editingFoodRefId = food.foodRefId;
    const itemServing: FoodServing = {
      id: food.servingId ?? undefined,
      size: Number(food.servingSize) > 0 ? Number(food.servingSize) : 100,
      unit: food.servingDescription || food.unit,
      energy: food.energy,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fat: food.fat,
    };
    const itemFood = {
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
      servings: food.servingId ? [itemServing] : undefined,
      defaultServingId: food.servingId ?? undefined,
    };
    const selection: FoodSelection = {
      food: itemFood,
      servingId: food.servingId ?? servingsOf(itemFood)[0]?.id ?? null,
      portions: portionsOf(food.quantity, food.servingSize) ?? 1,
    };
    this.selections = [selection];
    this.activeSelection = selection;
    this.showAddFoodModal = true;
    this.nutritionService.getFoodForClient(food.foodRefId).subscribe({
      next: (detail: any) => {
        if (this.editingFoodRefId !== food.foodRefId || this.activeSelection !== selection) return;
        const servings = servingsOf(detail);
        const merged = food.servingId && !servings.some((serving) => serving.id === food.servingId) ? [itemServing, ...servings] : servings;
        selection.food = { ...selection.food, servings: merged, defaultServingId: detail?.defaultServingId };
      },
      error: () => {},
    });
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
