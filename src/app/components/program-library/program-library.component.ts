import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';
import { EmptyStateComponent } from 'app/shared/components/empty-state/empty-state.component';
import { Component, OnInit, ViewChild } from '@angular/core';
import { firstValueFrom, Observable, of, switchMap } from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { WorkoutService, PageResponse } from '../../service/workout.service';
import {
  ExerciseService,
  PageResponse as ExercisePageResponse,
} from '../../service/exercise.service';
import { AuthService } from '../../config/auth.service';
import { ScrollLoaderComponent } from '../scroll-loader/scroll-loader.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalAssignToclientComponent } from '../clients/modal-assign-toclient/modal-assign-toclient.component';
import { ClientService, Client } from 'app/service/client.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { EnumResponse, Exercise } from '@shared/models/exercice.models';
import * as XLSX from 'xlsx';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProgramDaysBadgeComponent } from '@shared/components/program-days-badge/program-days-badge.component';
import { DeleteModalComponent } from './delete-modal/delete-modal.component';
import { ToastService } from 'app/service/toast.service';
import { WorkoutAiDialogComponent } from './workout-ai-dialog/workout-ai-dialog.component';
import { AiQuotaComponent } from 'app/components/ai-quota/ai-quota.component';
import { MAX_PROGRAM_WEEKS, WorkoutAiDraft, workoutDraftWeeks } from 'app/service/workout-ai.service';

import { programFileOpenErrorKey, programFileProblem, programFileSaveName, programFileUploadErrorKey } from '@shared/models/program-file-check';
import { ProgramFileViewerComponent } from '@shared/components/program-file-viewer/program-file-viewer.component';
import { isFilePlan } from '@shared/models/program-file-check';
@Component({
  selector: 'app-program-library',
  standalone: true,
  imports: [WriteActionDirective, EmptyStateComponent, ProgramFileViewerComponent,
    CommonModule,
    FormsModule,
    FeatherModule,
    ScrollLoaderComponent,
    ModalAssignToclientComponent,
    TranslateModule,
    ProgramDaysBadgeComponent,
    DeleteModalComponent,
    WorkoutAiDialogComponent,
    AiQuotaComponent,
  ],
  templateUrl: './program-library.component.html',
  styleUrls: [
    './program-library.component.scss',
    './superset-styles.scss',
    './exercise-modal-styles.scss',
  ],
})
export class ProgramLibraryComponent implements OnInit {
  programs: WorkoutPlan[] = [];
  allPrograms: WorkoutPlan[] = [];
  searchTerm = '';
  /** « Programmes » (APP) | « Fichiers » (FILES): the PDF / Excel never mixed with the programs (lot 3). ALL: templates. */
  programTypeFilter: 'ALL' | 'APP' | 'FILES' | 'PDF' | 'EXCEL' = 'APP';
  currentPage = 0;
  pageSize = 12;
  totalPages = 0;
  totalElements = 0;
  myLibraryCount = 0;
  templatesCount = 0;
  isLoading = false;
  openDropdownId: string | null = null;
  activeTab = 'my-library';
  showCreateModal = false;
  showDeleteModal = false;
  programToDelete: WorkoutPlan | null = null;

  programName = '';
  programDescription = '';
  showProgramDescription = false;
  startDate = '';
  endDate = '';
  isWorkoutPlanTemplate = false;
  typeWorkoutPlan = 'STRENGTH_TRAINING';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trainingDays: any[] = [
    { name: 'Day 1', description: '', showDescription: false, exercises: [] },
  ];
  selectedDayIndex = 0;
  showExerciseModal = false;
  exerciseSearchTerm = '';
  selectedMuscle = '';
  selectedEquipment = '';
  selectedType = '';
  exercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  enums: EnumResponse | null = null;
  exerciseCurrentPage = 0;
  exercisePageSize = 20;
  exerciseTotalPages = 0;
  isLoadingExercises = false;
  exerciseActiveTab = 'templates';
  exerciseTemplatesCount = 0;
  exerciseMyExercisesCount = 0;

  showAssignModal = false;
  programToAssign: WorkoutPlan | null = null;

  showCreateTypeModal = false;
  showWorkoutCreateModal = false;
  createWorkoutName = '';
  createWorkoutDurationWeeks = 4;
  readonly workoutDurationOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  showImportFileModal = false;
  importFile: File | null = null;
  importProgramName = '';
  importProgramDescription = '';
  importSaving = false;
  importError = '';
  /** Upload progress of the file being sent (0-100, audit PDF/Excel 2026-11-23, lot 3). */
  uploadPercent = 0;
  assignImportedProgram = false;
  notifyImportedClients = true;
  importAssignStartDate = '';
  importAssignEndDate = '';
  importClients: Client[] = [];
  selectedImportClientIds: string[] = [];
  importClientsLoading = false;
  previewProgram: WorkoutPlan | null = null;
  selectedLibraryFileProgram: WorkoutPlan | null = null;
  workoutFileEnabled = true;

