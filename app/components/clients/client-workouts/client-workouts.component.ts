import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WorkoutService } from 'app/service/workout.service';
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm.component';
import { WorkoutDayService } from 'app/service/workout-day.service';
import { CoachSettingsService } from 'app/service/coach-settings.service';

type WorkoutStatus = 'COMPLETED' | 'MISSED' | 'PENDING';
type WorkoutSetType = 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE';

interface ExerciseSet {
  setNumber?: number;
  reps?: number;
  weight?: number | null;
  duration?: number;
  restMin: number;
  restSec: number;
  type?: WorkoutSetType | string;
}

interface RawExercise {
  id: string;
  name: string;
  type: 'CARDIO' | 'MUSCULATION';
  supersetGroupId: string | null;
  sets: ExerciseSet[];
  duration?: number;
}

interface WorkoutSession {
  name: string;
  exercises: RawExercise[];
}

interface GroupedExercise {
  groupIndex: number;
  subIndex?: number;
  displayNumber: string;
  label: string;
  name: string;
  type: string;
  sets: {
    setNumber: number;
    type: WorkoutSetType;
    displayLabel: string;
    reps: string;
    weight: number | null;
    rest: string;
    duration?: number;
  }[];
  duration?: number;
}

interface Workout {
  id: string;
  planId: string;
  date: string;
  title: string;
  program: string;
  dayNumber: number;
  status: WorkoutStatus;
  rawSessions: WorkoutSession[];
  groupedExercises: GroupedExercise[];
}

interface FileProgram {
  id: string;
  name: string;
  coachName: string;
  resourceType: string;
  originalFileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  startDate?: string;
  endDate?: string;
  addedLabel: string;
  isCurrent: boolean;
  pageCountLabel: string;
}

@Component({
  selector: 'app-client-workouts',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalConfirmComponent],
  templateUrl: './client-workouts.component.html',
  styleUrl: './client-workouts.component.scss',
})
export class ClientWorkoutsComponent implements OnInit {
  activeTab: 'upcoming' | 'past' = 'upcoming';
  clientViewMode: 'calendar' | 'file' = 'calendar';
  currentMonthDate = new Date();
  userid = sessionStorage.getItem('userId');
  selectedWorkout: Workout | null = null;
  selectedFileProgram: FileProgram | null = null;

  workouts: Workout[] = [];
  filePrograms: FileProgram[] = [];
  filteredFilePrograms: FileProgram[] = [];
  coaches: any[] = [];
  selectedCoachId: string | 'all' = 'all';
  searchProgram = '';
  allPlans: any[] = [];

  constructor(
    public workoutService: WorkoutService,
    private workoutDayService: WorkoutDayService,
    private coachSettingsService: CoachSettingsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.coachSettingsService.loadConfig().subscribe({
      next: () => this.getWorkoutDay(),
      error: () => this.getWorkoutDay(),
    });
  }

  get showExerciseWeight(): boolean {
    return this.coachSettingsService.shouldShowExerciseWeight();
  }

  getWorkoutDay() {
    this.workoutService.getWorkoutPlansByClient(this.userid).subscribe((plans: any[]) => {
      this.allPlans = plans || [];
      const coachMap = new Map<string, any>();
      this.allPlans.forEach((plan: any) => {
        if (plan.coach && plan.coach.id) {
          coachMap.set(plan.coach.id, {
            id: plan.coach.id,
            firstName: plan.coach.firstName || 'Coach',
            lastName: plan.coach.lastName || '',
            fullName: `${plan.coach.firstName || 'Coach'} ${plan.coach.lastName || ''}`.trim(),
          });
        }
      });
      this.coaches = Array.from(coachMap.values());
      this.selectedCoachId = this.coaches.length === 1 ? this.coaches[0].id : 'all';
      this.applyCoachFilter();
    });
  }

  applyCoachFilter() {
    let filteredPlans = this.allPlans || [];
    if (this.selectedCoachId !== 'all') {
      filteredPlans = filteredPlans.filter((plan: any) => plan.coach && plan.coach.id === this.selectedCoachId);
    }

    const normalPlans = filteredPlans.filter((plan: any) => !this.isFilePlan(plan));
    const filePlans = filteredPlans.filter((plan: any) => this.isFilePlan(plan));

    this.workouts = this.mapPlansToWorkouts(normalPlans);
    this.filePrograms = this.mapPlansToFilePrograms(filePlans);
    this.applyFileSearch();

    if (this.filePrograms.length > 0 && !this.selectedFileProgram) {
      this.selectedFileProgram = this.currentPrograms[0] || this.filePrograms[0];
    } else if (this.selectedFileProgram) {
      const stillExists = this.filePrograms.find((p) => p.id === this.selectedFileProgram?.id);
      this.selectedFileProgram = stillExists || this.currentPrograms[0] || this.filePrograms[0] || null;
    }

    if (this.filePrograms.length > 0) {
      this.clientViewMode = 'file';
    }

    this.selectedWorkout = null;
  }

