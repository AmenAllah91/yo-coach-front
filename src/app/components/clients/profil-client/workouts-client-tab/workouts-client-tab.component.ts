import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { openDayOutlet } from '@shared/program-calendar/day-outlet';
import { Component, DestroyRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin, skip } from 'rxjs';
import { ClientPlanEmptyComponent } from '../client-plan-empty/client-plan-empty.component';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';
import { WorkoutService } from 'app/service/workout.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProgramDaysBadgeComponent } from '@shared/components/program-days-badge/program-days-badge.component';
import { ChangeDatesModalComponent } from '@shared/components/change-dates-modal/change-dates-modal.component';
import { ProgramShiftModalComponent } from '@shared/components/program-shift-modal/program-shift-modal.component';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ToastService } from 'app/service/toast.service';
import { OverviewItem, addDaysIso, canChangeDates, isHasActivityError, isPlanLocked, todayIso } from '@shared/models/program-schedule';
import { PROGRAM_FILE_ACCEPT, programFileKind, programFileOpenErrorKey, programFileProblem, programFileSaveName, programFileUploadErrorKey } from '@shared/models/program-file-check';
import { ProgramFileViewerComponent } from '@shared/components/program-file-viewer/program-file-viewer.component';
import { ClientProgramAction, ClientProgramsComponent } from '@shared/components/client-programs/client-programs.component';
import { RemoveProgramConfirmComponent } from '@shared/components/remove-program-confirm/remove-program-confirm.component';

type ProgramStatusFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP';
type ProgramSortMode = 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC';

import { isFilePlan } from '@shared/models/program-file-check';
@Component({
  selector: 'app-workouts-client-tab',
  standalone: true,
  imports: [WriteActionDirective, CommonModule, FormsModule, TranslateModule, ProgramDaysBadgeComponent, SectionLoaderComponent, ClientPlanEmptyComponent, ChangeDatesModalComponent, ProgramShiftModalComponent, ClientProgramsComponent, RemoveProgramConfirmComponent, ProgramFileViewerComponent],
  templateUrl: './workouts-client-tab.component.html',
  styleUrl: './workouts-client-tab.component.scss',
})
export class WorkoutsClientTabComponent implements OnInit {
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
  /** « Progression par exercice » : lue seulement quand le coach l'ouvre. */

  /** The program the coach asked to remove (P10). */
  removeTarget: OverviewItem | null = null;
  removing = false;
  /** The programs arrived once: later reloads (filters, pages, assignments) keep the list on screen. */
  loaded = false;
  private readonly destroyRef = inject(DestroyRef);
  workoutPlan: WorkoutPlan[] = [];
  activeWorkoutPrograms: WorkoutPlan[] = [];
  activeTab: 'ALL' | 'APP' | 'FILES' = 'ALL';
  appPrograms: WorkoutPlan[] = [];
  uploadedFiles: WorkoutPlan[] = [];
  allVisibleWorkoutPrograms: WorkoutPlan[] = [];
  openedActionsId: string | null = null;
  isAssignMenuOpen = false;
  showUploadFileModal = false;
  selectedUploadFile: File | null = null;
  uploadFileKind: 'pdf' | 'excel' | null = null;
  uploadProgramName = '';
  uploadProgramDescription = '';
  uploadStartDate = '';
  uploadEndDate = '';
  uploadSaving = false;
  uploadError: string | null = null;

  replaceTargetProgram: WorkoutPlan | null = null;
  replaceSaving = false;
  replaceError: string | null = null;

  showChangeDatesModal = false;
  /** « Décaler la suite » of that program (DS-10). */
  shiftTarget: OverviewItem | null = null;
  dateTargetProgram: WorkoutPlan | null = null;
  dateTargetIsFile = false;
  dateStart = '';
  dateEnd = '';
  dateSaving = false;
  dateError: string | null = null;
  workoutFileEnabled = true;
  readonly programFileAccept = PROGRAM_FILE_ACCEPT;
  /** Upload progress of the file being sent (0-100, audit PDF/Excel 2026-11-23, lot 3). */
  uploadPercent = 0;
  /** The file shown in the shared viewer. */
  viewerPlan: WorkoutPlan | null = null;

  workoutPage = 0;
  workoutSize = 5;
  workoutTotalPages = 0;
  workoutPagesArray: number[] = [];
  allProgramsFilter: ProgramStatusFilter = 'ALL';
  allProgramsSort: ProgramSortMode = 'RECOMMENDED';

