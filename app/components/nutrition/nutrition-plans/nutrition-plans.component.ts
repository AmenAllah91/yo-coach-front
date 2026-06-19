import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  NutritionService,
  NutritionPlan,
} from '../../../service/nutrition.service';
import { DeleteNutritionPlanModalComponent } from '../delete-nutrition-plan-modal/delete-nutrition-plan-modal.component';
import { ChoosePlanTypeModalComponent } from '../choose-plan-type-modal/choose-plan-type-modal.component';
import { ModalAssignToclientComponent } from 'app/components/clients/modal-assign-toclient/modal-assign-toclient.component';

@Component({
  selector: 'app-nutrition-plans',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeatherModule,
    DeleteNutritionPlanModalComponent,
    ChoosePlanTypeModalComponent,
    ModalAssignToclientComponent,
  ],
  templateUrl: './nutrition-plans.component.html',
  styleUrls: ['./nutrition-plans.component.scss'],
})
export class NutritionPlansComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private documentClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.openDropdownId = null;
    }
  };

  plans: NutritionPlan[] = [];
  searchTerm = '';

  showChooseModal = false;
  showDeleteModal = false;
  selectedPlan: NutritionPlan | null = null;
  openDropdownId: string | null = null;
  loading = false;
  error: string | null = null;

  programToAssign: NutritionPlan | null = null;
  showAssignModal = false;

  showNutritionPlanTypeModal = false;
  showImportFileModal = false;
  importFile: File | null = null;
  importFileKind: 'PDF' | 'EXCEL' | null = null;
  importPlanName = '';
  importPlanDescription = '';
  importStartDate = '';
  importEndDate = '';
  importSaving = false;
  importError = '';

  constructor(
    private nutritionService: NutritionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPlans();
    document.addEventListener('click', this.documentClickHandler);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.documentClickHandler);
  }

  loadPlans() {
    this.loading = true;
    this.error = null;

    forkJoin({
      privatePlans: this.nutritionService.getNutritionPlans(),
      templatePlans: this.nutritionService.getNutritionPlansTemplates(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ privatePlans, templatePlans }) => {
          const privateContent = this.extractPlans(privatePlans);
          const templateContent = this.extractPlans(templatePlans)
            .filter((plan: any) => !plan.isDemo)
            .map((plan) => ({
              ...plan,
              isMealPlanTemplate: true,
            }));

          this.plans = this.sortNewestFirst(
            this.dedupePlans([...privateContent, ...templateContent])
          );

          this.loading = false;

          console.log(
            '[NUTRITION PLANS] loaded plans =',
            this.plans.length,
            {
              privatePlans: privateContent.length,
              templatePlans: templateContent.length,
              all: this.plans,
            }
          );
        },
        error: (error) => {
          console.error('[NUTRITION PLANS] Error loading plans:', error);
          this.plans = [];
          this.loading = false;
          this.error = 'Failed to load nutrition plans';
        },
      });
  }

  private extractPlans(response: any): NutritionPlan[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.content)) {
      return response.content;
    }

    return [];
  }

  private dedupePlans(plans: NutritionPlan[]): NutritionPlan[] {
    const map = new Map<string, NutritionPlan>();

    for (const plan of plans) {
      if (!plan.id) {
        map.set(crypto.randomUUID(), plan);
        continue;
      }

      map.set(plan.id, plan);
    }

    return Array.from(map.values());
  }

  private sortNewestFirst(plans: NutritionPlan[]): NutritionPlan[] {
    return [...plans].sort((a, b) => {
      const bTime = this.toDateTime(b.updatedAt || b.createdAt || b.startDate);
      const aTime = this.toDateTime(a.updatedAt || a.createdAt || a.startDate);

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return (b.id || '').localeCompare(a.id || '');
    });
  }

  private toDateTime(value: string | Date | undefined): number {
    if (!value) return 0;

    const time = value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isNaN(time) ? 0 : time;
  }

  isTemplatePlan(plan: NutritionPlan): boolean {
    return Boolean((plan as any).isMealPlanTemplate || (plan as any).mealPlanTemplate);
  }


  isFilePlan(plan: NutritionPlan): boolean {
    const anyPlan = plan as any;
    const mode = String(anyPlan?.nutritionPlanMode || '').toUpperCase();
    const type = String(anyPlan?.resourceType || '').toUpperCase();

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!anyPlan?.fileName ||
      !!anyPlan?.originalFileName ||
      !!anyPlan?.fileUrl
    );
  }

  getFileKind(plan: NutritionPlan): 'PDF' | 'EXCEL' {
    const anyPlan = plan as any;
    const type = String(anyPlan?.resourceType || '').toUpperCase();
    const fileName = String(anyPlan?.originalFileName || anyPlan?.fileName || '').toLowerCase();

    if (type === 'PDF' || fileName.endsWith('.pdf')) {
      return 'PDF';
    }

    return 'EXCEL';
  }

  getPlanTypeLabel(plan: NutritionPlan): string {
    if (this.isFilePlan(plan)) {
      return this.getFileKind(plan) === 'PDF' ? 'PDF Document' : 'Excel Document';
    }

    return plan.trackingMode === 'TOTAL_FOR_DAY'
      ? 'TOTAL FOR DAY'
      : plan.trackingMode === 'EACH_MEAL'
        ? 'EACH MEAL'
        : 'FULL MEAL PLAN';
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);

    if (!value) {
      return '';
    }

    if (value < 1024 * 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  previewNutritionFile(plan: NutritionPlan) {
    this.openDropdownId = null;
    const popup = window.open('', '_blank');

    if (!popup) {
      return;
    }

    popup.document.open();
    popup.document.write('<p style="font-family:Arial;padding:24px">Loading nutrition file...</p>');
    popup.document.close();

    this.nutritionService
      .downloadNutritionFile(plan)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const blobUrl = window.URL.createObjectURL(blob);
          popup.location.href = blobUrl;
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
        },
        error: () => {
          popup.document.open();
          popup.document.write('<p style="font-family:Arial;padding:24px;color:#dc2626">Could not open nutrition file.</p>');
          popup.document.close();
        },
      });
  }

  downloadNutritionFile(plan: NutritionPlan) {
    this.openDropdownId = null;

    this.nutritionService
      .downloadNutritionFile(plan)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download =
            (plan as any).originalFileName ||
            (plan as any).fileName ||
            `${plan.name || 'nutrition-plan'}.${this.getFileKind(plan) === 'PDF' ? 'pdf' : 'xlsx'}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        },
        error: (error) => {
          console.error('Error downloading nutrition file:', error);
        },
      });
  }

  get filteredPlans() {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.plans;
    }

    return this.plans.filter((plan) =>
      (plan.name || '').toLowerCase().includes(query)
    );
  }

  openChooseModal() {
    this.showNutritionPlanTypeModal = true;
  }

  closeChooseModal() {
    this.showChooseModal = false;
  }

  closeNutritionPlanTypeModal() {
    this.showNutritionPlanTypeModal = false;
  }

  createNormalNutritionPlan() {
    this.showNutritionPlanTypeModal = false;
    this.showChooseModal = true;
  }

  openImportNutritionFile() {
    this.showNutritionPlanTypeModal = false;
    this.importFile = null;
    this.importFileKind = null;
    this.importPlanName = '';
    this.importPlanDescription = '';
    const today = new Date().toISOString().slice(0, 10);
    this.importStartDate = today;
    this.importEndDate = today;
    this.importError = '';
    this.showImportFileModal = true;
  }

  closeImportNutritionFile() {
    if (this.importSaving) {
      return;
    }

    this.showImportFileModal = false;
    this.importFile = null;
    this.importFileKind = null;
    this.importPlanName = '';
    this.importPlanDescription = '';
    this.importStartDate = '';
    this.importEndDate = '';
    this.importError = '';
  }

  onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.setImportNutritionFile(file);
  }

  onImportDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onImportDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];

    if (file) {
      this.setImportNutritionFile(file);
    }
  }

  private setImportNutritionFile(file: File) {
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isExcel =
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel');

    if (!isPdf && !isExcel) {
      this.importError = 'Only PDF, XLS, and XLSX files are allowed.';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.importError = 'File is too large. Maximum size is 25 MB.';
      return;
    }

    this.importFile = file;
    this.importFileKind = isPdf ? 'PDF' : 'EXCEL';
    this.importPlanName = file.name.replace(/\.[^/.]+$/, '');
    this.importError = '';
  }

  saveImportedNutritionFile() {
    if (!this.importFile) {
      this.importError = 'Please choose a file.';
      return;
    }

    if (!this.importPlanName.trim()) {
      this.importError = 'Please enter a plan name.';
      return;
    }

    this.importSaving = true;
    this.importError = '';

    this.nutritionService
      .createNutritionFilePlan(
        this.importFile,
        this.importPlanName.trim(),
        this.importPlanDescription.trim(),
        this.importStartDate,
        this.importEndDate
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.importSaving = false;
          this.closeImportNutritionFile();
          this.loadPlans();
        },
        error: (error) => {
          console.error('Error importing nutrition file:', error);
          this.importSaving = false;
          this.importError = 'Could not import this nutrition file.';
        },
      });
  }

  getCurrentUserId(): string {
    return (
      sessionStorage.getItem('userId') ||
      localStorage.getItem('userId') ||
      ''
    );
  }

  getPlanOwnerId(plan: NutritionPlan): string {
    return String(
      (plan as any).createdBy ||
      (plan as any).coach?.id ||
      ''
    ).trim();
  }

  canManagePlan(plan: NutritionPlan): boolean {
    if (this.isFilePlan(plan)) {
      return true;
    }

    if (this.isTemplatePlan(plan)) {
      return false;
    }

    const currentUserId = this.getCurrentUserId();
    const ownerId = this.getPlanOwnerId(plan);

    return !!currentUserId && !!ownerId && currentUserId === ownerId;
  }

  editPlan(plan: NutritionPlan) {
    if (this.isFilePlan(plan)) {
      return;
    }

    if (this.isTemplatePlan(plan)) {
      return;
    }

    if (plan.trackingMode === 'EACH_MEAL') {
      const url = 'nutrition/create-macro-plan/' + plan.id;
      this.router.navigateByUrl(url);
    } else if (plan.trackingMode === 'TOTAL_FOR_DAY') {
      const url = 'nutrition/create-macro-plan-total-day/' + plan.id;
      this.router.navigateByUrl(url);
    } else {
      const url = 'nutrition/create-full-plan/' + plan.id;
      this.router.navigateByUrl(url);
    }
  }

  openDeleteModal(plan: NutritionPlan) {
    if (this.isTemplatePlan(plan)) {
      return;
    }

    this.selectedPlan = plan;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedPlan = null;
  }

  confirmDelete() {
    if (!this.selectedPlan) {
      return;
    }

    this.nutritionService
      .deleteNutritionPlan(this.selectedPlan.id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeDeleteModal();
          this.loadPlans();
        },
        error: (error) => {
          console.error('Error deleting plan:', error);
          this.error = 'Failed to delete nutrition plan';
          this.closeDeleteModal();
        },
      });
  }

  toggleDropdown(planId: string, event: Event) {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === planId ? null : planId;
  }

  assignToClients(program: NutritionPlan) {
    this.programToAssign = program;
    this.showAssignModal = true;
    this.openDropdownId = null;
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.programToAssign = null;
  }

  onProgramAssigned(event: any) {
    if (!this.programToAssign || !event?.clients?.length || !event?.date) {
      this.showAssignModal = false;
      return;
    }

    for (const client of event.clients) {
      if (this.isFilePlan(this.programToAssign)) {
        const item = {
          ...this.programToAssign,
          client,
          startDate: event.date,
          endDate: event.endDate || event.date,
          mealDays: [],
          isMealPlanTemplate: false,
        };

        this.nutritionService
          .assignNutritionPlan(item)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => this.loadPlans(),
            error: (err) => console.error('Error assigning nutrition file:', err),
          });

        continue;
      }

      const mealDays = (this.programToAssign.mealDays || []).map(
        (day: any, index: number) => {
          const current = new Date(event.date);
          current.setDate(current.getDate() + index);

          return {
            ...day,
            date: current.toISOString().split('T')[0],
            dayOfWeek: current.toLocaleDateString('en-US', {
              weekday: 'long',
            }),
          };
        }
      );

      const item = {
        ...this.programToAssign,
        client,
        startDate: event.date,
        mealDays,
        endDate: mealDays.length
          ? mealDays[mealDays.length - 1].date
          : event.date,
        isMealPlanTemplate: false,
      };

      this.nutritionService
        .assignNutritionPlan(item)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadPlans();
          },
          error: (err) => {
            console.error('Error assigning nutrition plan:', err);
          },
        });
    }

    this.showAssignModal = false;
    this.programToAssign = null;
  }

  duplicatePlan(id: string | undefined) {
    if (!id) {
      return;
    }

    this.nutritionService
      .duplicate(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPlans();
          this.openDropdownId = null;
        },
        error: (error) => console.error('Error duplicating program:', error),
      });
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';

    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTotalProtein(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets?.proteinG || 0),
        0
      ) || 0;

    return `${total}g Protein`;
  }

  getTotalCarbs(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets?.carbsG || 0),
        0
      ) || 0;

    return `${total}g Carbs`;
  }

  getTotalFat(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets?.fatG || 0),
        0
      ) || 0;

    return `${total}g Fat`;
  }

  getTotalCalories(plan: NutritionPlan): string {
    const total =
      plan.mealDays?.reduce(
        (sum, day) => sum + (day.dayTargets?.calories || 0),
        0
      ) || 0;

    return `${total} Kcal`;
  }
}
