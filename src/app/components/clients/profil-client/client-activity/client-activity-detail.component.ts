import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { CoachSettingsService } from 'app/service/coach-settings.service';
import { MealplanDayService } from 'app/service/mealplan-day.service';
import {
  NutritionActivity,
  WorkoutActivity,
  findExerciseLog,
  nutritionDayStatusLabel,
  workoutActivityDuration,
  workoutActivityMode,
  workoutActivityStatusLabel,
} from './client-activity';

/**
 * What the client did on a workout or nutrition day, read-only for the coach (profile dashboard, coach dashboard).
 * The host keeps the open day, Escape and the page scroll lock.
 */
@Component({
  selector: 'app-client-activity-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './client-activity-detail.component.html',
  styleUrls: ['./client-activity.scss', './client-activity-detail.component.scss'],
})
export class ClientActivityDetailComponent implements OnChanges {
  @Input() workout: WorkoutActivity | null = null;
  @Input() nutrition: NutritionActivity | null = null;
  @Input() clientName = '';
  /** Coach dashboard: the day is being read, or could not be shown (translation key). */
  @Input() loading = false;
  @Input() notice: string | null = null;
  @Input() showProfileLink = false;
  @Output() closed = new EventEmitter<void>();
  @Output() message = new EventEmitter<void>();
  @Output() openProfile = new EventEmitter<void>();

  constructor(
    private translate: TranslateService,
    private coachSettingsService: CoachSettingsService,
    private mealplanDayService: MealplanDayService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrition'] && this.nutrition) this.loadNutritionPhotoUrls(this.nutrition);
  }

  get dateLocale(): string {
    return this.translate.currentLang === 'en' ? 'en-US' : 'fr-FR';
  }

  /** Stored meal photos are private: their links are asked for when the day opens. */
  private loadNutritionPhotoUrls(activity: NutritionActivity): void {
    activity.mealLogs.forEach((log: any, logIndex: number) => {
      const hasStoredPhoto = log?.photoPath && String(log.photoPath) !== 'null';
      const mealIndex = activity.meals.findIndex((meal: any) => meal?.id === log?.mealId);
      const resolvedMealIndex = mealIndex >= 0 ? mealIndex : logIndex;
      const meal = activity.meals[resolvedMealIndex];
      const mealId = log?.mealId || meal?.id;

      if (!hasStoredPhoto || !activity.planId || !activity.id || !mealId) return;

      this.mealplanDayService
        .getMealPhotoUrl(activity.planId, activity.id, mealId)
        .pipe(catchError(() => of(null)))
        .subscribe((result) => {
          if (!result?.photoUrl) return;

          log.photoUrl = result.photoUrl;
          const existingPhoto = activity.photos.find((photo) =>
            photo.mealId === mealId
          );
          if (existingPhoto) {
            existingPhoto.url = result.photoUrl;
          } else {
            activity.photos.push({
              url: result.photoUrl,
              label: log?.mealName || meal?.name || `Meal ${resolvedMealIndex + 1}`,
              time: log?.loggedAt || log?.createdAt || '',
              mealId,
            });
          }
        });
    });
  }

  /* ---------- Nutrition ---------- */

  nutritionDayStatusLabel(activity: NutritionActivity): string {
    return nutritionDayStatusLabel(this.translate, activity);
  }

  nutritionReportTitle(activity: NutritionActivity): string {
    return activity.status === 'IN_PROGRESS' || activity.status === 'OFF_PLAN'
      ? this.translate.instant('REVIEW_LOG_FOR_DAY', { day: activity.dayName })
      : this.translate.instant('NUTRITION_REPORT_FOR_DAY', { day: activity.dayName });
  }

  nutritionMealLog(activity: NutritionActivity, index: number): any {
    const meal = activity.meals[index];
    return activity.mealLogs.find((log: any) =>
      meal?.id && log?.mealId === meal.id
    ) || activity.mealLogs[index] || null;
  }

