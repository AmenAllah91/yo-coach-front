import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { environment } from '@env/environment';
import { NutritionService } from 'app/service/nutrition.service';
import { MealplanDayService } from 'app/service/mealplan-day.service';
import { FoodReplacementGroupItem, FoodReplacementGroupsService } from 'app/service/food-replacement-groups.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { DocumentService } from 'app/service/document.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { CompletionCelebrationComponent } from '../shared/completion-celebration.component';
import { CelebrationView, nutritionCelebration } from '../shared/celebration';
import {
  NutritionTotals, capitalizeFirst, clientVisibleMeals, consumedTotals, dateKey, foodMacros, isMealReported,
  mealMacros, mealReportStatus, planDate, programWeek, targetTotals,
} from '../shared/client-plan-utils';

/** Days during which the client can correct a finished day (ClientDayRules.CLIENT_EDIT_DAYS on the server). */
const CLIENT_EDIT_DAYS = 7;

type MealStatus = 'AS_PLANNED' | 'MODIFIED' | 'SKIPPED';
interface DayItem { plan: any; day: any; date: Date; }
interface FileProgram { plan: any; type: 'PDF' | 'EXCEL'; isCurrent: boolean; }
interface ReplacementOption { item: FoodReplacementGroupItem; name: string; calories: number; protein: number; carbs: number; fat: number; }

/**
 * Client nutrition, same content and logic as the mobile NutritionScreen and NutritionDetailScreen: month list
 * (upcoming / past), nutrition files, the day page (summary ring, meals with recipe, foods and swaps, meal
 * reports and photos, daily feedback, complete day / off-plan).
 */
@Component({
  selector: 'app-client-nutrition',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, CompletionCelebrationComponent],
  templateUrl: './client-nutrition.component.html',
  styleUrl: './client-nutrition.component.scss',
})
export class ClientNutritionComponent implements OnInit, OnDestroy {
  @Input() previewClientId = '';
  @Input() previewMode = false;

  view: 'list' | 'files' | 'file' | 'day' = 'list';
  loading = true;
  error = '';
  upcoming = true;
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  plans: any[] = [];
  filesEnabled = false;
  toast: { message: string; tone: 'success' | 'error' | 'info' } | null = null;

  // Day page
  item: DayItem | null = null;
  expandedMeal: number | null = 0;
  hunger = '';
  energy = '';
  digestion = '';
  overallNote = '';
  savingDay = false;
  showCompleteSheet = false;
  showOffPlanSheet = false;
  uploadingMealId: string | null = null;
  mealPhotoUrls = new Map<string, string>();
  coverUrls = new Map<string, string>();
  foodImages = new Map<string, string>();
  viewedPhoto: string | null = null;

  // Meal report sheet
  reportMeal: any | null = null;
  reportStatus: MealStatus = 'AS_PLANNED';
  reportNote = '';

  // Food swap sheet
  loadingSwapFoodId: string | null = null;
  replacingFoodId: string | null = null;
  swapMeal: any | null = null;
  swapFood: any | null = null;
  swapOptions: ReplacementOption[] = [];
  swapSelected: ReplacementOption | null = null;

  showPdfPreview = false;

  // Files
  openedFile: FileProgram | null = null;
  fileLoading = false;
  fileError = '';
  excelSheets: string[] = [];
  excelSheet = '';
  excelRows: any[][] = [];
  excelHeaders: string[] = [];
  pdfCurrentPage = 1;
  pdfTotalPages = 0;
  pdfZoom = 100;
  @ViewChild('pdfCanvas') pdfCanvas?: ElementRef<HTMLCanvasElement>;
  private pdfDocument: any = null;
  private pdfRenderTask: any = null;
  private workbook: XLSX.WorkBook | null = null;

  private clientId = sessionStorage.getItem('userId') || '';
  private initialDayId = '';
  private initialPlanId = '';
  private openedInitial = false;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Subscription();
  private plansRequest?: Subscription;

