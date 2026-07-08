import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';
import { forkJoin, Observable, of, Subject, switchMap, takeUntil } from 'rxjs';
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

    const request$ = this.activeTab === 'templates'
      ? this.nutritionService.getNutritionPlansTemplates(0, 500, this.searchTerm)
      : this.nutritionService.getNutritionPlans(0, 500, this.programTypeFilter, this.searchTerm);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          const content = this.extractPlans(page);

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
          this.totalElements = matchingPlans.length;
          this.totalPages = Math.ceil(matchingPlans.length / this.pageSize);
          if (this.currentPage > this.totalPages - 1) {
            this.currentPage = 0;
          }
          this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading nutrition plans:', error);
          this.error = 'Failed to load nutrition plans.';
          this.loading = false;
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


  get myLibraryCount(): number {
    return this.plans.filter((plan) => !this.isTemplatePlan(plan)).length;
  }

  get templatesCount(): number {
    return this.plans.filter((plan) => this.isTemplatePlan(plan)).length;
  }

  setActiveTab(tab: 'my-library' | 'templates') {
    this.activeTab = tab;
    this.openDropdownId = null;
    this.currentPage = 0;

    if (tab === 'templates') {
      this.programTypeFilter = 'ALL';
    }

    this.loadPlans();
  }

  setProgramTypeFilter(type: 'ALL' | 'APP' | 'PDF' | 'EXCEL') {
    this.programTypeFilter = type;
    this.openDropdownId = null;
    this.currentPage = 0;
    this.loadPlans();
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
      const weeks = this.getPlanTotalWeeks(plan);
      return weeks > 0
        ? `${weeks}-week nutrition program`
        : `${days}-day nutrition program`;
    }

    return (plan as any).details || 'Nutrition program';
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

  private async renderExcelInNewTab(popup: Window, plan: NutritionPlan, blob: Blob): Promise<void> {
    const title = this.escapeHtml(plan?.name || plan?.originalFileName || 'Excel Preview');
    const fileName = this.escapeHtml(plan?.originalFileName || plan?.fileName || '');
    const excelBlob = new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const blobUrl = window.URL.createObjectURL(excelBlob);
    const safeBlobUrl = blobUrl.replace(/'/g, '%27');

    popup.document.open();
    popup.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
          <style>
            html, body { margin: 0; min-height: 100%; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }
            .topbar { height: 58px; display: flex; align-items: center; padding: 0 18px; background: #111827; color: #fff; font-weight: 700; box-sizing: border-box; }
            .meta { padding: 12px 18px; color: #667085; background: #fff; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            .tabs { display: flex; gap: 8px; padding: 10px 18px; background: #fff; border-bottom: 1px solid #e5e7eb; overflow-x: auto; }
            .tab { border: 1px solid #dbe7f2; background: #fff; border-radius: 8px; padding: 7px 12px; cursor: pointer; white-space: nowrap; }
            .tab.active { background: #eaf8ff; color: #0284c7; border-color: #7dd3fc; font-weight: 700; }
            .wrap { padding: 18px; overflow: auto; height: calc(100vh - 113px); box-sizing: border-box; }
            table { border-collapse: collapse; background: #fff; min-width: max-content; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08); }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 13px; white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
            th { background: #f8fafc; color: #475569; font-weight: 700; }
            .row-index { position: sticky; left: 0; min-width: 44px; text-align: center; z-index: 2; }
            .message { padding: 28px; color: #475569; }
            .error { color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="topbar">${title}</div>
          <div class="meta">${fileName} · Excel preview</div>
          <div class="tabs" id="tabs"></div>
          <div class="wrap" id="sheet"><div class="message">Loading Excel preview...</div></div>
          <script>
            const fileUrl = '${safeBlobUrl}';
            const escapeText = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
            const columnName = (index) => {
              let name = '';
              let n = index + 1;
              while (n > 0) {
                const rem = (n - 1) % 26;
                name = String.fromCharCode(65 + rem) + name;
                n = Math.floor((n - 1) / 26);
              }
              return name;
            };
            function renderSheet(workbook, sheetName) {
              const worksheet = workbook.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
              const previewRows = rows.filter(row => row.some(cell => String(cell || '').trim() !== '')).slice(0, 200);
              const maxCols = Math.min(24, Math.max(1, ...previewRows.map(row => row.length)));
              let html = '<table><thead><tr><th class="row-index"></th>';
              for (let c = 0; c < maxCols; c++) html += '<th>' + columnName(c) + '</th>';
              html += '</tr></thead><tbody>';
              previewRows.forEach((row, r) => {
                html += '<tr><th class="row-index">' + (r + 1) + '</th>';
                for (let c = 0; c < maxCols; c++) html += '<td>' + escapeText(row[c]) + '</td>';
                html += '</tr>';
              });
              if (!previewRows.length) html += '<tr><th class="row-index">1</th><td>No data found in this sheet.</td></tr>';
              html += '</tbody></table>';
              document.getElementById('sheet').innerHTML = html;
              document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === sheetName));
            }
            async function init() {
              try {
                if (!window.XLSX) throw new Error('Excel preview library failed to load.');
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error('Could not load the Excel file.');
                const buffer = await response.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetNames = workbook.SheetNames || [];
                if (!sheetNames.length) throw new Error('This Excel file has no sheets.');
                const tabs = document.getElementById('tabs');
                sheetNames.forEach((sheetName) => {
                  const btn = document.createElement('button');
                  btn.className = 'tab';
                  btn.type = 'button';
                  btn.dataset.sheet = sheetName;
                  btn.textContent = sheetName;
                  btn.onclick = () => renderSheet(workbook, sheetName);
                  tabs.appendChild(btn);
                });
                renderSheet(workbook, sheetNames[0]);
              } catch (error) {
                document.getElementById('sheet').innerHTML = '<div class="message error">Could not render Excel preview. Use Download to open this file.<br>' + escapeText(error.message || error) + '</div>';
              }
            }
            init();
          </script>
        </body>
      </html>
    `);
    popup.document.close();

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
  }



  private getNutritionPreviewContentType(plan: any, blob: Blob): string {
    const blobType = String(blob?.type || '').toLowerCase();

    if (blobType.includes('pdf')) {
      return 'application/pdf';
    }

    if (
      blobType.includes('spreadsheet') ||
      blobType.includes('excel') ||
      blobType.includes('application/vnd.ms-excel')
    ) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const name = String(plan?.originalFileName || plan?.fileName || plan?.name || '').toLowerCase();
    const type = String(plan?.resourceType || plan?.fileContentType || '').toLowerCase();

    if (name.endsWith('.pdf') || type.includes('pdf')) {
      return 'application/pdf';
    }

    if (
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      type.includes('excel') ||
      type.includes('spreadsheet')
    ) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return 'application/pdf';
  }

  private buildNutritionExcelPreviewHtml(blobUrl: string, fileName: string): string {
    const safeTitle = this.escapeHtml(fileName);
    const safeBlobUrl = this.escapeHtml(blobUrl);

    return `
      <!doctype html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }
            .topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 22px; background: #ffffff; border-bottom: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(15,23,42,.05); }
            .title { min-width: 0; }
            h1 { margin: 0; font-size: 20px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .subtitle { margin-top: 4px; color: #64748b; font-size: 13px; }
            .tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 14px 22px; background: #fff; border-bottom: 1px solid #e5e7eb; }
            .tab { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; color: #334155; }
            .tab.active { background: #0f172a; color: #fff; border-color: #0f172a; }
            .content { padding: 20px 22px; }
            .sheet-wrap { overflow: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,.06); max-height: calc(100vh - 145px); }
            table { border-collapse: collapse; min-width: 100%; font-size: 13px; }
            td, th { border: 1px solid #e5e7eb; padding: 8px 10px; min-width: 90px; max-width: 360px; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
            th { background: #f1f5f9; position: sticky; top: 0; z-index: 1; font-weight: 700; }
            .row-number { background: #f8fafc; color: #64748b; text-align: right; min-width: 54px; width: 54px; position: sticky; left: 0; z-index: 2; }
            th.row-number { z-index: 3; }
            .message { max-width: 760px; margin: 80px auto; padding: 28px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,.08); }
            .message h2 { margin: 0 0 12px; font-size: 22px; }
            .message p { margin: 0; color: #64748b; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="message" id="loading"><h2>Opening Excel preview...</h2><p>Please wait.</p></div>
          <div id="app" style="display:none;">
            <div class="topbar">
              <div class="title">
                <h1>${safeTitle}</h1>
                <div class="subtitle">Excel preview · no automatic download</div>
              </div>
            </div>
            <div class="tabs" id="tabs"></div>
            <div class="content"><div class="sheet-wrap" id="sheet"></div></div>
          </div>

          <script>
            const fileUrl = '${safeBlobUrl}';
            const escapeText = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
            const columnName = (index) => {
              let name = '';
              let n = index + 1;
              while (n > 0) {
                const rem = (n - 1) % 26;
                name = String.fromCharCode(65 + rem) + name;
                n = Math.floor((n - 1) / 26);
              }
              return name;
            };

            function renderSheet(workbook, sheetName) {
              const worksheet = workbook.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
              const maxCols = Math.max(1, ...rows.map(row => row.length));
              let html = '<table><thead><tr><th class="row-number"></th>';
              for (let c = 0; c < maxCols; c++) html += '<th>' + columnName(c) + '</th>';
              html += '</tr></thead><tbody>';
              rows.forEach((row, r) => {
                html += '<tr><th class="row-number">' + (r + 1) + '</th>';
                for (let c = 0; c < maxCols; c++) html += '<td>' + escapeText(row[c]) + '</td>';
                html += '</tr>';
              });
              if (!rows.length) html += '<tr><th class="row-number">1</th><td>Empty sheet</td></tr>';
              html += '</tbody></table>';
              document.getElementById('sheet').innerHTML = html;
              document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === sheetName));
            }

            async function init() {
              try {
                if (!window.XLSX) throw new Error('Excel preview library failed to load.');
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error('Could not load the Excel file.');
                const buffer = await response.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetNames = workbook.SheetNames || [];
                if (!sheetNames.length) throw new Error('This Excel file has no sheets.');

                const tabs = document.getElementById('tabs');
                sheetNames.forEach((sheetName) => {
                  const btn = document.createElement('button');
                  btn.className = 'tab';
                  btn.type = 'button';
                  btn.dataset.sheet = sheetName;
                  btn.textContent = sheetName;
                  btn.onclick = () => renderSheet(workbook, sheetName);
                  tabs.appendChild(btn);
                });

                document.getElementById('loading').style.display = 'none';
                document.getElementById('app').style.display = 'block';
                renderSheet(workbook, sheetNames[0]);
              } catch (error) {
                document.body.innerHTML = '<div class="message"><h2>Could not open Excel preview</h2><p>' + escapeText(error.message || error) + '</p></div>';
              }
            }
            init();
          </script>
        </body>
      </html>
    `;
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

  get filteredPlans() {
    const start = this.currentPage * this.pageSize;

    return this.getMatchingPlans().slice(start, start + this.pageSize);
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

  getProgramDurationDays(program?: NutritionPlan | null): number {
    if (!program) return 1;

    if (this.isFilePlan(program) && program.startDate && program.endDate) {
      return this.daysBetweenInclusive(program.startDate, program.endDate);
    }

    return this.getMealDaySpan(program);
  }

  onProgramAssigned(event: any) {
    if (!this.programToAssign || !event?.clients?.length || !event?.date) {
      this.showAssignModal = false;
      return;
    }

    for (const client of event.clients) {
      const resolution = this.getConflictResolution(event, client);
      const startDate = this.getResolvedStartDate(event.date, resolution);
      const endDate = this.addDays(startDate, this.getProgramDurationDays(this.programToAssign) - 1);

      const replace$ = resolution?.resolution === 'REPLACE'
        ? this.stopExistingNutritionBefore(resolution.conflict, startDate)
        : of(null);

      if (this.isFilePlan(this.programToAssign)) {
        if (!endDate) {
          this.error = 'End date is required for PDF / Excel nutrition plans.';
          return;
        }

        const item = {
          ...this.programToAssign,
          client,
          startDate,
          endDate,
          mealDays: [],
          isMealPlanTemplate: false,
        };

        replace$
          .pipe(
            switchMap(() => this.nutritionService.assignNutritionPlan(item)),
            takeUntil(this.destroy$)
          )
          .subscribe({
            next: () => this.loadPlans(),
            error: (err) => console.error('Error assigning nutrition file:', err),
          });

        continue;
      }

      const mealDays = (this.programToAssign.mealDays || []).map(
        (day: any, index: number) => {
          const date = this.addDays(startDate, index);
          const current = new Date(`${date}T00:00:00`);

          return {
            ...day,
            date,
            dayOfWeek: current.toLocaleDateString('en-US', {
              weekday: 'long',
            }),
          };
        }
      );

      const item = {
        ...this.programToAssign,
        client,
        startDate,
        mealDays,
        endDate: mealDays.length
          ? mealDays[mealDays.length - 1].date
          : startDate,
        isMealPlanTemplate: false,
      };

      replace$
        .pipe(
          switchMap(() => this.nutritionService.assignNutritionPlan(item)),
          takeUntil(this.destroy$)
        )
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

  private getConflictResolution(event: any, client: any): any | null {
    if (!client?.id) return null;
    return event?.conflictResolutions?.[client.id] || null;
  }

  private getResolvedStartDate(defaultStartDate: string, resolution: any | null): string {
    if (resolution?.resolution === 'START_AFTER' && resolution.conflict?.endDate) {
      return this.addDays(resolution.conflict.endDate, 1);
    }

    return defaultStartDate;
  }

  private stopExistingNutritionBefore(conflict: any, nextStartDate: string): Observable<unknown> {
    if (!conflict?.id || !conflict.startDate) return of(null);

    const replacementEndDate = this.addDays(nextStartDate, -1);
    if (new Date(`${replacementEndDate}T00:00:00`).getTime() < new Date(`${conflict.startDate}T00:00:00`).getTime()) {
      return this.nutritionService.deleteNutritionPlan(conflict.id);
    }

    return this.nutritionService.updateNutritionPlanDates(conflict.id, conflict.startDate, replacementEndDate);
  }

  private daysBetweenInclusive(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.floor((end - start) / 86400000) + 1;
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '';

    return parsedDate.toLocaleDateString('en-US', {
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