  onCoachChange(coachId: string | 'all') {
    this.selectedCoachId = coachId;
    this.applyCoachFilter();
  }

  get currentMonth(): string {
    return this.currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get displayWorkouts(): Workout[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.workouts.filter((w) => {
      const workoutDate = new Date(w.date);
      workoutDate.setHours(0, 0, 0, 0);
      const sameMonth = workoutDate.getMonth() === this.currentMonthDate.getMonth() && workoutDate.getFullYear() === this.currentMonthDate.getFullYear();
      if (!sameMonth) return false;
      return this.activeTab === 'upcoming' ? workoutDate >= today : workoutDate < today;
    });
  }

  get calendarCountLabel(): string {
    const count = this.displayWorkouts.length;
    return `${count} séance${count > 1 ? 's' : ''} ce mois`;
  }

  get currentPrograms(): FileProgram[] {
    return this.filteredFilePrograms.filter((p) => p.isCurrent);
  }

  get historyPrograms(): FileProgram[] {
    return this.filteredFilePrograms.filter((p) => !p.isCurrent);
  }

  mapPlansToWorkouts(plans: any[]): Workout[] {
    const workouts: Workout[] = [];
    plans.forEach((plan) => {
      if (!plan.startDate || !plan.workoutDays?.length) return;
      const planStart = new Date(plan.startDate);
      plan.workoutDays.forEach((day: any) => {
        if (!day.dayNumber) return;
        const workoutDate = new Date(planStart);
        workoutDate.setDate(planStart.getDate() + (day.dayNumber - 1));
        const dateStr = workoutDate.toISOString().split('T')[0];
        workouts.push({
          id: day.id,
          planId: plan.id,
          date: dateStr,
          title: day.title || `Day ${day.dayNumber}`,
          program: plan.name,
          dayNumber: day.dayNumber,
          status: day.status ?? 'PENDING',
          rawSessions: day.workoutSessions || [],
          groupedExercises: this.groupExercisesBySuperset(day.workoutSessions || []),
        });
      });
    });
    return workouts;
  }

  mapPlansToFilePrograms(plans: any[]): FileProgram[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (plans || []).map((plan: any) => {
      const type = String(plan.resourceType || '').toUpperCase();
      const coachName = `${plan.coach?.firstName || 'Coach'} ${plan.coach?.lastName || ''}`.trim();
      const end = plan.endDate ? new Date(plan.endDate) : null;
      if (end) end.setHours(0, 0, 0, 0);
      const isCurrent = !end || end >= today;
      return {
        id: plan.id,
        name: plan.name || 'Programme fichier',
        coachName,
        resourceType: type === 'XLS' || type === 'XLSX' ? 'EXCEL' : (type || 'PDF'),
        originalFileName: plan.originalFileName,
        fileUrl: plan.fileUrl,
        fileSizeBytes: plan.fileSizeBytes,
        startDate: plan.startDate,
        endDate: plan.endDate,
        addedLabel: plan.startDate ? this.formatFrenchDate(plan.startDate) : '',
        isCurrent,
        pageCountLabel: type === 'PDF' ? '12 pages' : 'Feuille Excel',
      } as FileProgram;
    }).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }

  applyFileSearch() {
    const q = this.searchProgram.trim().toLowerCase();
    this.filteredFilePrograms = !q
      ? [...this.filePrograms]
      : this.filePrograms.filter((p) =>
          [p.name, p.originalFileName, p.resourceType].filter(Boolean).join(' ').toLowerCase().includes(q)
        );
  }

  isFilePlan(plan: any): boolean {
    const mode = String(plan?.workoutPlanMode || plan?.mode || '').toUpperCase();
    const type = String(plan?.resourceType || '').toUpperCase();
    return mode === 'FILE' || !!plan?.fileName || !!plan?.fileUrl || ['PDF', 'XLS', 'XLSX', 'EXCEL'].includes(type);
  }

  setClientViewMode(mode: 'calendar' | 'file') {
    this.clientViewMode = mode;
    this.selectedWorkout = null;
    if (mode === 'file' && !this.selectedFileProgram) {
      this.selectedFileProgram = this.currentPrograms[0] || this.filePrograms[0] || null;
    }
  }

  selectFileProgram(program: FileProgram) {
    this.selectedFileProgram = program;
    this.clientViewMode = 'file';
  }

  getSafeSelectedFileUrl(): SafeResourceUrl | null {
    if (!this.selectedFileProgram) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.workoutService.getWorkoutFileUrl(this.selectedFileProgram as any));
  }

  openSelectedFile() {
    if (!this.selectedFileProgram) return;
    window.open(this.workoutService.getWorkoutFileUrl(this.selectedFileProgram as any), '_blank');
  }