  constructor(
    private nutritionService: NutritionService,
    private mealplanDayService: MealplanDayService,
    private replacementGroups: FoodReplacementGroupsService,
    private coachSettings: CoachSettingsService,
    private documents: DocumentService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private theme: ClientThemeService,
  ) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnInit(): void {
    this.theme.ensureLoaded();
    if (this.previewClientId) this.clientId = this.previewClientId;
    if (!this.previewMode) {
      this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
        this.initialDayId = params.get('dayId') || '';
        this.initialPlanId = params.get('planId') || '';
        this.openedInitial = false;
        this.load();
      }));
    } else {
      this.load();
    }
  }

  ngOnDestroy(): void {
    if (this.feedbackTimer) { clearTimeout(this.feedbackTimer); this.sendFeedback(); }
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.subscriptions.unsubscribe();
    this.plansRequest?.unsubscribe();
    this.revokeFile();
    document.body.classList.remove('client-workout-detail-open');
  }

  // -------------------------------------------------------------------------
  // Loading (mobile NutritionProvider.load)
  // -------------------------------------------------------------------------
  load(): void {
    if (!this.clientId) { this.loading = false; this.error = this.somethingWentWrong; return; }
    this.plansRequest?.unsubscribe();
    this.loading = !this.plans.length;
    this.error = '';
    this.plansRequest = this.nutritionService.getNutritionPlanByClientId(this.clientId, true).subscribe({
      next: (response: any) => {
        const plans: any[] = Array.isArray(response) ? response : (response?.content || []);
        this.subscriptions.add(this.hydrate(plans).subscribe(full => {
          this.plans = [...full].sort((a, b) =>
            (planDate(b.createdAt)?.getTime() ?? -Infinity) - (planDate(a.createdAt)?.getTime() ?? -Infinity));
          this.loading = false;
          this.loadCoachSettings();
          this.openInitialTarget();
        }));
      },
      error: err => { this.loading = false; this.error = err?.message || this.somethingWentWrong; },
    });
  }

  /** Coach preview: plans listed without meals are read in detail (the client list is already complete). */
  private hydrate(plans: any[]) {
    const needsDetail = (plan: any) => !!plan?.id && !this.isFileProgram(plan)
      && (!(plan.mealDays || []).length || (plan.mealDays || []).every((day: any) => !day?.meals?.length));
    if (!this.previewClientId || !plans.some(needsDetail)) return of(plans);
    return forkJoin(plans.map(plan => needsDetail(plan)
      ? this.nutritionService.getNutritionPlanById(plan.id, true).pipe(map((detail: any) => ({ ...detail, ...plan, mealDays: detail?.mealDays || plan.mealDays })), catchError(() => of(plan)))
      : of(plan)));
  }

  private loadCoachSettings(): void {
    const coachId = this.plans.map(plan => String(plan?.coach?.id || plan?.coachId || '').trim()).find(Boolean);
    if (!coachId) { this.filesEnabled = false; return; }
    this.subscriptions.add(this.coachSettings.getConfigForCoach(coachId, true).pipe(catchError(() => of(null))).subscribe(config => {
      const nutrition: any = (config as any)?.nutrition;
      this.filesEnabled = !!config && nutrition?.nutritionFileEnabled !== false;
    }));
  }

  private openInitialTarget(): void {
    if (this.openedInitial || this.view === 'day') return;
    if (this.initialPlanId) {
      const plan = this.plans.find(item => item.id === this.initialPlanId);
      if (plan) {
        this.openedInitial = true;
        if (this.isFileProgram(plan)) { this.view = 'files'; return; }
        const first = plan.mealDays?.[0];
        const focus = planDate(plan.startDate) || (first ? this.dayDate(plan, first) : null);
        if (focus) this.month = new Date(focus.getFullYear(), focus.getMonth(), 1);
        const day = this.initialDayId ? (plan.mealDays || []).find((d: any) => d.id === this.initialDayId) : first;
        if (day) this.openDay({ plan, day, date: this.dayDate(plan, day) || this.today });
        return;
      }
    }
    if (this.initialDayId) {
      for (const plan of this.plans) {
        const day = (plan.mealDays || []).find((d: any) => d.id === this.initialDayId);
        if (day) { this.openedInitial = true; this.openDay({ plan, day, date: this.dayDate(plan, day) || this.today }); return; }
      }
    }
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------
  private get today(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  /** Stored date, else plan start + dayNumber - 1 (mobile fallbackDate); null when neither is known. */
  private dayDate(plan: any, day: any): Date | null {
    const own = planDate(day?.date);
    if (own) return own;
    const start = planDate(plan?.startDate);
    if (!start) return null;
    const number = Number(day?.dayNumber) > 0 ? Number(day.dayNumber) : (plan?.mealDays || []).indexOf(day) + 1;
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.max(number, 1) - 1);
  }

  /** A day with nothing to follow (no visible meal, no target, not a cheat day): not listed. */
  private isEmptyDay(day: any): boolean {
    return !day?.cheatMeal && !clientVisibleMeals(day).length && targetTotals(day).calories <= 0;
  }

  /** NutritionDay.status on mobile: the stored one, else IN_PROGRESS from the day itself, PENDING before. */
  dayStatus(item: DayItem): string {
    const stored = String(item.day?.status || '').trim().toUpperCase();
    if (stored) return stored;
    return item.date.getTime() <= this.today.getTime() ? 'IN_PROGRESS' : 'PENDING';
  }

  private get dayItems(): DayItem[] {
    const items: DayItem[] = [];
    for (const plan of this.plans) {
      if (this.isFileProgram(plan)) continue;
      for (const day of plan.mealDays || []) {
        // Undated days used to all land on today: one "today's plan" card per day of the plan.
        const date = this.dayDate(plan, day);
        if (date && !this.isEmptyDay(day)) items.push({ plan, day, date });
      }
    }
    return items;
  }

  /**
   * By date, as the workouts (and the mobile app): « Upcoming » is today and after, today first; « Past » the days
   * before, whatever their status. A day the client has started today stays in « Upcoming ».
   */
  get visibleItems(): DayItem[] {
    const today = this.today.getTime();
    return this.dayItems
      .filter(item => (this.upcoming ? item.date.getTime() >= today : item.date.getTime() < today))
      .filter(item => item.date.getFullYear() === this.month.getFullYear() && item.date.getMonth() === this.month.getMonth())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * The coach fills a plan as it goes (backlog-programmes.md R6): the client gets the filled days, the plan runs
   * until its end date. Shown in "Upcoming" for the months between the last day received and that end date.
   */
  get preparingNext(): boolean {
    if (!this.upcoming) return false;
    const today = this.today.getTime();
    const monthStart = this.month.getTime();
    const monthEnd = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0).getTime();
    return this.plans.some(plan => {
      if (this.isFileProgram(plan)) return false;
      const end = planDate(plan?.endDate);
      if (!end || end.getTime() < today) return false;
      const days = (plan.mealDays || []).map((day: any) => this.dayDate(plan, day)?.getTime()).filter((time: any) => Number.isFinite(time));
      const after = days.length ? Math.max(...days) + 86_400_000 : (planDate(plan?.startDate)?.getTime() ?? today);
      const from = Math.max(after, today);
      return from <= end.getTime() && from <= monthEnd && end.getTime() >= monthStart;
    });
  }

  private get isCurrentMonth(): boolean {
    const now = new Date();
    return this.month.getFullYear() === now.getFullYear() && this.month.getMonth() === now.getMonth();
  }
  get canGoPrevious(): boolean { return this.upcoming ? !this.isCurrentMonth : true; }
  get canGoNext(): boolean { return this.upcoming ? true : !this.isCurrentMonth; }
  get monthLabel(): string {
    const label = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(this.month);
    return label ? label[0].toUpperCase() + label.slice(1) : label;
  }

  setTab(upcoming: boolean): void {
    this.upcoming = upcoming;
    const now = new Date();
    const nowIndex = now.getFullYear() * 12 + now.getMonth();
    const viewIndex = this.month.getFullYear() * 12 + this.month.getMonth();
    if (upcoming ? viewIndex < nowIndex : viewIndex > nowIndex) this.month = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  shiftMonth(delta: number): void {
    if (delta < 0 ? !this.canGoPrevious : !this.canGoNext) return;
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
  }

  isToday(item: DayItem): boolean { return item.date.getTime() === this.today.getTime(); }
  highlighted(item: DayItem): boolean {
    const status = this.dayStatus(item);
    return this.isToday(item) && status !== 'COMPLETED' && status !== 'OFF_PLAN';
  }

  listTitle(item: DayItem): string {
    const name = String(item.day?.name || '').trim() || item.plan?.name;
    return `${capitalizeFirst(name)} · ${this.t('Week', 'Semaine')} ${programWeek(item.plan?.startDate, item.date)}`;
  }

  planLine(item: DayItem): string {
    const tag = capitalizeFirst(item.plan?.description);
    return tag ? `${capitalizeFirst(item.plan?.name)} · ${tag}` : capitalizeFirst(item.plan?.name);
  }

  meals(item: DayItem): any[] { return clientVisibleMeals(item.day); }
  previewMeals(item: DayItem): any[] { return this.meals(item).slice(0, 4); }
  target(item: DayItem): NutritionTotals { return targetTotals(item.day); }
  mealsCount(n: number): string { return this.fr ? `${n} repas` : (n === 1 ? '1 meal' : `${n} meals`); }
  formatNumber(value: number): string { return new Intl.NumberFormat(this.locale).format(Math.round(value)); }

  listStatus(item: DayItem): { label: string; color: string; icon?: string } {
    const status = this.dayStatus(item);
    const today = this.isToday(item);
    // A past day is never « planned » nor « in progress »: never logged, or partly logged.
    if (item.date.getTime() < this.today.getTime() && !['COMPLETED', 'OFF_PLAN'].includes(status)) {
      return this.dayLogged(item.day)
        ? { label: this.t('Partial', 'Partielle'), color: '#D97706' }
        : { label: this.t('Not logged', 'Non renseignée'), color: '#C2410C' };
    }
    switch (status) {
      case 'COMPLETED': return { label: this.t('Completed', 'Terminé'), color: '#1E8E4E' };
      case 'OFF_PLAN': return { label: this.t('Off-plan', 'Hors plan'), color: '#7455D9' };
      case 'IN_PROGRESS': return { label: this.t('In progress', 'En cours'), color: 'var(--yc-primary)' };
      default: return today ? { label: this.t('Today', 'Aujourd’hui'), color: 'var(--yc-primary)' }
        : { label: this.t('Planned', 'Prévu'), color: 'var(--yc-text-secondary)', icon: 'calendar' };
    }
  }

  /** At least one meal of the day was reported by the client. */
  private dayLogged(day: any): boolean {
    return clientVisibleMeals(day).some((meal: any) => !!mealReportStatus(day, meal));
  }

  /** Lead badge of a meal row: [icon, color, filled] or null for the plain number. */
  mealLead(day: any, meal: any): { icon: string; color: string; filled: boolean } | null {
    switch (mealReportStatus(day, meal)) {
      case 'AS_PLANNED': return { icon: 'check', color: '#1E8E4E', filled: true };
      case 'MODIFIED': return { icon: 'edit-2', color: '#D97706', filled: true };
      case 'SKIPPED': return { icon: 'minus', color: 'var(--yc-text-hint)', filled: false };
      default: return null;
    }
  }

  mealCalories(meal: any): number { return mealMacros(meal).calories; }

  /** Optional time set by the coach ("HH:mm"), in the client's language (08:00 / 8:00 AM); '' when none. */
  mealTimeLabel(meal: any): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(meal?.mealTime || '').trim());
    if (!match) return '';
    const time = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
    return new Intl.DateTimeFormat(this.locale, { hour: this.fr ? '2-digit' : 'numeric', minute: '2-digit' }).format(time);
  }
  capitalize(value: string): string { return capitalizeFirst(value); }
  weekdayShort(date: Date): string { return new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(date).toUpperCase().replace('.', ''); }
  dayNumber(date: Date): string { return String(date.getDate()).padStart(2, '0'); }
  monthShort(date: Date): string { return new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(date).toUpperCase().replace('.', ''); }

  // -------------------------------------------------------------------------
  // Files (mobile _filesEntry / _openFilesPage)
  // -------------------------------------------------------------------------
  isFileProgram(plan: any): boolean {
    const mode = String(plan?.nutritionPlanMode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    return mode === 'FILE' || ['PDF', 'EXCEL', 'XLS', 'XLSX'].includes(type) || !!plan?.fileName || !!plan?.fileUrl;
  }

  private fileType(plan: any): 'PDF' | 'EXCEL' {
    const type = String(plan?.resourceType || '').toUpperCase();
    if (['XLS', 'XLSX', 'EXCEL'].includes(type)) return 'EXCEL';
    if (type === 'PDF') return 'PDF';
    const combined = [plan?.originalFileName || plan?.fileName, plan?.fileContentType, plan?.fileUrl].map(v => String(v || '').toLowerCase()).join(' ');
    if (combined.includes('pdf')) return 'PDF';
    return /xlsx|xls|excel|spreadsheet/.test(combined) ? 'EXCEL' : 'PDF';
  }

  private isCurrentFile(plan: any): boolean {
    const end = planDate(plan?.endDate);
    return !end || end.getTime() >= this.today.getTime();
  }

  get filePrograms(): FileProgram[] {
    if (!this.filesEnabled) return [];
    return this.plans.filter(plan => this.isFileProgram(plan))
      .map(plan => ({ plan, type: this.fileType(plan), isCurrent: this.isCurrentFile(plan) }) as FileProgram)
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        const ad = (planDate(a.plan.startDate) || planDate(a.plan.createdAt) || new Date(0)).getTime();
        const bd = (planDate(b.plan.startDate) || planDate(b.plan.createdAt) || new Date(0)).getTime();
        return bd - ad;
      });
  }
  get currentFiles(): FileProgram[] { return this.filePrograms.filter(file => file.isCurrent); }
  get historyFiles(): FileProgram[] { return this.filePrograms.filter(file => !file.isCurrent); }
  get filesSummary(): string {
    const n = this.filePrograms.length; const active = this.currentFiles.length; const s = n > 1 ? 's' : '';
    return this.fr ? `${n} document${s} de votre coach${active > 0 ? ` · ${active} actif${active > 1 ? 's' : ''}` : ''}`
      : `${n} document${s} from your coach${active > 0 ? ` · ${active} active` : ''}`;
  }

  fileDateRange(file: FileProgram): string {
    const start = planDate(file.plan.startDate); const end = planDate(file.plan.endDate);
    const format = (date: Date) => new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    if (!start && !end) return this.t('No dates', 'Aucune date');
    if (start && !end) return this.t(`From ${format(start)}`, `À partir du ${format(start)}`);
    if (!start && end) return this.t(`Until ${format(end)}`, `Jusqu’au ${format(end)}`);
    return `${format(start!)} - ${format(end!)}`;
  }

  fileSize(file: FileProgram): string {
    const bytes = Number(file.plan.fileSizeBytes || 0);
    if (bytes <= 0) return 'File';
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  openFile(file: FileProgram): void { this.openedFile = file; this.view = 'file'; this.loadFile(); }
  closeFile(): void { this.revokeFile(); this.openedFile = null; this.view = 'files'; }

  private revokeFile(): void { this.pdfDocument = null; this.workbook = null; }

  private loadFile(): void {
    const file = this.openedFile;
    if (!file) return;
    this.revokeFile();
    this.fileLoading = true;
    this.fileError = '';
    this.subscriptions.add(this.nutritionService.downloadNutritionFile(file.plan).subscribe({
      next: async (blob: Blob) => {
        try {
          if (file.type === 'EXCEL') {
            this.workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
            this.excelSheets = this.workbook.SheetNames || [];
            this.showExcelSheet(this.excelSheets[0] || '');
          } else {
            const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
            const pdfjs: any = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
            this.pdfDocument = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
            this.pdfTotalPages = this.pdfDocument.numPages || 0;
            this.pdfCurrentPage = 1;
            setTimeout(() => this.renderPdfPage(), 0);
          }
        } catch (error: any) {
          this.fileError = this.t(`Could not open file: ${error?.message || error}`, `Impossible d’ouvrir le fichier : ${error?.message || error}`);
        }
        this.fileLoading = false;
      },
      error: (error: any) => {
        this.fileLoading = false;
        this.fileError = this.t(`Could not open file: ${error?.message || error}`, `Impossible d’ouvrir le fichier : ${error?.message || error}`);
      },
    }));
  }

  showExcelSheet(name: string): void {
    this.excelSheet = name;
    const sheet = this.workbook?.Sheets[name];
    if (!sheet) { this.excelHeaders = []; this.excelRows = []; return; }
    const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as any[][])
      .filter(row => row.some(cell => String(cell || '').trim() !== '')).slice(0, 200);
    const columns = Math.min(26, Math.max(1, ...rows.map(row => row.length)));
    this.excelHeaders = Array.from({ length: columns }, (_, index) => String.fromCharCode(65 + index));
    this.excelRows = rows.map(row => Array.from({ length: columns }, (_, index) => row[index] ?? ''));
  }

  async renderPdfPage(): Promise<void> {
    const canvas = this.pdfCanvas?.nativeElement;
    if (!this.pdfDocument || !canvas) return;
    try { this.pdfRenderTask?.cancel(); } catch { /* finished already */ }
    const context = canvas.getContext('2d');
    if (!context) return;
    const page = await this.pdfDocument.getPage(this.pdfCurrentPage);
    const available = Math.max(280, (canvas.parentElement?.clientWidth || 800) - 16);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (available / base.width) * (this.pdfZoom / 100) });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    this.pdfRenderTask = page.render({ canvasContext: context, viewport });
    try { await this.pdfRenderTask.promise; } catch { /* cancelled by a newer render */ }
    this.pdfRenderTask = null;
  }

  pdfPage(delta: number): void {
    const next = this.pdfCurrentPage + delta;
    if (next < 1 || (this.pdfTotalPages && next > this.pdfTotalPages)) return;
    this.pdfCurrentPage = next;
    this.renderPdfPage();
  }

  pdfZoomBy(delta: number): void { this.pdfZoom = Math.min(200, Math.max(50, this.pdfZoom + delta)); this.renderPdfPage(); }

  downloadFile(file: FileProgram): void {
    this.subscriptions.add(this.nutritionService.downloadNutritionFile(file.plan).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = String(file.plan.originalFileName || file.plan.fileName || `${file.plan.name}.${file.type === 'EXCEL' ? 'xlsx' : 'pdf'}`)
          .replace(/[\\/:*?"<>|]/g, '_');
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.showToast(this.t(`File downloaded: ${link.download}`, `Fichier téléchargé : ${link.download}`), 'success');
      },
      error: (error: any) => this.showToast(this.t(`Could not download file: ${error?.message || error}`, `Impossible de télécharger le fichier : ${error?.message || error}`), 'error'),
    }));
  }

  // -------------------------------------------------------------------------
  // Day page (mobile NutritionDetailScreen)
  // -------------------------------------------------------------------------
  openDay(item: DayItem): void {
    this.item = item;
    const day = item.day;
    this.hunger = day.hunger || '';
    this.energy = day.energy || '';
    this.digestion = day.digestion || '';
    this.overallNote = day.overallNote || '';
    this.expandedMeal = clientVisibleMeals(day).length ? 0 : null;
    this.editing = false;
    this.view = 'day';
    if (!this.previewMode) document.body.classList.add('client-workout-detail-open');
    window.scrollTo({ top: 0 });
    this.loadFoodImages();
    this.loadMealPhotos();
    this.loadCovers();
  }

  backToList(): void {
    if (this.feedbackTimer) { clearTimeout(this.feedbackTimer); this.feedbackTimer = null; this.sendFeedback(); }
    this.item = null;
    this.editing = false;
    this.view = 'list';
    document.body.classList.remove('client-workout-detail-open');
    this.load();
  }

  get day(): any { return this.item?.day; }
  get status(): string { return this.item ? this.dayStatus(this.item) : 'PENDING'; }
  get finished(): boolean { return this.status === 'COMPLETED' || this.status === 'OFF_PLAN'; }
  get visibleMeals(): any[] { return clientVisibleMeals(this.day); }
  get isFullMealPlan(): boolean { return this.visibleMeals.some(meal => (meal.foods || []).length > 0); }
  get isMacroEachMeal(): boolean { return this.visibleMeals.length > 0 && this.visibleMeals.every(meal => !(meal.foods || []).length); }
  get isMacroTotalDay(): boolean { return this.visibleMeals.length === 0; }
  get reported(): number { return this.visibleMeals.filter(meal => isMealReported(this.day, meal)).length; }
  get dayTarget(): NutritionTotals { return targetTotals(this.day); }
  get consumed(): NutritionTotals {
    if (this.isMacroTotalDay) {
      const t = this.day?.dayTargets || {};
      return { calories: Number(t.calories || 0), protein: Number(t.proteinG || 0), carbs: Number(t.carbsG || 0), fat: Number(t.fatG || 0) };
    }
    return consumedTotals(this.day);
  }
  ratio(value: number, goal: number): number { return goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0; }
  /** Stroke offset of the calories ring (r = 47, circumference ≈ 295.3). */
  ringOffset(value: number, goal: number): number { return 295.3 * (1 - this.ratio(value, goal)); }

  get headerTitle(): string {
    if (!this.item) return '';
    const text = new Intl.DateTimeFormat(this.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(this.item.date);
    return text[0].toUpperCase() + text.slice(1);
  }

  get headerSubtitle(): string {
    if (!this.item) return '';
    const name = capitalizeFirst(String(this.day?.name || '').trim() || this.item.plan?.name);
    return `${name} · ${this.t('Week', 'Semaine')} ${programWeek(this.item.plan?.startDate, this.item.date)} · ${this.dayKind}`;
  }

  /** Mobile _subtitleFor: the day description, else its dominant macro. */
  private get dayKind(): string {
    const description = String(this.day?.description || '').trim();
    if (description) return description;
    const t = this.day?.dayTargets || {};
    const p = Number(t.proteinG || 0); const c = Number(t.carbsG || 0); const f = Number(t.fatG || 0);
    if (p >= c && p >= f) return this.t('High Protein', 'Riche en protéines');
    if (c <= p && c <= f) return this.t('Low Carb', 'Faible en glucides');
    if (f >= p && f >= c) return this.t('Higher Fat', 'Plus riche en lipides');
    return this.t('Meal Plan', 'Plan de repas');
  }

  get statusBadge(): { label: string; color: string } {
    switch (this.status) {
      case 'IN_PROGRESS': return { label: this.t('In progress', 'En cours'), color: 'var(--yc-primary)' };
      case 'COMPLETED': return { label: this.t('Completed', 'Terminé'), color: '#1E8E4E' };
      case 'OFF_PLAN': return { label: this.t('Off-plan', 'Hors plan'), color: '#7455D9' };
      default: return { label: this.t('Pending', 'En attente'), color: 'var(--yc-text-secondary)' };
    }
  }

  toggleMeal(index: number): void { this.expandedMeal = this.expandedMeal === index ? null : index; }

  macros(meal: any): NutritionTotals { return mealMacros(meal); }
  mealStatus(meal: any): string { return mealReportStatus(this.day, meal); }
  mealChip(meal: any): { label: string; color: string } {
    const status = this.mealStatus(meal);
    switch (status) {
      case 'AS_PLANNED': return { label: this.t('As planned', 'Comme prévu'), color: '#1E8E4E' };
      case 'MODIFIED': return { label: this.t('Modified', 'Modifié'), color: '#D97706' };
      case 'SKIPPED': return { label: this.t('Skipped', 'Sauté'), color: 'var(--yc-text-secondary)' };
      default: return { label: status, color: 'var(--yc-text-secondary)' };
    }
  }

  mealLog(meal: any): any {
    return (this.day?.clientMealLogs || []).find((log: any) => String(log?.mealId) === String(meal?.id));
  }
  mealNote(meal: any): string { return String(this.mealLog(meal)?.note ?? meal?.note ?? '').trim(); }
  hasPhoto(meal: any): boolean { return !!String(this.mealLog(meal)?.photoPath ?? meal?.photoPath ?? '').trim() || this.mealPhotoUrls.has(meal.id); }

  isRecipe(meal: any): boolean {
    return !!String(meal?.coverImage || '').trim() || Number(meal?.totalTimeMinutes || 0) > 0
      || this.directions(meal).length > 0 || (meal?.tags || []).length > 0;
  }
  directions(meal: any): string[] { return (meal?.directions || []).map((step: any) => String(step ?? '').trim()).filter(Boolean); }
  recipeChips(meal: any): { icon: string; text: string }[] {
    const chips: { icon: string; text: string }[] = [];
    const time = Number(meal?.totalTimeMinutes || 0);
    const servings = Number(meal?.servings || 0);
    if (time > 0) chips.push({ icon: 'clock', text: `${this.number(time)} min` });
    if (servings > 0) chips.push({ icon: 'users', text: this.fr ? `${this.number(servings)} portion${servings > 1 ? 's' : ''}` : `${this.number(servings)} serving${servings > 1 ? 's' : ''}` });
    for (const tag of meal?.tags || []) chips.push({ icon: 'tag', text: String(tag) });
    return chips;
  }

  foodsLabel(meal: any): string {
    const n = (meal?.foods || []).length;
    if (!n) return '';
    return ` · ${this.fr ? `${n} aliment${n > 1 ? 's' : ''}` : `${n} food${n > 1 ? 's' : ''}`}`;
  }

  foodMacros(food: any): NutritionTotals { return foodMacros(food); }
  foodUnit(food: any): string { return String(food?.unit || food?.foodRef?.servingDescription || food?.foodRef?.unit || 'g'); }
  foodImage(food: any): string | null {
    const own = String(food?.imageUrl || food?.foodRef?.imageUrl || '').trim();
    if (own) return own;
    const refId = this.foodRefId(food);
    return refId ? this.foodImages.get(refId) || null : null;
  }
  private foodRefId(food: any): string {
    const ref = food?.foodRef;
    return String(ref?.id || ref?._id || food?.foodRefId || (typeof ref === 'string' ? ref : '') || '').trim();
  }
  foodTint(index: number): string { return ['#E5484D', '#D97706', '#1E9E63', '#0C86C8', '#7455D9'][index % 5]; }
  number(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
  quantity(value: any): string { const n = Number(value); return Number.isFinite(n) ? String(n) : String(value ?? ''); }

  private loadFoodImages(): void {
    const ids = new Set<string>();
    for (const meal of this.day?.meals || []) {
      for (const food of meal.foods || []) {
        if (!String(food?.imageUrl || food?.foodRef?.imageUrl || '').trim() && this.foodRefId(food)) ids.add(this.foodRefId(food));
      }
    }
    ids.forEach(id => this.subscriptions.add(this.nutritionService.getFoodForClient(id, true).pipe(catchError(() => of(null))).subscribe((food: any) => {
      const url = String(food?.imageUrl || '').trim();
      if (url) this.foodImages.set(id, url);
    })));
  }

  private loadMealPhotos(): void {
    const item = this.item;
    if (!item) return;
    for (const meal of item.day.meals || []) {
      if (!String(this.mealLog(meal)?.photoPath ?? meal?.photoPath ?? '').trim()) continue;
      this.subscriptions.add(this.mealplanDayService.getMealPhotoUrl(item.plan.id, item.day.id, meal.id).pipe(catchError(() => of(null))).subscribe(result => {
        if (result?.photoUrl) this.mealPhotoUrls.set(meal.id, this.absolute(result.photoUrl));
      }));
    }
  }

  /** Cover images may be stored as a document path: resolved once. */
  private loadCovers(): void {
    for (const meal of this.day?.meals || []) {
      const cover = String(meal?.coverImage || '').trim();
      if (!cover || this.coverUrls.has(cover)) continue;
      if (cover.startsWith('http') && !cover.includes('X-Amz')) { this.coverUrls.set(cover, cover); continue; }
      this.subscriptions.add(this.documents.refreshStoredFileUrl(cover).pipe(catchError(() => of(cover.startsWith('http') ? cover : ''))).subscribe(url => {
        if (url) this.coverUrls.set(cover, String(url).trim());
      }));
    }
  }
  coverUrl(meal: any): string { return this.coverUrls.get(String(meal?.coverImage || '').trim()) || ''; }

  private absolute(url: string): string { return url.startsWith('http') ? url : `${environment.baseApiUrl}${url}`; }

  uploadMealPhoto(event: Event, meal: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.item) return;
    if (file.size > 8 * 1024 * 1024) { this.showToast(this.t('The photo must not exceed 8 MB.', 'La photo ne doit pas dépasser 8 MB.'), 'error'); return; }
    const item = this.item;
    this.uploadingMealId = meal.id;
    this.subscriptions.add(this.mealplanDayService.uploadMealPhoto(item.plan.id, item.day.id, meal.id, file).subscribe({
      next: result => {
        this.uploadingMealId = null;
        this.mealPhotoUrls.set(meal.id, result?.photoUrl ? this.absolute(result.photoUrl) : URL.createObjectURL(file));
        this.showToast(this.t('Meal photo uploaded.', 'Photo du repas importée.'), 'success');
      },
      error: () => { this.uploadingMealId = null; this.showToast(this.t('Photo upload failed', 'Échec de l’envoi de la photo'), 'error'); },
    }));
  }

  // Meal report (mobile _openMealReportSheet)
  openReport(meal: any): void {
    if (this.previewMode) return;
    this.reportMeal = meal;
    this.reportStatus = (this.mealStatus(meal) as MealStatus) || 'AS_PLANNED';
    if (!['AS_PLANNED', 'MODIFIED', 'SKIPPED'].includes(this.reportStatus)) this.reportStatus = 'AS_PLANNED';
    this.reportNote = this.mealNote(meal);
  }

  get reportTitle(): string {
    const name = String(this.reportMeal?.name || '');
    return this.fr ? `Rapport · ${capitalizeFirst(name)}` : `Report ${name.toLowerCase()}`;
  }

  /** Optimistic: the report shows at once and comes back if the request fails. */
  saveReport(): void {
    const meal = this.reportMeal;
    const item = this.item;
    this.reportMeal = null;
    if (!meal || !item) return;
    const day = item.day;
    const previous = { status: day.status, logs: (day.clientMealLogs || []).map((log: any) => ({ ...log })) };
    const note = this.reportNote.trim();
    const logs: any[] = [...(day.clientMealLogs || [])];
    const index = logs.findIndex(log => String(log?.mealId) === String(meal.id));
    const next = { ...(index >= 0 ? logs[index] : {}), mealId: meal.id, status: this.reportStatus, note };
    if (index >= 0) logs[index] = next; else logs.push(next);
    day.clientMealLogs = logs;
    // A correction of a finished day keeps its status (completed, off-plan): only an open day becomes in progress.
    const status = this.finished ? day.status : 'IN_PROGRESS';
    if (this.status === 'PENDING') day.status = 'IN_PROGRESS';
    this.subscriptions.add(this.mealplanDayService.updatePlanDay({
      id: day.id, status, clientMealLogs: logs, ...this.feedbackPayload(),
    }, item.plan.id).subscribe({
      next: () => { day.status = status; this.showToast(this.t('Meal report saved.', 'Rapport du repas enregistré.'), 'success'); },
      error: () => {
        day.status = previous.status; day.clientMealLogs = previous.logs;
        this.showToast(this.t('The report could not be saved. Please try again.', 'Le rapport n\'a pas pu être enregistré. Réessayez.'), 'error');
      },
    }));
  }

  // Food swap (mobile _openReplaceFoodSheet)
  openSwap(meal: any, food: any): void {
    if (this.previewMode || !this.item || this.loadingSwapFoodId || this.replacingFoodId) return;
    const item = this.item;
    this.loadingSwapFoodId = food.id;
    this.subscriptions.add(this.replacementGroups.getReplacementGroupsForAssignedFood(item.plan.id, item.day.id, meal.id, food.id).subscribe({
      next: groups => {
        this.loadingSwapFoodId = null;
        const originalName = String(food?.name || food?.foodRef?.name || '').trim().toLowerCase();
        const originalRef = this.foodRefId(food);
        const options = (groups || []).flatMap(group => group.foods || []).filter(option =>
          !(originalRef && option.foodRefId === originalRef) && String(option.name || '').trim().toLowerCase() !== originalName);
        if (!options.length) { this.showToast(this.t('No replacement foods found', 'Aucun aliment de remplacement trouvé')); return; }
        this.swapMeal = meal;
        this.swapFood = food;
        this.swapSelected = null;
        this.swapOptions = options.map(option => {
          const serving = Number(option.servingSize) > 0 ? Number(option.servingSize) : 100;
          const factor = Number(option.quantity ?? 100) / serving;
          return {
            item: option, name: option.name ? capitalizeFirst(option.name) : 'Food',
            calories: Math.round(Number(option.energy || 0) * factor), protein: Math.round(Number(option.protein || 0) * factor),
            carbs: Math.round(Number(option.carbohydrates || 0) * factor), fat: Math.round(Number(option.fat || 0) * factor),
          };
        });
      },
      error: () => { this.loadingSwapFoodId = null; this.showToast(this.t('Failed to load replacement foods', 'Impossible de charger les aliments de remplacement'), 'error'); },
    }));
  }

  closeSwap(): void { this.swapMeal = null; this.swapFood = null; this.swapOptions = []; this.swapSelected = null; }

  swapDelta(option: ReplacementOption): number { return option.calories - Math.round(foodMacros(this.swapFood).calories); }

  confirmSwap(): void {
    const option = this.swapSelected; const meal = this.swapMeal; const food = this.swapFood; const item = this.item;
    this.closeSwap();
    if (!option || !meal || !food || !item) return;
    this.replacingFoodId = food.id;
    this.subscriptions.add(this.nutritionService.replaceAssignedMealFood(item.plan.id, item.day.id, meal.id, food.id, {
      replacementFoodRefId: option.item.foodRefId, servingId: option.item.servingId ?? null,
      quantity: option.item.quantity, unit: option.item.unit,
    }).subscribe({
      next: (updatedPlan: any) => {
        this.replacingFoodId = null;
        const updatedDay = (updatedPlan?.mealDays || []).find((d: any) => d.id === item.day.id);
        if (updatedPlan) {
          const index = this.plans.findIndex(plan => plan.id === updatedPlan.id);
          const merged = { ...item.plan, ...updatedPlan };
          if (index >= 0) this.plans[index] = merged;
          this.item = { plan: merged, day: updatedDay || item.day, date: item.date };
        }
        this.loadFoodImages();
        this.showToast(this.t('Food replaced successfully', 'Aliment remplacé avec succès'), 'success');
      },
      error: () => { this.replacingFoodId = null; this.showToast(this.t('Failed to replace food', 'Échec du remplacement de l\'aliment'), 'error'); },
    }));
  }

  // Daily feedback (mobile _buildDailyFeedback)
  get feedbackRows(): { key: 'hunger' | 'energy' | 'digestion'; title: string; options: [string, string][] }[] {
    return [
      { key: 'hunger', title: this.t('Hunger', 'Faim'), options: [['LOW', this.t('Low', 'Faible')], ['GOOD', this.t('Balanced', 'Équilibrée')], ['HIGH', this.t('High', 'Élevée')]] },
      { key: 'energy', title: this.t('Energy', 'Énergie'), options: [['LOW', this.t('Low', 'Basse')], ['GOOD', this.t('Steady', 'Stable')], ['HIGH', this.t('High', 'Haute')]] },
      { key: 'digestion', title: 'Digestion', options: [['POOR', this.t('Poor', 'Mauvaise')], ['GOOD', this.t('Good', 'Bonne')], ['GREAT', this.t('Great', 'Super')]] },
    ];
  }

  feedbackValue(key: 'hunger' | 'energy' | 'digestion'): string { return this[key]; }
  /** The mobile app may have stored the French words: both are read. */
  isFeedback(key: 'hunger' | 'energy' | 'digestion', value: string): boolean {
    return this.normalizeFeedback(this[key]) === value;
  }
  private normalizeFeedback(value: string): string {
    const v = String(value || '').trim().toLowerCase();
    if (['low', 'faible'].includes(v)) return 'LOW';
    if (['good', 'bien', 'balanced', 'steady', 'well_balanced', 'fine'].includes(v)) return 'GOOD';
    if (['high', 'élevé', 'eleve'].includes(v)) return 'HIGH';
    if (['poor', 'mauvaise'].includes(v)) return 'POOR';
    if (['great', 'excellente'].includes(v)) return 'GREAT';
    return v.toUpperCase();
  }
  /** Stored value of an option: the English word the coach pages read ('Low', 'Good', 'High', 'Poor', 'Great'). */
  private storedFeedback(value: string): string {
    const words: Record<string, string> = { LOW: 'Low', GOOD: 'Good', HIGH: 'High', POOR: 'Poor', GREAT: 'Great' };
    return words[value] || value;
  }

  setFeedback(key: 'hunger' | 'energy' | 'digestion', value: string): void {
    const stored = this.storedFeedback(value);
    if (this[key] === stored) return;
    this[key] = stored;
    this.scheduleFeedbackSave();
  }

  scheduleFeedbackSave(): void {
    if (this.previewMode) return;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => { this.feedbackTimer = null; this.sendFeedback(); }, 400);
  }

  private feedbackPayload(): { hunger: string; energy: string; digestion: string; overallNote: string } {
    return { hunger: this.hunger, energy: this.energy, digestion: this.digestion, overallNote: this.overallNote.trim() };
  }

  /** Only the feedback fields: the server keeps the day's status and meal reports as stored. */
  private sendFeedback(): void {
    const item = this.item;
    if (!item) return;
    const payload = this.feedbackPayload();
    const unchanged = (Object.keys(payload) as (keyof typeof payload)[])
      .every(key => (item.day[key] || '') === payload[key]);
    if (unchanged) return;
    Object.assign(item.day, payload);
    this.mealplanDayService.updatePlanDay({ id: item.day.id, ...payload }, item.plan.id).subscribe({ error: () => undefined });
  }

  // Edit a finished day (client corrections, CLIENT_EDIT_DAYS on the server): reports and feedback are saved
  // as they change, the day keeps its status.
  editing = false;

  get editDeadline(): Date | null {
    return this.item ? new Date(this.item.date.getFullYear(), this.item.date.getMonth(), this.item.date.getDate() + CLIENT_EDIT_DAYS) : null;
  }
  get canModify(): boolean {
    const deadline = this.editDeadline;
    return !this.previewMode && this.finished && !!deadline && this.today.getTime() <= deadline.getTime();
  }
  get editDeadlineLabel(): string {
    const deadline = this.editDeadline;
    return deadline ? new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'long' }).format(deadline) : '';
  }
  /** Meal report and photo: an open day, or a finished day being edited. */
  get canReport(): boolean { return !this.previewMode && !this.isFutureDay && (!this.finished || (this.editing && this.canModify)); }

  finishEditing(): void {
    if (this.feedbackTimer) { clearTimeout(this.feedbackTimer); this.feedbackTimer = null; this.sendFeedback(); }
    this.editing = false;
  }

  /** Day not reached yet: no report, feedback or completion in advance (the server refuses them). */
  get isFutureDay(): boolean { return !!this.item && this.item.date.getTime() > this.today.getTime(); }

  get unreportedMeals(): any[] { return this.visibleMeals.filter(meal => !isMealReported(this.day, meal)); }
  get unreportedText(): string {
    const n = this.unreportedMeals.length;
    return this.fr
      ? `${n} repas non signalé${n > 1 ? 's seront enregistrés' : ' sera enregistré'} « comme prévu ».`
      : `${n} meal${n > 1 ? 's' : ''} not reported will be saved “as planned”.`;
  }

  /** Complete day = the plan was followed: unreported meals are confirmed first, then logged AS_PLANNED. */
  askCompleteDay(): void {
    if (this.unreportedMeals.length) { this.showCompleteSheet = true; return; }
    this.saveDayStatus('COMPLETED');
  }

  // Complete day / off-plan (mobile _saveDayStatus)
  saveDayStatus(status: 'COMPLETED' | 'OFF_PLAN'): void {
    const item = this.item;
    if (!item || this.savingDay) return;
    if (this.feedbackTimer) { clearTimeout(this.feedbackTimer); this.feedbackTimer = null; }
    this.savingDay = true;
    const day = item.day;
    const logs = status === 'OFF_PLAN'
      ? this.visibleMeals.map(meal => ({ ...(this.mealLog(meal) || {}), mealId: meal.id, status: 'SKIPPED', note: '' }))
      : [...(day.clientMealLogs || []).filter((log: any) => !this.unreportedMeals.some(meal => String(meal.id) === String(log?.mealId))),
        ...this.unreportedMeals.map(meal => ({ ...(this.mealLog(meal) || {}), mealId: meal.id, status: 'AS_PLANNED', note: this.mealLog(meal)?.note || '' }))];
    this.subscriptions.add(this.mealplanDayService.updatePlanDay({
      id: day.id, status, clientMealLogs: logs, ...this.feedbackPayload(),
    }, item.plan.id).subscribe({
      next: () => {
        this.savingDay = false;
        Object.assign(day, { status, clientMealLogs: logs, ...this.feedbackPayload() });
        // Celebrated once the server has the completed day; never an off-plan day nor a refused one.
        const celebration = status === 'COMPLETED' ? this.celebrationView(item) : null;
        if (!celebration) this.showToast(this.t('Nutrition day marked off-plan.', 'Journée nutrition marquée hors plan.'), 'success');
        this.backToList();
        this.celebration = celebration;
      },
      error: () => { this.savingDay = false; this.showToast(this.t('Failed to update nutrition day.', 'Échec de la mise à jour de la journée nutrition.'), 'error'); },
    }));
  }

  // « Day complete! » (mobile NutritionCelebrationScreen): the day as just saved, the meals not reported « as planned »
  celebration: CelebrationView | null = null;

  private celebrationView(item: DayItem): CelebrationView {
    const day = item.day;
    const meals = clientVisibleMeals(day);
    // A day with only a total (no meal): completed means the total was eaten, as its summary shows.
    const eaten = meals.length ? consumedTotals(day) : targetTotals(day);
    const target = targetTotals(day);
    return nutritionCelebration({
      title: capitalizeFirst(String(day?.name || '').trim() || item.plan?.name),
      date: item.date,
      meals: meals.map(meal => mealReportStatus(day, meal) || 'AS_PLANNED'),
      calories: eaten.calories,
      protein: eaten.protein,
      targetCalories: target.calories,
      targetProtein: target.protein,
      seed: String(day?.id || `${item.plan?.id}-${day?.dayNumber}`),
    }, this.fr);
  }

  closeCelebration(): void { this.celebration = null; }

  // PDF of the plan (web print preview, mobile "Export PDF")
  get pdfDays(): { date: Date; day: any }[] {
    if (!this.item) return [];
    const plan = this.item.plan;
    return (plan.mealDays || []).map((day: any) => ({ date: this.dayDate(plan, day) || this.today, day }))
      .sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime());
  }
  pdfMeals(day: any): any[] { return clientVisibleMeals(day); }
  pdfTarget(day: any): NutritionTotals { return targetTotals(day); }
  formatLongDate(date: Date | null): string {
    return date ? new Intl.DateTimeFormat(this.locale, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '—';
  }

  downloadPdf(): void {
    const preview = document.querySelector('.cn-pdf-document');
    if (!preview) return;
    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) return;
    const title = String(this.item?.plan?.name || 'nutrition-plan').replace(/[<>&"']/g, '');
    win.document.write(`<!doctype html><html><head><title>${title}</title><style>${PDF_PRINT_STYLES}</style></head><body>${preview.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  // -------------------------------------------------------------------------
  private get somethingWentWrong(): string { return this.t('Something went wrong', 'Une erreur est survenue'); }

  showToast(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
    this.toast = { message, tone };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 3500);
  }

  trackByDay = (_: number, item: DayItem) => `${item.plan?.id}-${item.day?.id}-${dateKey(item.date)}`;
  trackByMeal = (index: number, meal: any) => meal?.id || index;
}

const PDF_PRINT_STYLES = `
  @page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{margin:0;color:#0f1b2d;font-family:Arial,Helvetica,sans-serif}
  .cn-pdf-brand{color:#1e9e63;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
  h1{margin:20px 0 8px;font-size:26px}p{color:#546175;line-height:1.5}
  .cn-pdf-day{margin-top:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid}
  .cn-pdf-day h2{margin:0;padding:9px 12px;background:#1e9e63;color:#fff;font-size:12px}
  .cn-pdf-totals{padding:8px 12px;font-size:11px;color:#546175;border-bottom:1px solid #eef1f4}
  .cn-pdf-meal{padding:8px 12px 2px;font-size:12px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:5px 12px;border-top:1px solid #eef1f4;text-align:left}th{color:#7d889b;font-size:9px;text-transform:uppercase}
`;
