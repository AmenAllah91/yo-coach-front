import { MealplanDayService } from './../../../service/mealplan-day.service';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';
import { ModalReplaceFoodComponent } from '../modal-replace-food/modal-replace-food.component';
import { FoodReplacementGroupsService } from 'app/service/food-replacement-groups.service';
import * as XLSX from 'xlsx';

type PlanStatus = 'COMPLETED' | 'MISSED' | 'PENDING';

interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  foodRefId?: string;
}

interface Meal {
  id: string;
  name: string;
  foods: Food[];
  mealTargets?: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    calories: number;
  };
}

interface NutritionDay {
  id: string;
  date: string;
  displayDate: string;
  planId: string;
  programName: string;
  programType: string;
  status: PlanStatus;
  mealCount: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
  meals: Meal[];
  dayTargets?: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    calories: number;
  };
}


interface NutritionFileProgram {
  id: string;
  name: string;
  coachName: string;
  resourceType: string;
  originalFileName?: string;
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  startDate?: string;
  endDate?: string;
  addedLabel: string;
  isCurrent: boolean;
  pageCountLabel: string;
}

@Component({
  selector: 'app-client-nutrition',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalConfirmComponent, ModalReplaceFoodComponent],
  templateUrl: './client-nutrition.component.html',
  styleUrl: './client-nutrition.component.scss',
})
export class ClientNutritionComponent implements OnInit, OnDestroy {
  coachNutritionFileEnabled = new Map<string, boolean>();
  nutritionFileEnabled = true;

  userid = sessionStorage.getItem('userId');
  nutritionDays: NutritionDay[] = [];
  currentDate: Date = new Date();
  activeTab: 'upcoming' | 'past' = 'upcoming';
  selectedDay: NutritionDay | null = null;
  clientViewMode: 'calendar' | 'file' = 'calendar';
  selectedFileProgram: NutritionFileProgram | null = null;
  selectedFileBlobUrl: string | null = null;
  selectedFileLoading = false;
  selectedFileError = '';
  filePrograms: NutritionFileProgram[] = [];
  filteredFilePrograms: NutritionFileProgram[] = [];
  searchProgram = '';

  pdfBlobUrl: string | null = null;
  pdfSafeUrl: SafeResourceUrl | null = null;
  excelSheets: string[] = [];
  selectedExcelSheetName = '';
  excelRows: any[][] = [];
  excelHeaders: string[] = [];
  excelLoading = false;
  selectedExcelWorkbook: any | null = null;

  showConfirmModal = false;
  pendingStatus: PlanStatus | null = null;

  showReplaceModal = false;
  foodToReplace: Food | null = null;
  mealToUpdate: Meal | null = null;

  private replacementCache = new Map<string, boolean>();

  userName = 'Kolton';

  coaches: any[] = [];

  selectedCoachId: string | 'all' = 'all';

