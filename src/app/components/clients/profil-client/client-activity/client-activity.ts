import { TranslateService } from '@ngx-translate/core';
import { totalMacros } from '@shared/models/nutrition-math';

/**
 * Workout and nutrition days as the coach follows them (profile dashboard, coach dashboard): built from the
 * assigned plans, which already hold the days, sessions, meals and the client logs.
 */

export type WorkoutActivityStatus =
  | 'COMPLETED'
  | 'COMPLETED_AFTER_WORKOUT'
  | 'IN_PROGRESS'
  | 'OVERDUE'
  | 'MISSED'
  | 'NOT_STARTED'
  | 'UPCOMING';

export interface WorkoutActivity {
  id: string;
  planId: string;
  programName: string;
  programDescription: string;
  week: number;
  dayInWeek: number;
  workoutName: string;
  scheduledDate: Date;
  status: WorkoutActivityStatus;
  durationSeconds: number | null;
  completedCount: number;
  skippedCount: number;
  totalExercises: number;
  partialCount: number;
  completedSets: number;
  missedSets: number;
  pendingSets: number;
  totalSets: number;
  overallNote: string;
  missedReason: string;
  exercises: any[];
  exerciseLogs: any[];
}

export type NutritionActivityStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_LOGGED' | 'OFF_PLAN';

