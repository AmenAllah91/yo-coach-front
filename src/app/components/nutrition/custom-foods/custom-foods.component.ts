import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { FoodDraft, foodErrors, foodNumber, foodImageError } from './food-validation';
import { NutritionService, Food } from '../../../service/nutrition.service';
import { FoodServing } from '@shared/models/MealPlan';
import { defaultServingOf, servingsOf } from '@shared/models/nutrition-math';
import { cleanUnit, editableUnit, MAX_SERVINGS, MAX_UNIT_LENGTH, servingKey } from '../food-servings/food-serving-rules';
import { FoodServingFormComponent } from '../food-servings/food-serving-form.component';
import { ServingUnitPipe } from '../food-servings/serving-unit.pipe';
import { AuthService } from '@config/auth.service';
import * as XLSX from 'xlsx';
import { FoodImportPreview, FoodImportReport, foodImportTemplate, importFieldLabel, parseFoodRows } from './food-import';

@Component({
  selector: 'app-custom-foods',
  standalone: true,
  imports: [WriteActionDirective, CommonModule, FormsModule, FeatherModule, TranslateModule, FoodServingFormComponent, ServingUnitPipe],
  templateUrl: './custom-foods.component.html',
  styleUrls: ['./custom-foods.component.scss']
})
export class CustomFoodsComponent implements OnInit, OnDestroy {
  loadError=false;
  deleting=false;
  deleteError='';
  private loadRequest?:Subscription;
  private closeDropdown=()=>{this.openDropdownId=null;};
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
  servingDescription = 'g';
  foodImageUrl = '';
  selectedImageFile: File | null = null;
  private hadExistingImage = false;
  mainServingId: string | null = null;
  private mainServingBase:Partial<FoodServing>={};
  extraServings: FoodServing[] = [];
  servingFormOpen = false;
  editingServingIndex: number | null = null;
  @ViewChild(FoodServingFormComponent) servingForm?: FoodServingFormComponent;
  isAdmin = false;
  showImportModal = false;
  importPreview: FoodImportPreview | null = null;
  importReport: FoodImportReport | null = null;
  importing = false;
  importError = '';
  readonly importFieldLabel = importFieldLabel;

  constructor(
    private nutritionService: NutritionService,
    private translate: TranslateService,
    private authService: AuthService,
  ) {}

  downloadImportTemplate(): void {
    XLSX.writeFile(foodImportTemplate((key) => this.translate.instant(key)), this.translate.instant('FOOD_IMPORT_FILE_NAME'));
  }

