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
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { DeleteNutritionPlanModalComponent } from '../delete-nutrition-plan-modal/delete-nutrition-plan-modal.component';
import { ChoosePlanTypeModalComponent } from '../choose-plan-type-modal/choose-plan-type-modal.component';
import { ModalAssignToclientComponent } from 'app/components/clients/modal-assign-toclient/modal-assign-toclient.component';
import * as XLSX from 'xlsx';

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
  goBack(): void {
    window.history.back();
  }


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
  programTypeFilter: 'ALL' | 'APP' | 'PDF' | 'EXCEL' = 'ALL';

  showChooseModal = false;
  showDeleteModal = false;
  selectedPlan: NutritionPlan | null = null;
  openDropdownId: string | null = null;

  showFilePreviewModal = false;
  previewPlan: NutritionPlan | null = null;
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
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit() {
    this.loadNutritionFileSetting();
    this.loadPlans();
    document.addEventListener('click', this.documentClickHandler);
  }


  private loadNutritionFileSetting(): void {
    this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

    this.coachSettingsService.loadConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: (config) => {
        this.nutritionFileEnabled = config.nutrition?.nutritionFileEnabled !== false;
        if (!this.nutritionFileEnabled && this.programTypeFilter !== 'APP') {
          this.programTypeFilter = 'ALL';
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


  get myLibraryCount(): number {
    return this.plans.filter((plan) => !this.isTemplatePlan(plan)).length;
  }

  get templatesCount(): number {
    return this.plans.filter((plan) => this.isTemplatePlan(plan)).length;
  }

  setActiveTab(tab: 'my-library' | 'templates') {
    this.activeTab = tab;
    this.openDropdownId = null;

    if (tab === 'templates') {
      this.programTypeFilter = 'ALL';
    }
  }

  setProgramTypeFilter(type: 'ALL' | 'APP' | 'PDF' | 'EXCEL') {
    this.programTypeFilter = type;
    this.openDropdownId = null;
  }

  getProgramTypeKey(plan: NutritionPlan): 'APP' | 'PDF' | 'EXCEL' {
    if (!this.isFilePlan(plan)) {
      return 'APP';
    }

    return this.getFileKind(plan);
  }

  getProgramIconName(plan: NutritionPlan): string {
    const type = this.getProgramTypeKey(plan);
if (type === 'APP') {
      return 'grid';
    }

    return 'file-text';
  }

  getProgramDescription(plan: NutritionPlan): string {
    if (this.isFilePlan(plan)) {
      const fileName = (plan as any).originalFileName || (plan as any).fileName || 'Static nutrition document';
      const size = (plan as any).fileSizeBytes ? ` · ${this.formatFileSize((plan as any).fileSizeBytes)}` : '';
      return `${fileName}${size}`;
    }

    const days = plan.mealDays?.length || 0;
    if (days > 0) {
      return `${days}-day nutrition program`;
    }

    return (plan as any).details || 'Nutrition program';
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
    const anyPlan = plan as any;
    const mode = String(anyPlan?.nutritionPlanMode || anyPlan?.mealPlanMode || anyPlan?.planMode || '').toUpperCase();
    const type = String(anyPlan?.resourceType || anyPlan?.fileType || anyPlan?.documentType || '').toUpperCase();
    const fileName = String(anyPlan?.originalFileName || anyPlan?.fileName || anyPlan?.fileUrl || '').toLowerCase();

    return (
      mode === 'FILE' ||
      mode === 'DOCUMENT' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!anyPlan?.fileName ||
      !!anyPlan?.originalFileName ||
      !!anyPlan?.fileUrl ||
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.xlsx')
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
      return this.getFileKind(plan) === 'PDF' ? 'PDF' : 'Excel';
    }

    return 'App Program';
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

  previewNutritionFile(plan: NutritionPlan) {
    this.openDropdownId = null;

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      return;
    }

    const title = this.escapeHtml(plan.name || 'Nutrition file');
    previewWindow.document.open();
    previewWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #f7f9fc; color: #111827; }
            .topbar { height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; background: #111827; color: #fff; box-sizing: border-box; }
            .title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .loading { padding: 28px; color: #667085; }
          </style>
        </head>
        <body>
          <div class="topbar"><div class="title">${title}</div></div>
          <div class="loading">Loading preview...</div>
        </body>
      </html>
    `);
    previewWindow.document.close();

    this.nutritionService
      .downloadNutritionFile(plan)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (blob) => {
          try {
            if (this.getFileKind(plan) === 'PDF') {
              this.renderPdfInNewTab(previewWindow, plan, blob);
              return;
            }

            await this.renderExcelInNewTab(previewWindow, plan, blob);
          } catch (error) {
            console.error('Nutrition file preview error:', error);
            this.renderPreviewError(previewWindow);
          }
        },
        error: (error) => {
          console.error('Nutrition file preview error:', error);
          this.renderPreviewError(previewWindow);
        },
      });
  }

  private renderPdfInNewTab(previewWindow: Window, plan: NutritionPlan, blob: Blob): void {
    const title = this.escapeHtml(plan.name || (plan as any).originalFileName || 'PDF preview');
    const pdfBlob = blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(pdfBlob);

    previewWindow.document.open();
    previewWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            html, body { margin: 0; height: 100%; font-family: Arial, sans-serif; background: #111827; }
            .topbar { height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; background: #111827; color: #fff; box-sizing: border-box; }
            .title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            iframe { width: 100%; height: calc(100vh - 54px); border: 0; background: #fff; }
          </style>
        </head>
        <body>
          <div class="topbar"><div class="title">${title}</div></div>
          <iframe src="${blobUrl}"></iframe>
        </body>
      </html>
    `);
    previewWindow.document.close();

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
  }

  private async renderExcelInNewTab(previewWindow: Window, plan: NutritionPlan, blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames?.[0] || '';
    const worksheet = workbook.Sheets[sheetName];
    const rows = worksheet
      ? (XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][])
      : [];

    const title = this.escapeHtml(plan.name || (plan as any).originalFileName || 'Excel preview');
    const fileName = this.escapeHtml((plan as any).originalFileName || (plan as any).fileName || '');
    const visibleRows = rows.slice(0, 160);

    const tableRows = visibleRows.map((row, rowIndex) => `
      <tr>
        <th class="row-index">${rowIndex + 1}</th>
        ${row.map((cell) => `<td>${this.escapeHtml(String(cell ?? ''))}</td>`).join('')}
      </tr>
    `).join('');

    previewWindow.document.open();
    previewWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #f7f9fc; color: #111827; }
            .topbar { height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; background: #111827; color: #fff; box-sizing: border-box; }
            .title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .meta { padding: 12px 18px; color: #667085; background: #fff; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            .wrap { padding: 18px; overflow: auto; height: calc(100vh - 96px); box-sizing: border-box; }
            table { border-collapse: collapse; background: #fff; min-width: max-content; box-shadow: 0 1px 2px rgba(15,23,42,.06); }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 13px; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
            .row-index { position: sticky; left: 0; background: #f8fafc; color: #475569; text-align: center; min-width: 44px; z-index: 2; }
          </style>
        </head>
        <body>
          <div class="topbar"><div class="title">${title}</div></div>
          <div class="meta">${fileName} · ${rows.length} rows</div>
          <div class="wrap">
            <table><tbody>${tableRows || '<tr><td>No data found in this Excel file.</td></tr>'}</tbody></table>
          </div>
        </body>
      </html>
    `);
    previewWindow.document.close();
  }

  private renderPreviewError(previewWindow: Window): void {
    previewWindow.document.open();
    previewWindow.document.write(`
      <html>
        <body style="font-family:Arial,sans-serif;padding:28px;color:#dc2626">
          Could not preview this file. Use Download to open it.
        </body>
      </html>
    `);
    previewWindow.document.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  closeFilePreviewModal(): void {
    this.showFilePreviewModal = false;
  }

  openProgramFile(plan: NutritionPlan): void {
    this.previewNutritionFile(plan);
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

    return this.plans.filter((plan) => {
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
        type === this.programTypeFilter;

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

  openChooseModal() {
    if (this.nutritionFileEnabled === false) {
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
        this.importPlanDescription.trim() || undefined,
        undefined,
        undefined
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

  onProgramAssigned(event: any) {
    if (!this.programToAssign || !event?.clients?.length || !event?.date) {
      this.showAssignModal = false;
      return;
    }

    for (const client of event.clients) {
      if (this.isFilePlan(this.programToAssign)) {
        if (!event.endDate) {
          this.error = 'End date is required for PDF / Excel nutrition plans.';
          return;
        }

        const item = {
          ...this.programToAssign,
          client,
          startDate: event.date,
          endDate: event.endDate,
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
