import { EmptyStateComponent } from 'app/shared/components/empty-state/empty-state.component';
import { ProgramDaysBadgeComponent } from '@shared/components/program-days-badge/program-days-badge.component';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'app/config/auth.service';
import { Subject, takeUntil } from 'rxjs';
import {
  NutritionService,
  NutritionPlan,
} from '../../../service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { DeleteNutritionPlanModalComponent } from '../delete-nutrition-plan-modal/delete-nutrition-plan-modal.component';
import { ChoosePlanTypeModalComponent } from '../choose-plan-type-modal/choose-plan-type-modal.component';
import { ModalAssignToclientComponent } from 'app/components/clients/modal-assign-toclient/modal-assign-toclient.component';
import * as XLSX from 'xlsx';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'app/service/toast.service';

import { NutritionPlanKind as AppPlanKind, nutritionPlanKind } from '@shared/models/nutrition-plan-kind';

type NutritionPlanKind = AppPlanKind | 'PDF' | 'EXCEL';

const PLAN_KIND_ICONS: Record<NutritionPlanKind, string> = {
  FOODS: 'coffee',
  DAY_MACROS: 'pie-chart',
  MEAL_MACROS: 'layers',
  PDF: 'file-text',
  EXCEL: 'file-text',
};

import { programFileOpenErrorKey, programFileProblem, programFileSaveName, programFileUploadErrorKey } from '@shared/models/program-file-check';
import { ProgramFileViewerComponent } from '@shared/components/program-file-viewer/program-file-viewer.component';
import { isFilePlan } from '@shared/models/program-file-check';
@Component({
  selector: 'app-nutrition-plans',
  standalone: true,
  imports: [WriteActionDirective, EmptyStateComponent, ProgramDaysBadgeComponent, ProgramFileViewerComponent, 
    CommonModule,
    FormsModule,
    FeatherModule,
    DeleteNutritionPlanModalComponent,
    ChoosePlanTypeModalComponent,
    ModalAssignToclientComponent,
    TranslateModule,
  ],
  templateUrl: './nutrition-plans.component.html',
  styleUrls: ['./nutrition-plans.component.scss'],
})
export class NutritionPlansComponent implements OnInit, OnDestroy {
  private static readonly plansCache = new Map<string, NutritionPlan[]>();
  private static readonly initialFetchSize = 100;

  nutritionFileEnabled = true;


  getProgramId = (plan: any): string => {
    return String(
      plan?.id ||
      plan?._id ||
      plan?.uuid ||
      plan?.fileName ||
      plan?.originalFileName ||
      plan?.name ||
      ''
    );
  };

