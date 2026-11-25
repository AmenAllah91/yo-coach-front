import { ProgramDaysBadgeComponent } from '@shared/components/program-days-badge/program-days-badge.component';
import { openDayOutlet } from '@shared/program-calendar/day-outlet';
import { dayWindowPlan } from '@shared/program-calendar/day-window-prefetch';
import { nutritionPlanKind } from '@shared/models/nutrition-plan-kind';
import { ChangeDatesModalComponent } from '@shared/components/change-dates-modal/change-dates-modal.component';
import { ProgramShiftModalComponent } from '@shared/components/program-shift-modal/program-shift-modal.component';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ToastService } from 'app/service/toast.service';
import { isFilePlan, programFileOpenErrorKey, programFileProblem, programFileSaveName, programFileUploadErrorKey, PROGRAM_FILE_ACCEPT } from 'app/shared/models/program-file-check';
import { ProgramFileViewerComponent } from '@shared/components/program-file-viewer/program-file-viewer.component';
import { OverviewItem, canChangeDates, isPlanLocked, todayIso } from '@shared/models/program-schedule';
import { ClientProgramAction, ClientProgramsComponent } from '@shared/components/client-programs/client-programs.component';
import { RemoveProgramConfirmComponent } from '@shared/components/remove-program-confirm/remove-program-confirm.component';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, skip } from 'rxjs';
import { ClientPlanEmptyComponent } from '../client-plan-empty/client-plan-empty.component';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { NutritionService } from 'app/service/nutrition.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type NutritionStatusFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP';
type NutritionSortMode = 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC';

@Component({
  selector: 'app-nutrition-client-tab',
  standalone: true,
  imports: [WriteActionDirective, ProgramDaysBadgeComponent, CommonModule, FormsModule, TranslateModule, SectionLoaderComponent, ClientPlanEmptyComponent, ChangeDatesModalComponent, ProgramShiftModalComponent, ClientProgramsComponent, RemoveProgramConfirmComponent, ProgramFileViewerComponent],
  templateUrl: './nutrition-client-tab.component.html',
  styleUrl: './nutrition-client-tab.component.scss',
})
export class NutritionClientTabComponent implements OnInit {
  nutritionFileEnabled = true;
  readonly programFileAccept = PROGRAM_FILE_ACCEPT;
  replaceTargetPlan: any = null;
  /** The file shown in the shared viewer. */
  viewerPlan: any = null;
  replaceSaving = false;

  @Input() clientId!: string;
  @Input() coachId!: string;
  @Input() clientName = '';
  /** « Assigner un programme », with the start to propose (a gap's first day) when there is one. */
  @Output() assignNew = new EventEmitter<string | null>();
  /** « Voir le suivi » / a past day: the client's calendar. */
  @Output() openCalendar = new EventEmitter<string | null>();
  /** « Envoyer un message » from a day shown in the tab: the profile opens its chat. */
  /** « Envoyer un message », with a text ready in the chat when there is one (a missed workout). */
  @Output() message = new EventEmitter<string | null>();
  /** « Voir comme mon client » on a file: the profile opens the client's view on its « Fichiers » tab. */
  @Output() previewAsClient = new EventEmitter<void>();
  /** « Importer un fichier » (the nutrition tab has no window of its own: the profile opens it). */
  @Output() importFile = new EventEmitter<void>();
  @ViewChild(ClientProgramsComponent) programs?: ClientProgramsComponent;
  /** The program the coach asked to remove (P10). */
  removeTarget: OverviewItem | null = null;
  removing = false;
  /** The plans arrived once: later reloads (filters, pages, assignments) keep the list on screen. */
  loaded = false;
  private readonly destroyRef = inject(DestroyRef);