  async onImportFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importReport = null;
    this.importPreview = null;
    this.importError = '';
    this.showImportModal = true;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      this.importPreview = parseFoodRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' }));
    } catch {
      this.importError = 'FOOD_IMPORT_READ_FAILED';
    }
  }

  get canConfirmImport(): boolean {
    return !this.importing && !!this.importPreview && !this.importPreview.fileError && this.importPreview.validFoods > 0;
  }

  confirmImport(): void {
    if (!this.canConfirmImport || !this.importPreview) return;
    const foods = this.importPreview.foods.filter((food) => food.valid).map((food) => ({ name: food.name, servings: food.servings }));
    this.importing = true;
    this.importError = '';
    this.nutritionService.importFoods(foods).subscribe({
      next: (report: FoodImportReport) => {
        this.importing = false;
        this.importReport = report;
        this.importPreview = null;
        this.loadFoods();
      },
      error: () => {
        this.importing = false;
        this.importError = 'FOOD_IMPORT_FAILED';
      },
    });
  }

  importEntries(status: 'DUPLICATE' | 'INVALID') {
    return this.importReport?.entries.filter((entry) => entry.status === status) ?? [];
  }

  closeImportModal(): void {
    if (this.importing) return;
    this.showImportModal = false;
    this.importPreview = null;
    this.importReport = null;
    this.importError = '';
  }

  canManage(food: Food): boolean {
    return this.isAdmin ? !!food.isGeneral : !food.isGeneral;
  }

  get unitSuggestions(): string[] {
    return String(this.translate.instant('FOOD_UNIT_SUGGESTIONS')).split(',').map((unit) => unit.trim()).filter(Boolean);
  }

  mainServingOf(food: Food): FoodServing {
    return defaultServingOf(food);
  }

  servingCount(food: Food): number {
    return servingsOf(food).length;
  }

  private mainServingFromForm(): FoodServing {
    const serving: FoodServing = {
      ...this.mainServingBase,
      size: foodNumber(this.servingSize) as number,
      unit: cleanUnit(this.servingDescription),
      energy: foodNumber(this.calories),
      protein: foodNumber(this.protein),
      carbohydrates: foodNumber(this.carbs),
      fat: foodNumber(this.fat),
      fiber: foodNumber(this.fiber),
      sugar: foodNumber(this.sugar),
      polyols: foodNumber(this.polyols),
      saturatedFat: foodNumber(this.saturated),
      polyunsaturatedFat: foodNumber(this.polyunsaturated),
      monounsaturatedFat: foodNumber(this.monounsaturated),
      sodium: foodNumber(this.salt),
    };
    if (this.mainServingId) serving.id = this.mainServingId;
    return serving;
  }

  private loadMainServing(serving: FoodServing): void {
    this.mainServingBase={...serving};
    const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
    this.mainServingId = serving.id ?? null;
    this.servingSize = text(serving.size);
    this.servingDescription = editableUnit(serving.unit, this.translate.instant('FOOD_UNIT_PIECE'));
    this.calories = text(serving.energy);
    this.protein = text(serving.protein);
    this.carbs = text(serving.carbohydrates);
    this.fat = text(serving.fat);
    this.fiber = text(serving.fiber);
    this.sugar = text(serving.sugar);
    this.polyols = text(serving.polyols);
    this.saturated = text(serving.saturatedFat);
    this.polyunsaturated = text(serving.polyunsaturatedFat);
    this.monounsaturated = text(serving.monounsaturatedFat);
    this.salt = text(serving.sodium);
  }

  get mainServingValid(): boolean {
    return Object.keys(this.errors).every((key) => key === 'image' || key === 'foodName');
  }

  get canAddServing(): boolean {
    return this.extraServings.length + 1 < MAX_SERVINGS;
  }

  get servingFormOthers(): FoodServing[] {
    const main = this.mainServingFromForm();
    const others = this.extraServings.filter((_, index) => index !== this.editingServingIndex);
    return main.size > 0 && main.unit ? [main, ...others] : others;
  }

  openServingForm(index: number | null): void {
    if (this.isSaving) return;
    this.editingServingIndex = index;
    this.servingFormOpen = true;
  }

  closeServingForm(): void {
    this.servingFormOpen = false;
    this.editingServingIndex = null;
  }

  private commitPendingServing(): boolean {
    const form = this.servingForm;
    if (!form || form.isBlank) {
      this.closeServingForm();
      return true;
    }
    const serving = form.commit();
    if (!serving) return false;
    this.onServingSaved(serving);
    return true;
  }

  onServingSaved(serving: FoodServing): void {
    if (this.editingServingIndex === null) this.extraServings = [...this.extraServings, serving];
    else this.extraServings = this.extraServings.map((current, index) => (index === this.editingServingIndex ? serving : current));
    this.closeServingForm();
  }

  removeServing(index: number): void {
    if (this.isSaving) return;
    this.extraServings = this.extraServings.filter((_, current) => current !== index);
    if (this.editingServingIndex === index) this.closeServingForm();
  }

  setMainServing(index: number): void {
    if (this.isSaving || !this.mainServingValid) return;
    const chosen = this.extraServings[index];
    const previous = this.mainServingFromForm();
    this.extraServings = this.extraServings.map((current, position) => (position === index ? previous : current));
    this.loadMainServing(chosen);
    this.closeServingForm();
  }

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
  get errors(): Record<string, string> {
    const errors: Record<string, string> = { ...foodErrors(this.draft), ...(this.imageError ? { image: this.imageError } : {}) };
    const unit = cleanUnit(this.servingDescription);
    if (!errors['servingDescription'] && unit.length > MAX_UNIT_LENGTH) errors['servingDescription'] = 'FOOD_VALID_UNIT_LENGTH';
    if (!errors['servingSize'] && !errors['servingDescription']
      && this.extraServings.some((serving) => servingKey(serving.size, serving.unit) === servingKey(foodNumber(this.servingSize), unit))) {
      errors['servingDescription'] = 'FOOD_VALID_SERVING_DUPLICATE';
    }
    return errors;
  }
  get canSave(): boolean { return !this.isSaving && Object.keys(this.errors).length === 0; }
  fieldError(field: string): string {
    const error = this.errors[field] || '';
    return this.touched.has(field) || error === 'FOOD_VALID_FAT_SUM' || error === 'FOOD_VALID_SERVING_DUPLICATE' ? error : '';
  }
  touch(field: string) { this.touched.add(field); }

  ngOnInit() {
    this.loadCurrentUser();
    this.loadFoods();
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdown);
  }
  ngOnDestroy() {this.loadRequest?.unsubscribe();document.removeEventListener('click',this.closeDropdown);}

  private async loadCurrentUser() {
    this.isAdmin = (await this.authService.extractRoles()).includes('ROLE_ADMIN');
  }

  loadFoods() {
    this.loadRequest?.unsubscribe();
    this.loadError=false;
    this.loading = true;
    this.loadRequest=this.nutritionService.getFoods(this.currentPage, this.pageSize, this.searchTerm.trim() || undefined, this.customOnly).subscribe({
      next: (response) => {
        this.foods = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.loading = false;
      },
      error: (error) => {
        this.foods=[];this.totalElements=0;this.totalPages=0;this.loadError=true;
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
    if (this.isSaving || !this.canManage(food)) return;
    this.resetForm();
    this.editingFood = food;
    this.foodName = food.name;
    const servings = servingsOf(food);
    const main = servings.find((serving) => serving.id === food.defaultServingId) ?? servings[0];
    this.loadMainServing(main);
    this.extraServings = servings.filter((serving) => serving !== main).map((serving) => ({ ...serving }));
    this.foodImageUrl = food.imageUrl || '';
    this.hadExistingImage = Boolean(food.imageUrl);
    this.showAddModal = true;
    this.openDropdownId = null;
  }

  async saveFood() {
    if (!this.canSave) return;
    if (this.servingFormOpen && !this.commitPendingServing()) return;
    this.isSaving = true;
    this.saveError = '';
    let stage = 'save';
    try {
      const food: Food = {
        ...this.editingFood,
        name: this.foodName.trim(), calories: foodNumber(this.calories)!, protein: foodNumber(this.protein)!,
        carbs: foodNumber(this.carbs)!, fat: foodNumber(this.fat)!, fiber: foodNumber(this.fiber),
        sugar: foodNumber(this.sugar), polyols: foodNumber(this.polyols), saturatedFat: foodNumber(this.saturated),
        polyunsaturatedFat: foodNumber(this.polyunsaturated), monounsaturatedFat: foodNumber(this.monounsaturated),
        sodium: foodNumber(this.salt), servingSize: foodNumber(this.servingSize)!, servingUnit: cleanUnit(this.servingDescription),
        servings: [this.mainServingFromForm(), ...this.extraServings],
        defaultServingId: this.mainServingId,
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
    if (this.deleting || !this.canManage(food)) return;

    this.deleteError='';
    this.foodToDelete = food;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  confirmDelete() {
    if (this.foodToDelete && !this.deleting) {
      this.deleting=true;this.deleteError='';
      this.nutritionService.deleteFood(this.foodToDelete.id!).subscribe({
        next: () => {
          this.deleting=false;
          if(this.foods.length===1 && this.currentPage>0)this.currentPage--;
          this.loadFoods();
          this.closeDeleteModal();
        },
        error: (error) => {
          this.deleting=false;
          this.deleteError=error.status===403?'FOOD_DELETE_FORBIDDEN':error.status===404?'FOOD_DELETE_NOT_FOUND':error.status===409?'FOOD_DELETE_IN_USE':'FOOD_DELETE_ERROR';
        }
      });
    }
  }

  closeDeleteModal() {
    if(this.deleting)return;
    this.deleteError='';
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
    this.servingDescription = 'g';
    this.foodImageUrl = '';
    this.selectedImageFile = null;
    this.hadExistingImage = false;
    this.editingFood = null;
    this.mainServingId = null;
    this.mainServingBase={};
    this.extraServings = [];
    this.closeServingForm();
  }
}
