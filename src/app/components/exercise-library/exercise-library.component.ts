import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { FeatherModule } from 'angular-feather';
import { Location } from '@angular/common';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { ExerciseService, PageResponse } from '../../service/exercise.service';
import { AuthService } from '../../config/auth.service';
import { ScrollLoaderComponent } from '../scroll-loader/scroll-loader.component';
import { EnumResponse, Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, FeatherModule, YouTubePlayerModule, ScrollLoaderComponent],
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
  exerciseDescription = '';
  allExercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  isLoading = false;
  enums: EnumResponse | null = null;
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  editingExercise: Exercise | null = null;
  activeTab = 'templates';
  templatesCount = 0;
  myExercisesCount = 0;
  isTemplate = false;

  // Filters
  selectedEquipment = '';
  selectedMuscle = '';
  selectedType = '';

  constructor(
    private location: Location,
    private exerciseService: ExerciseService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Wait a bit for Keycloak to initialize
    setTimeout(() => {
      console.log('Exercise Library - Checking authentication status');
      if (!this.authService.isLoggedIn()) {
        console.log('Exercise Library - Not logged in, redirecting to login');
        this.authService.login();
        return;
      }
      console.log('Exercise Library - User is logged in, loading data');
      this.loadEnums();
      this.loadAllExercises();
      this.loadAllCounts();
    }, 1000);
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
    const startTime = Date.now();
    const serviceCall = this.activeTab === 'templates'
      ? this.exerciseService.getTemplateExercises(this.currentPage, this.pageSize)
      : this.exerciseService.getMyExercises(this.currentPage, this.pageSize);

    serviceCall.subscribe({
      next: (response: PageResponse<Exercise>) => {
        const elapsed = Date.now() - startTime;
        const minDelay = 800; // Minimum 800ms loading time
        const remainingDelay = Math.max(0, minDelay - elapsed);

        setTimeout(() => {
          this.allExercises = response.content;
          this.filteredExercises = response.content;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.isLoading = false;
          this.applyFilters();
        }, remainingDelay);
      },
      error: (error) => {
        const elapsed = Date.now() - startTime;
        const minDelay = 800;
        const remainingDelay = Math.max(0, minDelay - elapsed);

        setTimeout(() => {
          console.error('Error loading exercises:', error);
          this.isLoading = false;
        }, remainingDelay);
      }
    });
  }

  loadAllCounts() {
    this.exerciseService.getTemplateExercises(0, 1).subscribe({
      next: (response: PageResponse<Exercise>) => {
        this.templatesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading templates count:', error)
    });

    this.exerciseService.getMyExercises(0, 1).subscribe({
      next: (response: PageResponse<Exercise>) => {
        this.myExercisesCount = response.totalElements || 0;
      },
      error: (error) => console.error('Error loading my exercises count:', error)
    });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 0;
    this.loadAllExercises();
  }

  createExercise() {
    if (!this.exerciseName.trim()) return;

    const exercise: any = {
      name: this.exerciseName,
      type: this.exerciseType,
      equipment: this.equipment,
      muscle: this.muscle,
      isTemplate: this.isTemplate,
      videoLink: this.videoLink,
      description: this.exerciseDescription,
      createdBy: this.editingExercise?.createdBy || null
    };

    if (this.editingExercise) {
      this.exerciseService.updateExercise(this.editingExercise.id!, exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.loadAllCounts(); // Refresh sidebar counts
          this.resetForm();
          this.closeCreateModal();
        },
        error: (error) => console.error('Error updating exercise:', error)
      });
    } else {
      this.exerciseService.createExercise(exercise).subscribe({
        next: () => {
          this.loadAllExercises();
          this.loadAllCounts(); // Refresh sidebar counts
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
    this.exerciseDescription = '';
    this.isTemplate = false;
    this.editingExercise = null;
  }

  editExercise(exercise: Exercise) {
    this.editingExercise = exercise;
    this.exerciseName = exercise.name;
    this.exerciseType = exercise.type;
    this.equipment = exercise.equipment;
    this.muscle = exercise.muscle;
    this.isTemplate = exercise.isTemplate || false;
    this.videoLink = (exercise as any).videoLink || exercise.videoUrl || '';
    this.exerciseDescription = exercise.description || '';
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
          this.loadAllCounts(); // Refresh sidebar counts
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