  mealPlan: any[] = [];
  activeMealPlans: any[] = [];
  appPlans: any[] = [];
  filePlans: any[] = [];
  activeTab: 'ALL' | 'APP' | 'FILES' = 'ALL';
  openActionsPlanId: string | null = null;
  showChangeDatesModal = false;
  /** « Décaler la suite » of that program (DS-10). */
  shiftTarget: OverviewItem | null = null;
  dateTargetPlan: any | null = null;
  dateTargetIsFile = false;
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
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    public programSchedule: ProgramScheduleService,
    private toast: ToastService
  ) {}


  ngOnInit(): void {
    // The client profile refreshes the coach settings when it opens: the plans load once right away with them,
    // and load again only if the file option turns out different.
    this.applyNutritionFileSetting();
    this.coachSettingsService.configChanges$
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const before = `${this.nutritionFileEnabled}|${this.activeTab}`;
        this.applyNutritionFileSetting();
        if (before !== `${this.nutritionFileEnabled}|${this.activeTab}` && this.clientId && this.coachId) {
          this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
        }
      });
  }

  /* ---------------- the tab (P1-P10) ---------------- */

  onProgramAction(action: ClientProgramAction): void {
    const id = action.programId || action.item?.id;
    switch (action.type) {
      case 'message':
        this.message.emit(action.draft || null);
        return;
      case 'import':
        this.importFile.emit();
        return;
      case 'preview':
        this.previewAsClient.emit();
        return;
      case 'rename':
        if (action.item) this.renameFile(action.item.id, action.item.name);
        return;
      case 'assign':
        this.assignNew.emit(action.date || null);
        return;
      case 'calendar':
        this.openCalendar.emit(action.date || null);
        return;
      case 'remove':
        this.removeTarget = action.item || null;
        return;
      case 'shift':
        // « Décaler la suite » (DS-10): the window reads what it proposes itself.
        this.shiftTarget = action.item || null;
        return;
      case 'dates':
        // The tab already has its dates: the window opens at once, the server checks the rest (CD-11).
        if (action.item) {
          this.changeDatesOf(action.item);
          return;
        }
        break;
    }
    if (!id) return;
    // The windows and the editor work on the whole plan: it is read when the coach asks (a day's window: the plan the
    // week card already read, so that it opens at once).
    const read = () => this.nutritionService.getNutritionPlanById(id, true);
    (action.open ? dayWindowPlan(id, read) : read()).subscribe({
      next: plan => {
        if (action.type === 'edit' || action.type === 'view') this.editPlan(plan, action.dayNumber, action.open);
        else if (action.type === 'dates') this.changeDates(plan);
        else if (action.type === 'duplicate') this.duplicateToLibrary(plan);
        else if (action.type === 'open') this.previewFile(plan);
        else if (action.type === 'download') this.downloadFile(plan);
        else if (action.type === 'replace') this.replaceFile(plan);
      },
      error: () => this.toast.show({ type: 'error', title: this.translate.instant('ASSIGN_FLOW.REASON_UNEXPECTED') }),
    });
  }

  confirmRemove(): void {
    const target = this.removeTarget;
    if (!target || this.removing) return;
    this.removing = true;
    this.nutritionService.deleteNutritionPlan(target.id, true).subscribe({
      next: () => {
        this.removing = false;
        this.removeTarget = null;
        this.toast.show({ type: 'success', title: this.translate.instant('CLIENT_PROGRAMS.REMOVED') });
        this.programs?.reload();
      },
      error: () => {
        this.removing = false;
        this.toast.show({ type: 'error', title: this.translate.instant('CLIENT_PROGRAMS.REMOVE_FAILED') });
      },
    });
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

  /** No plan at all for this client (not only for the chosen filter, type or page). */
  get hasNoPlan(): boolean {
    return !this.hasActivePlans() && this.allOtherPlans.length === 0
      && this.allPlansFilter === 'ALL' && this.activeTab === 'ALL' && this.page === 0;
  }

  hasActivePlans(): boolean {
    return this.currentActivePlans.length > 0;
  }

  setActiveTab(tab: 'ALL' | 'APP' | 'FILES') {
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

  /** After a change made here (file, dates): the tab is read again. */
  getMealPlanByCoachAndClient(_idCoach: string, _idClient: string) {
    this.loaded = true;
    this.programs?.reload();
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
    return isFilePlan(plan);
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
    if (!this.canMoveDates(plan)) return;
    this.dateTargetPlan = plan;
    this.dateTargetIsFile = this.isFilePlan(plan);
    this.dateStart = this.toDateInputValue(plan?.startDate);
    this.dateEnd = this.toDateInputValue(plan?.endDate);
    this.dateError = null;
    this.showChangeDatesModal = true;
  }

  /** « Modifier les dates » from the tab: its menu offers it only when the plan can move (CD-11). */
  private changeDatesOf(item: OverviewItem): void {
    this.closeActions();
    this.dateTargetPlan = { id: item.id, name: item.name, startDate: item.startDate, endDate: item.endDate };
    this.dateTargetIsFile = item.file;
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

  private toDateInputValue(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);

    try {
      return new Date(value).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }


  /** A stopped or finished client program: open it or duplicate it, no more changes (backlog-programmes.md A9). */
  isLocked(plan: any): boolean {
    return isPlanLocked(plan, todayIso());
  }

  /** Not once the client logged a day in it: their history keeps its dates (a file only moves its end). */
  canMoveDates(plan: any): boolean {
    return canChangeDates(plan, 'NUTRITION', this.isFilePlan(plan), todayIso());
  }

  stoppedLabel(plan: any): string {
    return plan?.stoppedAt ? this.translate.instant('ASSIGN_FLOW.STOPPED_ON', { date: this.programSchedule.formatDate(plan.stoppedAt) }) : '';
  }

  /** A full copy in the library, without the client's progress, ready to edit and assign again. */
  duplicateToLibrary(plan: any): void {
    this.closeActions();
    if (!plan?.id) return;
    this.nutritionService.duplicate(plan.id).subscribe({
      next: () => this.toast.success(this.translate.instant('ASSIGN_FLOW.DUPLICATED')),
      error: () => this.toast.error(this.translate.instant('ASSIGN_FLOW.DUPLICATE_FAILED')),
    });
  }

  /** « Décaler la suite » saved: the tab is read again (the message already said what changed). */
  onShiftSaved(): void {
    this.shiftTarget = null;
  }

  onDatesSaved(): void {
    this.showChangeDatesModal = false;
    this.dateTargetPlan = null;
    this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
  }

  /** « Remplacer le fichier » (audit PDF/Excel 2026-11-23, G4): confirm, choose the new file, send it. */
  replaceFile(plan: any): void {
    if (this.isLocked(plan) || !plan?.id || this.replaceSaving) return;
    this.closeActions();
    if (!window.confirm(this.translate.instant('PROGRAM_FILES.REPLACE_CONFIRM'))) return;
    this.replaceTargetPlan = plan;
    const input = document.getElementById('profile-nutrition-replace-file-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  onReplaceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const plan = this.replaceTargetPlan;
    if (!file || !plan?.id) return;
    const problem = programFileProblem(file);
    if (problem) {
      this.toast.error(this.translate.instant(problem));
      return;
    }
    this.replaceSaving = true;
    this.toast.show({ type: 'info', title: this.translate.instant('PROGRAM_FILES.REPLACING') });
    this.nutritionService.replaceNutritionFile(plan.id, file).subscribe({
      next: () => {
        this.replaceSaving = false;
        this.replaceTargetPlan = null;
        this.toast.success(this.translate.instant('PROGRAM_FILES.REPLACE_DONE'));
        this.getMealPlanByCoachAndClient(this.coachId, this.clientId);
      },
      error: (error) => {
        this.replaceSaving = false;
        this.toast.error(this.translate.instant(programFileUploadErrorKey(error)));
      },
    });
  }

  getPlanTypeLabel(plan: any): string {
    if (this.isFilePlan(plan)) {
      return this.getFileTypeLabel(plan);
    }

    const kind = nutritionPlanKind(plan);
    return kind === 'DAY_MACROS'
      ? 'TOTAL FOR DAY'
      : kind === 'MEAL_MACROS'
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
    // In the coach's language ("18 oct. 2026" / "18 Oct 2026").
    const locale = (this.translate.currentLang || this.translate.defaultLang || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
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

  /** « Renommer » a file program (audit PDF/Excel 2026-11-23, lot 3). */
  private renameFile(id: string, current: string): void {
    const name = window.prompt(this.translate.instant('PROGRAM_FILES.RENAME_PROMPT'), current || '')?.trim();
    if (!name || name === current) return;
    this.nutritionService.updateNutritionFileDetails(id, name).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROGRAM_FILES.RENAMED'));
        this.programs?.reload();
      },
      error: (error: unknown) => this.toast.error(this.translate.instant(programFileUploadErrorKey(error))),
    });
  }

  /** The shared viewer (audit PDF/Excel 2026-11-23, lot 2): before, a pop-up with its own copy of a PDF / Excel reader. */
  previewFile(plan: any) {
    this.closeActions();
    this.viewerPlan = plan;
  }

  downloadFile(plan: any) {
    this.closeActions();
    this.nutritionService.downloadNutritionFile(plan).subscribe({
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

  /** `open`: the day opens in its window over the editor's calendar, « Fermer » comes back to this tab. */
  editPlan(plan: any, dayNumber?: number | null, open?: boolean) {
    this.closeActions();
    if (this.isFilePlan(plan)) {
      this.previewFile(plan);
      return;
    }
    // A day: its window over this page (the profile stays underneath, read again after a save).
    if (dayNumber && open && plan?.client?.id && plan?.id) {
      const outletKind = nutritionPlanKind(plan) === 'DAY_MACROS' ? 'macro-day' : nutritionPlanKind(plan) === 'MEAL_MACROS' ? 'macro-plan' : 'full-plan';
      openDayOutlet(this.router, outletKind, plan.client.id, plan.id, dayNumber);
      return;
    }
    const extras = dayNumber ? { queryParams: { day: dayNumber } } : {};

    let url = 'clients';

    const kind = nutritionPlanKind(plan);
    if (kind === 'DAY_MACROS') {
      url =
        url +
        '/create-macro-plan-total-day/' +
        plan.client.id +
        '/edit/' +
        plan.id;
      this.router.navigateByUrl(this.router.createUrlTree([url], extras));
    } else if (kind === 'MEAL_MACROS') {
      url = url + '/create-macro-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(this.router.createUrlTree([url], extras));
    } else {
      url = url + '/create-full-plan/' + plan.client.id + '/edit/' + plan.id;
      this.router.navigateByUrl(this.router.createUrlTree([url], extras));
    }
  }


  private applyNutritionFileSetting(): void {
    // The option only stops new imports: the files already given to the client stay listed (audit PDF/Excel, G1).
    this.nutritionFileEnabled = this.coachSettingsService.shouldUseNutritionFiles();
  }

  openAssignNutrition() {
    this.assignNew.emit();
  }
}
