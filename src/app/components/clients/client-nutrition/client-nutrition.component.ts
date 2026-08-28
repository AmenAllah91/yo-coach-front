import { MealplanDayService } from './../../../service/mealplan-day.service';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';
import { ModalReplaceFoodComponent } from '../modal-replace-food/modal-replace-food.component';
import { FoodReplacementGroupsService } from 'app/service/food-replacement-groups.service';
import * as XLSX from 'xlsx';
import { environment } from '@env/environment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@config/auth.service';
import { Location } from '@angular/common';

type PlanStatus = 'COMPLETED' | 'OFF_PLAN' | 'IN_PROGRESS' | 'PENDING';
type MealReportStatus = 'AS_PLANNED' | 'MODIFIED' | 'SKIPPED';

interface Food {
  id: string;
  name: string;
  quantity: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  foodRefId?: string;
  imageUrl?: string;
  category?: string;
}

interface Meal {
  id: string;
  name: string;
  foods: Food[];
  mealType?: string;
  mealTime?: string;
  actualMealTime?: string;
  servings?: number;
  totalTimeMinutes?: number;
  coverImage?: string;
  directions?: string[];
  tags?: string[];
  expanded?: boolean;
  mealTargets?: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    calories: number;
  };
  reportStatus?: MealReportStatus;
  note?: string;
  photoUrl?: string;
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
  hunger?: string;
  energy?: string;
  digestion?: string;
  overallNote?: string;
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
  imports: [CommonModule, FormsModule, ModalConfirmComponent, ModalReplaceFoodComponent, TranslateModule],
  templateUrl: './client-nutrition.component.html',
  styleUrl: './client-nutrition.component.scss',
})
export class ClientNutritionComponent implements OnInit, OnDestroy {
  coachNutritionFileEnabled = new Map<string, boolean>();
  nutritionFileEnabled = false;
  fileSettingsResolved = false;
  private allPlans: any[] = [];

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

  userName = sessionStorage.getItem('username') || '';

  coaches: any[] = [];

  selectedCoachId: string | 'all' = 'all';
  showMealReportModal = false;
  showMealViewModal = false;
  showNutritionPdfPreview = false;
  reportMeal: Meal | null = null;
  viewedMeal: Meal | null = null;
  viewedMealIndex = 0;
  reportMealIndex = 0;
  reportStatus: MealReportStatus = 'AS_PLANNED';
  reportNote = '';
  savingMealReport = false;
  uploadingMealId: string | null = null;
  dailySaveMessage = '';

  constructor(
    private mealplanDayService: MealplanDayService,
    private nutritionService: NutritionService,
    private foodReplacementGroupsService: FoodReplacementGroupsService,
    private sanitizer: DomSanitizer,
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    private authService: AuthService,
    private location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadCurrentUserName();
    this.getMealPlan();
  }