  private destroy$ = new Subject<void>();
  private documentClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.openDropdownId = null;
    }
  };

  plans: NutritionPlan[] = [];
  searchTerm = '';
  activeTab: 'my-library' | 'templates' = 'my-library';
  /** « Programmes » (APP) | « Fichiers » (FILES): the PDF / Excel never mixed with the plans (lot 3). ALL: templates. */
  programTypeFilter: 'ALL' | 'APP' | 'FILES' | 'PDF' | 'EXCEL' = 'APP';

  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  pagesArray: number[] = [];

  showChooseModal = false;
  showDeleteModal = false;
  selectedPlan: NutritionPlan | null = null;
  openDropdownId: string | null = null;

  showFilePreviewModal = false;
  previewPlan: NutritionPlan | null = null;
  /** The file shown in the shared viewer. */
  viewerPlan: NutritionPlan | null = null;
  /** Upload progress of the file being sent (0-100, audit PDF/Excel 2026-11-23, lot 3). */
  uploadPercent = 0;
  previewLoading = false;
  previewError = '';
  previewFileKind: 'PDF' | 'EXCEL' | null = null;
  previewBlobUrl: string | null = null;
  excelRows: any[][] = [];
  excelSheets: string[] = [];
  selectedExcelSheetName = '';
  selectedExcelWorkbook: any | null = null;
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
    private router: Router,
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private location: Location,
    private authService: AuthService,
  ) {}

  /** Admin (or super admin): creates, changes and removes the YoCoach templates. */
  isAdmin = false;

  /** Number of plans in each tab (2026-11-20: « Mes plans » / « Modèles YoCoach »). */
  myLibraryCount = 0;
  templatesCount = 0;

  /** « Modèles YoCoach » tab, else the coach's own plans. */
  get publicTemplates(): boolean {
    return this.activeTab === 'templates';
  }

  /** A coach only copies a YoCoach template: changing, assigning or removing it is for the admin. */
  get readOnlyTemplates(): boolean {
    return this.publicTemplates && !this.isAdmin;
  }

  goBack(): void {
    window.history.back();
  }

  ngOnInit() {
    if (this.route.snapshot.data['tab'] === 'templates') {
      this.activeTab = 'templates';
      this.programTypeFilter = 'ALL';
    }
    void this.authService.extractRoles().then((roles) => {
      this.isAdmin = (roles || []).some((role) => role === 'ROLE_ADMIN' || role === 'ROLE_SUPER_ADMIN');
    });
    this.loadNutritionFileSetting();
    this.loadPlans();
    this.loadOtherTabCount();
    document.addEventListener('click', this.documentClickHandler);
  }


  private loadNutritionFileSetting(): void {
    this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

    this.coachSettingsService.loadConfig(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (config) => {
        this.nutritionFileEnabled = config.nutrition?.nutritionFileEnabled !== false;
        if (!this.nutritionFileEnabled && this.programTypeFilter !== 'APP') {
          this.programTypeFilter = this.activeTab === 'templates' ? 'ALL' : 'APP';
        }
        if (!this.nutritionFileEnabled) {
          this.showNutritionPlanTypeModal = false;
          this.showImportFileModal = false;
        }
      },
      error: () => {
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.documentClickHandler);
    this.revokePreviewBlob();
  }

  loadPlans() {
    const cacheKey = `${this.activeTab}|ALL|${this.searchTerm.trim().toLowerCase()}`;
    const sessionCacheKey = `yo-coach:nutrition-plans:${cacheKey}`;
    let cachedPlans = NutritionPlansComponent.plansCache.get(cacheKey);

    if (!cachedPlans) {
      try {
        const storedPlans = sessionStorage.getItem(sessionCacheKey);
        cachedPlans = storedPlans ? JSON.parse(storedPlans) as NutritionPlan[] : undefined;
        if (cachedPlans) {
          NutritionPlansComponent.plansCache.set(cacheKey, cachedPlans);
        }
      } catch {
        sessionStorage.removeItem(sessionCacheKey);
      }
    }

    if (cachedPlans) {
      this.applyLoadedPlans(cachedPlans);
    }

    this.loading = !cachedPlans;
    this.error = null;

    const request$ = this.activeTab === 'templates'
      // The page shows its own loading state (or the cached plans): no full-screen loader.
      ? this.nutritionService.getNutritionPlansTemplates(0, NutritionPlansComponent.initialFetchSize, this.searchTerm, true)
      : this.nutritionService.getNutritionPlans(0, NutritionPlansComponent.initialFetchSize, 'ALL', this.searchTerm, true);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          const content = this.extractPlans(page);
          NutritionPlansComponent.plansCache.set(cacheKey, content);
          try {
            sessionStorage.setItem(sessionCacheKey, JSON.stringify(content));
          } catch {
            // Memory cache still keeps navigation fast when session storage is unavailable.
          }
          this.applyLoadedPlans(content);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading nutrition plans:', error);
          this.error = 'Failed to load nutrition plans.';
          this.loading = false;
        },
      });
  }

  private applyLoadedPlans(content: NutritionPlan[]): void {
    this.plans = this.sortNewestFirst(
      this.activeTab === 'templates'
        ? content
            .filter((plan: any) => !plan.isDemo && this.isLibraryOnlyPlan(plan))
            .map((plan) => ({
              ...plan,
              isMealPlanTemplate: true,
            }))
        : content.filter((plan: any) => this.isLibraryOnlyPlan(plan))
    );

    const matchingPlans = this.getMatchingPlans();
    // The count of the open tab is the list itself (not filtered by a search or a type).
    if (!this.searchTerm.trim()) {
      if (this.activeTab === 'templates') this.templatesCount = this.plans.length;
      else this.myLibraryCount = this.plans.length;
    }
    this.totalElements = matchingPlans.length;
    this.totalPages = Math.ceil(matchingPlans.length / this.pageSize);
    if (this.currentPage > this.totalPages - 1) {
      this.currentPage = 0;
    }
    this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
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
      const bTime = this.toDateTime(this.getSortDate(b));
      const aTime = this.toDateTime(this.getSortDate(a));

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

  private getSortDate(plan: NutritionPlan): string | Date | undefined {
    const anyPlan = plan as any;

    return (
      anyPlan.updatedAt ||
      anyPlan.createdAt ||
      anyPlan.fileUploadedAt ||
      anyPlan.uploadedAt
    );
  }

  private isLibraryOnlyPlan(plan: NutritionPlan): boolean {
    const anyPlan = plan as any;

    return !(
      anyPlan.startDate ||
      anyPlan.endDate ||
      anyPlan.client ||
      anyPlan.clientId ||
      anyPlan.clientIds?.length
    );
  }


  /** The other tab only needs its count (one small request). */
  private loadOtherTabCount(): void {
    const request$ = this.activeTab === 'templates'
      ? this.nutritionService.getNutritionPlans(0, 1, 'ALL', '', true)
      : this.nutritionService.getNutritionPlansTemplates(0, 1, '', true);
    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (page: any) => {
        const total = Number(page?.totalElements ?? this.extractPlans(page).length) || 0;
        if (this.activeTab === 'templates') this.myLibraryCount = total;
        else this.templatesCount = total;
      },
      error: () => undefined,
    });
  }

  /**
   * Tabs « Mes plans » / « Modèles YoCoach » (2026-11-20, like the workout programs).
   * The address follows the tab without reloading the page, so a refresh or the back button keeps it.
   */
  switchLibraryTab(tab: 'my-library' | 'templates'): void {
    if (this.activeTab === tab) return;
    this.location.replaceState(tab === 'templates' ? '/nutrition/public-templates' : '/nutrition/plans');
    this.searchTerm = '';
    this.setActiveTab(tab);
  }

  setActiveTab(tab: 'my-library' | 'templates') {
    this.activeTab = tab;
    this.openDropdownId = null;
    this.currentPage = 0;

    // Templates: everything; my library: « Programmes » first, the files in their own tab.
    this.programTypeFilter = tab === 'templates' ? 'ALL' : 'APP';

    this.loadPlans();
  }

  setProgramTypeFilter(type: 'ALL' | 'APP' | 'FILES' | 'PDF' | 'EXCEL') {
    this.programTypeFilter = type;
    this.openDropdownId = null;
    this.currentPage = 0;
    // The library is already read: the tab only splits it on screen.
    this.applyLoadedPlans(this.plans);
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadPlans();
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
  }

  previousPage(): void {
    this.onPageChange(this.currentPage - 1);
  }

  nextPage(): void {
    this.onPageChange(this.currentPage + 1);
  }

  getCreatedDate(plan: NutritionPlan): string | Date | undefined {
    const anyPlan = plan as any;

    return anyPlan.createdAt || anyPlan.createdDate || anyPlan.fileUploadedAt || anyPlan.uploadedAt;
  }

  getModifiedDate(plan: NutritionPlan): string | Date | undefined {
    const anyPlan = plan as any;

    return (
      anyPlan.updatedAt ||
      anyPlan.lastModifiedDate ||
      anyPlan.modifiedAt ||
      anyPlan.createdAt ||
      anyPlan.createdDate ||
      anyPlan.fileUploadedAt ||
      anyPlan.uploadedAt
    );
  }

  getProgramTypeKey(plan: NutritionPlan): 'APP' | 'PDF' | 'EXCEL' {
    if (!this.isFilePlan(plan)) {
      return 'APP';
    }

    return this.getFileKind(plan);
  }

  /** The 3 kinds of plan built in the app (they open different editors), or the file kind. */
  getPlanKind(plan: NutritionPlan): NutritionPlanKind {
    if (this.isFilePlan(plan)) return this.getFileKind(plan);
    return nutritionPlanKind(plan);
  }

  getProgramIconName(plan: NutritionPlan): string {
    return PLAN_KIND_ICONS[this.getPlanKind(plan)];
  }

  getProgramDescription(plan: NutritionPlan): string {
    if (this.isFilePlan(plan)) {
      const fileName = (plan as any).originalFileName || (plan as any).fileName || this.translate.instant('STATIC_NUTRITION_DOCUMENT');
      const size = (plan as any).fileSizeBytes ? ` · ${this.formatFileSize((plan as any).fileSizeBytes)}` : '';
      return `${fileName}${size}`;
    }

    const days = plan.mealDays?.length || 0;
    if (days > 0) {
      const weeks = this.getPlanTotalWeeks(plan);
      return weeks > 0
        ? this.translate.instant('WEEK_NUTRITION_PROGRAM', { count: weeks })
        : this.translate.instant('DAY_NUTRITION_PROGRAM', { count: days });
    }

    return (plan as any).details || this.translate.instant('NUTRITION_PROGRAM');
  }

  getPlanTotalWeeks(plan: NutritionPlan): number {
    if (this.isFilePlan(plan)) return 0;

    const totalDays = this.getMealDaySpan(plan);
    return totalDays > 0 ? Math.ceil(totalDays / 7) : 0;
  }

  private getMealDaySpan(plan: NutritionPlan): number {
    const days = plan?.mealDays || [];
    const maxDayNumber = days
      .map((day: any) => Number(day?.dayNumber || 0))
      .filter((dayNumber: number) => dayNumber > 0)
      .reduce((max: number, dayNumber: number) => Math.max(max, dayNumber), 0);

    return maxDayNumber || days.length || 1;
  }

  trackByProgram(_index: number, program: any): string {
    return String(
      program?.id ||
      program?._id ||
      program?.uuid ||
      program?.fileName ||
      program?.originalFileName ||
      program?.name ||
      _index
    );
  }

  isTemplatePlan(plan: NutritionPlan): boolean {
    return Boolean((plan as any).isMealPlanTemplate || (plan as any).mealPlanTemplate);
  }


  isFilePlan(plan: NutritionPlan): boolean {
    return isFilePlan(plan);
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
    const kind = this.getPlanKind(plan);
    if (kind === 'PDF') return 'PDF';
    if (kind === 'EXCEL') return 'Excel';
    return this.translate.instant(`PLAN_KIND_${kind}`);
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


  private revokePreviewBlob(): void {
    if (this.previewBlobUrl) {
      window.URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }

  /** The shared viewer (audit PDF/Excel 2026-11-23, lot 2): before, a pop-up with its own PDF / Excel reader. */
  previewNutritionFile(plan: NutritionPlan) {
    this.openDropdownId = null;
    this.viewerPlan = plan;
  }

  closeFilePreviewModal(): void {
    this.showFilePreviewModal = false;
  }

  openProgramFile(plan: NutritionPlan): void {
    this.previewNutritionFile(plan);
  }

  // ---- « Renommer » / « Remplacer » a library file (audit PDF/Excel 2026-11-23, lot 3)
  libraryReplaceSaving = false;
  libraryReplacePercent = 0;
  private libraryReplaceTarget: NutritionPlan | null = null;

  renameLibraryFile(plan: NutritionPlan): void {
    this.openDropdownId = null;
    const current = plan?.name || '';
    const name = window.prompt(this.translate.instant('PROGRAM_FILES.RENAME_PROMPT'), current)?.trim();
    if (!name || name === current || !plan?.id) return;
    this.nutritionService.updateNutritionFileDetails(plan.id, name, (plan as any).details || '').subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROGRAM_FILES.RENAMED'));
        NutritionPlansComponent.plansCache.clear();
        this.loadPlans();
      },
      error: (error: unknown) => this.toast.error(this.translate.instant(programFileUploadErrorKey(error))),
    });
  }

  replaceLibraryFile(plan: NutritionPlan): void {
    this.openDropdownId = null;
    if (!plan?.id || this.libraryReplaceSaving) return;
    if (!window.confirm(this.translate.instant('PROGRAM_FILES.LIBRARY_REPLACE_CONFIRM'))) return;
    this.libraryReplaceTarget = plan;
    const input = document.getElementById('library-nutrition-replace-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  onLibraryReplaceSelected(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    const plan = this.libraryReplaceTarget;
    if (!file || !plan?.id) return;
    const problem = programFileProblem(file);
    if (problem) {
      this.toast.error(this.translate.instant(problem));
      return;
    }
    this.libraryReplaceSaving = true;
    this.libraryReplacePercent = 0;
    this.nutritionService.replaceNutritionFile(plan.id, file, percent => (this.libraryReplacePercent = percent)).subscribe({
      next: () => {
        this.libraryReplaceSaving = false;
        this.libraryReplaceTarget = null;
        this.toast.success(this.translate.instant('PROGRAM_FILES.REPLACE_DONE'));
        NutritionPlansComponent.plansCache.clear();
        this.loadPlans();
      },
      error: (error: unknown) => {
        this.libraryReplaceSaving = false;
        this.toast.error(this.translate.instant(programFileUploadErrorKey(error)));
      },
    });
  }

  downloadProgramFile(plan: NutritionPlan): void {
    this.downloadNutritionFile(plan);
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
          link.download = programFileSaveName(plan);
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        },
        error: (error) => this.toast.error(this.translate.instant(programFileOpenErrorKey(error))),
      });
  }

  private getMatchingPlans(): NutritionPlan[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.plans.filter((plan) => {
      if (!this.isLibraryOnlyPlan(plan)) {
        return false;
      }

      const matchesTab = this.activeTab === 'templates'
        ? this.isTemplatePlan(plan)
        : !this.isTemplatePlan(plan);

      if (!matchesTab) {
        return false;
      }

      const type = this.getProgramTypeKey(plan);
if (this.nutritionFileEnabled === false && type !== 'APP') {
        return false;
      }

      const matchesType =
        this.activeTab === 'templates' ||
        this.programTypeFilter === 'ALL' ||
        (this.programTypeFilter === 'FILES' ? type === 'PDF' || type === 'EXCEL' : type === this.programTypeFilter);

      if (!matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        plan.name,
        (plan as any).details,
        (plan as any).originalFileName,
        (plan as any).fileName,
        this.getProgramDescription(plan),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }

  get filteredPlans() {
    const start = this.currentPage * this.pageSize;

    return this.getMatchingPlans().slice(start, start + this.pageSize);
  }

  openChooseModal() {
    // A YoCoach template is a plan made in the app (no PDF / Excel file).
    if (this.nutritionFileEnabled === false || this.publicTemplates) {
      this.createNormalNutritionPlan();
      return;
    }

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
    if (this.nutritionFileEnabled === false) {
      return;
    }

    this.showNutritionPlanTypeModal = false;
    this.importFile = null;
    this.importFileKind = null;
    this.importPlanName = '';
    this.importPlanDescription = '';
    this.importStartDate = '';
    this.importEndDate = '';
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
    const problem = programFileProblem(file);
    if (problem) {
      this.importError = this.translate.instant(problem);
      return;
    }

    this.importFile = file;
    this.importFileKind = file.name.toLowerCase().trim().endsWith('.pdf') ? 'PDF' : 'EXCEL';
    // The name typed before choosing another file is kept (same as the workout library).
    if (!this.importPlanName.trim()) this.importPlanName = file.name.replace(/\.[^/.]+$/, '');
    this.importError = '';
  }

  saveImportedNutritionFile() {
    if (!this.importFile) {
      this.importError = this.translate.instant('PROGRAM_FILES.CHOOSE_FILE');
      return;
    }

    if (!this.importPlanName.trim()) {
      this.importError = this.translate.instant('PROGRAM_FILES.ENTER_NAME');
      return;
    }

    this.importSaving = true;
    this.importError = '';
    this.uploadPercent = 0;

    this.nutritionService
      .createNutritionFilePlan(
        this.importFile,
        this.importPlanName.trim(),
        this.importPlanDescription.trim() || undefined,
        undefined,
        undefined,
        percent => (this.uploadPercent = percent)
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.importSaving = false;
          this.closeImportNutritionFile();
          this.loadPlans();
        },
        error: (error) => {
          this.importSaving = false;
          this.importError = this.translate.instant(programFileUploadErrorKey(error));
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

    if (this.isTemplatePlan(plan) && !this.isAdmin) {
      return;
    }

    const kind = nutritionPlanKind(plan);
    if (kind === 'MEAL_MACROS') {
      const url = 'nutrition/create-macro-plan/' + plan.id;
      this.router.navigateByUrl(url);
    } else if (kind === 'DAY_MACROS') {
      const url = 'nutrition/create-macro-plan-total-day/' + plan.id;
      this.router.navigateByUrl(url);
    } else {
      const url = 'nutrition/create-full-plan/' + plan.id;
      this.router.navigateByUrl(url);
    }
  }

  openDeleteModal(plan: NutritionPlan) {
    if (this.isTemplatePlan(plan) && !this.isAdmin) {
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

  /**
   * Removed from the screen (and the cached lists) at once, without a full-screen loader nor reloading the list;
   * put back if the server refuses.
   */
  confirmDelete() {
    const plan = this.selectedPlan;
    if (!plan?.id) {
      return;
    }

    const previousPlans = this.plans;
    this.closeDeleteModal();
    this.applyLoadedPlans(this.plans.filter((item) => item.id !== plan.id));
    this.forgetCachedPlan(plan.id);

    this.nutritionService
      .deleteNutritionPlan(plan.id, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.toast.success(this.translate.instant('PROGRAM_DELETED')),
        error: (error) => {
          console.error('Error deleting plan:', error);
          this.error = 'Failed to delete nutrition plan';
          this.applyLoadedPlans(previousPlans);
          this.loadPlans(); // the cached lists get the plan back
        },
      });
  }

  private forgetCachedPlan(planId: string): void {
    NutritionPlansComponent.plansCache.forEach((plans, key) => {
      NutritionPlansComponent.plansCache.set(key, plans.filter((item) => item.id !== planId));
    });
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith('yo-coach:nutrition-plans:')) continue;
        const plans = JSON.parse(sessionStorage.getItem(key) || '[]') as NutritionPlan[];
        sessionStorage.setItem(key, JSON.stringify(plans.filter((item) => item.id !== planId)));
      }
    } catch {
      // The memory cache is already up to date.
    }
  }

  toggleDropdown = (planId: string, event: Event): void => {
    event.stopPropagation();

    if (!planId) {
      return;
    }

    this.openDropdownId = this.openDropdownId === planId ? null : planId;
  };

  assignToClients(program: NutritionPlan) {
    this.openDropdownId = null;
    this.programToAssign = program;
    this.showAssignModal = true;
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.programToAssign = null;
  }

  getProgramDurationDays(program?: NutritionPlan | null): number {
    if (!program) return 1;

    if (this.isFilePlan(program) && program.startDate && program.endDate) {
      return this.daysBetweenInclusive(program.startDate, program.endDate);
    }

    return this.getMealDaySpan(program);
  }

  /** The assignment window did the work and shows the message with « Annuler » (backlog-programmes.md A7). */
  onAssignmentDone() {
    this.closeAssignModal();
    this.loadPlans();
  }

  private daysBetweenInclusive(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.floor((end - start) / 86400000) + 1;
  }

  /** Plan being duplicated (one at a time). */
  duplicatingId: string | null = null;

  /** Like the workout library: no full-screen loader, the copy shows at once on top, without reloading the list. */
  duplicatePlan(id: string | undefined) {
    if (!id || this.duplicatingId) {
      return;
    }

    this.openDropdownId = null;
    this.duplicatingId = id;
    this.nutritionService
      .duplicate(id, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (copy: NutritionPlan) => {
          this.duplicatingId = null;
          if (copy?.id && this.activeTab !== 'templates') {
            this.applyLoadedPlans([copy, ...this.plans]);
            this.currentPage = 0;
          } else {
            this.myLibraryCount += 1;
          }
          if (copy?.id) this.rememberCachedPlan(copy);
          if (this.publicTemplates && copy?.id) {
            // Copied from the YoCoach templates: the copy is in « Mes plans », opened in one click to adapt it.
            this.toast.show({
              type: 'success',
              duration: 8000,
              title: this.translate.instant('NUTRITION_TEMPLATE_COPIED'),
              message: this.translate.instant('TEMPLATE_COPIED_HINT'),
              actions: [{
                label: this.translate.instant('TEMPLATE_OPEN_COPY'),
                run: () => this.editPlan(copy),
              }],
            });
            return;
          }
          this.toast.success(this.translate.instant('PROGRAM_DUPLICATED'));
        },
        error: (error) => {
          this.duplicatingId = null;
          console.error('Error duplicating program:', error);
          this.toast.error(this.translate.instant('ASSIGN_FLOW.DUPLICATE_FAILED'));
        },
      });
  }

  /** The copy also goes into the cached lists of "My plans", so coming back to the page shows it at once. */
  private rememberCachedPlan(plan: NutritionPlan): void {
    NutritionPlansComponent.plansCache.forEach((plans, key) => {
      if (!key.startsWith('templates|')) NutritionPlansComponent.plansCache.set(key, [plan, ...plans]);
    });
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith('yo-coach:nutrition-plans:') || key.startsWith('yo-coach:nutrition-plans:templates|')) continue;
        const plans = JSON.parse(sessionStorage.getItem(key) || '[]') as NutritionPlan[];
        sessionStorage.setItem(key, JSON.stringify([plan, ...plans]));
      }
    } catch {
      // The memory cache is already up to date.
    }
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '';

    return parsedDate.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
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
