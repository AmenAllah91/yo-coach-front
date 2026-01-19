import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { Client, ClientService } from 'app/service/client.service';
import { WorkoutPlanFacade } from '../workout-plan.facade';
import {
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '@shared/models/workout.models';
import { Exercise } from '@shared/models/exercice.models';

@Component({
  selector: 'app-create-and-assign',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-and-assign.component.html',
  styleUrl: './create-and-assign.component.scss',
})
export class CreateAndAssignComponent implements OnInit {
  isEditMode = false;

  // assign-specific
  client: Client | null = null;

  // schedule-specific
  startDate = new Date().toISOString().split('T')[0];
  endDate = '';

  constructor(
    public facade: WorkoutPlanFacade,
    private route: ActivatedRoute,
    private clientService: ClientService,
    private cdr: ChangeDetectorRef
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

  // filters
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

  get editingExerciseDescription(): string | null {
    return this.facade.editingExerciseDescription;
  }

  // ===== lifecycle =====
  ngOnInit() {
    const planId = this.route.snapshot.paramMap.get('id');
    const clientId = this.route.snapshot.paramMap.get('idClient');

    if (planId) {
      this.isEditMode = true;
      this.facade.loadPlanForEdit(planId).subscribe({
        next: (plan: WorkoutPlan) => {
          this.facade.applyPlanForEdit(plan);

          if (plan.startDate) {
            this.startDate = new Date(plan.startDate)
              .toISOString()
              .split('T')[0];
          }

          this.updateAllDates();
          this.facade.syncPlanDays();
          this.cdr.markForCheck();
        },

        error: (err) =>
          console.error('Erreur lors du chargement du plan :', err),
      });
    } else {
      this.isEditMode = false;
      this.facade.initCreate();
      this.updateAllDates();
    }

    if (clientId) {
      this.clientService.getClientById(clientId).subscribe({
        next: (res) => (this.client = res),
        error: (err) => console.error('Erreur chargement client :', err),
      });
    }

    this.facade.loadExercisesFromAPI();
  }

  // ===== schedule-specific =====
  updateAllDates() {
    if (!this.startDate) return;

    const start = new Date(this.startDate);

    this.facade.days.forEach((day, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);

      day.date = current.toISOString().split('T')[0];
      day.dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
      day.title = `Day ${index + 1}`;
    });

    const end = new Date(start);
    end.setDate(start.getDate() + (this.facade.days.length - 1));
    this.endDate = end.toISOString().split('T')[0];
  }

  // ===== template functions (proxies) =====
  trackByDay = (index: number, d: WorkoutDay) => d.id;
  trackByExercise = (_: number, ex: Exercise) => ex.id;

  selectDay(d: WorkoutDay) {
    this.facade.selectDay(d);
  }

  addDay() {
    this.facade.addDay();
    this.updateAllDates();
  }

  duplicateSelectedDay() {
    this.facade.duplicateSelectedDay();
    this.updateAllDates();
  }

  deleteDay(d: WorkoutDay, ev?: Event) {
    ev?.stopPropagation();
    this.facade.deleteDay(d);
    this.updateAllDates();
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

  // ===== Modal bindings (Common Exercises) =====
  get isExerciseModalOpen(): boolean {
    return this.facade.isExerciseModalOpen;
  }

  get exerciseStep(): 'list' | 'detail' {
    return this.facade.exerciseStep;
  }
  set exerciseStep(v: 'list' | 'detail') {
    this.facade.exerciseStep = v;
  }

  get exerciseSearch(): string {
    return this.facade.exerciseSearch;
  }
  set exerciseSearch(v: string) {
    this.facade.exerciseSearch = v;
  }

  get filteredExercises() {
    return this.facade.filteredExercises;
  }

  get selectedExercise() {
    return this.facade.selectedExercise;
  }
  set selectedExercise(v: Exercise) {
    this.facade.selectedExercise = v;
  }

  // ===== Modal actions proxies =====
  openExerciseModal() {
    this.facade.openExerciseModal();
  }
  closeExerciseModal() {
    this.facade.closeExerciseModal();
  }
  filterExercises() {
    this.facade.filterExercises();
  }
  showExerciseDetail(ex: Exercise) {
    this.facade.showExerciseDetail(ex);
  }
  addExerciseToSession() {
    this.facade.addExerciseToSession();
  }

  // Notes proxies (si template l'utilise)
  setEditingExerciseDescription(id: string | null) {
    this.facade.setEditingExerciseDescription(id);
  }

  // superset/sets proxies si template les utilise
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

  handleSetChange(exId: string, si: number, field: string, value: string) {
    this.facade.handleSetChange?.(exId, si, field, value);
  }

  // ===== save (assign-specific) =====
  savePlan() {
    this.facade.setPlan({
      ...this.facade.plan,
      startDate: this.startDate,
      endDate: this.endDate,
      client: this.client ?? this.facade.plan.client,
    });

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
          this.startDate = new Date().toISOString().split('T')[0];
          this.updateAllDates();
        },
        error: (err) => console.error('Error creating workout plan:', err),
      });
    }
  }
}