  constructor(public workoutService: WorkoutService, private router: Router, private coachSettingsService: CoachSettingsService, private translate: TranslateService,
              public programSchedule: ProgramScheduleService, private toast: ToastService) {}


  ngOnInit(): void {
    // The client profile refreshes the coach settings when it opens: the programs load right away with them,
    // and load again only if the file option turns out different.
    this.applyWorkoutFileSetting();
    this.coachSettingsService.configChanges$
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const before = `${this.workoutFileEnabled}|${this.activeTab}`;
        this.applyWorkoutFileSetting();
        if (before !== `${this.workoutFileEnabled}|${this.activeTab}` && this.clientId && this.coachId) {
          this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
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
        this.openUploadFileModal();
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
      case 'edit':
      case 'view':
        if (id) this.openEditor(id, action.dayNumber, action.open);
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
    // The windows below work on the whole program: it is read when the coach asks.
    this.workoutService.getWorkoutById(id, true).subscribe({
      next: plan => {
        if (action.type === 'dates') this.changeDates(plan);
        else if (action.type === 'duplicate') this.duplicateToLibrary(plan);
        else if (action.type === 'open') this.previewFile(plan);
        else if (action.type === 'download') this.downloadFile(plan);
        else if (action.type === 'replace') this.replaceFile(plan);
      },
      error: () => this.toast.show({ type: 'error', title: this.translate.instant('ASSIGN_FLOW.REASON_UNEXPECTED') }),
    });
  }

  /** `open`: the day opens in its window over the calendar, « Fermer » comes back to this tab. */
  private openEditor(id: string, dayNumber?: number | null, open?: boolean): void {
    // A day: its window over this page (the profile stays underneath, read again after a save).
    if (dayNumber && open) {
      openDayOutlet(this.router, 'workout', this.clientId, id, dayNumber);
      return;
    }
    this.router.navigate(['/clients/create-workout', this.clientId, 'edit', id], dayNumber ? { queryParams: { day: dayNumber } } : {});
  }

  confirmRemove(): void {
    const target = this.removeTarget;
    if (!target || this.removing) return;
    this.removing = true;
    this.workoutService.deleteWorkout(target.id, true).subscribe({
      next: () => {
        this.removing = false;
        this.removeTarget = null;
        this.toast.show({ type: 'success', title: this.translate.instant('CLIENT_PROGRAMS.REMOVED') });
        this.programs?.reload();
      },
      error: (error) => {
        this.removing = false;
        // The client already trained in it: the server keeps it (its history), and says so.
        if (isHasActivityError(error)) {
          this.removeTarget = null;
          this.toast.show({ type: 'warning', title: this.translate.instant('CLIENT_PROGRAMS.REMOVE_HAS_ACTIVITY'), duration: 10000 });
          return;
        }
        this.toast.show({ type: 'error', title: this.translate.instant('CLIENT_PROGRAMS.REMOVE_FAILED') });
      },
    });
  }

  private applyWorkoutFileSetting(): void {
    // The option only stops new imports: the files already given to the client stay listed (audit PDF/Excel, G1).
    this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
  }

  isFileWorkoutProgram(program: WorkoutPlan): boolean {
    return this.isFileWorkout(program);
  }

  isNormalWorkoutProgram(program: WorkoutPlan): boolean {
    return !this.isFileWorkout(program);
  }

  getWorkoutFileType(program: WorkoutPlan): 'PDF' | 'EXCEL' {
    return this.getFileKind(program) === 'pdf' ? 'PDF' : 'EXCEL';
  }

  getWorkoutProgramCardType(program: WorkoutPlan): 'APP' | 'PDF' | 'EXCEL' {
    if (!this.isFileWorkout(program)) return 'APP';
    return this.getWorkoutFileType(program) === 'PDF' ? 'PDF' : 'EXCEL';
  }

  getCurrentWeekNumber(program: WorkoutPlan): number {
    if (this.isFileWorkout(program)) return 0;

    const anyProgram = program as any;
    const currentDay = Number(anyProgram?.currentDay || 0);
    if (currentDay > 0) {
      return Math.max(1, Math.ceil(currentDay / 7));
    }

    if (!program?.startDate) return 0;
    const start = new Date(program.startDate);
    if (Number.isNaN(start.getTime())) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    if (today < start) return 1;

    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.ceil(diffDays / 7));
  }

