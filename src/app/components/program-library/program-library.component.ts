import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Location } from '@angular/common';
import { WorkoutService, PageResponse } from '../../service/workout.service';
import {
  ExerciseService,
  PageResponse as ExercisePageResponse,
} from '../../service/exercise.service';
import { AuthService } from '../../config/auth.service';
import { ScrollLoaderComponent } from '../scroll-loader/scroll-loader.component';
import { Router } from '@angular/router';
import { ModalAssignToclientComponent } from '../clients/modal-assign-toclient/modal-assign-toclient.component';
import { ClientService, Client } from 'app/service/client.service';
import { WorkoutPlan } from '@shared/models/workout.models';
import { EnumResponse, Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-program-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeatherModule,
    ScrollLoaderComponent,
    ModalAssignToclientComponent,
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
  programTypeFilter: 'ALL' | 'APP' | 'PDF' | 'EXCEL' = 'ALL';
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

  showFileAssignModal = false;
  fileAssignProgram: WorkoutPlan | null = null;
  fileAssignClients: Client[] = [];
  selectedFileAssignClientIds: string[] = [];
  fileAssignStartDate = '';
  fileAssignEndDate = '';
  fileAssignNotifyClient = true;
  fileAssignSaving = false;
  fileAssignError = '';

  showCreateTypeModal = false;
  showImportFileModal = false;
  importFile: File | null = null;
  importProgramName = '';
  importProgramDescription = '';
  importSaving = false;
  importError = '';
  assignImportedProgram = false;
  notifyImportedClients = true;
  importAssignStartDate = '';
  importAssignEndDate = '';
  importClients: Client[] = [];
  selectedImportClientIds: string[] = [];
  importClientsLoading = false;
  showFilePreviewModal = false;
  previewProgram: WorkoutPlan | null = null;
  selectedLibraryFileProgram: WorkoutPlan | null = null;

  constructor(
    public workoutService: WorkoutService,
    private clientService: ClientService,
    private exerciseService: ExerciseService,
    private location: Location,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Wait a bit for Keycloak to initialize

    console.log('Program Library - Checking authentication status');
    if (!this.authService.isLoggedIn()) {
      console.log('Program Library - Not logged in, redirecting to login');
      this.authService.login();
      return;
    }
    console.log('Program Library - User is logged in, loading data');
    this.loadPrograms();
    this.loadEnums();
    this.loadAllCounts();
  }

  loadAllCounts() {
    // Load My Library count
    this.workoutService.getMyLibrary(0, 1).subscribe({
      next: (response: PageResponse<WorkoutPlan>) => {
        this.myLibraryCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading my library count:', error),
    });

    // Load Templates count
    this.workoutService.getTemplates(0, 1).subscribe({
      next: (response: PageResponse<WorkoutPlan>) => {
        this.templatesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading templates count:', error),
    });
  }

  loadPrograms() {
    this.isLoading = true;
    const startTime = Date.now();

    // Filters PDF / Excel / App cannot be applied safely after backend pagination,
    // because page 1 can be empty while page 2 contains matches.
    // So we load a large library page once, then paginate the filtered result locally.
    const serviceCall =
      this.activeTab === 'templates'
        ? this.workoutService.getTemplates(0, 500)
        : this.workoutService.getMyLibrary(0, 500);

    serviceCall.subscribe({
      next: (response: PageResponse<WorkoutPlan>) => {
        this.allPrograms = response.content || [];
        this.applyProgramFilters();

        if (this.activeTab === 'templates') {
          this.templatesCount = response.totalElements || this.allPrograms.length;
        } else {
          this.myLibraryCount = response.totalElements || this.allPrograms.length;
        }

        const elapsed = Date.now() - startTime;
        const minDelay = 250;
        const remainingDelay = Math.max(0, minDelay - elapsed);
        setTimeout(() => {
          this.isLoading = false;
        }, remainingDelay);
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
      const type = this.getProgramTypeKey(program);
      const matchesType = this.programTypeFilter === 'ALL' || type === this.programTypeFilter;
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

  toggleDropdown(programId: string | null, event?: Event) {
    if (this.openDropdownId === programId) {
      this.openDropdownId = null;
      return;
    }

    this.openDropdownId = programId;

    if (event && programId) {
      const button = event.target as HTMLElement;
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

  openFileAssignModal(program: WorkoutPlan) {
    this.fileAssignProgram = program;
    this.selectedFileAssignClientIds = [];
    this.fileAssignStartDate = program.startDate || '';
    this.fileAssignEndDate = program.endDate || '';
    this.fileAssignNotifyClient = true;
    this.fileAssignError = '';
    this.showFileAssignModal = true;
    this.loadImportClients();
  }

  closeFileAssignModal() {
    if (this.fileAssignSaving) return;

    this.showFileAssignModal = false;
    this.fileAssignProgram = null;
    this.selectedFileAssignClientIds = [];
    this.fileAssignStartDate = '';
    this.fileAssignEndDate = '';
    this.fileAssignNotifyClient = true;
    this.fileAssignError = '';
  }

  onFileAssignClientSelection(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedFileAssignClientIds = Array.from(select.selectedOptions).map((option) => option.value);
  }

  getSelectedFileAssignClients(): Client[] {
    return this.importClients.filter(
      (client) => !!client.id && this.selectedFileAssignClientIds.includes(client.id)
    );
  }

  confirmFileAssign() {
    if (!this.fileAssignProgram) return;

    const clientsToAssign = this.getSelectedFileAssignClients();

    if (!clientsToAssign.length) {
      this.fileAssignError = 'Sélectionnez au moins un client.';
      return;
    }

    this.fileAssignSaving = true;
    this.fileAssignError = '';

    let remaining = clientsToAssign.length;

    clientsToAssign.forEach((client) => {
      const item = {
        ...this.fileAssignProgram!,
        client,
        startDate: this.fileAssignStartDate || this.fileAssignProgram!.startDate,
        endDate: this.fileAssignEndDate || this.fileAssignProgram!.endDate || this.fileAssignStartDate || this.fileAssignProgram!.startDate,
        workoutDays: [],
      };

      this.workoutService.assignWorkout(item.id!, item).subscribe({
        next: () => {
          remaining -= 1;
          if (remaining === 0) {
            this.fileAssignSaving = false;
            this.closeFileAssignModal();
            this.loadPrograms();
            this.loadAllCounts();
          }
        },
        error: (error) => {
          console.error('Error assigning file workout program:', error);
          remaining -= 1;
          this.fileAssignError = 'Une erreur est survenue pendant l’assignation.';
          if (remaining === 0) {
            this.fileAssignSaving = false;
          }
        },
      });
    });
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProgramAssigned(event: any) {
    if (!this.programToAssign || !event?.clients?.length || !event?.date) {
      this.showAssignModal = false;
      return;
    }

    const isFile = this.isFileProgram(this.programToAssign);

    if (isFile && !event.endDate) {
      console.error('File workout assignment requires an end date.');
      return;
    }

    let remaining = event.clients.length;
    let hasError = false;

    for (const client of event.clients) {
      const startDate = event.date;
      const endDate = isFile
        ? event.endDate
        : undefined;

      const workoutDays = isFile
        ? []
        : (this.programToAssign.workoutDays || []).map((day: any, index: number) => {
            const current = new Date(startDate);
            current.setDate(current.getDate() + index);

            return {
              ...day,
              date: current.toISOString().split('T')[0],
              dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'long' }),
              dayNumber: index + 1,
              title: day.restDay ? 'Rest Day' : `Day ${index + 1}`,
            };
          });

      const calculatedEndDate = isFile
        ? endDate
        : (workoutDays.length ? workoutDays[workoutDays.length - 1].date : startDate);

      const item: any = {
        id: this.programToAssign.id,
        name: this.programToAssign.name,
        details: this.programToAssign.details,
        createdBy: this.programToAssign.createdBy,
        coach: this.programToAssign.coach,
        client: client,
        startDate,
        endDate: calculatedEndDate,
        workoutDays,
        typeWorkoutPlan: this.programToAssign.typeWorkoutPlan,
        isWorkoutPlanTemplate: false,

        // Important for FILE assignments: keep the source as a real file program.
        workoutPlanMode: isFile ? 'FILE' : (this.programToAssign.workoutPlanMode || 'NORMAL'),
        resourceType: this.programToAssign.resourceType,
        fileName: this.programToAssign.fileName,
        originalFileName: this.programToAssign.originalFileName,
        fileUrl: this.programToAssign.fileUrl,
        fileContentType: this.programToAssign.fileContentType,
        fileSizeBytes: this.programToAssign.fileSizeBytes,
      };

      this.workoutService.assignWorkout(item.id!, item).subscribe({
        next: () => {
          remaining -= 1;
          if (remaining === 0) {
            this.showAssignModal = false;
            this.programToAssign = null;
            this.loadPrograms();
            this.loadEnums();
            this.loadAllCounts();
          }
        },
        error: (err) => {
          console.error('Error assigning workout program:', err);
          hasError = true;
          remaining -= 1;
          if (remaining === 0) {
            if (!hasError) {
              this.showAssignModal = false;
              this.programToAssign = null;
            }
            this.loadPrograms();
            this.loadEnums();
            this.loadAllCounts();
          }
        },
      });
    }
  }


  editProgram(id: string) {
    const url = 'workout/edit-workout/' + id;
    this.router.navigateByUrl(url);
  }

  duplicateProgram(program: WorkoutPlan) {
    this.workoutService.duplicateWorkout(program.id!).subscribe({
      next: () => {
        this.loadPrograms();
        this.loadAllCounts(); // Refresh sidebar counts
        this.openDropdownId = null;
      },
      error: (error) => console.error('Error duplicating program:', error),
    });
  }

  copyToCalendar(program: WorkoutPlan) {
    console.log('Copy to calendar:', program);
    this.openDropdownId = null;
  }

  deleteProgram(program: WorkoutPlan) {
    this.programToDelete = program;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  confirmDelete() {
    if (this.programToDelete) {
      this.workoutService.deleteWorkout(this.programToDelete.id!).subscribe({
        next: () => {
          this.loadPrograms();
          this.loadAllCounts(); // Refresh sidebar counts
          this.closeDeleteModal();
        },
        error: (error) => console.error('Error deleting program:', error),
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.programToDelete = null;
  }

  createProgram() {
    this.showCreateTypeModal = true;
  }

  closeCreateTypeModal() {
    this.showCreateTypeModal = false;
  }

  createNormalWorkout() {
    this.showCreateTypeModal = false;
    this.router.navigateByUrl('workout/create-workout');
  }

  openImportFileWorkout() {
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
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'xls', 'xlsx'].includes(ext)) {
      this.importError = 'Only PDF, XLS, and XLSX files are allowed.';
      this.importFile = null;
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      this.importError = 'File is too large. Maximum size is 25 MB.';
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
    if (this.importClients.length > 0 || this.importClientsLoading) {
      return;
    }

    this.importClientsLoading = true;

    try {
      const coachId = await this.authService.extractUserId();

      if (!coachId) {
        this.importClientsLoading = false;
        return;
      }

      const service: any = this.clientService as any;
      const request$ = service.getListClientsByCoachWithoutPagination
        ? service.getListClientsByCoachWithoutPagination(coachId)
        : service.getClientsByCoach(coachId, 0, 500);

      request$.subscribe({
        next: (response: any) => {
          this.importClients = response?.content || response || [];
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
      this.importError = 'Please choose a file and enter a program name.';
      return;
    }

    this.importSaving = true;
    this.workoutService
      .createFileWorkout(
        this.importFile,
        this.importProgramName.trim(),
        this.importProgramDescription?.trim() || '',
        this.activeTab === 'templates'
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
          console.error('Error saving file workout:', error);
          this.importSaving = false;
          this.importError = 'Upload failed. Please try again.';
        },
      });
  }

  isFileProgram(program: WorkoutPlan | null | undefined): boolean {
    return !!program && String(program.workoutPlanMode || '').toUpperCase() === 'FILE';
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

  previewFileProgram(program: WorkoutPlan) {
    this.previewProgram = program;
    this.showFilePreviewModal = true;
    this.openDropdownId = null;
  }

  closeFilePreviewModal() {
    this.previewProgram = null;
    this.showFilePreviewModal = false;
  }

  private async fetchProgramFileBlob(program: WorkoutPlan): Promise<Blob> {
    const url = this.workoutService.getWorkoutFileUrl(program);
    const token = await this.authService.getToken();

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`File request failed with status ${response.status}`);
    }

    return response.blob();
  }

  async openProgramFile(program: WorkoutPlan) {
    this.openDropdownId = null;

    try {
      const blob = await this.fetchProgramFileBlob(program);
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      console.error('Error opening workout file:', error);
      alert('Impossible d’ouvrir le fichier. Vérifiez votre session puis réessayez.');
    }
  }

  async downloadProgramFile(program: WorkoutPlan) {
    this.openDropdownId = null;

    try {
      const blob = await this.fetchProgramFileBlob(program);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = program.originalFileName || program.fileName || `${program.name || 'workout-program'}.${String(program.resourceType || 'pdf').toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      console.error('Error downloading workout file:', error);
      alert('Impossible de télécharger le fichier. Vérifiez votre session puis réessayez.');
    }
  }

  get filteredPrograms(): WorkoutPlan[] {
    return this.programs || [];
  }

  setProgramTypeFilter(type: 'ALL' | 'APP' | 'PDF' | 'EXCEL') {
    this.programTypeFilter = type;
    this.currentPage = 0;
    this.applyProgramFilters();
  }

  getProgramTypeKey(program: WorkoutPlan): 'APP' | 'PDF' | 'EXCEL' {
    if (!this.isFileProgram(program)) return 'APP';
    const type = String(program.resourceType || '').toUpperCase();
    if (type === 'XLS' || type === 'XLSX' || type === 'EXCEL') return 'EXCEL';
    return 'PDF';
  }

  getProgramTypeLabel(program: WorkoutPlan): string {
    const key = this.getProgramTypeKey(program);
    if (key === 'APP') return 'App Program';
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
    return days ? `${days}-day workout program` : 'In-app workout program';
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

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 0;
    if (tab === 'templates') {
      this.programTypeFilter = 'ALL';
    }
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  goBack() {
    this.location.back();
  }
}