  private async loadCurrentUserName(): Promise<void> {
    const user = await this.authService.getCurrentUserDetails();
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    this.userName = fullName || user?.username || sessionStorage.getItem('username') || this.translate.instant('ATHLETE');
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
        this.hydrateNutritionPlans(plans).subscribe((hydratedPlans) => {
          this.applyLoadedPlans(hydratedPlans);
        });
      });
  }

  private hydrateNutritionPlans(plans: any[]) {
    if (!plans.length) return of([] as any[]);

    return forkJoin(plans.map((summary) => {
      if (!summary?.id || this.isFilePlan(summary)) return of(summary);
      return this.nutritionService.getNutritionPlanById(summary.id).pipe(
        map((detail: any) => ({
          ...detail,
          ...summary,
          coach: detail?.coach || summary?.coach,
          client: detail?.client || summary?.client,
          mealDays: this.mergeMealDays(summary?.mealDays || [], detail?.mealDays || []),
        })),
        catchError(() => of(summary))
      );
    }));
  }

  private mergeMealDays(summaryDays: any[], detailDays: any[]): any[] {
    if (!summaryDays.length) return detailDays;

    return summaryDays.map((summaryDay, index) => {
      const detailDay = detailDays.find((candidate: any) =>
        (summaryDay?.id && candidate?.id === summaryDay.id) ||
        (summaryDay?.dayNumber && candidate?.dayNumber === summaryDay.dayNumber)
      ) || detailDays[index] || {};

      return {
        ...detailDay,
        ...summaryDay,
        meals: summaryDay?.meals?.length ? summaryDay.meals : (detailDay?.meals || []),
        dayTargets: Object.keys(summaryDay?.dayTargets || {}).length
          ? summaryDay.dayTargets
          : (detailDay?.dayTargets || {}),
      };
    });
  }

  private applyLoadedPlans(plans: any[]): void {
    this.allPlans = plans;
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
    this.selectedCoachId = this.resolveCurrentCoachId(plans) || this.coaches[0]?.id || 'all';
    this.fileSettingsResolved = false;
    this.nutritionFileEnabled = false;
    this.coachNutritionFileEnabled.clear();
    this.processPlansWithFilter(plans);
    this.loadCoachNutritionFileSettings(plans);
  }

  private applyCoachFilter(plans?: any[]) {
    this.processPlansWithFilter(plans || this.allPlans);
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

  private resolveCurrentCoachId(plans: any[]): string | null {
    const clientCoachId = (plans || [])
      .map((plan) => plan?.client?.coachId || plan?.client?.coach?.id || plan?.client?.coach?._id)
      .find((coachId) => !!coachId);

    if (clientCoachId) {
      return clientCoachId;
    }

    const activePlanCoachId = (plans || [])
      .filter((plan) => this.isPlanCurrent(plan))
      .map((plan) => this.getPlanCoachId(plan))
      .find((coachId) => !!coachId);

    return activePlanCoachId || null;
  }

  private isPlanCurrent(plan: any): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = plan?.startDate ? new Date(plan.startDate) : null;
    const end = plan?.endDate ? new Date(plan.endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);
    return (!start || start <= today) && (!end || end >= today);
  }


  private loadCoachNutritionFileSettings(plans: any[]): void {
    const coachIds = this.selectedCoachId !== 'all'
      ? [this.selectedCoachId]
      : Array.from(
          new Set(
            (plans || [])
              .map((plan) => this.getPlanCoachId(plan))
              .filter((id): id is string => !!id)
          )
        );

    if (!coachIds.length) {
      this.fileSettingsResolved = true;
      this.processPlansWithFilter(plans);
      return;
    }

    forkJoin(
      coachIds.map((coachId) =>
        this.coachSettingsService.getConfigForCoach(coachId, true).pipe(
          map((config) => ({
            coachId,
            enabled: config.nutrition?.nutritionFileEnabled !== false,
          })),
          catchError(() => of({ coachId, enabled: false }))
        )
      )
    ).subscribe({
      next: (items) => {
        items.forEach((item) => {
          this.coachNutritionFileEnabled.set(item.coachId, item.enabled);
        });
        this.fileSettingsResolved = true;
        this.processPlansWithFilter(plans);
      },
      error: () => {
        this.fileSettingsResolved = true;
        this.processPlansWithFilter(plans);
      },
    });
  }

  isNutritionFileEnabledForCoach(coachId: string | null): boolean {
    if (!coachId) {
      return this.nutritionFileEnabled !== false;
    }

    if (!this.coachNutritionFileEnabled.has(coachId)) {
      return false;
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

    this.nutritionFileEnabled = this.fileSettingsResolved && (this.selectedCoachId === 'all'
      ? this.coaches.some((coach) => this.isNutritionFileEnabledForCoach(coach.id))
      : this.isNutritionFileEnabledForCoach(this.selectedCoachId));

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

    this.selectedDay = null;
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.fileSettingsResolved = false;
    this.nutritionFileEnabled = false;
    this.applyCoachFilter();
    this.loadCoachNutritionFileSettings(this.allPlans);
  }

  private mapApiResponseToNutritionDays(plans: any[]): NutritionDay[] {
    const days: NutritionDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    plans.forEach((plan) => {
      if (this.isFilePlan(plan) || !plan.mealDays?.length) return;
      const planStart = this.parseCalendarDate(plan.startDate);

      plan.mealDays.forEach((mealDay: any, index: number) => {
        const explicitDate = this.parseCalendarDate(mealDay?.date);
        const dayOffset = Number(mealDay?.dayNumber || index + 1) - 1;
        const mealDate = explicitDate || (planStart ? new Date(planStart) : null);
        if (!mealDate) return;
        if (!explicitDate) {
          mealDate.setDate(planStart!.getDate() + Math.max(0, dayOffset));
        }

        const totals = mealDay.dayTargets || {};

        const dateStr = this.toCalendarDate(mealDate);

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
          hunger: mealDay.hunger || '',
          energy: mealDay.energy || '',
          digestion: mealDay.digestion || '',
          overallNote: mealDay.overallNote || '',
        });
        const mappedDay = days[days.length - 1];
        (mealDay.clientMealLogs || []).forEach((log: any) => {
          const meal = mappedDay.meals.find(item => item.id === log.mealId);
          if (!meal) return;
          meal.reportStatus = log.status;
          meal.note = log.note || '';
          meal.actualMealTime = log.actualMealTime || log.eatenTime || log.mealTime || '';
          if (log.photoPath) {
            meal.photoUrl = `${environment.baseApiUrl}/api/meal-day/${plan.id}/days/${mealDay.id}/meals/${meal.id}/photo`;
          }
        });
      });
    });

    return days;
  }

  private parseCalendarDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toCalendarDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private calculateStatus(dateStr: string): PlanStatus {
    const dayDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dayDate.setHours(0, 0, 0, 0);

    return dayDate <= today ? 'IN_PROGRESS' : 'PENDING';
  }

  private getDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return this.translate.instant('TODAY');
    }
    return date.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  private mapMeals(meals: any[]): Meal[] {
    return meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      mealType: meal.mealType || '',
      mealTime: meal.mealTime || '',
      actualMealTime: '',
      servings: meal.servings || 1,
      totalTimeMinutes: meal.totalTimeMinutes || 0,
      coverImage: meal.coverImage || '',
      directions: Array.isArray(meal.directions) ? meal.directions : [],
      tags: Array.isArray(meal.tags) ? meal.tags : [],
      expanded: true,
      foods: (meal.foods || []).map((food: any) => {
        const foodRef = food.foodRef || {};
        const quantity = Number(food.quantity ?? foodRef.servingSize ?? 100);
        const servingSize = Number(foodRef.servingSize ?? 100);
        const ratio = servingSize > 0 ? quantity / servingSize : 1;
        const unit = food.unit || foodRef.servingDescription || 'g';

        return {
          id: food.id,
          name: food.name || foodRef.name || this.translate.instant('FOOD'),
          quantity: `${quantity} ${unit}`,
          protein: Math.round(Number(foodRef.protein || 0) * ratio),
          carbs: Math.round(Number(foodRef.carbohydrates || 0) * ratio),
          fat: Math.round(Number(foodRef.fat || 0) * ratio),
          calories: Math.round(Number(foodRef.energy || 0) * ratio),
          foodRefId: foodRef.id,
          imageUrl: foodRef.imageUrl || food.imageUrl || '',
          category: this.foodCategory(foodRef, food),
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

  isRecipeMeal(meal: Meal): boolean {
    return !!(meal?.coverImage || meal?.directions?.length || meal?.totalTimeMinutes || meal?.tags?.length);
  }

  mealVariantLabel(meal: Meal): string {
    return this.translate.instant(this.isRecipeMeal(meal) ? 'RECIPE_MEAL' : 'WITH_FOODS');
  }

  toggleMealCard(meal: Meal): void {
    meal.expanded = meal.expanded === false;
  }

  openMealView(meal: Meal, index: number): void {
    this.viewedMeal = meal;
    this.viewedMealIndex = index;
    this.showMealViewModal = true;
  }

  closeMealView(): void {
    this.showMealViewModal = false;
    this.viewedMeal = null;
  }

  updateActualMealTime(meal: Meal, value: string): void {
    meal.actualMealTime = value;
  }

  saveMealTiming(meal: Meal): void {
    if (!this.selectedDay) return;
    if (!meal.actualMealTime && meal.mealTime) {
      meal.actualMealTime = meal.mealTime;
    }
    this.persistNutritionDay(this.selectedDay.status === 'PENDING' ? 'IN_PROGRESS' : this.selectedDay.status);
  }

  formatMealTime(value?: string): string {
    const raw = String(value || '').trim();
    if (!raw) return this.translate.instant('NO_TIME');
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return raw;
    let hours = Number(match[1]);
    const minutes = match[2];
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${suffix}`;
  }

  mealHeaderTitle(meal: Meal, index: number): string {
    const type = String(meal.mealType || '').trim();
    const prefix = `${this.translate.instant('MEAL')} ${index + 1}`;
    return type ? `${prefix} · ${type.charAt(0).toUpperCase() + type.slice(1)}` : `${prefix} · ${meal.name}`;
  }

  mealMetaLine(meal: Meal): string {
    const parts = [];
    if (meal.actualMealTime) {
      parts.push(this.formatMealTime(meal.actualMealTime));
    } else if (meal.mealTime) {
      parts.push(this.formatMealTime(meal.mealTime));
    }
    if (meal.mealTargets?.calories || meal.mealTargets?.calories === 0) {
      parts.push(`${meal.mealTargets?.calories || 0} kcal`);
    }
    return parts.join(' · ');
  }

  get filteredDays(): NutritionDay[] {
    return this.nutritionDays
      .filter((day) => this.isSameMonthAndYear(day.date, this.currentDate))
      .filter((day) => {
        if (this.activeTab === 'upcoming') {
          return day.status === 'PENDING';
        }
        return day.status === 'COMPLETED' || day.status === 'OFF_PLAN' || day.status === 'IN_PROGRESS';
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
    return date.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });
  }

  listStatusLabel(status: unknown): string {
    let key = 'PLANNED_LABEL';
    switch (String(status || '').toUpperCase()) {
      case 'COMPLETED': key = 'COMPLETED_LABEL'; break;
      case 'UPCOMING': key = 'UPCOMING'; break;
      case 'IN_PROGRESS': key = 'IN_PROGRESS_LABEL'; break;
      case 'PENDING':
      case 'PLANNED':
      case 'NOT_STARTED': key = 'PLANNED_LABEL'; break;
      case 'MISSED': key = 'MISSED_LABEL'; break;
      case 'OFF_PLAN': key = 'OFF_PLAN'; break;
      case 'OVERDUE': key = 'OVERDUE_LABEL'; break;
    }
    return this.translate.instant(key);
  }

  listStatusIcon(status: unknown): string {
    switch (String(status || '').toUpperCase()) {
      case 'COMPLETED': return '✓';
      case 'MISSED':
      case 'OFF_PLAN': return '×';
      case 'OVERDUE': return '!';
      case 'UPCOMING':
      case 'IN_PROGRESS': return '◷';
      default: return '▣';
    }
  }

  get emptyStateMessage(): string {
    const month = this.formatMonthYear(this.currentDate);
    return this.activeTab === 'upcoming'
      ? `No upcoming nutrition plans for ${month}`
      : `No past nutrition plans for ${month}`;
  }

  handlePrevMonth(): void {
    if (!this.canGoPrevMonth) return;
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1
    );
  }

  handleNextMonth(): void {
    if (!this.canGoNextMonth) return;
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1
    );
  }

  setActiveTab(tab: 'upcoming' | 'past'): void {
    this.activeTab = tab;
    this.selectedDay = null;
    if (!this.isMonthValidForTab()) {
      this.currentDate = new Date();
    }
  }

  get canGoPrevMonth(): boolean {
    if (this.activeTab === 'upcoming') return !this.isCurrentMonth();
    return true;
  }

  get canGoNextMonth(): boolean {
    if (this.activeTab === 'past') return !this.isCurrentMonth();
    return true;
  }

  private isCurrentMonth(): boolean {
    const now = new Date();
    return (
      this.currentDate.getMonth() === now.getMonth() &&
      this.currentDate.getFullYear() === now.getFullYear()
    );
  }

  private isMonthValidForTab(): boolean {
    const now = new Date();
    const nowIndex = now.getFullYear() * 12 + now.getMonth();
    const viewIndex = this.currentDate.getFullYear() * 12 + this.currentDate.getMonth();
    return this.activeTab === 'upcoming' ? viewIndex >= nowIndex : viewIndex <= nowIndex;
  }

  selectDay(day: NutritionDay): void {
    this.selectedDay = {
      ...day,
      meals: day.meals.map(meal => ({
        ...meal,
        foods: meal.foods.map(food => ({ ...food })),
      })),
    };
    this.checkFoodReplacements(day);
    this.loadFoodImages();
    this.loadMealPhotoUrls();
  }

  private loadFoodImages(): void {
    if (!this.selectedDay) return;
    const foods = this.selectedDay.meals.flatMap(meal => meal.foods)
      .filter(food => !food.imageUrl && !!food.foodRefId);
    foods.forEach(food => {
      this.nutritionService.getFoodForClient(food.foodRefId!).pipe(catchError(() => of(null))).subscribe((detail: any) => {
        if (detail?.imageUrl) food.imageUrl = detail.imageUrl;
      });
    });
  }

  private loadMealPhotoUrls(): void {
    if (!this.selectedDay) return;
    const day = this.selectedDay;
    day.meals.filter(meal => !!meal.photoUrl).forEach(meal => {
      this.mealplanDayService.getMealPhotoUrl(day.planId, day.id, meal.id)
        .pipe(catchError(() => of(null)))
        .subscribe(result => {
          if (result?.photoUrl) meal.photoUrl = result.photoUrl;
        });
    });
  }

  private foodCategory(foodRef: any, food: any): string {
    const value = String(foodRef?.category || foodRef?.foodCategory || food?.category || '').trim();
    if (value) return value;
    const protein = Number(foodRef?.protein || 0);
    const carbs = Number(foodRef?.carbohydrates || 0);
    const fat = Number(foodRef?.fat || 0);
    if (protein >= carbs && protein >= fat) return 'Protein';
    if (fat > carbs) return 'Fat';
    return 'Carb';
  }

  openMealReport(meal: Meal, index: number): void {
    this.reportMeal = meal;
    this.reportMealIndex = index;
    this.reportStatus = meal.reportStatus || 'AS_PLANNED';
    this.reportNote = meal.note || '';
    this.showMealReportModal = true;
  }

  closeMealReport(): void {
    this.showMealReportModal = false;
    this.reportMeal = null;
    this.savingMealReport = false;
  }

  saveMealReport(): void {
    if (!this.selectedDay || !this.reportMeal || this.savingMealReport) return;
    this.reportMeal.reportStatus = this.reportStatus;
    this.reportMeal.note = this.reportNote.trim();
    this.savingMealReport = true;
    this.persistNutritionDay('IN_PROGRESS', () => this.closeMealReport());
  }

  saveMealNote(meal: Meal): void {
    if (!this.selectedDay) return;
    this.persistNutritionDay(this.selectedDay.status === 'PENDING' ? 'IN_PROGRESS' : this.selectedDay.status);
  }

  uploadMealPhoto(event: Event, meal: Meal): void {
    if (!this.selectedDay) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingMealId = meal.id;
    this.mealplanDayService.uploadMealPhoto(this.selectedDay.planId, this.selectedDay.id, meal.id, file).subscribe({
      next: (result) => {
        meal.photoUrl = result.photoUrl.startsWith('http')
          ? result.photoUrl
          : `${environment.baseApiUrl}${result.photoUrl}`;
        this.uploadingMealId = null;
      },
      error: () => this.uploadingMealId = null,
    });
  }

  completeNutritionDay(): void {
    if (!this.selectedDay) return;
    this.persistNutritionDay('COMPLETED', () => {
      this.dailySaveMessage = this.translate.instant('DAILY_FEEDBACK_SAVED');
      setTimeout(() => this.dailySaveMessage = '', 3000);
    });
  }

  markDayOffPlan(): void {
    if (!this.selectedDay) return;
    this.selectedDay.meals.forEach(meal => meal.reportStatus = 'SKIPPED');
    this.persistNutritionDay('OFF_PLAN');
  }

  private persistNutritionDay(status: PlanStatus, onSuccess?: () => void): void {
    if (!this.selectedDay) return;
    const day = this.selectedDay;
    const previousStatus = day.status;
    day.status = status;
    const clientMealLogs = day.meals.map(meal => ({
      mealId: meal.id,
      status: meal.reportStatus || null,
      note: meal.note?.trim() || '',
      actualMealTime: meal.actualMealTime || '',
    }));
    this.mealplanDayService.updatePlanDay({
      id: day.id,
      status,
      clientMealLogs,
      hunger: day.hunger || '',
      energy: day.energy || '',
      digestion: day.digestion || '',
      overallNote: day.overallNote?.trim() || '',
    }, day.planId).subscribe({
      next: () => {
        const listed = this.nutritionDays.find(item => item.id === day.id && item.planId === day.planId);
        if (listed) Object.assign(listed, day);
        onSuccess?.();
      },
      error: () => {
        day.status = previousStatus;
        this.savingMealReport = false;
      },
    });
  }

  nutritionDayStatusLabel(day: NutritionDay): string {
    if (day.status === 'OFF_PLAN') return this.translate.instant('OFF_PLAN');
    if (day.status === 'COMPLETED') return this.translate.instant('COMPLETED_LABEL');
    return this.translate.instant('IN_PROGRESS_LABEL');
  }

  mealStatusLabel(status?: MealReportStatus): string {
    if (status === 'AS_PLANNED') return this.translate.instant('AS_PLANNED');
    if (status === 'MODIFIED') return this.translate.instant('MODIFIED');
    if (status === 'SKIPPED') return this.translate.instant('SKIPPED');
    return '';
  }

  extractNutritionPdf(): void {
    this.showNutritionPdfPreview = true;
  }

  closeNutritionPdfPreview(): void {
    this.showNutritionPdfPreview = false;
  }

  get selectedNutritionPlan(): any {
    return this.allPlans.find(plan => plan.id === this.selectedDay?.planId) || null;
  }

  get pdfNutritionDays(): NutritionDay[] {
    if (!this.selectedDay) return [];
    return this.nutritionDays
      .filter(day => day.planId === this.selectedDay!.planId)
      .sort((a, b) => this.parseCalendarDate(a.date)!.getTime() - this.parseCalendarDate(b.date)!.getTime());
  }

  get pdfNutritionWeeks(): { number: number; days: NutritionDay[] }[] {
    const weeks = new Map<number, NutritionDay[]>();
    this.pdfNutritionDays.forEach((day, index) => {
      const number = Math.floor(index / 7) + 1;
      weeks.set(number, [...(weeks.get(number) || []), day]);
    });
    return Array.from(weeks, ([number, days]) => ({ number, days }));
  }

  get pdfNutritionClientName(): string {
    const client = this.selectedNutritionPlan?.client || {};
    return `${client.firstName || client.firstname || ''} ${client.lastName || client.lastname || ''}`.trim() || 'Client';
  }

  get pdfNutritionCoachName(): string {
    const coach = this.selectedNutritionPlan?.coach || {};
    return `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
  }

  get pdfNutritionMealCount(): number {
    return this.pdfNutritionDays.reduce((total, day) => total + day.meals.length, 0);
  }

  downloadNutritionPdf(): void {
    const preview = document.querySelector('.nutrition-pdf-document');
    if (!preview) return;
    const printWindow = window.open('', '_blank', 'width=960,height=800');
    if (!printWindow) return;
    const title = this.escapeNutritionPdfHtml(this.selectedDay?.programName || 'nutrition-program');
    printWindow.document.write(
      `<!doctype html><html><head><title>${title}</title><style>${this.nutritionPdfPrintStyles()}</style></head><body>${preview.outerHTML}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  private escapeNutritionPdfHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    }[character] || character));
  }

  private nutritionPdfPrintStyles(): string {
    return `
      @page{size:A4;margin:8mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
      body{margin:0;background:#fff;color:#07172b;font-family:Arial,sans-serif}.nutrition-pdf-document{width:100%;background:#fff}.nutrition-pdf-cover{min-height:270mm;padding:18mm 10mm}
      .nutrition-pdf-brand{display:flex;align-items:center;gap:12px;color:#078fc9;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase}.nutrition-pdf-brand>span:last-child{display:flex;flex-direction:column}.nutrition-pdf-brand strong{font:inherit}.nutrition-pdf-brand small{margin-top:3px;color:#8ba0b5;font-size:8px;letter-spacing:0;text-transform:none;font-weight:500}.nutrition-pdf-brand-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#12a7e5!important;color:#fff;font-size:21px}
      .nutrition-pdf-cover h1{margin:35px 0 10px;font-size:32px}.nutrition-pdf-description{color:#52677e;line-height:1.6}.nutrition-pdf-meta{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.nutrition-pdf-meta div{padding:13px;border:1px solid #d8e2ec;border-radius:8px}.nutrition-pdf-meta small{display:block;color:#8295aa;font-size:9px;text-transform:uppercase}.nutrition-pdf-meta strong{display:block;margin-top:7px;font-size:12px}
      .nutrition-pdf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.nutrition-pdf-stats div{padding:14px;border-radius:8px;background:#12a7e5!important;color:#fff!important}.nutrition-pdf-stats strong{display:block;font-size:23px}.nutrition-pdf-stats small{font-size:9px;font-weight:700}
      .nutrition-pdf-week{break-before:page;padding:4mm 2mm}.nutrition-pdf-week-header{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:1px solid #d9e3ec}.nutrition-pdf-week-header>div:last-child{display:flex;align-items:flex-end;flex-direction:column;gap:3px}.nutrition-pdf-week-header h2{margin:3px 0 0;font-size:22px}.nutrition-pdf-week-header small{color:#7890a8;font-size:8px;text-transform:uppercase}.nutrition-pdf-week-header strong{color:#34495f;font-size:9px}
      .nutrition-pdf-day{margin-top:14px;border:1px solid #cad8e4;border-radius:7px;overflow:hidden;break-inside:avoid}.nutrition-pdf-day-head{display:flex;justify-content:space-between;padding:9px 12px;background:#12a7e5!important;color:#fff!important;font-size:10px;font-weight:700}.nutrition-pdf-day-head em{padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.25)!important;font-size:7px;font-style:normal;text-transform:uppercase}
      .nutrition-pdf-totals{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e3eaf0}.nutrition-pdf-totals span{padding:7px 9px;border-right:1px solid #e3eaf0}.nutrition-pdf-totals span:last-child{border:0}.nutrition-pdf-totals strong,.nutrition-pdf-totals small{display:block}.nutrition-pdf-totals strong{font-size:9px}.nutrition-pdf-totals small{margin-top:2px;color:#8293a5;font-size:6px;text-transform:uppercase}
      .nutrition-pdf-meal{margin:9px;border:1px solid #dce5ed;border-radius:5px;overflow:hidden;break-inside:avoid}.nutrition-pdf-meal-head{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;background:#f7fafc!important;font-size:8px}.nutrition-pdf-meal-head strong{font-size:9px}.nutrition-pdf-meal-head em{padding:2px 5px;border-radius:4px;background:#e7f6fd!important;color:#087fae;font-size:6px;font-style:normal}.nutrition-pdf-meal table{width:100%;border-collapse:collapse;font-size:8px}.nutrition-pdf-meal th,.nutrition-pdf-meal td{padding:5px 8px;border-top:1px solid #e6edf3;text-align:left}.nutrition-pdf-meal th{color:#8093a8;font-size:7px;text-transform:uppercase}.nutrition-pdf-meal th:not(:first-child),.nutrition-pdf-meal td:not(:first-child){text-align:right}
      .nutrition-pdf-empty{padding:18px;text-align:center;color:#8a9bb0;font-size:9px;font-style:italic}
    `;
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
    if (hour < 12) return this.translate.instant('GOOD_MORNING');
    if (hour < 18) return this.translate.instant('GOOD_AFTERNOON');
    return this.translate.instant('GOOD_EVENING');
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
    return this.fileSettingsResolved && this.nutritionFileEnabled && this.filePrograms.length > 0;
  }

  get calendarCountLabel(): string {
    const count = this.filteredDays.length;
    return this.translate.instant(count === 1 ? 'ONE_DAY_THIS_MONTH' : 'DAYS_THIS_MONTH', { count });
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
          this.selectedFileError = this.translate.instant('PDF_PREVIEW_ERROR');
          this.selectedFileLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading PDF preview:', error);
        this.selectedFileError = this.translate.instant('PDF_PREVIEW_ERROR');
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
            this.selectedFileError = this.translate.instant('EXCEL_READ_ERROR');
          }
          this.excelLoading = false;
          this.selectedFileLoading = false;
        };
        reader.onerror = () => {
          this.excelLoading = false;
          this.selectedFileLoading = false;
          this.selectedFileError = this.translate.instant('FILE_READ_ERROR');
        };
        reader.readAsArrayBuffer(blob);
      },
      error: (error) => {
        console.error('Error loading Excel preview:', error);
        this.excelLoading = false;
        this.selectedFileLoading = false;
        this.selectedFileError = this.translate.instant('FILE_PREVIEW_LOAD_ERROR');
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
    return d.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
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
