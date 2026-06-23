import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-nutrition-client-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nutrition-client-tab.component.html',
  styleUrl: './nutrition-client-tab.component.scss',
})
export class NutritionClientTabComponent implements OnInit {
  nutritionFileEnabled = true;

  @Input() clientId!: string;
  @Input() coachId!: string;
  @Output() assignNew = new EventEmitter<void>();

  mealPlan: any[] = [];
  appPlans: any[] = [];
  filePlans: any[] = [];
  activeTab: 'ALL' | 'APP' | 'FILES' = 'ALL';
  openActionsPlanId: string | null = null;

  page = 0;
  size = 5;
  totalPages = 0;
  pagesArray: number[] = [];

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

  setActiveTab(tab: 'ALL' | 'APP' | 'FILES') {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.page = 0;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  changePage(newPage: number) {
    if (newPage < 0 || newPage >= this.totalPages) return;
    this.page = newPage;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  getMealPlanByCoachAndClient(idCoach: string, idClient: string) {
    this.nutritionService
      .getNutritionPlanByCoachIdAndClient(
        idCoach,
        idClient,
        this.page,
        this.size,
        this.activeTab
      )
      .subscribe((res) => {
        this.totalPages = res.totalPages || 0;
        this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);

        const plans = (res.content || []).map((program: any) => {
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

        this.mealPlan = plans;
        this.appPlans = this.activeTab === 'APP'
          ? plans
          : plans.filter((plan) => !this.isFilePlan(plan));
        this.filePlans = this.activeTab === 'FILES'
          ? plans
          : plans.filter((plan) => this.isFilePlan(plan));
      });
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
    // Nutrition file removal will be wired to delete/unassign when backend endpoint is available.
  }

  changeDates(plan: any): void {
    this.closeActions();
    // Date change modal can be wired next, same as workout file.
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

    if (!popup) return;

    popup.document.open();
    popup.document.write(`
      <html>
        <head>
          <title>${this.escapeHtml(plan?.name || 'Nutrition file')}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
            .topbar { padding: 14px 18px; background: #111827; color: #fff; font-weight: 700; }
            .loading { padding: 24px; color: #475467; }
          </style>
        </head>
        <body>
          <div class="topbar">Loading nutrition file preview...</div>
          <div class="loading">Please wait.</div>
        </body>
      </html>
    `);
    popup.document.close();

    this.nutritionService.downloadNutritionFile(plan).subscribe({
      next: (blob) => {
        if (this.getFileKind(plan) === 'pdf') {
          this.renderPdfPreview(popup, plan, blob);
          return;
        }

        this.renderExcelPreview(popup, plan, blob);
      },
      error: () => {
        popup.document.open();
        popup.document.write(`
          <html>
            <body style="font-family:Arial;padding:24px;color:#dc2626">
              Could not open nutrition file preview.
            </body>
          </html>
        `);
        popup.document.close();
      },
    });
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

  private renderExcelPreview(popup: Window, plan: any, blob: Blob): void {
    blob.arrayBuffer()
      .then((buffer) => import('xlsx').then((XLSX) => ({ XLSX, buffer })))
      .then(({ XLSX, buffer }) => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: '',
        }) as any[][];

        const maxRows = rows.slice(0, 120);
        const tableRows = maxRows
          .map((row, rowIndex) => `
            <tr>
              <th class="row-index">${rowIndex + 1}</th>
              ${row.map((cell) => `<td>${this.escapeHtml(String(cell ?? ''))}</td>`).join('')}
            </tr>
          `)
          .join('');

        const title = this.escapeHtml(plan?.name || plan?.originalFileName || 'Excel Preview');
        const fileName = this.escapeHtml(plan?.originalFileName || plan?.fileName || '');

        popup.document.open();
        popup.document.write(`
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { margin: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #111827; }
                .topbar {
                  padding: 14px 18px;
                  background: #111827;
                  color: #fff;
                  font-weight: 700;
                }
                .meta {
                  padding: 12px 18px;
                  background: #fff;
                  border-bottom: 1px solid #e5e7eb;
                  color: #667085;
                  font-size: 13px;
                }
                .wrap {
                  padding: 18px;
                  overflow: auto;
                  height: calc(100vh - 92px);
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
                  max-width: 260px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                th.row-index {
                  position: sticky;
                  left: 0;
                  background: #f1f5f9;
                  color: #475569;
                  z-index: 2;
                  min-width: 44px;
                  text-align: center;
                }
              </style>
            </head>
            <body>
              <div class="topbar">${title}</div>
              <div class="meta">${fileName} · ${rows.length} rows previewed</div>
              <div class="wrap">
                <table>
                  <tbody>${tableRows || '<tr><td>No data found in this Excel file.</td></tr>'}</tbody>
                </table>
              </div>
            </body>
          </html>
        `);
        popup.document.close();
      })
      .catch(() => {
        popup.document.open();
        popup.document.write(`
          <html>
            <body style="font-family:Arial;padding:24px;color:#dc2626">
              Could not render Excel preview. Use Download to open the file.
            </body>
          </html>
        `);
        popup.document.close();
      });
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

  openAssignNutrition() {
    this.assignNew.emit();
  }

  private loadNutritionFileSetting(): void {
    this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();

    this.coachSettingsService.loadConfig().subscribe({
      next: (config) => {
        this.nutritionFileEnabled = config.nutrition?.nutritionFileEnabled !== false;
        this.applyFilters?.();
      },
      error: () => {
        this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
      },
    });
  }
}


