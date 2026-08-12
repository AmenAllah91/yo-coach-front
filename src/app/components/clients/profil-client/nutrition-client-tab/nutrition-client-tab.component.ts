import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule } from '@ngx-translate/core';

type NutritionStatusFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP';
type NutritionSortMode = 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC';

@Component({
  selector: 'app-nutrition-client-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './nutrition-client-tab.component.html',
  styleUrl: './nutrition-client-tab.component.scss',
})
export class NutritionClientTabComponent implements OnInit {
  nutritionFileEnabled = true;

  @Input() clientId!: string;
  @Input() coachId!: string;
  @Output() assignNew = new EventEmitter<void>();

  mealPlan: any[] = [];
  activeMealPlans: any[] = [];
  appPlans: any[] = [];
  filePlans: any[] = [];
  activeTab: 'ALL' | 'APP' | 'FILES' = 'ALL';
  openActionsPlanId: string | null = null;
  showChangeDatesModal = false;
  dateTargetPlan: any | null = null;
  dateStart = '';
  dateEnd = '';
  dateSaving = false;
  dateError: string | null = null;

  page = 0;
  size = 5;
  totalPages = 0;
  pagesArray: number[] = [];
  allPlansFilter: NutritionStatusFilter = 'ALL';
  allPlansSort: NutritionSortMode = 'RECOMMENDED';

