import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-create-workout',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-workout.component.html',
  styleUrls: ['./create-workout.component.scss'],
})
export class CreateWorkoutComponent implements OnInit {
  isEditMode = false;

  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute
  ) {}

  // ====== PROPS utilisés par le template (alias facade) ======
  get workoutPlan(): WorkoutPlan {
    return this.facade.plan;
  }

  set workoutPlan(value: WorkoutPlan) {
    this.facade.setPlan(value);
  }

  get days(): WorkoutDay[] {
    return this.facade.days;
  }

  get selectedDay(): WorkoutDay | null {
    return this.facade.selectedDay;
  }

  set selectedDay(v: WorkoutDay | null) {
    this.facade.selectedDay = v;
  }

  get showPlanDescription(): boolean {
    return this.facade.showPlanDescription;
  }

  get showRestNotes(): boolean {
    return this.facade.showRestNotes;
  }

  get isExerciseModalOpen(): boolean {
    return this.facade.isExerciseModalOpen ?? false; // si pas encore dans facade
  }

  get showExerciseSelector(): boolean {
    return this.facade.showExerciseSelector;
  }

  get loading(): boolean {
    return this.facade.loading;
  }

  get exerciseDatabase(): Exercise[] {
    return this.facade.exerciseDatabase;
  }

  get page(): number {
    return this.facade.page;
  }

  get totalPages(): number {
    return this.facade.totalPages;
  }

  // ===== filters bindings =====
  get searchQuery(): string {
    return this.facade.searchQuery;
  }
  set searchQuery(v: string) {
    this.facade.searchQuery = v;
  }

  get muscleFilter(): string {
    return this.facade.muscleFilter;
  }
  set muscleFilter(v: string) {
    this.facade.muscleFilter = v;
  }

  get equipmentFilter(): string {
    return this.facade.equipmentFilter;
  }
  set equipmentFilter(v: string) {
    this.facade.equipmentFilter = v;
  }

  get typeFilter(): string {
    return this.facade.typeFilter;
  }
  set typeFilter(v: string) {
    this.facade.typeFilter = v;
  }

  // ===== notes state =====
  get editingExerciseDescription(): string | null {
    return this.facade.editingExerciseDescription;
  }

  // ===== lifecycle =====
  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');

    if (planId) {
      this.isEditMode = true;
      this.facade.loadPlanForEdit(planId).subscribe({
        next: (plan: WorkoutPlan) => {
          this.facade.applyPlanForEdit(plan);
        },
        error: (err) =>
          console.error('Erreur lors du chargement du plan :', err),
      });
    } else {
      this.isEditMode = false;
      this.facade.initCreate();
    }

    this.facade.loadExercisesFromAPI();
  }

  // ===== template functions (proxies) =====
  trackByDay = (index: number, d: WorkoutDay) => d.id;
  trackByExercise = (_: number, ex: Exercise) => ex.id;

  selectDay(d: WorkoutDay) {
    this.facade.selectDay(d);
  }

  addDay() {
    this.facade.addDay();
  }

  duplicateSelectedDay() {
    this.facade.duplicateSelectedDay();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    this.facade.deleteDay(d);
  }

  togglePlanDescription() {
    this.facade.showPlanDescription = !this.facade.showPlanDescription;
  }

  toggleDayDescription() {
    if (this.facade.selectedDay) {
      this.facade.selectedDay.showDescription =
        !this.facade.selectedDay.showDescription;
    }
  }

  toggleRestNotes() {
    this.facade.showRestNotes = !this.facade.showRestNotes;
  }

  toggleRestDay() {
    if (!this.selectedDay) return;

    this.selectedDay.isRestDay = !this.selectedDay.isRestDay;
    this.selectedDay.restDay = this.selectedDay.isRestDay;

    if (this.selectedDay.isRestDay) {
      this.selectedDay.workoutSessions = [];
      this.selectedDay.session = null;
    } else {
      // recréer une session si on sort du rest day
      if (
        !this.selectedDay.workoutSessions ||
        this.selectedDay.workoutSessions.length === 0
      ) {
        const newSession: WorkoutSession = {
          name: 'Main Session',
          exercises: [],
          totalSets: 0,
          totalReps: 0,
          totalDurationMin: 0,
        };
        this.selectedDay.workoutSessions = [newSession];
        this.selectedDay.session = newSession;
      } else {
        this.selectedDay.session = this.selectedDay.workoutSessions[0];
      }
    }
  }

  openExerciseSelector() {
    this.facade.showExerciseSelector = true;
    this.facade.loadExercisesFromAPI();
  }

  closeExerciseSelector() {
    this.facade.showExerciseSelector = false;
  }

  onFilterChange() {
    this.facade.onFilterChange();
  }

  nextPage() {
    this.facade.nextPage();
  }

  prevPage() {
    this.facade.prevPage();
  }

  handleSelectExercise(ex: Exercise) {
    this.facade.handleSelectExercise(ex);
  }

  // Si ton template utilise ces fonctions superset/sets,
  // il faut qu’elles existent dans la facade OU tu les mets ici en proxy aussi.
  // (je peux te donner la facade complète si tu veux)
  isInSuperset(i: number) {
    return this.facade.isInSuperset?.(i) ?? false;
  }
  isSecondOfSuperset(i: number) {
    return this.facade.isSecondOfSuperset?.(i) ?? false;
  }
  isSupersetPair(i: number) {
    return this.facade.isSupersetPair?.(i) ?? false;
  }
  canShowSupersetButton(i: number) {
    return this.facade.canShowSupersetButton?.(i) ?? false;
  }
  toggleSuperset(i: number) {
    this.facade.toggleSuperset?.(i);
  }

  handleRemoveExercise(exId: string) {
    this.facade.handleRemoveExercise?.(exId);
  }
  handleAddSet(exId: string) {
    this.facade.handleAddSet?.(exId);
  }
  handleRemoveSet(exId: string, si: number) {
    this.facade.handleRemoveSet?.(exId, si);
  }
  handleExerciseDescriptionChange(exId: string, v: string) {
    this.facade.handleExerciseDescriptionChange?.(exId, v);
  }
  setEditingExerciseDescription(exId: string | null) {
    this.facade.editingExerciseDescription = exId;
  }

  handleSetChange(exId: string, si: number, field: string, value: string) {
    this.facade.handleSetChange?.(exId, si, field, value);
  }

  savePlan() {
    this.facade.syncPlanDays();

    if (this.facade.plan.id) {
      this.facade.updatePlan().subscribe({
        next: (res) => console.log('Workout plan updated:', res),
        error: (err) => console.error('Error updating workout plan:', err),
      });
    } else {
      this.facade.createPlan().subscribe({
        next: (res) => {
          console.log('Workout plan created:', res);
          this.facade.initCreate();
        },
        error: (err) => console.error('Error creating workout plan:', err),
      });
    }
  }
}