  constructor(
    public workoutService: WorkoutService,
    private clientService: ClientService,
    private exerciseService: ExerciseService,
    private authService: AuthService,
    private router: Router,
    private coachSettingsService: CoachSettingsService,
    private translate: TranslateService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  /** Admin (or super admin): creates, changes and removes the public templates. */
  isAdmin = false;

  /** « Modèles publics » page (route data), else the coach's own programs. */
  get publicTemplates(): boolean {
    return this.activeTab === 'templates';
  }

  /** A coach only copies a public template: changing or assigning it is for the admin. */
  get readOnlyTemplates(): boolean {
    return this.publicTemplates && !this.isAdmin;
  }

  /** Program being duplicated / deleted (one at a time; the list updates without being reloaded). */
  duplicatingId: string | null = null;
  deleting = false;

  goBack(): void {
    window.history.back();
  }

  ngOnInit() {
    // Wait a bit for Keycloak to initialize

    console.log('Program Library - Checking authentication status');
    if (!this.authService.isLoggedIn()) {
      console.log('Program Library - Not logged in, redirecting to login');
      this.authService.login();
      return;
    }
    console.log('Program Library - User is logged in, loading data');
    if (this.route.snapshot.data['tab'] === 'templates') {
      this.activeTab = 'templates';
      this.programTypeFilter = 'ALL';
    }
    void this.authService.extractRoles().then((roles) => {
      this.isAdmin = (roles || []).some((role) => role === 'ROLE_ADMIN' || role === 'ROLE_SUPER_ADMIN');
    });
    // Everything loads at once: the programs are filtered on screen, so the file option (from the cached
    // settings, refreshed silently) only filters them again when it turns out different.
    this.applyWorkoutFileSetting();
    this.loadPrograms();
    this.loadEnums();
    this.loadAllCounts();
    this.coachSettingsService.loadConfig(true).subscribe({
      next: () => {
        const before = this.workoutFileEnabled;
        this.applyWorkoutFileSetting();
        if (before !== this.workoutFileEnabled) this.applyProgramFilters();
      },
      error: () => undefined,
    });
  }

  private applyWorkoutFileSetting(): void {
    this.workoutFileEnabled = this.coachSettingsService.shouldUseWorkoutFiles();
    if (!this.workoutFileEnabled && this.activeTab !== 'templates') this.programTypeFilter = 'APP';
  }

  /** Always called with loadPrograms, whose answer already gives the count of the open tab: only the other one is asked. */
  loadAllCounts() {
    if (this.activeTab === 'templates') {
      this.workoutService.getMyLibrary(0, 1, true).subscribe({
        next: (response: PageResponse<WorkoutPlan>) => {
          this.myLibraryCount = response.totalElements || 0;
        },
        error: (error) => console.error('Error loading my library count:', error),
      });
      return;
    }

    this.workoutService.getTemplates(0, 1, true).subscribe({
      next: (response: PageResponse<WorkoutPlan>) => {
        this.templatesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading templates count:', error),
    });
  }

  loadPrograms() {
    this.isLoading = true;

    // Filters PDF / Excel / App cannot be applied safely after backend pagination,
    // because page 1 can be empty while page 2 contains matches.
    // So we load a large library page once, then paginate the filtered result locally.
    const serviceCall =
      this.activeTab === 'templates'
        ? this.workoutService.getTemplates(0, 500, true) // the page shows its own loading state
        : this.workoutService.getMyLibrary(0, 500, true);

    serviceCall.subscribe({
      next: (response: PageResponse<WorkoutPlan>) => {
        this.allPrograms = this.sortNewestFirst(
          (response.content || []).filter((program) => this.isLibraryOnlyProgram(program))
        );
        this.applyProgramFilters();

        if (this.activeTab === 'templates') {
          this.templatesCount = this.allPrograms.length;
        } else {
          this.myLibraryCount = this.allPrograms.length;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading programs:', error);
        this.allPrograms = [];
        this.programs = [];
        this.totalPages = 0;
        this.totalElements = 0;
        this.isLoading = false;
      },
    });
  }

  applyProgramFilters() {
    const term = (this.searchTerm || '').trim().toLowerCase();

    const filtered = (this.allPrograms || []).filter((program) => {
      if (!this.isLibraryOnlyProgram(program)) {
        return false;
      }

      if (!this.workoutFileEnabled && this.isFileProgram(program)) {
        return false;
      }

      const type = this.getProgramTypeKey(program);
      const matchesType = this.programTypeFilter === 'ALL'
        || (this.programTypeFilter === 'FILES' ? type === 'PDF' || type === 'EXCEL' : type === this.programTypeFilter);
      const searchable = [program.name, program.details, program.originalFileName, this.getProgramTypeLabel(program)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      return matchesType && matchesSearch;
    });

    this.totalElements = filtered.length;
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));

    if (this.currentPage > this.totalPages - 1) {
      this.currentPage = 0;
    }

    const start = this.currentPage * this.pageSize;
    this.programs = filtered.slice(start, start + this.pageSize);
    this.ensureSelectedLibraryFileProgram();
  }

  private sortNewestFirst(programs: WorkoutPlan[]): WorkoutPlan[] {
    return [...programs].sort((a, b) => {
      const bTime = this.toDateTime(this.getSortDate(b));
      const aTime = this.toDateTime(this.getSortDate(a));

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return String((b as any).id || '').localeCompare(String((a as any).id || ''));
    });
  }

  private getSortDate(program: WorkoutPlan): string | Date | undefined {
    const anyProgram = program as any;

    return (
      anyProgram.updatedAt ||
      anyProgram.createdAt ||
      anyProgram.fileUploadedAt ||
      anyProgram.uploadedAt
    );
  }

  private toDateTime(value: string | Date | undefined): number {
    if (!value) return 0;

    const time = value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isNaN(time) ? 0 : time;
  }

  private isLibraryOnlyProgram(program: WorkoutPlan): boolean {
    const anyProgram = program as any;

    return !(
      anyProgram.startDate ||
      anyProgram.endDate ||
      anyProgram.client ||
      anyProgram.clientId ||
      anyProgram.clientIds?.length
    );
  }

  toggleDropdown(programId: string | null, event?: Event) {
    if (this.openDropdownId === programId) {
      this.openDropdownId = null;
      return;
    }

    this.openDropdownId = programId;

    if (event && programId) {
      const button = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
      const dropdown = button
        .closest('.dropdown')
        ?.querySelector('.dropdown-menu') as HTMLElement;

      if (dropdown) {
        const buttonRect = button.getBoundingClientRect();
        const dropdownHeight = 280; // Side action list height
        const viewportHeight = window.innerHeight;

        // Position dropdown
        if (buttonRect.bottom + dropdownHeight > viewportHeight) {
          // Show above if not enough space below
          dropdown.style.top = `${buttonRect.top - dropdownHeight}px`;
        } else {
          // Show below
          dropdown.style.top = `${buttonRect.bottom + 4}px`;
        }

        dropdown.style.left = `${Math.max(16, buttonRect.right - 220)}px`; // side action menu
      }
    }
  }

  assignToClients(program: WorkoutPlan) {
    console.log('Assign to clients:', program);
    this.programToAssign = program;
    this.showAssignModal = true;
    this.openDropdownId = null;
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.programToAssign = null;
  }

  getProgramDurationDays(program?: WorkoutPlan | null): number {
    if (!program) return 1;

    if (this.isFileProgram(program) && program.startDate && program.endDate) {
      return this.daysBetweenInclusive(program.startDate, program.endDate);
    }

    return Math.max((program.workoutDays || []).length, 1);
  }

  /** The assignment window did the work and shows the message with « Annuler » (backlog-programmes.md A7). */
  onAssignmentDone() {
    this.closeAssignModal();
    this.loadPrograms();
    this.loadEnums();
    this.loadAllCounts();
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


  editProgram(id: string) {
    // The list already holds the whole program: the editor shows it at once instead of loading it again.
    const workoutPlan = this.allPrograms.find((program) => program.id === id);
    this.router.navigateByUrl('workout/edit-workout/' + id, { state: workoutPlan ? { workoutPlan } : {} });
  }

  duplicateProgram(program: WorkoutPlan) {
    if (!program.id || this.duplicatingId) return;
    this.openDropdownId = null;
    this.duplicatingId = program.id;
    this.workoutService.duplicateWorkout(program.id, true).subscribe({
      next: (copy) => {
        this.duplicatingId = null;
        // The copy goes to "My library": shown at once on top, without reloading the whole library.
        if (this.activeTab !== 'templates' && copy?.id && this.isLibraryOnlyProgram(copy)) {
          this.allPrograms = this.sortNewestFirst([copy, ...this.allPrograms]);
          this.currentPage = 0;
          this.applyProgramFilters();
        }
        this.myLibraryCount += 1;
        if (this.publicTemplates && copy?.id) {
          // Copied from the public templates: the copy is in « Programmes », opened in one click to adapt it.
          const copyId = copy.id;
          this.toast.show({
            type: 'success',
            duration: 8000,
            title: this.translate.instant('TEMPLATE_COPIED'),
            message: this.translate.instant('TEMPLATE_COPIED_HINT'),
            actions: [{
              label: this.translate.instant('TEMPLATE_OPEN_COPY'),
              run: () => void this.router.navigateByUrl('workout/edit-workout/' + copyId, { state: { workoutPlan: copy } }),
            }],
          });
          return;
        }
        this.toast.success(this.translate.instant('PROGRAM_DUPLICATED'));
      },
      error: (error) => {
        this.duplicatingId = null;
        console.error('Error duplicating program:', error);
      },
    });
  }

  deleteProgram(program: WorkoutPlan) {
    this.programToDelete = program;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  confirmDelete() {
    const program = this.programToDelete;
    if (!program?.id || this.deleting) return;
    this.deleting = true;
    // Removed from the screen at once, without waiting for the server (nor reloading the library); put back if the
    // server refuses.
    const countKey = this.activeTab === 'templates' ? 'templatesCount' : 'myLibraryCount';
    this.allPrograms = this.allPrograms.filter((item) => item.id !== program.id);
    this.applyProgramFilters();
    this[countKey] = Math.max(0, this[countKey] - 1);
    this.closeDeleteModal();
    this.workoutService.deleteWorkout(program.id, true).subscribe({
      next: () => {
        this.deleting = false;
        this.toast.success(this.translate.instant('PROGRAM_DELETED'));
      },
      error: (error) => {
        this.deleting = false;
        console.error('Error deleting program:', error);
        if (!this.allPrograms.some((item) => item.id === program.id)) {
          this.allPrograms = this.sortNewestFirst([...this.allPrograms, program]);
          this.applyProgramFilters();
          this[countKey] += 1;
        }
      },
    });
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.programToDelete = null;
  }

  /**
   * « Créer un programme »: the choice Builder / IA / PDF-Excel (audit PDF/Excel 2026-11-24). Before, the button went
   * straight to the builder's window and the import of a PDF / Excel (and the AI card) could no longer be reached.
   * A YoCoach template is a program made in the app: straight to the builder.
   */
  createProgram() {
    if (this.publicTemplates || this.activeTab === 'templates') {
      this.openWorkoutCreateModal();
      return;
    }
    this.showCreateTypeModal = true;
  }

  /** IA-33: the AI program (questions in a dialog, then the editor opens with the draft, nothing saved). */
  @ViewChild(WorkoutAiDialogComponent) workoutAi?: WorkoutAiDialogComponent;

  get aiLanguage(): 'fr' | 'en' | 'ar' {
    const lang = (this.translate.currentLang || 'fr').slice(0, 2);
    return lang === 'en' || lang === 'ar' ? lang : 'fr';
  }

  openWorkoutAi(): void {
    this.showCreateTypeModal = false;
    this.workoutAi?.open();
  }

  openWorkoutAiDraft(draft: WorkoutAiDraft): void {
    void this.router.navigate(['/workout/create-workout'], {
      queryParams: { durationWeeks: workoutDraftWeeks(draft), ...(this.activeTab === 'templates' ? { template: '1' } : {}) },
      state: { aiDraft: draft },
    });
  }

  closeCreateTypeModal() {
    this.showCreateTypeModal = false;
  }

  createNormalWorkout() {
    this.showCreateTypeModal = false;
    this.openWorkoutCreateModal();
  }

  openWorkoutCreateModal() {
    this.createWorkoutName = '';
    this.createWorkoutDurationWeeks = 4;
    this.showWorkoutCreateModal = true;
  }

  closeWorkoutCreateModal() {
    this.showWorkoutCreateModal = false;
  }

  submitWorkoutCreateModal() {
    const name = this.createWorkoutName.trim();
    if (!name) return;

    const durationWeeks = Math.max(1, Math.min(Number(this.createWorkoutDurationWeeks) || 4, MAX_PROGRAM_WEEKS));

    this.showWorkoutCreateModal = false;
    // The editor opens at once and creates the program itself, in the background (autoCreate): no full-screen wait
    // for the server before the page shows.
    void this.router.navigate(['/workout/create-workout'], {
      queryParams: { name, durationWeeks, ...(this.activeTab === 'templates' ? { template: '1' } : {}) },
      state: { autoCreate: true },
    });
  }

  openImportFileWorkout() {
    if (!this.workoutFileEnabled) {
      this.showCreateTypeModal = false;
      return;
    }

    this.showCreateTypeModal = false;
    this.showImportFileModal = true;
    this.importError = '';
    this.loadImportClients();
  }

  closeImportFileWorkout() {
    this.showImportFileModal = false;
    this.importFile = null;
    this.importProgramName = '';
    this.importProgramDescription = '';
    this.importSaving = false;
    this.importError = '';
    this.assignImportedProgram = false;
    this.notifyImportedClients = true;
    this.importAssignStartDate = '';
    this.importAssignEndDate = '';
    this.selectedImportClientIds = [];
  }

  onImportDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onImportDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || null;
    if (file) this.setImportFile(file);
  }

  onImportFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement)?.files?.[0] || null;
    if (file) this.setImportFile(file);
  }

  setImportFile(file: File) {
    const problem = programFileProblem(file);
    if (problem) {
      this.importError = this.translate.instant(problem);
      this.importFile = null;
      return;
    }
    this.importError = '';
    this.importFile = file;
    if (!this.importProgramName.trim()) {
      const base = file.name.replace(/\.[^.]+$/, '');
      this.importProgramName = base;
    }
  }


  async loadImportClients() {
    if (this.importClientsLoading) {
      return;
    }

    this.importClientsLoading = true;
    this.importClients = [];

    try {
      const coachId = await this.authService.extractUserId();

      if (!coachId) {
        this.importClientsLoading = false;
        return;
      }

      const request$ = this.clientService.getActiveClientsForAssignment(coachId);

      request$.subscribe({
        next: (clients) => {
          this.importClients = clients;
          this.selectedImportClientIds = this.selectedImportClientIds.filter(id =>
            this.importClients.some(client => client.id === id)
          );
          this.importClientsLoading = false;
        },
        error: (error: any) => {
          console.error('Error loading clients for import assignment:', error);
          this.importClientsLoading = false;
        },
      });
    } catch (error) {
      console.error('Error resolving coach id for import clients:', error);
      this.importClientsLoading = false;
    }
  }

  onImportClientSelection(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedImportClientIds = Array.from(select.selectedOptions).map((option) => option.value);
  }

  getSelectedImportClients(): Client[] {
    return this.importClients.filter(
      (client) => !!client.id && this.selectedImportClientIds.includes(client.id)
    );
  }

  saveImportedFileWorkout() {
    if (!this.importFile || !this.importProgramName.trim()) {
      this.importError = this.translate.instant('SELECT_FILE_AND_PROGRAM_NAME');
      return;
    }

    this.uploadPercent = 0;
    this.importSaving = true;
    this.workoutService
      .createFileWorkout(
        this.importFile,
        this.importProgramName.trim(),
        this.importProgramDescription?.trim() || '',
        this.activeTab === 'templates',
        percent => (this.uploadPercent = percent)
      )
      .subscribe({
        next: (createdProgram: WorkoutPlan) => {
          const clientsToAssign = this.assignImportedProgram ? this.getSelectedImportClients() : [];

          if (!clientsToAssign.length) {
            this.importSaving = false;
            this.closeImportFileWorkout();
            this.loadPrograms();
            this.loadAllCounts();
            return;
          }

          let remaining = clientsToAssign.length;

          clientsToAssign.forEach((client) => {
            const item = {
              ...createdProgram,
              client,
              startDate: this.importAssignStartDate || createdProgram.startDate,
              endDate: this.importAssignEndDate || createdProgram.endDate || this.importAssignStartDate || createdProgram.startDate,
              workoutDays: [],
            };

            this.workoutService.assignWorkout(item.id!, item).subscribe({
              next: () => {
                remaining -= 1;
                if (remaining === 0) {
                  this.importSaving = false;
                  this.closeImportFileWorkout();
                  this.loadPrograms();
                  this.loadAllCounts();
                }
              },
              error: (error) => {
                console.error('Error assigning imported file workout:', error);
                remaining -= 1;
                if (remaining === 0) {
                  this.importSaving = false;
                  this.closeImportFileWorkout();
                  this.loadPrograms();
                  this.loadAllCounts();
                }
              },
            });
          });
        },
        error: (error) => {
          this.importSaving = false;
          this.importError = this.translate.instant(programFileUploadErrorKey(error));
        },
      });
  }

  isFileProgram(program: WorkoutPlan | null | undefined): boolean {
    return isFilePlan(program);
  }

  getProgramResourceLabel(program: WorkoutPlan): string {
    if (!this.isFileProgram(program)) return '';
    const type = String(program.resourceType || '').toUpperCase();
    if (type === 'XLS' || type === 'XLSX') return 'EXCEL';
    return type || 'FILE';
  }

  getProgramMeta(program: WorkoutPlan): string {
    if (this.isFileProgram(program)) {
      const parts = [];
      if (program.originalFileName) parts.push(program.originalFileName);
      if (program.fileSizeBytes) parts.push(this.formatFileSize(program.fileSizeBytes));
      return parts.join(' · ');
    }
    const dayCount = program.workoutDays?.length || 0;
    const parts = [dayCount + ' day' + (dayCount === 1 ? '' : 's')];
    if (program.typeWorkoutPlan) parts.push(String(program.typeWorkoutPlan).replace(/_/g, ' ').toLowerCase());
    return parts.join(' · ');
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** The shared viewer (audit PDF/Excel 2026-11-23, lot 2): before, a pop-up with its own PDF / Excel reader. */
  previewFileProgram(program: WorkoutPlan) {
    this.openDropdownId = null;
    this.previewProgram = program;
  }

  closeFilePreviewModal() {
    this.previewProgram = null;
  }

  openProgramFile(program: WorkoutPlan) {
    this.previewFileProgram(program);
  }

  private async fetchProgramFileBlob(program: WorkoutPlan): Promise<Blob> {
    return await firstValueFrom(this.workoutService.getWorkoutFileBlob(program));
  }

  // ---- « Renommer » / « Remplacer » a library file (audit PDF/Excel 2026-11-23, lot 3)
  libraryReplaceSaving = false;
  libraryReplacePercent = 0;
  private libraryReplaceTarget: WorkoutPlan | null = null;

  renameLibraryFile(plan: WorkoutPlan): void {
    this.openDropdownId = null;
    const current = plan?.name || '';
    const name = window.prompt(this.translate.instant('PROGRAM_FILES.RENAME_PROMPT'), current)?.trim();
    if (!name || name === current || !plan?.id) return;
    this.workoutService.updateWorkoutFileDetails(plan.id, name, (plan as any).details || '').subscribe({
      next: () => {
        this.toast.success(this.translate.instant('PROGRAM_FILES.RENAMED'));
        this.loadPrograms();
      },
      error: (error: unknown) => this.toast.error(this.translate.instant(programFileUploadErrorKey(error))),
    });
  }

  replaceLibraryFile(plan: WorkoutPlan): void {
    this.openDropdownId = null;
    if (!plan?.id || this.libraryReplaceSaving) return;
    if (!window.confirm(this.translate.instant('PROGRAM_FILES.LIBRARY_REPLACE_CONFIRM'))) return;
    this.libraryReplaceTarget = plan;
    const input = document.getElementById('library-workout-replace-input') as HTMLInputElement | null;
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
    this.workoutService.replaceWorkoutFile(plan.id, file, percent => (this.libraryReplacePercent = percent)).subscribe({
      next: () => {
        this.libraryReplaceSaving = false;
        this.libraryReplaceTarget = null;
        this.toast.success(this.translate.instant('PROGRAM_FILES.REPLACE_DONE'));
        this.loadPrograms();
      },
      error: (error: unknown) => {
        this.libraryReplaceSaving = false;
        this.toast.error(this.translate.instant(programFileUploadErrorKey(error)));
      },
    });
  }

  async downloadProgramFile(program: WorkoutPlan) {
    this.openDropdownId = null;

    try {
      const blob = await this.fetchProgramFileBlob(program);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = programFileSaveName(program);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      this.toast.error(this.translate.instant(programFileOpenErrorKey(error)));
    }
  }


  get filteredPrograms(): WorkoutPlan[] {
    return this.programs || [];
  }

  setProgramTypeFilter(type: 'ALL' | 'APP' | 'FILES' | 'PDF' | 'EXCEL') {
    if (!this.workoutFileEnabled && (type === 'PDF' || type === 'EXCEL' || type === 'FILES')) {
      return;
    }

    this.programTypeFilter = type;
    this.currentPage = 0;
    this.applyProgramFilters();
  }

  getProgramTypeKey(program: WorkoutPlan): 'APP' | 'PDF' | 'EXCEL' {
    if (!this.workoutFileEnabled || !this.isFileProgram(program)) return 'APP';
    const type = String(program.resourceType || '').toUpperCase();
    if (type === 'XLS' || type === 'XLSX' || type === 'EXCEL') return 'EXCEL';
    return 'PDF';
  }

  getProgramTypeLabel(program: WorkoutPlan): string {
    const key = this.getProgramTypeKey(program);
    if (key === 'APP') return this.translate.instant('APP_PROGRAM');
    return key === 'EXCEL' ? 'Excel' : 'PDF';
  }

  getProgramIconName(program: WorkoutPlan): string {
    return this.getProgramTypeKey(program) === 'APP' ? 'grid' : 'file-text';
  }

  getProgramDescription(program: WorkoutPlan): string {
    if (program.details) return program.details;
    if (this.isFileProgram(program)) {
      return [program.originalFileName, program.fileSizeBytes ? this.formatFileSize(program.fileSizeBytes) : '']
        .filter(Boolean)
        .join(' · ');
    }
    const days = program.workoutDays?.length || 0;
    return days
      ? this.translate.instant('WORKOUT_PROGRAM_DAYS', { count: days })
      : this.translate.instant('IN_APP_WORKOUT_PROGRAM');
  }

  getCreatedDate(program: WorkoutPlan): string | Date | undefined {
    const anyProgram = program as any;

    return anyProgram.createdAt || anyProgram.createdDate || anyProgram.fileUploadedAt || anyProgram.uploadedAt;
  }

  getModifiedDate(program: WorkoutPlan): string | Date | undefined {
    const anyProgram = program as any;

    return (
      anyProgram.updatedAt ||
      anyProgram.lastModifiedDate ||
      anyProgram.modifiedAt ||
      anyProgram.createdAt ||
      anyProgram.createdDate ||
      anyProgram.fileUploadedAt ||
      anyProgram.uploadedAt
    );
  }

  get filePrograms(): WorkoutPlan[] {
    return this.programs.filter((program) => this.isFileProgram(program));
  }

  get normalPrograms(): WorkoutPlan[] {
    return this.programs.filter((program) => !this.isFileProgram(program));
  }

  ensureSelectedLibraryFileProgram() {
    const files = this.filePrograms;
    if (!files.length) {
      this.selectedLibraryFileProgram = null;
      return;
    }

    if (!this.selectedLibraryFileProgram || !files.some((p) => p.id === this.selectedLibraryFileProgram?.id)) {
      this.selectedLibraryFileProgram = files[0];
    }
  }

  selectLibraryFileProgram(program: WorkoutPlan) {
    this.selectedLibraryFileProgram = program;
  }

  getFileProgramsCurrent(): WorkoutPlan[] {
    return this.filePrograms.filter((program) => !program.endDate || new Date(program.endDate) >= new Date());
  }

  getFileProgramsHistory(): WorkoutPlan[] {
    return this.filePrograms.filter((program) => !!program.endDate && new Date(program.endDate) < new Date());
  }

  getFileDateLabel(program: WorkoutPlan): string {
    const source = program.startDate || (program as any).fileUploadedAt || '';
    if (!source) return '';
    return new Date(source).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  getSelectedFileSafeUrl(): string {
    return this.selectedLibraryFileProgram ? this.workoutService.getWorkoutFileUrl(this.selectedLibraryFileProgram) : '';
  }

  openSelectedLibraryFile() {
    if (this.selectedLibraryFileProgram) {
      this.downloadProgramFile(this.selectedLibraryFileProgram);
    }
  }

  printSelectedLibraryFile() {
    this.openSelectedLibraryFile();
  }

  shareSelectedLibraryFile() {
    this.openSelectedLibraryFile();
  }

  fullscreenSelectedLibraryFile() {
    this.openSelectedLibraryFile();
  }


  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }

  saveProgram() {}

  resetForm() {
    this.programName = '';
    this.programDescription = '';
    this.showProgramDescription = false;
    this.startDate = '';
    this.endDate = '';
    this.isWorkoutPlanTemplate = false;
    this.typeWorkoutPlan = 'STRENGTH_TRAINING';
    this.trainingDays = [
      { name: 'Day 1', description: '', showDescription: false, exercises: [] },
    ];
    this.selectedDayIndex = 0;
  }

  updateDayName(index: number, newName: string) {
    this.trainingDays[index].name = newName;
  }

  addTrainingDay() {
    const dayNumber = this.trainingDays.length + 1;
    this.trainingDays.push({
      name: `Day ${dayNumber}`,
      description: '',
      showDescription: false,
      exercises: [],
    });
  }

  removeTrainingDay(index: number) {
    if (this.trainingDays.length > 1) {
      this.trainingDays.splice(index, 1);
      if (this.selectedDayIndex >= this.trainingDays.length) {
        this.selectedDayIndex = this.trainingDays.length - 1;
      }
    }
  }

  selectDay(index: number) {
    this.selectedDayIndex = index;
  }

  toggleProgramDescription() {
    this.showProgramDescription = !this.showProgramDescription;
  }

  toggleDayDescription(dayIndex: number) {
    this.trainingDays[dayIndex].showDescription =
      !this.trainingDays[dayIndex].showDescription;
  }

  addExercise() {
    this.loadExercises();
    this.loadExerciseCounts();
    this.showExerciseModal = true;
  }

  closeExerciseModal() {
    this.showExerciseModal = false;
    this.exerciseSearchTerm = '';
    this.selectedMuscle = '';
    this.selectedEquipment = '';
    this.selectedType = '';
    this.exerciseActiveTab = 'templates';
  }

  selectExercise(exercise: Exercise) {
    const newExercise = {
      exerciseRef: exercise.id!,
      name: exercise.name,
      type: exercise.type,
      muscle: exercise.muscle,
      equipment: exercise.equipment,
      sets: [{ setNumber: 1, reps: 8, weight: 0, restMin: 1, restSec: 0, type: 'REGULAR' }],
      isSuperset: false,
      supersetWith: undefined,
      supersetGroupId: undefined,
      notes: '',
    };
    this.trainingDays[this.selectedDayIndex].exercises.push(newExercise);
    this.closeExerciseModal();
  }

  addSet(exerciseIndex: number) {
    const sets = this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex].sets;
    const nextSetNumber = sets.length + 1;
    sets.push(
      {
        setNumber: nextSetNumber,
        reps: 8,
        weight: 0,
        restMin: 1,
        restSec: 0,
        type: 'REGULAR',
      }
    );
  }

  removeSet(exerciseIndex: number, setIndex: number) {
    const exercise =
      this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex];
    if (exercise.sets.length > 1) {
      exercise.sets.splice(setIndex, 1);
    }
  }