  printSelectedFile() {
    this.openSelectedFile();
  }

  shareSelectedFile() {
    this.openSelectedFile();
  }

  fullscreenSelectedFile() {
    this.openSelectedFile();
  }

  formatFileSize(bytes?: number): string {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatFrenchDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  private groupExercisesBySuperset(sessions: any[]): GroupedExercise[] {
    const allExercises: RawExercise[] = sessions.flatMap((s) => s.exercises || []);
    const groups: { [key: string]: RawExercise[] } = {};
    allExercises.forEach((ex) => {
      const groupId = ex.supersetGroupId || `solo_${ex.id}`;
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(ex);
    });

    const groupedExercises: GroupedExercise[] = [];
    let globalIndex = 1;
    Object.values(groups).forEach((groupExercises: RawExercise[]) => {
      groupExercises.forEach((ex, subIndex) => {
        const isSuperset = groupExercises.length > 1;
        const displayNumber = isSuperset ? `${globalIndex}.${subIndex + 1}` : `${globalIndex}`;
        const totalDuration = ex.sets?.reduce((sum, s) => sum + (s.duration || 0), 0) ?? ex.duration;
        groupedExercises.push({
          groupIndex: globalIndex,
          subIndex: isSuperset ? subIndex + 1 : undefined,
          displayNumber,
          label: ex.type,
          name: ex.name,
          type: ex.type,
          sets: ex.sets?.map((s, setIndex) => {
            const setType = this.normalizeSetType(s);
            const displaySetNumber = setIndex + 1;
            return {
              setNumber: displaySetNumber,
              type: setType,
              displayLabel: this.getSetDisplayLabel(setType, displaySetNumber),
              reps: s.reps != null ? `${s.reps}` : '-',
              weight: s.weight ?? null,
              rest: this.formatRest(s.restMin ?? 0, s.restSec ?? 0),
              duration: s.duration,
            };
          }) || [],
          duration: totalDuration,
        });
      });
      globalIndex++;
    });
    return groupedExercises;
  }

  private normalizeSetType(set: any): WorkoutSetType {
    const rawType = (set?.type ?? set?.setType ?? set?.workoutSetType ?? set?.typeSet ?? set?.workoutType ?? set?.set_type ?? set?.setTypeEnum ?? set?.exerciseSetType ?? 'REGULAR')
      .toString().trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (rawType === 'W' || rawType === 'WARMUP' || rawType === 'WARM_UP') return 'WARM_UP';
    if (rawType === 'D' || rawType === 'DROPSET' || rawType === 'DROP_SET') return 'DROP_SET';
    if (rawType === 'F' || rawType === 'FAILURE') return 'FAILURE';
    return 'REGULAR';
  }

  getSetDisplayLabel(type: WorkoutSetType, setNumber: number): string {
    if (type === 'WARM_UP') return 'W';
    if (type === 'DROP_SET') return 'D';
    if (type === 'FAILURE') return 'F';
    return String(setNumber);
  }

  getSetTypeClass(type?: WorkoutSetType): string {
    switch (type) {
      case 'WARM_UP': return 'cw-set-type--warmup';
      case 'DROP_SET': return 'cw-set-type--dropset';
      case 'FAILURE': return 'cw-set-type--failure';
      default: return 'cw-set-type--regular';
    }
  }

  formatRest(restMin: number, restSec: number): string {
    const min = Number(restMin || 0);
    const sec = Number(restSec || 0);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  getTotalExercises(workout: Workout): number {
    return workout.groupedExercises.length;
  }

  userName = 'Kolton';
  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  setActiveTab(tab: 'upcoming' | 'past') {
    this.activeTab = tab;
    this.selectedWorkout = null;
  }

  prevMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
  }

  onSelectWorkout(workout: Workout): void {
    this.selectedWorkout = { ...workout };
  }

  backToList() { this.selectedWorkout = null; }

  showConfirmModal = false;
  pendingStatus: WorkoutStatus | null = null;

  openConfirmModal(status: WorkoutStatus): void { this.pendingStatus = status; this.showConfirmModal = true; }
  closeConfirmModal(): void { this.showConfirmModal = false; this.pendingStatus = null; }
  confirmStatusUpdate(): void {
    if (this.selectedWorkout && this.pendingStatus) this.updateWorkoutStatus(this.selectedWorkout, this.pendingStatus);
    this.closeConfirmModal();
  }

  updateWorkoutStatus(workout: Workout, status: WorkoutStatus): void {
    workout.status = status;
    this.workoutDayService.updateWorkoutDay({ id: workout.id, dayNumber: workout.dayNumber, status }, workout.planId).subscribe({
      next: () => this.getWorkoutDay(),
      error: (err) => {
        console.error('Update failed:', err);
        workout.status = 'PENDING';
      },
    });
  }
}
