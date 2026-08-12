import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { WorkoutService } from 'app/service/workout.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule } from '@ngx-translate/core';

type ProgramStatusFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'OVERLAP';
type ProgramSortMode = 'RECOMMENDED' | 'START_ASC' | 'START_DESC' | 'END_ASC' | 'END_DESC';

@Component({
  selector: 'app-workouts-client-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './workouts-client-tab.component.html',
  styleUrl: './workouts-client-tab.component.scss',
})
export class WorkoutsClientTabComponent implements OnInit {
  @Input() clientId!: string;
  @Input() coachId!: string;
  @Output() assignNew = new EventEmitter<void>();
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
  dateTargetProgram: WorkoutPlan | null = null;
  dateStart = '';
  dateEnd = '';
  dateSaving = false;
  dateError: string | null = null;
  workoutFileEnabled = true;

  workoutPage = 0;
  workoutSize = 5;
  workoutTotalPages = 0;
  workoutPagesArray: number[] = [];
  allProgramsFilter: ProgramStatusFilter = 'ALL';
  allProgramsSort: ProgramSortMode = 'RECOMMENDED';

  constructor(public workoutService: WorkoutService, private router: Router, private coachSettingsService: CoachSettingsService) {}

  ngOnInit(): void {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        if (!this.workoutFileEnabled && this.activeTab === 'FILES') {
          this.activeTab = 'ALL';
        }
        if (this.clientId && this.coachId) {
          this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
        }
      },
      error: () => {
        this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
        if (this.clientId && this.coachId) {
          this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
        }
      },
    });
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
    if (!this.workoutFileEnabled) {
      return this.appPrograms;
    }

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

  hasActivePrograms(): boolean {
    return this.currentActivePrograms.length > 0;
  }

  changeWorkoutPage(newPage: number) {
    if (newPage < 0 || newPage >= this.workoutTotalPages) return;
    this.workoutPage = newPage;
    this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
  }

  setActiveTab(tab: 'ALL' | 'APP' | 'FILES') {
    if (!this.workoutFileEnabled && tab === 'FILES') {
      tab = 'APP';
    }

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
    const today = new Date().toISOString().slice(0, 10);
    this.uploadStartDate = today;
    this.uploadEndDate = today;
    this.uploadError = null;
    this.showUploadFileModal = true;
  }

  onUploadFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isExcel = lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') ||
      file.type.includes('spreadsheet') || file.type.includes('excel');

    if (!isPdf && !isExcel) {
      this.uploadError = 'Only PDF, XLS, and XLSX files are allowed.';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.uploadError = 'File is too large. Maximum size is 25 MB.';
      return;
    }

    this.uploadFileKind = isPdf ? 'pdf' : 'excel';
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
      this.uploadError = 'Please choose a file.';
      return;
    }

    if (!this.uploadProgramName.trim()) {
      this.uploadError = 'Please enter a program name.';
      return;
    }

    this.uploadSaving = true;
    this.uploadError = null;

    this.workoutService
      .createAndAssignFileWorkoutOnly(
        this.selectedUploadFile,
        this.uploadProgramName.trim(),
        this.uploadProgramDescription.trim(),
        this.clientId,
        this.uploadStartDate,
        this.uploadEndDate
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
          console.error('Error creating assigned workout file:', error);
          this.uploadSaving = false;
          this.uploadError = 'Could not upload and assign this file.';
        },
      });
  }

  getWorkOutPlanByCoachAndClient(idCoach: string, idClient: string) {
    const backendType = this.workoutFileEnabled ? this.activeTab : 'APP';

    forkJoin({
      active: this.workoutService.getWorkoutByCoachIdAndClient(
        idCoach,
        idClient,
        0,
        100,
        backendType,
        'ACTIVE',
        'ALL',
        'RECOMMENDED'
      ),
      allPrograms: this.workoutService.getWorkoutByCoachIdAndClient(
        idCoach,
        idClient,
        this.workoutPage,
        this.workoutSize,
        backendType,
        'NON_ACTIVE',
        this.allProgramsFilter,
        this.allProgramsSort
      ),
    }).subscribe(({ active, allPrograms }) => {
        const activePrograms = this.normalizeAndDedupeWorkoutPrograms(active.content || [])
          .sort((a: WorkoutPlan, b: WorkoutPlan) => this.compareProgramEndDateAsc(a, b));
        const dedupedPrograms = this.normalizeAndDedupeWorkoutPrograms(allPrograms.content || [])
          .sort((a: WorkoutPlan, b: WorkoutPlan) => this.compareProgramsByBusinessStatus(a, b));

        this.workoutTotalPages = Math.max(1, allPrograms.totalPages || Math.ceil((allPrograms.totalElements || dedupedPrograms.length) / this.workoutSize));
        this.workoutPagesArray = Array.from(
          { length: this.workoutTotalPages },
          (_, i) => i
        );

        this.activeWorkoutPrograms = activePrograms;
        this.allVisibleWorkoutPrograms = dedupedPrograms;
        this.appPrograms = dedupedPrograms.filter((program) => !this.isFileWorkout(program));
        this.uploadedFiles = dedupedPrograms.filter((program) => this.isFileWorkout(program));
        this.workoutPlan = dedupedPrograms;
      });
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
    const mode = String(program?.workoutPlanMode || '').toUpperCase();
    const type = String(program?.resourceType || '').toUpperCase();
    return (
      mode === 'FILE' ||
      !!program?.fileName ||
      !!program?.originalFileName ||
      !!program?.fileUrl ||
      ['PDF', 'XLS', 'XLSX', 'EXCEL'].includes(type)
    );
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
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

  previewFile(program: WorkoutPlan) {
    this.openedActionsId = null;
    const popup = window.open('', '_blank');

    if (!popup) {
      console.error('Preview popup was blocked by the browser.');
      return;
    }

    const fileName = program.originalFileName || program.fileName || program.name || 'workout-file';

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

    this.workoutService.getWorkoutFileBlob(program).subscribe({
      next: (blob) => {
        const contentType = this.getPreviewContentType(program, blob);
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
          popup.document.write(this.buildExcelPreviewHtml(blobUrl, fileName));
          popup.document.close();
        }
      },
      error: (error) => {
        console.error('Error previewing workout file:', error);
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


  private buildExcelPreviewHtml(blobUrl: string, fileName: string): string {
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

  private getPreviewContentType(program: WorkoutPlan, blob: Blob): string {
    const declaredType = String(blob.type || program.fileContentType || program.resourceType || '').toLowerCase();
    const fileName = String(program.originalFileName || program.fileName || program.name || '').toLowerCase();

    if (declaredType.includes('pdf') || fileName.endsWith('.pdf')) {
      return 'application/pdf';
    }

    if (declaredType.includes('sheet') || declaredType.includes('excel') || fileName.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    if (fileName.endsWith('.xls')) {
      return 'application/vnd.ms-excel';
    }

    return blob.type || program.fileContentType || 'application/octet-stream';
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      };
      return entities[char];
    });
  }

  downloadFile(program: WorkoutPlan) {
    this.openedActionsId = null;

    this.workoutService.getWorkoutFileBlob(program).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = program.originalFileName || program.fileName || `${program.name || 'workout-file'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      },
      error: (error) => console.error('Error downloading workout file:', error),
    });
  }

  replaceFile(program: WorkoutPlan) {
    this.openedActionsId = null;
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

    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isExcel =
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel');

    if (!isPdf && !isExcel) {
      this.replaceError = 'Only PDF, XLS, and XLSX files are allowed.';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.replaceError = 'File is too large. Maximum size is 25 MB.';
      return;
    }

    this.replaceSaving = true;
    this.replaceError = null;

    this.workoutService.replaceWorkoutFile(this.replaceTargetProgram.id, file).subscribe({
      next: () => {
        this.replaceSaving = false;
        this.replaceTargetProgram = null;
        this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
      },
      error: (error) => {
        console.error('Error replacing workout file:', error);
        this.replaceSaving = false;
        this.replaceError = 'Could not replace this file.';
      },
    });
  }

  changeDates(program: WorkoutPlan) {
    this.openedActionsId = null;
    this.dateTargetProgram = program;
    this.dateStart = this.toDateInputValue(program.startDate);
    this.dateEnd = this.toDateInputValue(program.endDate);
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

  saveChangedDates() {
    if (!this.dateTargetProgram?.id) return;

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

    this.workoutService.updateWorkoutPlanDates(this.dateTargetProgram.id, this.dateStart, this.dateEnd).subscribe({
      next: () => {
        this.dateSaving = false;
        this.closeChangeDatesModal();
        this.workoutPage = 0;
        this.getWorkOutPlanByCoachAndClient(this.coachId, this.clientId);
      },
      error: (error) => {
        console.error('Error updating workout dates:', error);
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