  constructor(
    private mealplanDayService: MealplanDayService,
    private nutritionService: NutritionService,
    private foodReplacementGroupsService: FoodReplacementGroupsService,
    private sanitizer: DomSanitizer,
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit(): void {
    this.getMealPlan();
  }

  ngOnDestroy(): void {
    this.revokeSelectedFileBlob();
  }

  hasReplacementGroup(food: any): boolean {
    if (!food?.id) return false;
    return this.replacementCache.get(food.id) === true;
  }

  getMealPlan() {
    this.nutritionService
      .getNutritionPlanByClientId(this.userid)
      .subscribe((response: any) => {
        const plans: any[] = Array.isArray(response) ? response : (response?.content || []);
        const coachMap = new Map<string, any>();
        plans.forEach((plan) => {
          if (plan.coach && plan.coach.id) {
            const fullName = `${plan.coach.firstName || 'Coach'} ${
              plan.coach.lastName || ''
            }`.trim();
            coachMap.set(plan.coach.id, {
              id: plan.coach.id,
              firstName: plan.coach.firstName || 'Coach',
              lastName: plan.coach.lastName || '',
              fullName: fullName || 'Unknown Coach',
            });
          }
        });

        this.coaches = Array.from(coachMap.values());

        if (this.coaches.length === 1) {
          this.selectedCoachId = this.coaches[0].id;
        } else {
          this.selectedCoachId = 'all';
        }

        this.applyCoachFilter(plans);
      });
  }

  private applyCoachFilter(plans?: any[]) {
    if (!plans) {
      this.nutritionService
        .getNutritionPlanByClientId(this.userid)
        .subscribe((freshResponse: any) => {
          const freshPlans: any[] = Array.isArray(freshResponse) ? freshResponse : (freshResponse?.content || []);
          this.processPlansWithFilter(freshPlans);
        });
    } else {
      this.loadCoachNutritionFileSettings(plans);
    }
  }


  getPlanCoachId(plan: any): string | null {
    return (
      plan?.coach?.id ||
      plan?.coach?._id ||
      plan?.coach ||
      plan?.createdBy ||
      plan?.client?.coachId ||
      null
    );
  }


  private loadCoachNutritionFileSettings(plans: any[]): void {
    const coachIds = Array.from(
      new Set(
        (plans || [])
          .map((plan) => this.getPlanCoachId(plan))
          .filter((id): id is string => !!id)
      )
    );

    if (!coachIds.length) {
      this.processPlansWithFilter(plans);
      return;
    }

    let remaining = coachIds.length;

    coachIds.forEach((coachId) => {
      this.coachSettingsService.getConfigForCoach(coachId).subscribe({
        next: (config) => {
          this.coachNutritionFileEnabled.set(coachId, config.nutrition?.nutritionFileEnabled !== false);
        },
        error: () => {
          this.coachNutritionFileEnabled.set(coachId, true);
        },
        complete: () => {
          remaining -= 1;
          if (remaining === 0) {
            this.processPlansWithFilter(plans);
          }
        },
      });
    });
  }

  isNutritionFileEnabledForCoach(coachId: string | null): boolean {
    if (!coachId) {
      return this.nutritionFileEnabled !== false;
    }

    if (!this.coachNutritionFileEnabled.has(coachId)) {
      return true;
    }

    return this.coachNutritionFileEnabled.get(coachId) !== false;
  }

  private processPlansWithFilter(plans: any[]) {
    let filteredPlans = plans || [];

    if (this.selectedCoachId !== 'all') {
      filteredPlans = filteredPlans.filter((plan) => {
        const coachId = this.getPlanCoachId(plan);
        return !coachId || coachId === this.selectedCoachId;
      });
    }

    const appPlans = filteredPlans.filter((plan) => !this.isFilePlan(plan));
    const filePlans = filteredPlans.filter((plan) => this.isFilePlan(plan) && this.isNutritionFileEnabledForCoach(this.getPlanCoachId(plan)));

    this.nutritionDays = this.mapApiResponseToNutritionDays(appPlans);
    this.filePrograms = this.mapPlansToFilePrograms(filePlans);
    this.filteredFilePrograms = [...this.filePrograms];

    this.selectedFileProgram =
      this.filePrograms.find((p) => p.id === this.selectedFileProgram?.id) ||
      this.currentPrograms[0] ||
      this.historyPrograms[0] ||
      null;

    if (this.filePrograms.length > 0) {
      this.clientViewMode = 'file';
      this.loadSelectedFilePreview();
    } else {
      this.clientViewMode = 'calendar';
      this.revokeSelectedFileBlob();
    }

    this.setInitialMonth();
    this.selectedDay = null;
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.applyCoachFilter();
  }

  private setInitialMonth(): void {
    if (this.nutritionDays.length === 0) {
      const fileDate = this.filePrograms
        .map((p) => p.startDate ? new Date(p.startDate) : null)
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (fileDate) {
        this.currentDate = new Date(fileDate.getFullYear(), fileDate.getMonth(), 1);
      }

      return;
    }

    const firstDate = this.nutritionDays
      .map((d) => new Date(d.date))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    this.currentDate = new Date(
      firstDate.getFullYear(),
      firstDate.getMonth(),
      1
    );
  }

  private mapApiResponseToNutritionDays(plans: any[]): NutritionDay[] {
    const days: NutritionDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    plans.forEach((plan) => {
      if (this.isFilePlan(plan) || !plan.mealDays?.length) return;
      const planStart = new Date(plan.startDate);

      plan.mealDays.forEach((mealDay: any) => {
        const dayOffset = mealDay.dayNumber ? mealDay.dayNumber - 1 : 0;
        const mealDate = new Date(planStart);
        mealDate.setDate(planStart.getDate() + dayOffset);

        const totals = mealDay.dayTargets || {};

        const dateStr = mealDate.toISOString().split('T')[0];

        days.push({
          id: mealDay.id,
          date: dateStr,
          displayDate: this.getDisplayDate(dateStr),
          planId: plan.id,
          programName: plan.name,
          programType: 'Nutrition Program',
          status: mealDay.status ?? this.calculateStatus(dateStr),
          mealCount: mealDay.meals?.length || 0,
          totalProtein: totals.proteinG || 0,
          totalCarbs: totals.carbsG || 0,
          totalFat: totals.fatG || 0,
          totalCalories: totals.calories || 0,
          dayTargets: totals,
          meals: this.mapMeals(mealDay.meals || []),
        });
      });
    });

    return days;
  }

  private calculateStatus(dateStr: string): PlanStatus {
    const dayDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate < today) return 'MISSED';
    return 'PENDING';
  }