  removeExercise(exerciseIndex: number) {
    const exercises = this.trainingDays[this.selectedDayIndex].exercises;
    const exerciseToRemove = exercises[exerciseIndex];

    // If removing a superset exercise, clean up only its pair
    if (exerciseToRemove.supersetWith && exerciseToRemove.supersetGroupId) {
      // Find the paired exercise with the same supersetGroupId and clean it up
      exercises.forEach((ex) => {
        if (
          ex.supersetGroupId === exerciseToRemove.supersetGroupId &&
          ex.exerciseRef !== exerciseToRemove.exerciseRef
        ) {
          ex.isSuperset = false;
          ex.supersetWith = undefined;
          ex.supersetGroupId = undefined;
          // Restore sets if they were cleared
          if (ex.sets.length === 0) {
            ex.sets = [{ setNumber: 1, reps: 8, weight: 0, restMin: 1, restSec: 0, type: 'REGULAR' }];
          }
        }
      });
    }

    // Remove the exercise
    exercises.splice(exerciseIndex, 1);
  }

  toggleSuperset(exerciseIndex: number) {
    const exercises = this.trainingDays[this.selectedDayIndex].exercises;
    const currentExercise = exercises[exerciseIndex];
    const nextExercise = exercises[exerciseIndex + 1];

    if (!nextExercise) return;

    // Check if these two exercises are already paired
    const areAlreadyPaired =
      currentExercise.supersetWith === nextExercise.exerciseRef;

    if (areAlreadyPaired) {
      // Remove superset
      currentExercise.isSuperset = false;
      currentExercise.supersetWith = undefined;
      currentExercise.supersetGroupId = undefined;
      nextExercise.isSuperset = false;
      nextExercise.supersetWith = undefined;
      nextExercise.supersetGroupId = undefined;
      if (nextExercise.sets.length === 0) {
        nextExercise.sets = [{ setNumber: 1, reps: 8, weight: 0, restMin: 1, restSec: 0, type: 'REGULAR' }];
      }
    } else {
      // First, break ALL existing superset connections
      exercises.forEach((ex) => {
        if (
          ex.supersetWith === currentExercise.exerciseRef ||
          ex.supersetWith === nextExercise.exerciseRef
        ) {
          ex.isSuperset = false;
          ex.supersetWith = undefined;
          ex.supersetGroupId = undefined;
          if (ex.sets.length === 0) {
            ex.sets = [{ setNumber: 1, reps: 8, weight: 0, restMin: 1, restSec: 0, type: 'REGULAR' }];
          }
        }
      });

      // Reset current and next exercises
      currentExercise.isSuperset = false;
      currentExercise.supersetWith = undefined;
      currentExercise.supersetGroupId = undefined;
      nextExercise.isSuperset = false;
      nextExercise.supersetWith = undefined;
      nextExercise.supersetGroupId = undefined;

      // Now create the new superset
      const supersetId = `superset_${exerciseIndex}_${
        exerciseIndex + 1
      }_${Date.now()}`;
      currentExercise.isSuperset = true;
      currentExercise.supersetWith = nextExercise.exerciseRef;
      currentExercise.supersetGroupId = supersetId;
      nextExercise.isSuperset = true;
      nextExercise.supersetWith = currentExercise.exerciseRef;
      nextExercise.supersetGroupId = supersetId;
      nextExercise.sets = [];
    }
  }