  nutritionMealState(log: any): string {
    if (!log) return 'Not logged';
    const value = String(log?.status || log?.completionMode || '').toUpperCase();
    if (value === 'SKIPPED' || log?.skipped) return 'Skipped';
    if (value === 'MODIFIED' || log?.modified) return 'Modified';
    if (value === 'OFF_PLAN' || log?.offPlan) return 'Off-plan';
    return 'As planned';
  }

  nutritionMealStateLabel(log: any): string {
    if (!log) return this.translate.instant('NUTRITION_MEAL_NOT_LOGGED');
    const value = String(log?.status || log?.completionMode || '').toUpperCase();
    if (value === 'SKIPPED' || log?.skipped) return this.translate.instant('NUTRITION_MEAL_SKIPPED');
    if (value === 'MODIFIED' || log?.modified) return this.translate.instant('MODIFIED');
    if (value === 'OFF_PLAN' || log?.offPlan) return this.translate.instant('NUTRITION_ACTIVITY_STATUS_OFF_PLAN');
    return this.translate.instant('AS_PLANNED');
  }

  /* ---------- Workout ---------- */

  workoutActivityDetailTitle(activity: WorkoutActivity): string {
    const dayLabel = `${this.translate.instant('DAY')} ${activity.dayInWeek}`;
    const name = activity.workoutName.trim();
    return !name || /^(day|jour)\s*\d+$/i.test(name) ? dayLabel : `${dayLabel} – ${name}`;
  }

  workoutActivityStatusLabel(activity: WorkoutActivity): string {
    return workoutActivityStatusLabel(this.translate, activity);
  }

  workoutActivityMode(activity: WorkoutActivity): string {
    return workoutActivityMode(this.translate, activity);
  }

  workoutActivityDuration(activity: WorkoutActivity): string {
    return workoutActivityDuration(this.translate, activity);
  }

  workoutActivityLog(activity: WorkoutActivity, exercise: any, index: number): any {
    return findExerciseLog(activity.exerciseLogs, exercise, index);
  }

  /** A set as the coach planned it or the client did it: « 10 rép. · 20 kg », or its duration for a timed set. */
  formatActivitySet(set: any, exercise: any): string {
    const duration = Number(set?.duration);
    const timed = String(exercise?.type || exercise?.exerciseRef?.type || '').toUpperCase() === 'CARDIO'
      || (Number.isFinite(duration) && duration > 0 && !set?.reps);
    if (timed) {
      if (!Number.isFinite(duration) || duration <= 0) return '—';
      const minutes = Math.floor(duration / 60);
      const seconds = Math.round(duration % 60);
      return minutes ? `${minutes} min${seconds ? ` ${seconds}s` : ''}` : `${seconds}s`;
    }
    const reps = set?.reps ?? '—';
    return `${reps} ${this.translate.instant('REPS_SHORT')} · ${this.formatActivityWeight(set?.weight)} ${this.coachSettingsService.getWeightUnit()}`;
  }

  performedSet(log: any, plannedSet: any, index: number): any {
    return (log?.sets || []).find(
      (set: any) => Number(set?.setNumber) === Number(plannedSet?.setNumber || index + 1)
    ) || null;
  }

  exerciseActivityState(activity: WorkoutActivity, exercise: any, index: number): string {
    const log = this.workoutActivityLog(activity, exercise, index);
    if (log?.skipped) return 'Skipped';
    const statuses = (exercise?.sets || []).map((set: any, setIndex: number) =>
      this.workoutSetStatus(activity, exercise, index, set, setIndex)
    );
    if (statuses.includes('Done') && statuses.includes('Missed')) return 'Partially completed';
    if (log?.completed) return 'Completed';
    if (activity.status === 'COMPLETED_AFTER_WORKOUT') return 'Completed';
    if (activity.status === 'COMPLETED' && !activity.exerciseLogs.length) return 'Completed';
    if (activity.status === 'IN_PROGRESS' && log) return 'In progress';
    return 'Pending';
  }