export interface NutritionActivity {
  id: string;
  planId: string;
  programName: string;
  week: number;
  dayInWeek: number;
  dayName: string;
  scheduledDate: Date;
  status: NutritionActivityStatus;
  meals: any[];
  mealLogs: any[];
  plannedMeals: number;
  loggedMeals: number;
  asPlannedMeals: number;
  modifiedMeals: number;
  skippedMeals: number;
  hunger: string;
  energy: string;
  digestion: string;
  overallNote: string;
  loggedAt: any;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  photos: Array<{ url: string; label: string; time: string; mealId?: string }>;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function safeDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function resolveProgramDayDate(day: any, planStart: Date | null, index: number): Date | null {
  const explicitDate = safeDate(day?.date);
  if (explicitDate) return explicitDate;
  if (!planStart) return null;

  const dayNumber = Number(day?.dayNumber || index + 1);
  const date = new Date(planStart);
  date.setDate(planStart.getDate() + Math.max(0, dayNumber - 1));
  return startOfDay(date);
}

function firstNutritionNumber(...values: any[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function resolveNutritionMealMacros(meal: any): { calories: number; protein: number; carbs: number; fat: number } {
  const targets = meal?.mealTargets || {};
  const foodTotals = totalMacros(meal?.foods);

  return {
    calories: firstNutritionNumber(meal?.calories, targets?.calories, foodTotals.calories),
    protein: firstNutritionNumber(meal?.protein, targets?.proteinG, foodTotals.protein),
    carbs: firstNutritionNumber(meal?.carbs, targets?.carbsG, foodTotals.carbs),
    fat: firstNutritionNumber(meal?.fat, targets?.fatG, foodTotals.fat),
  };
}

/**
 * The client's log of an exercise, as the calendar reads it (shared/models/calendar-day.ts): by exercise id, else by
 * its number (letter or position), else by position only for an old log that has neither (never another exercise's).
 */
export function findExerciseLog(logs: any[], exercise: any, index: number): any {
  const byPosition = logs[index];
  const letter = String.fromCharCode(65 + index);
  return logs.find((log: any) => !!exercise?.id && log?.exerciseId === exercise.id)
    || logs.find((log: any) =>
      log?.displayNumber === letter || String(log?.displayNumber ?? '') === String(index + 1))
    || (byPosition && !byPosition.exerciseId && byPosition.displayNumber == null ? byPosition : null);
}

/** Every workout day of the plans (rest days and empty days left out), the latest first. */
export function buildWorkoutActivities(plans: any[]): WorkoutActivity[] {
  const today = startOfDay(new Date()).getTime();
  const activities: WorkoutActivity[] = [];

  for (const plan of plans || []) {
    const days = plan?.workoutDays || [];
    const planStart = safeDate(plan?.startDate);
    days.forEach((day: any, index: number) => {
      if (day?.restDay === true) return;
      const scheduledDate = resolveProgramDayDate(day, planStart, index);
      if (!scheduledDate) return;
      const sessions = day?.workoutSessions || [];
      const exercises = sessions.flatMap((session: any) => session?.exercises || []);
      if (!exercises.length) return;

      const logs = day?.clientExerciseLogs || [];
      const skippedCount = logs.filter((log: any) => log?.skipped === true).length;
      // Each exercise counts once: done (logged as completed, or at least one set done), partial among them.
      let completedCount = 0;
      let partialCount = 0;
      let completedSets = 0;
      let missedSets = 0;
      let pendingSets = 0;
      let totalSets = 0;
      exercises.forEach((exercise: any, exerciseIndex: number) => {
        const log = findExerciseLog(logs, exercise, exerciseIndex);
        const plannedSets = exercise?.sets || [];
        totalSets += plannedSets.length;
        let exerciseDone = 0;
        let exerciseMissed = 0;
        plannedSets.forEach((set: any, setIndex: number) => {
          const actual = (log?.sets || []).find((item: any) =>
            Number(item?.setNumber) === Number(set?.setNumber || setIndex + 1)
          );
          const setStatus = String(actual?.status || '').toUpperCase();
          if (setStatus === 'MISSED' || actual?.missed === true) {
            missedSets++;
            exerciseMissed++;
          } else if (setStatus === 'COMPLETED' || setStatus === 'DONE' || actual?.completed === true || (actual && setStatus !== 'PENDING')) {
            completedSets++;
            exerciseDone++;
          } else {
            pendingSets++;
          }
        });
        if (log?.skipped) return;
        if (log?.completed === true || exerciseDone > 0) completedCount++;
        if (exerciseDone > 0 && exerciseMissed > 0) partialCount++;
      });
      const rawStatus = String(day?.status || '').toUpperCase();
      const completionMode = String(day?.clientCompletionMode || '').toUpperCase();
      let status: WorkoutActivityStatus;

      if (rawStatus === 'COMPLETED' && completionMode === 'ALREADY_COMPLETED') {
        status = 'COMPLETED_AFTER_WORKOUT';
      } else if (rawStatus === 'COMPLETED') {
        status = 'COMPLETED';
      } else if (rawStatus === 'MISSED') {
        status = 'MISSED';
      } else if (scheduledDate.getTime() < today) {
        // A workout cannot remain active once its scheduled day has passed.
        // This also turns old pending workouts into items that need resolution.
        status = 'OVERDUE';
      } else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'PAUSED') {
        status = 'IN_PROGRESS';
      } else if (scheduledDate.getTime() > today) {
        status = 'UPCOMING';
      } else {
        status = 'NOT_STARTED';
      }
      if (status === 'COMPLETED_AFTER_WORKOUT') {
        completedCount = Math.max(0, exercises.length - skippedCount);
        completedSets = Math.max(0, totalSets - missedSets);
        pendingSets = 0;
      } else if (status === 'COMPLETED' && !logs.length) {
        completedCount = exercises.length;
        completedSets = totalSets;
        pendingSets = 0;
      } else if (status === 'MISSED') {
        missedSets = totalSets;
        completedSets = 0;
        pendingSets = 0;
      }

      const dayNumber = Number(day?.dayNumber || index + 1);
      activities.push({
        id: day?.id || `${plan?.id || 'plan'}-${dayNumber}`,
        planId: plan?.id || '',
        programName: plan?.name || 'Workout program',
        programDescription: plan?.details || plan?.description || '',
        week: Math.max(1, Math.ceil(dayNumber / 7)),
        dayInWeek: ((dayNumber - 1) % 7) + 1,
        workoutName:
          sessions.find((session: any) => String(session?.name || '').trim())?.name ||
          day?.name ||
          day?.title ||
          day?.dayOfWeek ||
          `Day ${dayNumber}`,
        scheduledDate,
        status,
        durationSeconds: status === 'COMPLETED_AFTER_WORKOUT'
          ? null
          : Number(day?.workoutElapsedSeconds || 0) || null,
        completedCount: Math.min(exercises.length, completedCount),
        skippedCount,
        totalExercises: exercises.length,
        partialCount,
        completedSets,
        missedSets,
        pendingSets,
        totalSets,
        overallNote: day?.overallWorkoutNote || '',
        missedReason: day?.missedReason || day?.statusReason || day?.overallWorkoutNote || '',
        exercises,
        exerciseLogs: logs,
      });
    });
  }

  return activities.sort(
    (a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime()
  );
}

/** Every nutrition day of the plans up to today, the latest first. */
export function buildNutritionActivities(plans: any[]): NutritionActivity[] {
  const today = startOfDay(new Date()).getTime();
  const activities: NutritionActivity[] = [];

  for (const plan of plans || []) {
    const planStart = safeDate(plan?.startDate);
    (plan?.mealDays || []).forEach((day: any, index: number) => {
      const scheduledDate = resolveProgramDayDate(day, planStart, index);
      if (!scheduledDate || scheduledDate.getTime() > today) return;

      const meals = (day?.meals || []).map((meal: any) => {
        const macros = resolveNutritionMealMacros(meal);
        return { ...meal, ...macros };
      });
      const rawMealLogs = day?.clientMealLogs || day?.mealLogs || day?.loggedMeals || [];
      const mealLogs = rawMealLogs.map((log: any, logIndex: number) => {
        const mealId = log?.mealId || meals[logIndex]?.id;
        const photoUrl = log?.photoUrl || log?.imageUrl || '';

        return {
          ...log,
          mealId,
          photoUrl,
        };
      });
      const rawStatus = String(
        day?.nutritionStatus || day?.clientStatus || day?.status || ''
      ).toUpperCase().replace('-', '_');
      const offPlan = rawStatus === 'OFF_PLAN' || rawStatus === 'OFFPLAN' ||
        day?.offPlan === true || day?.followedPlan === false;
      const loggedMeals = mealLogs.filter((log: any) => {
        const logStatus = String(log?.status || log?.completionMode || '').toUpperCase();
        return log?.logged === true ||
          ['AS_PLANNED', 'COMPLETED', 'MODIFIED', 'SKIPPED'].includes(logStatus);
      }).length;
      let status: NutritionActivityStatus;

      if (offPlan) status = 'OFF_PLAN';
      else if (rawStatus === 'COMPLETED') status = 'COMPLETED';
      // A past day whose meals are all reported is done, even if the client did not close it.
      else if (scheduledDate.getTime() < today && meals.length > 0 && loggedMeals >= meals.length) status = 'COMPLETED';
      else if (rawStatus === 'IN_PROGRESS' || loggedMeals > 0) status = 'IN_PROGRESS';
      // Today is not over: nothing reported yet is « en cours », not « non renseigné ».
      else if (scheduledDate.getTime() === today) status = 'IN_PROGRESS';
      else status = 'NOT_LOGGED';

      const asPlannedMeals = mealLogs.filter((log: any) => {
        const value = String(log?.status || log?.completionMode || '').toUpperCase();
        return value === 'AS_PLANNED' || value === 'COMPLETED' || log?.asPlanned === true;
      }).length;
      const modifiedMeals = mealLogs.filter((log: any) => {
        const value = String(log?.status || log?.completionMode || '').toUpperCase();
        return value === 'MODIFIED' || log?.modified === true;
      }).length;
      const skippedMeals = mealLogs.filter((log: any) => {
        const value = String(log?.status || log?.completionMode || '').toUpperCase();
        return value === 'SKIPPED' || log?.skipped === true;
      }).length;
      const mealTotals = meals.reduce((sum: any, meal: any) => ({
        calories: sum.calories + meal.calories,
        protein: sum.protein + meal.protein,
        carbs: sum.carbs + meal.carbs,
        fat: sum.fat + meal.fat,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const dayTargets = day?.dayTargets || {};
      const totals = {
        calories: firstNutritionNumber(dayTargets?.calories, day?.totalCalories, mealTotals.calories),
        protein: firstNutritionNumber(dayTargets?.proteinG, day?.totalProtein, mealTotals.protein),
        carbs: firstNutritionNumber(dayTargets?.carbsG, day?.totalCarbs, mealTotals.carbs),
        fat: firstNutritionNumber(dayTargets?.fatG, day?.totalFat, mealTotals.fat),
      };
      const photos = mealLogs.flatMap((log: any, logIndex: number) => {
        const urls = [log?.photoUrl, log?.imageUrl, ...(log?.photos || [])]
          .map((photo: any) => typeof photo === 'string' ? photo : photo?.url)
          .filter(Boolean);
        const mealIndex = meals.findIndex((meal: any) => meal?.id === log?.mealId);
        return urls.map((url: string) => ({
          url,
          label: log?.mealName || meals[mealIndex >= 0 ? mealIndex : logIndex]?.name || `Meal ${logIndex + 1}`,
          time: log?.loggedAt || log?.createdAt || '',
          mealId: log?.mealId,
        }));
      });
      const dayNumber = Number(day?.dayNumber || index + 1);

      activities.push({
        id: day?.id || `${plan?.id || 'nutrition'}-${dayNumber}`,
        planId: plan?.id || '',
        programName: plan?.name || 'Nutrition plan',
        week: Math.max(1, Math.ceil(dayNumber / 7)),
        dayInWeek: ((dayNumber - 1) % 7) + 1,
        dayName: day?.name || `Day ${dayNumber}`,
        scheduledDate,
        status,
        meals,
        mealLogs,
        plannedMeals: meals.length,
        loggedMeals,
        asPlannedMeals,
        modifiedMeals,
        skippedMeals,
        hunger: day?.hunger ?? day?.dailyFeedback?.hunger ?? '',
        energy: day?.energy ?? day?.dailyFeedback?.energy ?? '',
        digestion: day?.digestion ?? day?.dailyFeedback?.digestion ?? '',
        overallNote: day?.overallNote ?? day?.clientNote ?? day?.dailyFeedback?.note ?? '',
        loggedAt: day?.loggedAt || day?.updatedAt || '',
        totals,
        photos,
      });
    });
  }

  return activities.sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime());
}

/* ---------- Labels shared by the lists and the detail window ---------- */

export function workoutActivityStatusLabel(translate: TranslateService, activity: WorkoutActivity): string {
  const status = activity.status === 'COMPLETED_AFTER_WORKOUT' ? 'COMPLETED'
    : activity.status === 'NOT_STARTED' ? 'UPCOMING'
    : activity.status === 'OVERDUE' ? 'NOT_LOGGED'
    : activity.status;
  return translate.instant(`WORKOUT_ACTIVITY_STATUS_${status}`);
}

export function workoutActivityMode(translate: TranslateService, activity: WorkoutActivity): string {
  if (activity.status === 'COMPLETED_AFTER_WORKOUT') return translate.instant('AFTER_WORKOUT');
  if (activity.status === 'COMPLETED') return translate.instant('LIVE_WORKOUT');
  if (activity.status === 'IN_PROGRESS') return translate.instant('ONGOING');
  if (activity.status === 'OVERDUE') return translate.instant('NO_ACTIVITY');
  if (activity.status === 'MISSED') return translate.instant('WORKOUT_MISSED');
  return translate.instant('NOT_STARTED_LABEL');
}

export function workoutActivityDuration(translate: TranslateService, activity: WorkoutActivity): string {
  if (activity.status === 'COMPLETED_AFTER_WORKOUT' || activity.status === 'MISSED') return translate.instant('NOT_RECORDED');
  if (activity.durationSeconds === null) return '—';
  const minutes = Math.floor(activity.durationSeconds / 60);
  const seconds = activity.durationSeconds % 60;
  return minutes ? `${minutes} min${seconds ? ` ${seconds}s` : ''}` : `${seconds}s`;
}

/** The day's pill: « En cours » only today; a past day with some meals reported is « Partiel ». */
export function nutritionDayStatusLabel(translate: TranslateService, activity: NutritionActivity): string {
  if (activity.status === 'IN_PROGRESS' && activity.scheduledDate.getTime() < startOfDay(new Date()).getTime()) {
    return translate.instant('NUTRITION_ACTIVITY_STATUS_PARTIAL');
  }
  return translate.instant(`NUTRITION_ACTIVITY_STATUS_${activity.status}`);
}