  constructor(
    private nutritionService: NutritionService,
    private router: Router,
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit(): void {
    this.loadNutritionFileSetting();
    if (this.clientId && this.coachId) {
      this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
    }
  }

  get displayedPlans(): any[] {
    return this.mealPlan;
  }

  get currentActivePlans(): any[] {
    return this.activeMealPlans;
  }

  get allOtherPlans(): any[] {
    return this.displayedPlans;
  }

  hasActivePlans(): boolean {
    return this.currentActivePlans.length > 0;
  }

  setActiveTab(tab: 'ALL' | 'APP' | 'FILES') {
    if (this.nutritionFileEnabled === false) {
      tab = 'APP';
    }

    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.page = 0;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setAllPlansFilter(filter: NutritionStatusFilter): void {
    if (this.allPlansFilter === filter) {
      return;
    }

    this.allPlansFilter = filter;
    this.page = 0;
    this.closeActions();
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setAllPlansSort(sort: NutritionSortMode): void {
    if (this.allPlansSort === sort) {
      return;
    }

    this.allPlansSort = sort;
    this.page = 0;
    this.closeActions();
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  changePage(newPage: number) {
    if (newPage < 0 || newPage >= this.totalPages) return;
    this.page = newPage;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  getMealPlanByCoachAndClient(idCoach: string, idClient: string) {
    if (this.nutritionFileEnabled === false) {
      this.activeTab = 'APP';
    }
    forkJoin({
      active: this.nutritionService.getNutritionPlanByCoachIdAndClient(
        idCoach,
        idClient,
        0,
        100,
        this.activeTab,
        'ACTIVE',
        'ALL',
        'RECOMMENDED'
      ),
      allPlans: this.nutritionService.getNutritionPlanByCoachIdAndClient(
        idCoach,
        idClient,
        this.page,
        this.size,
        this.activeTab,
        'NON_ACTIVE',
        this.allPlansFilter,
        this.allPlansSort
      ),
    }).subscribe(({ active, allPlans }) => {
        this.totalPages = allPlans.totalPages || 0;
        this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);

        const activePlans = this.decoratePlans(active.content || []);
        const plans = this.decoratePlans(allPlans.content || []);

        this.activeMealPlans = activePlans;
        this.mealPlan = this.nutritionFileEnabled === false
          ? plans.filter((plan: any) => !this.isFilePlan(plan))
          : plans;
        this.appPlans = this.activeTab === 'APP'
          ? plans
          : plans.filter((plan) => !this.isFilePlan(plan));
        this.filePlans = this.activeTab === 'FILES'
          ? plans
          : plans.filter((plan) => this.isFilePlan(plan));
      });
  }

  private decoratePlans(plans: any[]): any[] {
    return (plans || []).map((program: any) => {
          const isFile = this.isFilePlan(program);

          if (isFile) {
            this.decorateFilePlan(program);
            return program;
          }

          const start = program.startDate ? new Date(program.startDate) : null;
          const totalDays = program.mealDays?.length || 0;

          let end = program.endDate ? new Date(program.endDate) : null;

          if (start && !end) {
            end = new Date(start);
            end.setDate(end.getDate() + Math.max(totalDays - 1, 0));
            program.endDate = end;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (start) start.setHours(0, 0, 0, 0);
          if (end) end.setHours(0, 0, 0, 0);

          if (start && today < start) program.status = 'upcoming';
          else if (start && end && today >= start && today <= end) program.status = 'active';
          else if (start && !end && today >= start) program.status = 'active';
          else program.status = 'completed';

          let daysPassed = 0;
          if (program.status === 'active' && start) {
            const diffTime = today.getTime() - start.getTime();
            daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          } else if (program.status === 'completed') {
            daysPassed = totalDays;
          }

          program.totalDays = totalDays;
          program.currentDay = Math.min(daysPassed, totalDays || daysPassed || 0);
          program.progressPercent = totalDays
            ? (program.currentDay / program.totalDays) * 100
            : 0;

          return program;
        });
  }

  private comparePlansByNewest(a: any, b: any): number {
    const aNewest = this.getPlanNewestTime(a);
    const bNewest = this.getPlanNewestTime(b);

    if (aNewest !== bNewest) return bNewest - aNewest;

    return this.toValidTime(b?.startDate) - this.toValidTime(a?.startDate);
  }

  private getPlanNewestTime(plan: any): number {
    const candidates = [
      plan?.createdAt,
      plan?.creationDate,
      plan?.assignedAt,
      plan?.assignedDate,
      plan?.fileUploadedAt,
      plan?.updatedAt,
      plan?.lastModifiedDate,
      plan?.startDate,
    ];

    for (const value of candidates) {
      const time = this.toValidTime(value);
      if (time > -8640000000000000) return time;
    }

    return -8640000000000000;
  }

  private toValidTime(value: any): number {
    if (!value) return -8640000000000000;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : -8640000000000000;
  }

  decorateFilePlan(program: any): void {
    const start = program.startDate ? new Date(program.startDate) : null;
    const end = program.endDate ? new Date(program.endDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);

    if (start && today < start) program.status = 'upcoming';
    else if (start && end && today >= start && today <= end) program.status = 'active';
    else if (start && !end && today >= start) program.status = 'active';
    else program.status = 'completed';

    program.totalDays = this.getDays(program.startDate, program.endDate);
    program.currentDay = this.getCurrentFileDay(program);
    program.progressPercent = program.totalDays
      ? Math.min(100, (program.currentDay / program.totalDays) * 100)
      : 0;
  }

  isPlanOverlap(plan: any): boolean {
    return !!plan?.overlap || (this.isPlanActiveToday(plan) && this.currentActivePlans.length > 1);
  }

  private isPlanActiveToday(plan: any): boolean {
    const start = this.toDateOnlyString(plan?.startDate);
    const end = this.toDateOnlyString(plan?.endDate);
    const today = this.toDateOnlyString(new Date());

    return !!start && !!end && !!today && start <= today && today <= end;
  }

  private toDateOnlyString(value: any): string | null {
    if (!value) return null;

    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isFilePlan(plan: any): boolean {
    const mode = String(plan?.nutritionPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();

    return (
      mode === 'FILE' ||
      type === 'PDF' ||
      type === 'EXCEL' ||
      type === 'XLS' ||
      type === 'XLSX' ||
      !!plan?.fileName ||
      !!plan?.originalFileName ||
      !!plan?.fileUrl
    );
  }

  getFileKind(plan: any): 'pdf' | 'excel' {
    const type = String(plan?.resourceType || '').toUpperCase();
    const fileName = String(plan?.originalFileName || plan?.fileName || '').toLowerCase();

    if (type === 'PDF' || fileName.endsWith('.pdf')) {
      return 'pdf';
    }

    return 'excel';
  }

  getFileTypeLabel(plan: any): 'PDF' | 'EXCEL' {
    return this.getFileKind(plan) === 'pdf' ? 'PDF' : 'EXCEL';
  }


  getFileLabel(plan: any): string {
    return this.getFileKind(plan) === 'pdf' ? 'PDF Document' : 'Excel Document';
  }

  isActionsOpen(plan: any): boolean {
    return !!plan?.id && this.openActionsPlanId === plan.id;
  }

  toggleActions(plan: any, event: Event): void {
    event.stopPropagation();
    this.openActionsPlanId = this.isActionsOpen(plan) ? null : plan?.id || null;
  }

  closeActions(): void {
    this.openActionsPlanId = null;
  }

  removeProgram(plan: any): void {
    this.closeActions();
    if (!plan?.id) return;
    this.nutritionService.deleteNutritionPlan(plan.id).subscribe({
      next: () => {
        this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
      },
      error: (err) => console.error('Error removing nutrition plan:', err),
    });
  }

  changeDates(plan: any): void {
    this.closeActions();
    this.dateTargetPlan = plan;
    this.dateStart = this.toDateInputValue(plan?.startDate);
    this.dateEnd = this.toDateInputValue(plan?.endDate);
    this.dateError = null;
    this.showChangeDatesModal = true;
  }

  closeChangeDatesModal(): void {
    if (this.dateSaving) return;

    this.showChangeDatesModal = false;
    this.dateTargetPlan = null;
    this.dateStart = '';
    this.dateEnd = '';
    this.dateError = null;
  }

  saveChangedDates(): void {
    if (!this.dateTargetPlan?.id) return;

    if (!this.dateStart || !this.dateEnd) {
      this.dateError = 'Start date and end date are required.';
      return;
    }

    if (this.dateEnd < this.dateStart) {
      this.dateError = 'End date must be after start date.';
      return;
    }

    this.dateSaving = true;
    this.dateError = null;

    this.nutritionService
      .updateNutritionPlanDates(this.dateTargetPlan.id, this.dateStart, this.dateEnd)
      .subscribe({
        next: (updatedPlan) => {
          if (this.dateTargetPlan) {
            this.dateTargetPlan.startDate = updatedPlan?.startDate || this.dateStart;
            this.dateTargetPlan.endDate = updatedPlan?.endDate || this.dateEnd;
          }
          this.dateSaving = false;
          this.closeChangeDatesModal();
          this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
        },
        error: (error) => {
          console.error('Error updating nutrition dates:', error);
          this.dateSaving = false;
          this.dateError = 'Could not update dates.';
        },
      });
  }

  private toDateInputValue(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);

    try {
      return new Date(value).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }

  replaceFile(plan: any): void {
    this.closeActions();
    // Replace file modal can be wired next, same as workout file.
  }

  getPlanTypeLabel(plan: any): string {
    if (this.isFilePlan(plan)) {
      return this.getFileTypeLabel(plan);
    }

    return plan.trackingMode === 'TOTAL_FOR_DAY'
      ? 'TOTAL FOR DAY'
      : plan.trackingMode === 'EACH_MEAL'
        ? 'EACH MEAL'
        : 'FULL MEAL PLAN';
  }

  getCurrentWeekNumber(plan: any): number {
    if (this.isFilePlan(plan)) return 0;

    const currentDay = Number(plan?.currentDay || 0);
    if (currentDay > 0) {
      return Math.max(1, Math.ceil(currentDay / 7));
    }

    if (!plan?.startDate) return 0;
    const start = new Date(plan.startDate);
    if (Number.isNaN(start.getTime())) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    if (today < start) return 1;

    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.ceil(diffDays / 7));
  }

  getPlanTotalWeeks(plan: any): number {
    if (this.isFilePlan(plan)) return 0;

    const totalDays = this.getMealDaySpan(plan);
    return totalDays > 0 ? Math.ceil(totalDays / 7) : 0;
  }

  getDisplayEndDate(plan: any): any {
    if (this.isFilePlan(plan)) {
      return plan?.endDate;
    }

    const start = this.toDateOnlyString(plan?.startDate);
    if (!start) return plan?.endDate;

    const span = this.getMealDaySpan(plan);
    return this.addDaysToDateOnly(start, Math.max(span - 1, 0));
  }

  private getMealDaySpan(plan: any): number {
    const days = plan?.mealDays || [];
    const maxDayNumber = days
      .map((day: any) => Number(day?.dayNumber || 0))
      .filter((dayNumber: number) => dayNumber > 0)
      .reduce((max: number, dayNumber: number) => Math.max(max, dayNumber), 0);

    return maxDayNumber || days.length || 1;
  }

  private addDaysToDateOnly(dateOnly: string, days: number): string {
    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return this.toDateOnlyString(date) || dateOnly;
  }

  formatPlanDate(value: any): string {
    const dateOnly = this.toDateOnlyString(value);
    if (!dateOnly) return '-';

    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  getDays(start: string, end: string): number {
    if (!start || !end) return 0;

    const s = new Date(start);
    const e = new Date(end);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

    const diff = e.getTime() - s.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  getCurrentFileDay(plan: any): number {
    if (!plan.startDate) return 0;

    const start = new Date(plan.startDate);
    const today = new Date();

    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (today < start) return 0;

    const diff = today.getTime() - start.getTime();
    const currentDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

    return plan.totalDays ? Math.min(currentDay, plan.totalDays) : currentDay;
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);

    if (!value) return '';

    if (value < 1024 * 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  previewFile(plan: any) {
    this.closeActions();

    const popup = window.open('', '_blank');

    if (!popup) {
      console.error('Preview popup was blocked by the browser.');
      return;
    }

    const fileName = plan?.originalFileName || plan?.fileName || plan?.name || 'nutrition-file';

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${this.escapeHtml(fileName)}</title>
          <style>
            html, body { margin: 0; height: 100%; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }
            .message { max-width: 680px; margin: 80px auto; padding: 28px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,.08); }
            .message h2 { margin: 0 0 12px; font-size: 22px; }
            .message p { margin: 0; color: #64748b; line-height: 1.6; }
            iframe { width: 100%; height: 100%; border: 0; background: #fff; }
          </style>
        </head>
        <body><div class="message"><h2>Loading preview...</h2><p>Please wait.</p></div></body>
      </html>
    `);
    popup.document.close();

    this.nutritionService.downloadNutritionFile(plan).subscribe({
      next: (blob) => {
        const contentType = this.getNutritionPreviewContentType(plan, blob);
        const fileBlob = blob.type === contentType ? blob : new Blob([blob], { type: contentType });
        const blobUrl = window.URL.createObjectURL(fileBlob);

        if (contentType === 'application/pdf') {
          popup.document.open();
          popup.document.write(`
            <!doctype html>
            <html>
              <head>
                <title>${this.escapeHtml(fileName)}</title>
                <style>html, body { margin: 0; height: 100%; } iframe { width: 100%; height: 100%; border: 0; }</style>
              </head>
              <body>
                <iframe src="${blobUrl}" title="${this.escapeHtml(fileName)}"></iframe>
              </body>
            </html>
          `);
          popup.document.close();
        } else {
          popup.document.open();
          popup.document.write(this.buildNutritionExcelPreviewHtml(blobUrl, fileName));
          popup.document.close();
        }

        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
      },
      error: (error) => {
        console.error('Error previewing nutrition file:', error);
        popup.document.open();
        popup.document.write(`
          <!doctype html>
          <html>
            <head><title>Preview error</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px;">
              <h2>Could not preview this file</h2>
              <p>Please try again later.</p>
            </body>
          </html>
        `);
        popup.document.close();
      },
    });
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

  private renderPdfPreview(popup: Window, plan: any, blob: Blob): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(pdfBlob);
    const title = this.escapeHtml(plan?.name || plan?.originalFileName || 'PDF Preview');

    popup.document.open();
    popup.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            html, body { margin: 0; height: 100%; background: #1f2937; font-family: Arial, sans-serif; }
            .topbar {
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 16px;
              box-sizing: border-box;
              background: #111827;
              color: #fff;
              font-weight: 700;
            }
            .topbar span {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              padding-right: 16px;
            }
            iframe {
              width: 100%;
              height: calc(100% - 48px);
              border: 0;
              background: #fff;
            }
          </style>
        </head>
        <body>
          <div class="topbar"><span>${title}</span></div>
          <iframe src="${blobUrl}"></iframe>
        </body>
      </html>
    `);
    popup.document.close();

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
  }

  private renderExcelPreview(previewWindow: Window, plan: any, blob: Blob): void {
    const title = this.escapeHtml(plan?.name || plan?.originalFileName || 'Excel preview');
    const fileName = this.escapeHtml(plan?.originalFileName || plan?.fileName || '');
    const excelBlob = new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const blobUrl = window.URL.createObjectURL(excelBlob);
    const safeBlobUrl = blobUrl.replace(/'/g, '%27');

    previewWindow.document.open();
    previewWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
          <style>
            html, body { margin: 0; min-height: 100%; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }
            .topbar {
              height: 58px;
              display: flex;
              align-items: center;
              padding: 0 18px;
              background: #111827;
              color: #fff;
              font-weight: 700;
              box-sizing: border-box;
            }
            .meta {
              padding: 12px 18px;
              color: #667085;
              background: #fff;
              border-bottom: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .tabs {
              display: flex;
              gap: 8px;
              padding: 10px 18px;
              background: #fff;
              border-bottom: 1px solid #e5e7eb;
              overflow-x: auto;
            }
            .tab {
              border: 1px solid #dbe7f2;
              background: #fff;
              border-radius: 8px;
              padding: 7px 12px;
              cursor: pointer;
              white-space: nowrap;
            }
            .tab.active {
              background: #eaf8ff;
              color: #0284c7;
              border-color: #7dd3fc;
              font-weight: 700;
            }
            .wrap {
              padding: 18px;
              overflow: auto;
              height: calc(100vh - 113px);
              box-sizing: border-box;
            }
            table {
              border-collapse: collapse;
              background: #fff;
              min-width: max-content;
              box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px 10px;
              font-size: 13px;
              white-space: nowrap;
              max-width: 280px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            th {
              background: #f8fafc;
              color: #475569;
              font-weight: 700;
            }
            .row-index {
              position: sticky;
              left: 0;
              min-width: 44px;
              text-align: center;
              z-index: 2;
            }
            .message {
              padding: 28px;
              color: #475569;
            }
            .error {
              color: #dc2626;
            }
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
    previewWindow.document.close();

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
  }


  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  downloadFile(plan: any) {
    this.closeActions();
    this.nutritionService.downloadNutritionFile(plan).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download =
          plan.originalFileName ||
          plan.fileName ||
          `${plan.name || 'nutrition-plan'}.${this.getFileKind(plan) === 'pdf' ? 'pdf' : 'xlsx'}`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
      error: (error) => console.error('Error downloading nutrition file:', error),
    });
  }

  editPlan(plan: any) {
    this.closeActions();
    if (this.isFilePlan(plan)) {
      this.previewFile(plan);
      return;
    }

    let url = 'clients';

    if (plan.trackingMode === 'TOTAL_FOR_DAY') {
      url =
        url +
        '/create-macro-plan-total-day/' +
        plan.client.id +
        '/edit/' +
        plan.id;
      this.router.navigateByUrl(url);
    } else if (plan.trackingMode === 'EACH_MEAL') {
      url = url + '/create-macro-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(url);
    } else {
      url = url + '/create-full-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(url);
    }
  }


  private loadNutritionFileSetting(): void {
    this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        this.nutritionFileEnabled = config.nutrition?.nutritionFileEnabled !== false;
        if (this.nutritionFileEnabled === false) {
          this.activeTab = 'APP';
        }
        if (this.clientId && this.coachId) {
          this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
        }
      },
      error: () => {
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      },
    });
  }

  openAssignNutrition() {
    this.assignNew.emit();
  }
}