  exerciseActivityStateLabel(activity: WorkoutActivity, exercise: any, index: number): string {
    const state = this.exerciseActivityState(activity, exercise, index);
    // « En attente » only while the workout can still go on: finished, nothing ticked; past and never logged.
    if (state === 'Pending' && activity.status === 'COMPLETED') return this.translate.instant('EXERCISE_ACTIVITY_UNCHECKED');
    if (state === 'Pending' && activity.status === 'OVERDUE') return this.translate.instant('EXERCISE_ACTIVITY_NOT_LOGGED');
    const key = `EXERCISE_ACTIVITY_${state.toUpperCase().replace(/ /g, '_')}`;
    return this.translate.instant(key);
  }

  exerciseStateIcon(activity: WorkoutActivity, exercise: any, index: number): string {
    switch (this.exerciseActivityState(activity, exercise, index)) {
      case 'Completed': return 'fa-circle-check';
      case 'Partially completed': return 'fa-circle-half-stroke';
      case 'Skipped': return 'fa-circle-minus';
      case 'In progress': return 'fa-circle-play';
      default: return 'fa-clock';
    }
  }

  workoutSetStatus(activity: WorkoutActivity, exercise: any, exerciseIndex: number, set: any, setIndex: number): string {
    const log = this.workoutActivityLog(activity, exercise, exerciseIndex);
    const actual = this.performedSet(log, set, setIndex);
    const status = String(actual?.status || '').toUpperCase();
    if (status === 'MISSED' || actual?.missed === true) return 'Missed';
    if (status === 'COMPLETED' || status === 'DONE' || actual?.completed === true || (actual && status !== 'PENDING')) return 'Done';
    if (activity.status === 'COMPLETED_AFTER_WORKOUT' || (activity.status === 'COMPLETED' && !activity.exerciseLogs.length)) return 'Done';
    if (activity.status === 'MISSED' || log?.skipped) return 'Missed';
    return 'Pending';
  }

  workoutSetStatusLabel(activity: WorkoutActivity, exercise: any, exerciseIndex: number, set: any, setIndex: number): string {
    const status = this.workoutSetStatus(activity, exercise, exerciseIndex, set, setIndex);
    if (status === 'Pending' && activity.status === 'COMPLETED') return this.translate.instant('WORKOUT_SET_STATUS_UNCHECKED');
    if (status === 'Pending' && activity.status === 'OVERDUE') return '—';
    return this.translate.instant(`WORKOUT_SET_STATUS_${status.toUpperCase()}`);
  }

  exerciseSetSummary(activity: WorkoutActivity, exercise: any, index: number): string {
    const sets = exercise?.sets || [];
    const done = sets.filter((set: any, setIndex: number) => this.workoutSetStatus(activity, exercise, index, set, setIndex) === 'Done').length;
    const missed = sets.filter((set: any, setIndex: number) => this.workoutSetStatus(activity, exercise, index, set, setIndex) === 'Missed').length;
    return this.translate.instant('EXERCISE_SET_SUMMARY', { sets: sets.length, done, missed });
  }

  formatActivityDate(date: Date): string {
    return date.toLocaleDateString(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatActivityRest(set: any): string {
    const min = Number(set?.restMin || 0);
    const sec = Number(set?.restSec || 0);
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  private formatActivityWeight(value: any): string {
    const converted = this.coachSettingsService.convertWeightFromKg(value);
    return converted === null ? '—' : this.coachSettingsService.formatNumber(converted);
  }

  workoutSetTypeLabel(type: any): string {
    const value = String(type || 'REGULAR').toUpperCase();
    if (value === 'WARM_UP') return this.translate.instant('SET_TYPE_WARM_UP');
    if (value === 'DROP_SET') return this.translate.instant('SET_TYPE_DROP_SET');
    if (value === 'FAILURE') return this.translate.instant('SET_TYPE_FAILURE');
    return '—';
  }
}