  getProgramTotalWeeks(program: WorkoutPlan): number {
    if (this.isFileWorkout(program)) return 0;

    const totalDays = this.getWorkoutDaySpan(program);
    return totalDays > 0 ? Math.ceil(totalDays / 7) : 0;
  }

  get displayedPrograms(): WorkoutPlan[] {
    if (this.activeTab === 'APP') return this.appPrograms;
    if (this.activeTab === 'FILES') return this.uploadedFiles;

    return this.workoutPlan;
  }

  get currentActivePrograms(): WorkoutPlan[] {
    return this.activeWorkoutPrograms
      .sort((a, b) => this.compareProgramEndDateAsc(a, b));
  }

  get allOtherPrograms(): WorkoutPlan[] {
    return this.displayedPrograms;
  }

  /** No program at all for this client (not only for the chosen filter, type or page). */
  get hasNoProgram(): boolean {
    return !this.hasActivePrograms() && this.allOtherPrograms.length === 0
      // Without the files option the tab always shows the app programs: that is the full list too.
      && this.allProgramsFilter === 'ALL' && this.activeTab === 'ALL' && this.workoutPage === 0;
  }

  hasActivePrograms(): boolean {
    return this.currentActivePrograms.length > 0;
  }

  changeWorkoutPage(newPage: number) {
    if (newPage < 0 || newPage >= this.workoutTotalPages) return;
    this.workoutPage = newPage;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setActiveTab(tab: 'ALL' | 'APP' | 'FILES') {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.openedActionsId = null;
    this.isAssignMenuOpen = false;
    this.workoutPage = 0;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setAllProgramsFilter(filter: ProgramStatusFilter) {
    if (this.allProgramsFilter === filter) {
      return;
    }

    this.allProgramsFilter = filter;
    this.workoutPage = 0;
    this.openedActionsId = null;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setAllProgramsSort(sort: ProgramSortMode) {
    if (this.allProgramsSort === sort) {
      return;
    }

    this.allProgramsSort = sort;
    this.workoutPage = 0;
    this.openedActionsId = null;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  toggleAssignMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isAssignMenuOpen = !this.isAssignMenuOpen;
    this.openedActionsId = null;
  }

  buildInApp() {
    this.isAssignMenuOpen = false;
    this.assignNew.emit();
  }

  openUploadFileModal() {
    if (!this.workoutFileEnabled) {
      return;
    }

    this.isAssignMenuOpen = false;
    this.selectedUploadFile = null;
    this.uploadFileKind = null;
    this.uploadProgramName = '';
    this.uploadProgramDescription = '';
    // Local date (toISOString gave yesterday between midnight and 1 am in Tunis) and 4 weeks, not 1 day.
    const today = todayIso();
    this.uploadStartDate = today;
    this.uploadEndDate = addDaysIso(today, 27);
    this.uploadError = null;
    this.showUploadFileModal = true;
  }

  onUploadFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const problem = programFileProblem(file);
    if (problem) {
      this.uploadError = this.translate.instant(problem);
      input.value = '';
      return;
    }

    this.uploadFileKind = programFileKind(file);
    this.selectedUploadFile = file;
    this.uploadProgramName = file.name.replace(/\.[^/.]+$/, '');
    this.uploadProgramDescription = '';
    this.uploadError = null;
  }

  closeUploadFileModal() {
    if (this.uploadSaving) return;
    this.showUploadFileModal = false;
    this.selectedUploadFile = null;
    this.uploadFileKind = null;
    this.uploadProgramName = '';
    this.uploadProgramDescription = '';
    this.uploadStartDate = '';
    this.uploadEndDate = '';
    this.uploadError = null;
  }

  createAndAssignUploadedFile() {
    if (!this.selectedUploadFile) {
      this.uploadError = this.translate.instant('PROGRAM_FILES.CHOOSE_FILE');
      return;
    }

    if (!this.uploadProgramName.trim()) {
      this.uploadError = this.translate.instant('PROGRAM_FILES.ENTER_NAME');
      return;
    }

    if (!this.uploadStartDate || !this.uploadEndDate || this.uploadEndDate < this.uploadStartDate) {
      this.uploadError = this.translate.instant('PROGRAM_FILES.ERROR_DATES');
      return;
    }

    this.uploadSaving = true;
    this.uploadError = null;
    this.uploadPercent = 0;

    this.workoutService
      .createAndAssignFileWorkoutOnly(
        this.selectedUploadFile,
        this.uploadProgramName.trim(),
        this.uploadProgramDescription.trim(),
        this.clientId,
        this.uploadStartDate,
        this.uploadEndDate,
        percent => (this.uploadPercent = percent)
      )
      .subscribe({
        next: () => {
          this.uploadSaving = false;
          this.closeUploadFileModal();
          this.activeTab = 'FILES';
          this.workoutPage = 0;
          this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
        },
        error: (error) => {
          this.uploadSaving = false;
          this.uploadError = this.translate.instant(programFileUploadErrorKey(error));
        },
      });
  }

  /** After a change made here (file, dates): the tab is read again. */
  getWorkOutPlanByCoachAndClient(_idCoach: string, _idClient: string) {
    this.loaded = true;
    this.programs?.reload();
  }

  private normalizeAndDedupeWorkoutPrograms(programs: WorkoutPlan[]): WorkoutPlan[] {
    const normalizedPrograms = (programs || []).map((program: WorkoutPlan) => {
      const isFile = this.isFileWorkout(program);

      if (isFile) {
        this.normalizeWorkoutProgramDates(program, 1, true);
      } else {
        const totalDays = program.workoutDays?.length || 0;
        this.normalizeWorkoutProgramDates(program, totalDays, false);
        this.applyProgramStatusAndProgress(program, totalDays);
      }

      return program;
    });

    return this.dedupeWorkoutPrograms(normalizedPrograms);
  }


  private dedupeWorkoutPrograms(programs: WorkoutPlan[]): WorkoutPlan[] {
    const map = new Map<string, WorkoutPlan>();

    (programs || []).forEach((program) => {
      const isFile = this.isFileWorkout(program);
      const source = (program as any)?.sourceWorkoutPlanId || String(program?.name || '').trim().toLowerCase();
      const fileKey = isFile
        ? String(program?.fileName || program?.originalFileName || program?.fileUrl || '').trim().toLowerCase()
        : 'APP';
      const start = this.toDateOnlyString(program?.startDate) || '';
      const end = this.toDateOnlyString(this.getDisplayEndDate(program)) || this.toDateOnlyString(program?.endDate) || '';
      const key = `${source}|${fileKey}|${start}|${end}`;

      if (!map.has(key)) {
        map.set(key, program);
      }
    });

    return Array.from(map.values());
  }

  private applyProgramStatusAndProgress(program: WorkoutPlan, totalDays: number): void {
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
  }

  private normalizeWorkoutProgramDates(program: WorkoutPlan, totalDays: number, isFile: boolean): void {
    const start = this.toDateOnlyString(program?.startDate);
    const end = this.toDateOnlyString(program?.endDate);

    if (start) {
      program.startDate = start as any;
    }

    if (!start) {
      if (end) program.endDate = end as any;
      return;
    }

    if (isFile) {
      program.endDate = end && this.compareDateOnly(end, start) >= 0 ? end as any : start as any;
      return;
    }

    const logicalSpan = this.getWorkoutDaySpan(program);
    program.endDate = this.addDaysToDateOnly(start, Math.max(logicalSpan - 1, 0)) as any;
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

  private addDaysToDateOnly(dateOnly: string, days: number): string {
    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return this.toDateOnlyString(date) || dateOnly;
  }

  private compareDateOnly(a: string, b: string): number {
    return a.localeCompare(b);
  }


  getProgramEndTime(program: any): number {
    if (!program?.endDate) return -8640000000000000;
    const time = new Date(program.endDate).getTime();
    return Number.isFinite(time) ? time : -8640000000000000;
  }

  getProgramStartTime(program: any): number {
    if (!program?.startDate) return -8640000000000000;
    const time = new Date(program.startDate).getTime();
    return Number.isFinite(time) ? time : -8640000000000000;
  }

  private toValidTime(value: any): number | null {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }

  isProgramActiveToday(program: WorkoutPlan): boolean {
    const start = this.toDateOnlyString(program?.startDate);
    const end = this.toDateOnlyString(this.getDisplayEndDate(program)) || this.toDateOnlyString(program?.endDate);
    const today = this.getTodayDateOnlyString();

    return !!start && !!end && start <= today && today <= end;
  }

  isProgramOverlap(program: WorkoutPlan): boolean {
    return !!program?.overlap || (this.isProgramActiveToday(program) && this.currentActivePrograms.length > 1);
  }

  private compareProgramsByBusinessStatus(a: WorkoutPlan, b: WorkoutPlan): number {
    const aBucket = this.getBusinessStatusBucket(a);
    const bBucket = this.getBusinessStatusBucket(b);

    if (aBucket !== bBucket) return aBucket - bBucket;

    if (aBucket === 0) return this.compareProgramEndDateAsc(a, b);
    if (aBucket === 1) return this.compareProgramStartDateAsc(a, b);
    return this.compareProgramEndDateDesc(a, b);
  }

  private getBusinessStatusBucket(program: WorkoutPlan): number {
    if (this.isProgramActiveToday(program)) return 0;

    const start = this.toDateOnlyString(program?.startDate);
    const today = this.getTodayDateOnlyString();

    if (start && start > today) return 1;
    return 2;
  }

  private compareProgramEndDateAsc(a: WorkoutPlan, b: WorkoutPlan): number {
    return this.compareDateValuesAsc(this.getDisplayEndDate(a) || a?.endDate, this.getDisplayEndDate(b) || b?.endDate);
  }

  private compareProgramStartDateAsc(a: WorkoutPlan, b: WorkoutPlan): number {
    return this.compareDateValuesAsc(a?.startDate, b?.startDate);
  }

  private compareProgramEndDateDesc(a: WorkoutPlan, b: WorkoutPlan): number {
    return this.compareDateValuesDesc(this.getDisplayEndDate(a) || a?.endDate, this.getDisplayEndDate(b) || b?.endDate);
  }

  private compareDateValuesAsc(a: any, b: any): number {
    const aDate = this.toDateOnlyString(a) || '9999-12-31';
    const bDate = this.toDateOnlyString(b) || '9999-12-31';
    return aDate.localeCompare(bDate);
  }

  private compareDateValuesDesc(a: any, b: any): number {
    const aDate = this.toDateOnlyString(a) || '0000-01-01';
    const bDate = this.toDateOnlyString(b) || '0000-01-01';
    return bDate.localeCompare(aDate);
  }

  private getTodayDateOnlyString(): string {
    return this.toDateOnlyString(new Date()) || '';
  }


  isFileWorkout(program: WorkoutPlan): boolean {
    return isFilePlan(program);
  }

  getFileKind(program: WorkoutPlan): 'pdf' | 'excel' | 'file' {
    const type = String(program?.resourceType || program?.fileContentType || program?.originalFileName || '').toLowerCase();
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('xls') || type.includes('excel') || type.includes('spreadsheet')) return 'excel';
    return 'file';
  }

  getFileLabel(program: WorkoutPlan): string {
    const kind = this.getFileKind(program);
    if (kind === 'pdf') return 'PDF Document';
    if (kind === 'excel') return 'Excel Document';
    return 'Uploaded File';
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }



  getDisplayEndDate(program: WorkoutPlan): any {
    if (this.isFileWorkout(program)) {
      return program.endDate;
    }

    const start = this.toDateOnlyString(program?.startDate);
    if (!start) return program.endDate;

    const span = this.getWorkoutDaySpan(program);
    return this.addDaysToDateOnly(start, Math.max(span - 1, 0));
  }

  private getWorkoutDaySpan(program: WorkoutPlan): number {
    const days = program?.workoutDays || [];
    const maxDayNumber = days
      .map((day: any) => Number(day?.dayNumber || 0))
      .filter((dayNumber) => dayNumber > 0)
      .reduce((max, dayNumber) => Math.max(max, dayNumber), 0);

    return maxDayNumber || days.length || 1;
  }

  formatProgramDate(value: any): string {
    const dateOnly = this.toDateOnlyString(value);
    if (!dateOnly) return '-';

    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    // In the coach's language ("18 oct. 2026" / "18 Oct 2026").
    const locale = (this.translate.currentLang || this.translate.defaultLang || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  toggleActions(program: WorkoutPlan, event: MouseEvent) {
    event.stopPropagation();
    const id = program.id || program.name;
    this.openedActionsId = this.openedActionsId === id ? null : id || null;
  }

  isActionsOpen(program: WorkoutPlan): boolean {
    return this.openedActionsId === (program.id || program.name);
  }

  @HostListener('document:click')
  closeActions() {
    this.openedActionsId = null;
    this.isAssignMenuOpen = false;
  }

  /** « Renommer » a file program (audit PDF/Excel 2026-11-23, lot 3). */
  private renameFile(id: string, current: string): void {
    const name = window.prompt(this.translate.instant('PROGRAM_FILES.RENAME_PROMPT'), current || '')?.trim();
    if (!name || name === current) return;
    this.workoutService.updateWorkoutFileDetails(id, name).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROGRAM_FILES.RENAMED'));
        this.programs?.reload();
      },
      error: (error: unknown) => this.toast.error(this.translate.instant(programFileUploadErrorKey(error))),
    });
  }

  /** The shared viewer (audit PDF/Excel 2026-11-23, lot 2): before, a pop-up with its own copy of a PDF / Excel reader. */
  previewFile(program: WorkoutPlan) {
    this.openedActionsId = null;
    this.viewerPlan = program;
  }

  downloadFile(program: WorkoutPlan) {
    this.openedActionsId = null;

    this.workoutService.getWorkoutFileBlob(program).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = programFileSaveName(program);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      },
      error: (error) => this.toast.error(this.translate.instant(programFileOpenErrorKey(error))),
    });
  }

  replaceFile(program: WorkoutPlan) {
    if (this.isLocked(program) || this.replaceSaving) return;
    this.openedActionsId = null;
    if (!window.confirm(this.translate.instant('PROGRAM_FILES.REPLACE_CONFIRM'))) return;
    this.replaceTargetProgram = program;
    this.replaceError = null;

    const input = document.getElementById('profile-workout-replace-file-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  onReplaceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !this.replaceTargetProgram?.id) return;

    const problem = programFileProblem(file);
    if (problem) {
      this.replaceError = this.translate.instant(problem);
      return;
    }

    this.replaceSaving = true;
    this.replaceError = null;

    this.workoutService.replaceWorkoutFile(this.replaceTargetProgram.id, file).subscribe({
      next: () => {
        this.replaceSaving = false;
        this.replaceTargetProgram = null;
        this.toast.success(this.translate.instant('PROGRAM_FILES.REPLACE_DONE'));
        this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
      },
      error: (error) => {
        this.replaceSaving = false;
        this.replaceError = this.translate.instant(programFileUploadErrorKey(error));
      },
    });
  }

  changeDates(program: WorkoutPlan) {
    this.openedActionsId = null;
    if (!this.canMoveDates(program)) return;
    this.dateTargetProgram = program;
    this.dateTargetIsFile = this.isFileWorkout(program);
    this.dateStart = this.toDateInputValue(program.startDate);
    this.dateEnd = this.toDateInputValue(program.endDate);
    this.dateError = null;
    this.showChangeDatesModal = true;
  }

  /** « Modifier les dates » from the tab: its menu offers it only when the program can move (CD-11). */
  private changeDatesOf(item: OverviewItem): void {
    this.openedActionsId = null;
    this.dateTargetProgram = { id: item.id, name: item.name, startDate: item.startDate, endDate: item.endDate } as any;
    this.dateTargetIsFile = item.file;
    this.dateError = null;
    this.showChangeDatesModal = true;
  }

  closeChangeDatesModal() {
    if (this.dateSaving) return;
    this.showChangeDatesModal = false;
    this.dateTargetProgram = null;
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
  isLocked(program: any): boolean {
    return isPlanLocked(program, todayIso());
  }

  /** Not once the client did a session in it: their history keeps its dates (a file only moves its end). */
  canMoveDates(program: any): boolean {
    return canChangeDates(program, 'WORKOUT', this.isFileWorkout(program), todayIso());
  }

  stoppedLabel(program: any): string {
    return program?.stoppedAt ? this.translate.instant('ASSIGN_FLOW.STOPPED_ON', { date: this.programSchedule.formatDate(program.stoppedAt) }) : '';
  }

  /** A full copy in the library, without the client's progress, ready to edit and assign again. */
  duplicateToLibrary(program: any): void {
    this.openedActionsId = null;
    if (!program?.id) return;
    this.workoutService.duplicateWorkout(program.id).subscribe({
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
    this.dateTargetProgram = null;
    this.workoutPage = 0;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  removeProgram(program: WorkoutPlan) {
    this.openedActionsId = null;
    if (!program.id) return;
    this.workoutService.deleteWorkout(program.id).subscribe(() => {
      this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
    });
  }

  // ton HTML appelle ça
  editWorkout(workout: WorkoutPlan) {
    const url =
      '/clients/create-workout/' + this.clientId + '/edit/' + workout.id;
    this.router.navigateByUrl(url);
  }

  openAssignWorkout() {
    this.assignNew.emit();
  }
}
