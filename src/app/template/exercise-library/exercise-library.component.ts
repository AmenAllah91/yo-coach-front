import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { FeatherModule } from 'angular-feather';
import { Location } from '@angular/common';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { ExerciseService, Exercise, PageResponse, EnumResponse } from '../../service/exercise.service';

@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, FeatherModule, YouTubePlayerModule],
  templateUrl: './exercise-library.component.html',
  styleUrls: [
    './exercise-library.component.scss',
    '../../shared/styles/video-player.scss'
  ]
})
export class ExerciseLibraryComponent implements OnInit {
  selectedExercise: string | null = null;
  showCreateModal = false;
  showDeleteModal = false;
  exerciseToDelete: Exercise | null = null;
  exerciseName = '';
  exerciseType = '';
  equipment = '';
  muscle = '';
  videoLink = '';
  allExercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  isLoading = false;
  enums: EnumResponse | null = null;
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  editingExercise: Exercise | null = null;
  
  // Filters
  selectedEquipment = '';
  selectedMuscle = '';
  selectedType = '';

  constructor(
    private location: Location,
    private exerciseService: ExerciseService
  ) {}

  ngOnInit() {
    this.loadEnums();
    this.loadAllExercises();
  }

  selectExercise(exerciseId: string) {
    this.selectedExercise = exerciseId;
  }

  deselectExercise() {
    this.selectedExercise = null;
  }

  goBack() {
    this.location.back();
  }

  getExerciseName(): string {
    const exercise = this.allExercises.find(ex => ex.id === this.selectedExercise);
    return exercise ? exercise.name : '';
  }

  getSelectedExercise(): Exercise | null {
    return this.allExercises.find(ex => ex.id === this.selectedExercise) || null;
  }

  getYouTubeVideoId(url: string): string {
    if (!url) return '';
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
  }

  openCreateModal() {
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  loadEnums() {
    this.exerciseService.getEnums().subscribe({
      next: (enums) => {
        this.enums = enums;
        if (enums.typeExercise.length > 0) this.exerciseType = enums.typeExercise[0];
        if (enums.equipment.length > 0) this.equipment = enums.equipment[0];
        if (enums.muscleGroup.length > 0) this.muscle = enums.muscleGroup[0];
      },
      error: (error) => console.error('Error loading enums:', error)
    });
  }

  loadAllExercises() {
    this.isLoading = true;
    this.exerciseService.getAllExercises(this.currentPage, this.pageSize).subscribe({
      next: (response: PageResponse<Exercise>) => {
        this.allExercises = response.content;
        this.filteredExercises = response.content;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.isLoading = false;
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading exercises:', error);
        this.isLoading = false;
      }
    });
  }

  createExercise() {
    if (!this.exerciseName.trim()) return;
    
    const exercise: Exercise = {
      name: this.exerciseName,
      type: this.exerciseType,
      equipment: this.equipment,
      muscle: this.muscle,
      videoLink: this.videoLink
    };

    if (this.editingExercise) {
      this.exerciseService.updateExercise(this.editingExercise.id!, exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.resetForm();
          this.closeCreateModal();
        },
        error: (error) => console.error('Error updating exercise:', error)
      });
    } else {
      this.exerciseService.createExercise(exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.resetForm();
          this.closeCreateModal();
        },
        error: (error) => console.error('Error creating exercise:', error)
      });
    }
  }

  resetForm() {
    this.exerciseName = '';
    this.exerciseType = this.enums?.typeExercise[0] || '';
    this.equipment = this.enums?.equipment[0] || '';
    this.muscle = this.enums?.muscleGroup[0] || '';
    this.videoLink = '';
    this.editingExercise = null;
  }

  editExercise(exercise: Exercise) {
    this.editingExercise = exercise;
    this.exerciseName = exercise.name;
    this.exerciseType = exercise.type;
    this.equipment = exercise.equipment;
    this.muscle = exercise.muscle;
    this.videoLink = exercise.videoLink || '';
    this.openCreateModal();
  }

  deleteExercise(exercise: Exercise) {
    this.exerciseToDelete = exercise;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (this.exerciseToDelete) {
      this.exerciseService.deleteExercise(this.exerciseToDelete.id!).subscribe({
        next: () => {
          this.loadAllExercises();
          this.closeDeleteModal();
        },
        error: (error) => console.error('Error deleting exercise:', error)
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.exerciseToDelete = null;
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadAllExercises();
    }
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadAllExercises();
    }
  }

  applyFilters() {
    this.filteredExercises = this.allExercises.filter(exercise => {
      return (!this.selectedEquipment || exercise.equipment === this.selectedEquipment) &&
             (!this.selectedMuscle || exercise.muscle === this.selectedMuscle) &&
             (!this.selectedType || exercise.type === this.selectedType);
    });
  }

  onFilterChange() {
    this.applyFilters();
  }
}