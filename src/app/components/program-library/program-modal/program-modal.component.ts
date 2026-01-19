import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ExerciseService, Exercise, PageResponse as ExercisePageResponse, EnumResponse } from '../../../service/exercise.service';

@Component({
  selector: 'app-program-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './program-modal.component.html',
  styleUrls: ['./program-modal.component.scss']
})
export class ProgramModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() editingProgram: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

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
  exercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  enums: EnumResponse | null = null;
  exerciseCurrentPage = 0;
  exercisePageSize = 20;
  exerciseTotalPages = 0;
  isLoadingExercises = false;



  constructor(private exerciseService: ExerciseService) {}

  ngOnInit() {
    this.loadEnums();
  }

  ngOnChanges() {
    if (this.show && this.editingProgram) {
      this.loadProgramData();
    } else if (this.show) {
      this.resetForm();
    }
  }


  loadProgramData() {
    this.programName = this.editingProgram.name;
    this.programDescription = this.editingProgram.details || '';
    this.startDate = this.editingProgram.startDate || '';
    this.endDate = this.editingProgram.endDate || '';
    this.isWorkoutPlanTemplate = this.editingProgram.isWorkoutPlanTemplate || false;
    this.typeWorkoutPlan = this.editingProgram.typeWorkoutPlan || 'STRENGTH_TRAINING';

    if (this.editingProgram.workoutDays && this.editingProgram.workoutDays.length > 0) {
      this.trainingDays = this.editingProgram.workoutDays.map((day: any, index: number) => ({
        name: day.name || `Day ${index + 1}`,
        description: day.description || '',
        showDescription: !!day.description,
        exercises: []
      }));
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
  }

  closeModal() {
    this.close.emit();
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

    this.save.emit(program);
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

  loadEnums() {
    this.exerciseService.getEnums().subscribe({
      next: (enums) => {
        this.enums = enums;
      },
      error: (error) => console.error('Error loading enums:', error)
    });
  }

  addExercise() {
    this.showExerciseModal = true;
    this.loadExercises();
  }

  closeExerciseModal() {
    this.showExerciseModal = false;
  }

  loadExercises() {
    this.isLoadingExercises = true;
    this.exerciseService.getAllExercises(this.exerciseCurrentPage, this.exercisePageSize, this.selectedEquipment, this.selectedMuscle, undefined, this.exerciseSearchTerm).subscribe({
      next: (response: ExercisePageResponse<Exercise>) => {
        this.exercises = response.content || [];
        this.filteredExercises = this.exercises;
        this.exerciseTotalPages = response.totalPages || 0;
        this.isLoadingExercises = false;
      },
      error: (error) => {
        console.error('Error loading exercises:', error);
        this.isLoadingExercises = false;
      }
    });
  }

  selectExercise(exercise: Exercise) {
    const newExercise = {
      exerciseRef: exercise.id,
      name: exercise.name,
      type: exercise.type,
      sets: [{ reps: 8, restMin: 1, restSec: 0 }],
      isSuperset: false,
      supersetWith: null,
      supersetGroupId: null,
      notes: ''
    };
    this.trainingDays[this.selectedDayIndex].exercises.push(newExercise);
    this.closeExerciseModal();
  }

  removeExercise(index: number) {
    this.trainingDays[this.selectedDayIndex].exercises.splice(index, 1);
  }

  addSet(exerciseIndex: number) {
    this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex].sets.push({ reps: 8, restMin: 1, restSec: 0 });
  }

  removeSet(exerciseIndex: number, setIndex: number) {
    const sets = this.trainingDays[this.selectedDayIndex].exercises[exerciseIndex].sets;
    if (sets.length > 1) {
      sets.splice(setIndex, 1);
    }
  }

  onExerciseSearchChange() {
    this.exerciseCurrentPage = 0;
    this.loadExercises();
  }

  onExerciseFilterChange() {
    this.exerciseCurrentPage = 0;
    this.loadExercises();
  }

  previousExercisePage() {
    if (this.exerciseCurrentPage > 0) {
      this.exerciseCurrentPage--;
      this.loadExercises();
    }
  }

  nextExercisePage() {
    if (this.exerciseCurrentPage < this.exerciseTotalPages - 1) {
      this.exerciseCurrentPage++;
      this.loadExercises();
    }
  }

  toggleSuperset(index: number) {
    // Superset logic implementation
  }

  toggleExerciseNotes(index: number) {
    // Exercise notes toggle logic
  }

  addNewExercise() {
    // Add new exercise logic
  }
}
