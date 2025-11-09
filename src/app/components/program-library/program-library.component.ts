import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { Location } from '@angular/common';
import { WorkoutService, Workout, PageResponse } from '../../service/workout.service';
import { ExerciseService, Exercise, PageResponse as ExercisePageResponse, EnumResponse } from '../../service/exercise.service';
import { AuthService } from '../../config/auth.service';
import { ScrollLoaderComponent } from '../scroll-loader/scroll-loader.component';



@Component({
  selector: 'app-program-library',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, ScrollLoaderComponent],
  templateUrl: './program-library.component.html',
  styleUrls: [
    './program-library.component.scss',
    './superset-styles.scss',
    './exercise-modal-styles.scss'
  ]
})
export class ProgramLibraryComponent implements OnInit {
  programs: Workout[] = [];
  searchTerm = '';
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
  programToDelete: Workout | null = null;
  editingProgram: Workout | null = null;
  programName = '';
  programDescription = '';
  showProgramDescription = false;
  startDate = '';
  endDate = '';
  isWorkoutPlanTemplate = false;
  typeWorkoutPlan = 'STRENGTH_TRAINING';
  trainingDays: any[] = [{ name: 'Day 1', description: '', showDescription: false, exercises: [] }];
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

  constructor(
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
    private location: Location,
    private authService: AuthService
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
      next: (response: PageResponse<Workout>) => {
        this.myLibraryCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading my library count:', error)
    });

    // Load Templates count
    this.workoutService.getTemplates(0, 1).subscribe({
      next: (response: PageResponse<Workout>) => {
        this.templatesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading templates count:', error)
    });
  }

  loadPrograms() {
    this.isLoading = true;
    const startTime = Date.now();
    const serviceCall = this.activeTab === 'templates'
      ? this.workoutService.getTemplates(this.currentPage, this.pageSize)
      : this.workoutService.getMyLibrary(this.currentPage, this.pageSize);

    serviceCall.subscribe({
      next: (response: PageResponse<Workout>) => {
        const elapsed = Date.now() - startTime;
        const minDelay = 800; // Minimum 800ms loading time
        // const remainingDelay = Math.max(0, minDelay - elapsed);


          this.programs = response.content || [];
          this.totalPages = response.totalPages || 0;
          this.totalElements = response.totalElements || 0;

          // Update the appropriate count based on active tab
          if (this.activeTab === 'templates') {
            this.templatesCount = this.totalElements;
          } else {
            this.myLibraryCount = this.totalElements;
          }

          this.isLoading = false;

      },
      error: (error) => {
        const elapsed = Date.now() - startTime;
        const minDelay = 800;
        const remainingDelay = Math.max(0, minDelay - elapsed);

        setTimeout(() => {
          console.error('Error loading programs:', error);
          this.programs = [];
          this.totalPages = 0;
          this.totalElements = 0;
          this.isLoading = false;
        }, remainingDelay);
      }
    });
  }



  toggleDropdown(programId: string | null, event?: Event) {
    if (this.openDropdownId === programId) {
      this.openDropdownId = null;
      return;
    }

    this.openDropdownId = programId;

    if (event && programId) {
        const button = event.target as HTMLElement;
        const dropdown = button.closest('.dropdown')?.querySelector('.dropdown-menu') as HTMLElement;

        if (dropdown) {
          const buttonRect = button.getBoundingClientRect();
          const dropdownHeight = 200; // Approximate dropdown height
          const viewportHeight = window.innerHeight;

          // Position dropdown
          if (buttonRect.bottom + dropdownHeight > viewportHeight) {
            // Show above if not enough space below
            dropdown.style.top = `${buttonRect.top - dropdownHeight}px`;
          } else {
            // Show below
            dropdown.style.top = `${buttonRect.bottom + 4}px`;
          }

          dropdown.style.left = `${buttonRect.right - 180}px`; // 180px is dropdown width
        }
    }
  }

  assignToClients(program: Workout) {
    console.log('Assign to clients:', program);
    this.openDropdownId = null;
  }