  private getDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  private mapMeals(meals: any[]): Meal[] {
    return meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      foods: (meal.foods || []).map((food: any) => {
        const foodRef = food.foodRef || {};
        const quantity = Number(food.quantity ?? foodRef.servingSize ?? 100);
        const servingSize = Number(foodRef.servingSize ?? 100);
        const ratio = servingSize > 0 ? quantity / servingSize : 1;
        const unit = food.unit || foodRef.servingDescription || 'g';

        return {
          id: food.id,
          name: food.name || foodRef.name || 'Food',
          quantity: `${quantity} ${unit}`,
          protein: Math.round(Number(foodRef.protein || 0) * ratio),
          carbs: Math.round(Number(foodRef.carbohydrates || 0) * ratio),
          fat: Math.round(Number(foodRef.fat || 0) * ratio),
          calories: Math.round(Number(foodRef.energy || 0) * ratio),
          foodRefId: foodRef.id,
        };
      }),
      mealTargets: meal.mealTargets || {
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        calories: 0,
      },
    }));
  }

  get filteredDays(): NutritionDay[] {
    return this.nutritionDays
      .filter((day) => this.isSameMonthAndYear(day.date, this.currentDate))
      .filter((day) => {
        if (this.activeTab === 'upcoming') {
          return day.status === 'PENDING';
        }
        return day.status === 'COMPLETED' || day.status === 'MISSED';
      });
  }

  private isSameMonthAndYear(dateStr: string, reference: Date): boolean {
    const date = new Date(dateStr);
    return (
      date.getMonth() === reference.getMonth() &&
      date.getFullYear() === reference.getFullYear()
    );
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get emptyStateMessage(): string {
    const month = this.formatMonthYear(this.currentDate);
    return this.activeTab === 'upcoming'
      ? `No upcoming nutrition plans for ${month}`
      : `No past nutrition plans for ${month}`;
  }

  handlePrevMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1
    );
  }

  handleNextMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1
    );
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
    this.selectedDay = null;
  }

  selectDay(day: NutritionDay): void {
    this.selectedDay = { ...day };
    this.checkFoodReplacements(day);
  }

  private checkFoodReplacements(day: NutritionDay): void {
    if (!day.planId) return;

    day.meals.forEach(meal => {
      meal.foods.forEach(food => {
        this.foodReplacementGroupsService
          .getReplacementGroupsForAssignedFood(day.planId!, day.id, meal.id, food.id)
          .pipe(catchError(() => of([])))
          .subscribe(groups => {
            this.replacementCache.set(food.id, groups.length > 0);
          });
      });
    });
  }

  backToList(): void {
    this.selectedDay = null;
  }

  calculateMealTotals(meal: Meal) {
    return meal.foods.reduce(
      (acc, food) => ({
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
        calories: acc.calories + food.calories,
      }),
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  openConfirmModal(status: PlanStatus): void {
    this.pendingStatus = status;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingStatus = null;
  }

  confirmStatusUpdate(): void {
    if (this.selectedDay && this.pendingStatus) {
      this.updatePlanStatus(this.selectedDay, this.pendingStatus);
    }
    this.closeConfirmModal();
  }

  updatePlanStatus(day: NutritionDay, status: PlanStatus): void {
    day.status = status;

    this.nutritionDays = this.nutritionDays.map((d) =>
      d.id === day.id ? { ...d, status } : d
    );

    this.mealplanDayService
      .updatePlanDay({ id: day.id, status }, day.planId)
      .subscribe({
        next: () => {},
        error: () => {
          day.status = 'PENDING';
          this.nutritionDays = [...this.nutritionDays];
        },
      });
  }

  openReplaceModal(food: Food, meal: Meal): void {
    this.foodToReplace = food;
    this.mealToUpdate = meal;
    this.showReplaceModal = true;
  }

  closeReplaceModal(): void {
    this.showReplaceModal = false;
    this.foodToReplace = null;
    this.mealToUpdate = null;
  }

  get showNutritionFiles(): boolean {
    return this.filePrograms.length > 0;
  }

  get calendarCountLabel(): string {
    const count = this.filteredDays.length;
    return `${count} jour${count > 1 ? 's' : ''} ce mois`;
  }

  get currentPrograms(): NutritionFileProgram[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.filteredFilePrograms.filter((program) => {
      if (!program.endDate) return true;
      const end = new Date(program.endDate);
      end.setHours(0, 0, 0, 0);
      return end >= today;
    });
  }

  get historyPrograms(): NutritionFileProgram[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.filteredFilePrograms.filter((program) => {
      if (!program.endDate) return false;
      const end = new Date(program.endDate);
      end.setHours(0, 0, 0, 0);
      return end < today;
    });
  }

  isFilePlan(plan: any): boolean {
    const mode = String(plan?.nutritionPlanMode || plan?.mealPlanMode || plan?.planMode || '').toUpperCase();
    const type = String(plan?.resourceType || plan?.fileType || plan?.documentType || '').toUpperCase();
    const name = String(plan?.originalFileName || plan?.fileName || plan?.fileUrl || plan?.name || '').toLowerCase();

    return (
      mode === 'FILE' ||
      mode === 'DOCUMENT' ||
      ['PDF', 'EXCEL', 'XLS', 'XLSX'].includes(type) ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl ||
      name.endsWith('.pdf') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx')
    );
  }

  mapPlansToFilePrograms(plans: any[]): NutritionFileProgram[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (plans || []).map((plan: any, index: number) => {
      const rawType = String(plan.resourceType || plan.fileType || plan.documentType || '').toUpperCase();
      const fileName = String(plan.originalFileName || plan.fileName || plan.fileUrl || plan.name || '').toLowerCase();
      const resourceType =
        rawType === 'PDF' || fileName.endsWith('.pdf')
          ? 'PDF'
          : 'EXCEL';

      const coachName =
        `${plan.coach?.firstName || ''} ${plan.coach?.lastName || ''}`.trim() ||
        plan.coach?.fullName ||
        'Coach';

      const start = plan.startDate ? new Date(plan.startDate) : null;
      const end = plan.endDate ? new Date(plan.endDate) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(0, 0, 0, 0);

      const isCurrent = (!start || start <= today) && (!end || end >= today);

      return {
        id: plan.id || plan._id || `${resourceType}-${index}`,
        name: plan.name || plan.originalFileName || plan.fileName || 'Nutrition file',
        coachName,
        resourceType,
        originalFileName: plan.originalFileName,
        fileName: plan.fileName,
        fileUrl: plan.fileUrl,
        fileSizeBytes: plan.fileSizeBytes || plan.sizeBytes || plan.fileSize,
        startDate: plan.startDate,
        endDate: plan.endDate,
        addedLabel: plan.startDate ? this.formatFrenchDate(plan.startDate) : '',
        isCurrent,
        pageCountLabel: resourceType === 'PDF' ? 'PDF' : 'Feuille Excel',
      } as NutritionFileProgram;
    }).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }


  applyFileSearch() {
    const q = this.searchProgram.trim().toLowerCase();
    this.filteredFilePrograms = !q
      ? [...this.filePrograms]
      : this.filePrograms.filter((p) =>
          [p.name, p.originalFileName, p.resourceType].filter(Boolean).join(' ').toLowerCase().includes(q)
        );
  }

  setClientViewMode(mode: 'calendar' | 'file') {
    this.clientViewMode = mode;
    if (mode === 'file' && !this.selectedFileProgram) {
      this.selectedFileProgram = this.currentPrograms[0] || this.filePrograms[0] || null;
    }
    if (mode === 'file') {
      this.loadSelectedFilePreview();
    }
  }

  selectFileProgram(program: NutritionFileProgram) {
    this.selectedFileProgram = program;
    this.clientViewMode = 'file';
    this.loadSelectedFilePreview();
  }

  private revokeSelectedFileBlob() {
    if (this.selectedFileBlobUrl) {
      window.URL.revokeObjectURL(this.selectedFileBlobUrl);
      this.selectedFileBlobUrl = null;
    }
  }

  loadSelectedFilePreview() {
    this.revokeSelectedFileBlob();
    this.selectedFileError = '';
    this.pdfBlobUrl = null;
    this.pdfSafeUrl = null;

    const resourceType = String(this.selectedFileProgram?.resourceType || '').toUpperCase();

    if (!this.selectedFileProgram) {
      this.selectedFileLoading = false;
      return;
    }

    if (resourceType === 'EXCEL' || resourceType === 'XLS' || resourceType === 'XLSX') {
      this.loadSelectedExcelPreview();
      return;
    }

    if (resourceType !== 'PDF') {
      this.selectedFileLoading = false;
      return;
    }

    this.selectedFileLoading = true;

    this.nutritionService.downloadNutritionFile(this.selectedFileProgram).subscribe({
      next: async (blob) => {
        try {
          const pdfBlob = blob.type === 'application/pdf'
            ? blob
            : new Blob([blob], { type: 'application/pdf' });

          this.pdfBlobUrl = window.URL.createObjectURL(pdfBlob);
          this.pdfSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
          this.selectedFileBlobUrl = this.pdfBlobUrl;
          this.selectedFileLoading = false;
        } catch (error) {
          console.error('Error preparing PDF preview:', error);
          this.selectedFileError = 'Impossible d\'afficher l\'aperçu du PDF. Téléchargez le fichier pour l\'ouvrir.';
          this.selectedFileLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading PDF preview:', error);
        this.selectedFileError = 'Impossible d\'afficher l\'aperçu du PDF. Téléchargez le fichier pour l\'ouvrir.';
        this.selectedFileLoading = false;
      },
    });
  }

  loadSelectedExcelPreview() {
    this.excelLoading = true;
    this.selectedFileLoading = true;
    this.selectedFileError = '';

    if (!this.selectedFileProgram) {
      this.excelLoading = false;
      this.selectedFileLoading = false;
      return;
    }

    this.nutritionService.downloadNutritionFile(this.selectedFileProgram).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            this.excelSheets = workbook.SheetNames;
            this.selectedExcelSheetName = this.excelSheets[0] || '';
            this.parseExcelSheet(workbook, this.selectedExcelSheetName);
          } catch (err) {
            console.error('Excel parse error:', err);
            this.selectedFileError = 'Impossible de lire le fichier Excel.';
          }
          this.excelLoading = false;
          this.selectedFileLoading = false;
        };
        reader.onerror = () => {
          this.excelLoading = false;
          this.selectedFileLoading = false;
          this.selectedFileError = 'Erreur de lecture du fichier.';
        };
        reader.readAsArrayBuffer(blob);
      },
      error: (error) => {
        console.error('Error loading Excel preview:', error);
        this.excelLoading = false;
        this.selectedFileLoading = false;
        this.selectedFileError = 'Impossible de charger l\'aperçu du fichier.';
      },
    });
  }

  selectExcelSheet(sheetName: string) {
    this.selectedExcelSheetName = sheetName;

    if (!this.selectedExcelWorkbook) {
      return;
    }

    const worksheet = this.selectedExcelWorkbook.Sheets[sheetName];

    if (!worksheet) {
      this.excelRows = [];
      this.excelHeaders = [];
      return;
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as any[][];

    this.excelRows = rows.slice(0, 80);
    const maxColumns = Math.max(0, ...this.excelRows.map((row) => row.length));
    this.excelHeaders = Array.from({ length: maxColumns }, (_, i) => this.getExcelColumnLabel(i));
  }

  private parseExcelSheet(workbook: any, sheetName: string) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      this.excelHeaders = [];
      this.excelRows = [];
      return;
    }
    const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    this.excelHeaders = json[0] || [];
    this.excelRows = json.slice(1) || [];
  }

  switchToFileTab() {
    this.setClientViewMode('file');
  }

  switchToCalendarTab() {
    this.clientViewMode = 'calendar';
    this.selectedFileBlobUrl = null;
    this.pdfSafeUrl = null;
    this.pdfBlobUrl = null;
  }

  downloadSelectedFile() {
    if (!this.selectedFileProgram) return;

    this.nutritionService.downloadNutritionFile(this.selectedFileProgram).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.selectedFileProgram!.originalFileName || this.selectedFileProgram!.fileName || 'nutrition-file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Download error:', err);
      },
    });
  }

  private formatFrenchDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  replaceFood(replacement: {
    replacementFoodRefId: string;
    quantity: number;
    unit: string;
  }): void {
    if (!this.selectedDay || !this.mealToUpdate || !this.foodToReplace) return;

    this.nutritionService
      .replaceAssignedMealFood(
        this.selectedDay.planId,
        this.selectedDay.id,
        this.mealToUpdate.id,
        this.foodToReplace.id,
        replacement
      )
      .subscribe({
        next: (updatedPlan: any) => {
          const updatedDay = updatedPlan?.mealDays?.find(
            (d: any) => d.id === this.selectedDay!.id
          );

          if (updatedDay) {
            const totals = updatedDay.dayTargets || {};
            const mappedDay: NutritionDay = {
              ...this.selectedDay!,
              mealCount: updatedDay.meals?.length || 0,
              totalProtein: totals.proteinG || 0,
              totalCarbs: totals.carbsG || 0,
              totalFat: totals.fatG || 0,
              totalCalories: totals.calories || 0,
              dayTargets: totals,
              meals: this.mapMeals(updatedDay.meals || []),
            };

            this.selectedDay = mappedDay;
            this.nutritionDays = this.nutritionDays.map((d) =>
              d.id === mappedDay.id ? mappedDay : d
            );
          }

          this.closeReplaceModal();
        },
        error: (error) => {
          console.error('Error replacing food:', error);
        },
      });
  }  onExcelSheetChange(sheetName: string): void {
    this.selectedExcelSheetName = sheetName;

    if (this.selectedExcelWorkbook) {
      this.selectExcelSheet(sheetName);
    }
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);

    if (!value || Number.isNaN(value)) {
      return '';
    }

    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }


  getExcelColumnLabel(index: number): string {
    let label = '';
    let current = index + 1;

    while (current > 0) {
      const remainder = (current - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      current = Math.floor((current - 1) / 26);
    }

    return label;
  }


}