  toggleExerciseNotes(exerciseIndex: number) {
    console.log('Toggle notes for exercise', exerciseIndex);
  }

  addNewExercise() {
    console.log('Add new exercise');
  }

  /**
   * Tabs « Mes programmes » / « Modèles YoCoach » of the one Programs page (2026-11-20).
   * The address follows the tab without reloading the page, so a refresh or the back button keeps it.
   */
  switchLibraryTab(tab: 'my-library' | 'templates'): void {
    if (this.activeTab === tab) return;
    this.location.replaceState(tab === 'templates' ? '/workout/public-templates' : '/workout/program-library');
    this.searchTerm = '';
    this.setActiveTab(tab);
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 0;
    // Templates: everything; my library: « Programmes » first, the files in their own tab.
    this.programTypeFilter = tab === 'templates' ? 'ALL' : 'APP';
    this.loadPrograms();
  }

  onSearchChange() {
    this.currentPage = 0;
    this.applyProgramFilters();
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.applyProgramFilters();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.applyProgramFilters();
    }
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index);
  }

  onPageChange(page: number) {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.applyProgramFilters();
  }

  formatDate(dateString: string | Date | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  loadEnums() {
    this.exerciseService.getEnums().subscribe({
      next: (enums) => {
        this.enums = enums;
      },
      error: (error) => console.error('Error loading enums:', error),
    });
  }

  loadExercises() {
    this.isLoadingExercises = true;
    const serviceCall =
      this.exerciseActiveTab === 'templates'
        ? this.exerciseService.getTemplateExercises(
            this.exerciseCurrentPage,
            this.exercisePageSize
          )
        : this.exerciseService.getMyExercises(
            this.exerciseCurrentPage,
            this.exercisePageSize
          );

    serviceCall.subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exercises = response.content;
        this.filteredExercises = response.content;
        this.exerciseTotalPages = response.totalPages;
        this.isLoadingExercises = false;
        this.applyExerciseFilters();
      },
      error: (error) => {
        console.error('Error loading exercises:', error);
        this.isLoadingExercises = false;
      },
    });
  }

  loadExerciseCounts() {
    this.exerciseService.getTemplateExercises(0, 1).subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exerciseTemplatesCount = response.totalElements || 0;
      },
      error: (error) =>
        console.error('Error loading exercise templates count:', error),
    });

    this.exerciseService.getMyExercises(0, 1).subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exerciseMyExercisesCount = response.totalElements || 0;
      },
      error: (error) =>
        console.error('Error loading my exercises count:', error),
    });
  }

  setExerciseActiveTab(tab: string) {
    this.exerciseActiveTab = tab;
    this.exerciseCurrentPage = 0;
    this.loadExercises();
  }

  applyExerciseFilters() {
    this.filteredExercises = this.exercises.filter((exercise) => {
      return (
        (!this.selectedEquipment ||
          exercise.equipment === this.selectedEquipment) &&
        (!this.selectedMuscle || exercise.muscle === this.selectedMuscle) &&
        (!this.selectedType || exercise.type === this.selectedType) &&
        (!this.exerciseSearchTerm ||
          exercise.name
            .toLowerCase()
            .includes(this.exerciseSearchTerm.toLowerCase()))
      );
    });
  }

  onExerciseSearchChange() {
    this.applyExerciseFilters();
  }

  onExerciseFilterChange() {
    this.applyExerciseFilters();
  }

  nextExercisePage() {
    if (this.exerciseCurrentPage < this.exerciseTotalPages - 1) {
      this.exerciseCurrentPage++;
      this.loadExercises();
    }
  }

  previousExercisePage() {
    if (this.exerciseCurrentPage > 0) {
      this.exerciseCurrentPage--;
      this.loadExercises();
    }
  }

  loadExerciseDetails(exerciseId: string) {
    this.exerciseService.getExerciseById(exerciseId).subscribe({
      next: (exercise) => {
        this.trainingDays.forEach((day) => {
          day.exercises.forEach((ex) => {
            if (ex.exerciseRef === exerciseId) {
              ex.name = exercise.name;
              ex.type = exercise.type;
              ex.muscle = exercise.muscle;
              ex.equipment = exercise.equipment;
            }
          });
        });
      },
      error: (error) => console.error('Error loading exercise details:', error),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackByProgram(index: number, program: WorkoutPlan): any {
    return program.id || index;
  }

}