  editProgram(program: Workout) {
    this.editingProgram = program;
    this.programName = program.name;
    this.programDescription = program.details || '';
    this.startDate = program.startDate || '';
    this.endDate = program.endDate || '';
    this.isWorkoutPlanTemplate = program.isWorkoutPlanTemplate || false;
    this.typeWorkoutPlan = program.typeWorkoutPlan || 'STRENGTH_TRAINING';
    if (program.workoutDays && program.workoutDays.length > 0) {
      this.trainingDays = program.workoutDays.map((day, index) => ({
        name: day.name || `Day ${index + 1}`,
        description: day.description || '',
        showDescription: !!day.description,
        exercises: (day.exercises || (day.workoutSessions && day.workoutSessions[0] && (day.workoutSessions[0] as any).exercises ? (day.workoutSessions[0] as any).exercises : []) || []).map((ex: any, index: number, exercises: any[]) => {
          const exerciseId = typeof ex.exerciseRef === 'object' ? ex.exerciseRef.id : ex.exerciseRef;
          this.loadExerciseDetails(exerciseId);

          // Find superset partner if exists
          let supersetWith = null;
          let isSuperset = false;
          if (ex.supersetGroupId) {
            const partner = exercises.find((e, i) => i !== index && e.supersetGroupId === ex.supersetGroupId);
            if (partner) {
              supersetWith = typeof partner.exerciseRef === 'object' ? partner.exerciseRef.id : partner.exerciseRef;
              isSuperset = true;
            }
          }

          return {
            exerciseRef: exerciseId,
            name: '',
            type: '',
            muscle: '',
            equipment: '',
            sets: ex.sets ? ex.sets.map(set => ({
              reps: set.reps,
              restMin: set.restMin,
              restSec: set.restSec
            })) : [{ reps: 8, restMin: 1, restSec: 0 }],
            isSuperset: isSuperset,
            supersetWith: supersetWith,
            supersetGroupId: ex.supersetGroupId || null,
            notes: ex.notes || ''
          };
        })
      }));
    }
    this.showCreateModal = true;
    this.openDropdownId = null;
  }

  duplicateProgram(program: Workout) {
    this.workoutService.duplicateWorkout(program.id!).subscribe({
      next: () => {
        this.loadPrograms();
        this.loadAllCounts(); // Refresh sidebar counts
        this.openDropdownId = null;
      },
      error: (error) => console.error('Error duplicating program:', error)
    });
  }

  copyToCalendar(program: Workout) {
    console.log('Copy to calendar:', program);
    this.openDropdownId = null;
  }

  deleteProgram(program: Workout) {
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
        error: (error) => console.error('Error deleting program:', error)
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.programToDelete = null;
  }



  createProgram() {
    this.resetForm();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }

  saveProgram() {
    if (!this.programName.trim()) return;

    const program = {
      name: this.programName,
      details: this.programDescription || '',
      startDate: this.startDate || null,
      endDate: this.endDate || null,
      isWorkoutPlanTemplate: this.isWorkoutPlanTemplate,
      typeWorkoutPlan: this.typeWorkoutPlan,
      workoutDays: this.trainingDays.map((day, dayIndex) => ({
        dayId: `day_${dayIndex + 1}`,
        name: day.name,
        description: day.description || '',
        dayNumber: dayIndex + 1,
        restDay: false,
        workoutSessions: [{
          name: day.name,
          exercises: day.exercises.map((exercise: any) => ({
            exerciseRef: { id: exercise.exerciseRef },
            isSuperset: exercise.isSuperset || false,
            supersetWith: exercise.supersetWith || null,
            supersetGroupId: exercise.supersetGroupId || null,
            notes: exercise.notes || '',
            sets: exercise.sets.map((set: any, setIndex: number) => ({
              setNumber: setIndex + 1,
              reps: set.reps || 8,
              restMin: set.restMin || 1,
              restSec: set.restSec || 0
            }))
          }))
        }]
      }))
    };

    console.log('Saving program:', JSON.stringify(program, null, 2));
    console.log('Training days:', this.trainingDays);

    if (this.editingProgram) {
      this.workoutService.updateWorkout(this.editingProgram.id!, program as any).subscribe({
        next: () => {
          this.loadPrograms();
          this.loadAllCounts(); // Refresh sidebar counts
          this.closeCreateModal();
        },
        error: (error) => console.error('Error updating program:', error)
      });
    } else {
      this.workoutService.createWorkout(program as any).subscribe({
        next: () => {
          this.loadPrograms();
          this.loadAllCounts(); // Refresh sidebar counts
          this.closeCreateModal();
        },
        error: (error) => console.error('Error creating program:', error)
      });
    }
  }

  resetForm() {
    this.programName = '';
    this.programDescription = '';
    this.showProgramDescription = false;
    this.startDate = '';
    this.endDate = '';
    this.isWorkoutPlanTemplate = false;
    this.typeWorkoutPlan = 'STRENGTH_TRAINING';
    this.trainingDays = [{ name: 'Day 1', description: '', showDescription: false, exercises: [] }];
    this.selectedDayIndex = 0;
    this.editingProgram = null;
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
      exercises: []
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
    this.trainingDays[dayIndex].showDescription = !this.trainingDays[dayIndex].showDescription;
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
      sets: [{ reps: 8, restMin: 1, restSec: 0 }],
      isSuperset: false,
      supersetWith: undefined,
      supersetGroupId: undefined,
      notes: ''
    };
    this.trainingDays[this.selectedDayIndex].exercises.push(newExercise);
    this.closeExerciseModal();
  }

  addSet(exerciseIndex: number) {
    this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex].sets.push({
      reps: 8,
      restMin: 1,
      restSec: 0
    });
  }

  removeSet(exerciseIndex: number, setIndex: number) {
    const exercise = this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex];
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
      exercises.forEach(ex => {
        if (ex.supersetGroupId === exerciseToRemove.supersetGroupId && ex.exerciseRef !== exerciseToRemove.exerciseRef) {
          ex.isSuperset = false;
          ex.supersetWith = undefined;
          ex.supersetGroupId = undefined;
          // Restore sets if they were cleared
          if (ex.sets.length === 0) {
            ex.sets = [{ reps: 8, restMin: 1, restSec: 0 }];
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
    const areAlreadyPaired = currentExercise.supersetWith === nextExercise.exerciseRef;

    if (areAlreadyPaired) {
      // Remove superset
      currentExercise.isSuperset = false;
      currentExercise.supersetWith = undefined;
      currentExercise.supersetGroupId = undefined;
      nextExercise.isSuperset = false;
      nextExercise.supersetWith = undefined;
      nextExercise.supersetGroupId = undefined;
      if (nextExercise.sets.length === 0) {
        nextExercise.sets = [{ reps: 8, restMin: 1, restSec: 0 }];
      }
    } else {
      // First, break ALL existing superset connections
      exercises.forEach(ex => {
        if (ex.supersetWith === currentExercise.exerciseRef || ex.supersetWith === nextExercise.exerciseRef) {
          ex.isSuperset = false;
          ex.supersetWith = undefined;
          ex.supersetGroupId = undefined;
          if (ex.sets.length === 0) {
            ex.sets = [{ reps: 8, restMin: 1, restSec: 0 }];
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
      const supersetId = `superset_${exerciseIndex}_${exerciseIndex + 1}_${Date.now()}`;
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
    this.loadPrograms();
  }

  onSearchChange() {
    this.currentPage = 0;
    this.loadPrograms();
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadPrograms();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadPrograms();
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  loadEnums() {
    this.exerciseService.getEnums().subscribe({
      next: (enums) => {
        this.enums = enums;
      },
      error: (error) => console.error('Error loading enums:', error)
    });
  }

  loadExercises() {
    this.isLoadingExercises = true;
    const serviceCall = this.exerciseActiveTab === 'templates'
      ? this.exerciseService.getTemplateExercises(this.exerciseCurrentPage, this.exercisePageSize)
      : this.exerciseService.getMyExercises(this.exerciseCurrentPage, this.exercisePageSize);

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
      }
    });
  }

  loadExerciseCounts() {
    this.exerciseService.getTemplateExercises(0, 1).subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exerciseTemplatesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading exercise templates count:', error)
    });

    this.exerciseService.getMyExercises(0, 1).subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exerciseMyExercisesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading my exercises count:', error)
    });
  }

  setExerciseActiveTab(tab: string) {
    this.exerciseActiveTab = tab;
    this.exerciseCurrentPage = 0;
    this.loadExercises();
  }

  applyExerciseFilters() {
    this.filteredExercises = this.exercises.filter(exercise => {
      return (!this.selectedEquipment || exercise.equipment === this.selectedEquipment) &&
             (!this.selectedMuscle || exercise.muscle === this.selectedMuscle) &&
             (!this.selectedType || exercise.type === this.selectedType) &&
             (!this.exerciseSearchTerm || exercise.name.toLowerCase().includes(this.exerciseSearchTerm.toLowerCase()));
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
        this.trainingDays.forEach(day => {
          day.exercises.forEach(ex => {
            if (ex.exerciseRef === exerciseId) {
              ex.name = exercise.name;
              ex.type = exercise.type;
              ex.muscle = exercise.muscle;
              ex.equipment = exercise.equipment;
            }
          });
        });
      },
      error: (error) => console.error('Error loading exercise details:', error)
    });
  }

  trackByProgram(index: number, program: Workout): any {
    return program.id || index;
  }

  goBack() {
    this.location.back();
  }
}
