import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';

import { ProfilClientComponent } from './profil-client.component';
import { buildNutritionActivities, buildWorkoutActivities, findExerciseLog } from './client-activity/client-activity';

/** The dashboard « Activité » sections: statuses, counts, last 7 days and filters, on every kind of day. */
describe('ProfilClientComponent activity', () => {
  let component: any;
  const day = (offset: number): string => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date.toISOString();
  };
  const sets = (count: number) => Array.from({ length: count }, (_, index) => ({ setNumber: index + 1, reps: '10', weight: 20 }));
  const exercises = () => [
    { id: 'e1', name: 'Squat', sets: sets(3) },
    { id: 'e2', name: 'Bench', sets: sets(3) },
    { id: 'e3', name: 'Row', sets: sets(2) },
  ];
  const workoutDay = (offset: number, extra: any = {}) => ({
    id: `w${offset}`,
    date: day(offset),
    dayNumber: 7 + offset,
    workoutSessions: [{ name: 'Push', exercises: exercises() }],
    ...extra,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilClientComponent, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [{
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({})), queryParams: of({}), snapshot: { paramMap: convertToParamMap({}), queryParams: {} } },
      }],
    }).compileComponents();
    component = TestBed.createComponent(ProfilClientComponent).componentInstance;
  });

  afterEach(() => { document.body.style.overflow = ''; });

  function loadWorkouts(): void {
    component.workoutActivities = buildWorkoutActivities([{
      id: 'plan', name: 'Hypertrophie', startDate: day(-6),
      workoutDays: [
        // Done live, one exercise only partly (2 sets of 3), one not logged at all.
        workoutDay(-6, {
          status: 'COMPLETED',
          clientExerciseLogs: [
            { exerciseId: 'e1', completed: true, sets: sets(3).map(set => ({ ...set, status: 'COMPLETED' })) },
            { exerciseId: 'e2', completed: true, sets: [{ setNumber: 1, status: 'COMPLETED' }, { setNumber: 2, status: 'COMPLETED' }, { setNumber: 3, status: 'MISSED' }] },
          ],
        }),
        workoutDay(-5, { status: 'MISSED' }),
        workoutDay(-4),
        workoutDay(-3, { status: 'COMPLETED', clientCompletionMode: 'ALREADY_COMPLETED' }),
        workoutDay(-2, { restDay: true }),
        workoutDay(0, { status: 'IN_PROGRESS', clientExerciseLogs: [{ exerciseId: 'e1', sets: [{ setNumber: 1, status: 'COMPLETED' }] }] }),
        workoutDay(3),
        workoutDay(1),
      ],
    }]);
  }

  it('gives every past workout its real status, the latest first, without future or rest days', () => {
    loadWorkouts();
    const latest = component.latestWorkoutActivities;
    expect(latest.map((activity: any) => activity.status)).toEqual(['IN_PROGRESS', 'COMPLETED_AFTER_WORKOUT', 'OVERDUE', 'MISSED', 'COMPLETED']);
  });

  it('counts an exercise once, done or partly done', () => {
    loadWorkouts();
    const done = component.workoutActivities.find((activity: any) => activity.status === 'COMPLETED');
    expect(done.completedCount).toBe(2);
    expect(done.partialCount).toBe(1);
    expect(done.completedSets).toBe(5);
    expect(done.missedSets).toBe(1);
    const today = component.workoutActivities.find((activity: any) => activity.status === 'IN_PROGRESS');
    expect(today.completedCount).toBe(1);
  });

  it('sums up the last 7 days and opens the matching filter', () => {
    loadWorkouts();
    expect(component.workoutWeekSummary).toEqual({ done: 2, total: 5, missed: 1, notLogged: 1 });
    expect(component.workoutFilterCount('OVERDUE')).toBe(1);
    expect(component.workoutFilterCount('ALL')).toBe(5);
    component.openAllWorkoutActivity('UPCOMING');
    // Upcoming: the next one first.
    expect(component.filteredWorkoutActivities.map((activity: any) => activity.id)).toEqual(['w1', 'w3']);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('never shows « resolve » for a workout the client did not log', () => {
    loadWorkouts();
    const overdue = component.workoutActivities.find((activity: any) => activity.status === 'OVERDUE');
    expect(component.workoutActivityAction(overdue)).toBe('VIEW_WORKOUT');
    expect(component.workoutActivityStatusLabel(overdue)).toBe('WORKOUT_ACTIVITY_STATUS_NOT_LOGGED');
  });

  it('never takes another exercise\'s log by position', () => {
    const log = findExerciseLog([{ exerciseId: 'other', completed: true }], { id: 'e1' }, 0);
    expect(log).toBeNull();
    const old = findExerciseLog([{ completed: true }], { id: 'e1' }, 0);
    expect(old).toEqual({ completed: true });
  });

  it('closes the window on top with Escape and gives the page its scroll back', () => {
    loadWorkouts();
    component.openAllWorkoutActivity();
    component.openWorkoutActivity(component.workoutActivities[0]);
    component.onActivityEscape();
    expect(component.selectedWorkoutActivity).toBeNull();
    expect(component.showAllWorkoutActivity).toBeTrue();
    component.onActivityEscape();
    expect(component.showAllWorkoutActivity).toBeFalse();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps today « in progress » and counts the last 7 nutrition days', () => {
    component.nutritionActivities = buildNutritionActivities([{
      id: 'n', name: 'Mass', startDate: day(-8),
      mealDays: [
        { id: 'n0', date: day(0), dayNumber: 9, meals: [{ id: 'm1' }, { id: 'm2' }] },
        { id: 'n1', date: day(-1), dayNumber: 8, meals: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], clientMealLogs: [{ mealId: 'm1', status: 'AS_PLANNED' }] },
        { id: 'n2', date: day(-2), dayNumber: 7, meals: [{ id: 'm1' }] },
        { id: 'n3', date: day(-3), dayNumber: 6, meals: [{ id: 'm1' }], status: 'COMPLETED' },
        // Every meal reported but the day never closed by the client: done.
        { id: 'n4', date: day(-4), dayNumber: 5, meals: [{ id: 'm1' }], status: 'IN_PROGRESS', clientMealLogs: [{ mealId: 'm1', status: 'MODIFIED' }] },
        { id: 'n8', date: day(-8), dayNumber: 1, meals: [{ id: 'm1' }] },
        { id: 'nf', date: day(1), dayNumber: 10, meals: [{ id: 'm1' }] },
      ],
    }]);
    const statuses = component.nutritionActivities.map((activity: any) => `${activity.id}:${activity.status}`);
    expect(statuses).toEqual(['n0:IN_PROGRESS', 'n1:IN_PROGRESS', 'n2:NOT_LOGGED', 'n3:COMPLETED', 'n4:COMPLETED', 'n8:NOT_LOGGED']);
    // « En cours » only today; yesterday with 1 meal of 3 is « Partiel ».
    expect(component.nutritionDayStatusLabel(component.nutritionActivities[0])).toBe('NUTRITION_ACTIVITY_STATUS_IN_PROGRESS');
    expect(component.nutritionDayStatusLabel(component.nutritionActivities[1])).toBe('NUTRITION_ACTIVITY_STATUS_PARTIAL');
    expect(component.nutritionWeekSummary).toEqual({ logged: 3, total: 4, notLogged: 1 });
    expect(component.latestNutritionActivities.length).toBe(5);
    expect(component.nutritionFilterCount('NOT_LOGGED')).toBe(2);
  });

  it('opens the day a coach dashboard activity points to, once the plans are loaded', () => {
    spyOn(component.router, 'navigate').and.returnValue(Promise.resolve(true));
    component.linkedWorkoutDayId = 'w-6';
    component.linkedNutritionDayId = 'n1';
    component.applyWorkoutPlans([{ id: 'plan', name: 'Hypertrophie', startDate: day(-6), workoutDays: [workoutDay(-6, { status: 'COMPLETED' })] }]);
    expect(component.selectedWorkoutActivity?.id).toBe('w-6');
    // Nutrition not loaded yet: its day waits.
    expect(component.selectedNutritionActivity).toBeNull();
    component.applyNutritionPlans([{ id: 'n', name: 'Mass', startDate: day(-1), mealDays: [{ id: 'n1', date: day(-1), dayNumber: 1, meals: [{ id: 'm1' }] }] }]);
    expect(component.selectedNutritionActivity?.id).toBe('n1');
    expect(component.router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { workoutDayId: null, nutritionDayId: null } }));
  });

  it('stays on the dashboard when the linked day is no longer in the plans', () => {
    spyOn(component.router, 'navigate').and.returnValue(Promise.resolve(true));
    component.linkedWorkoutDayId = 'deleted';
    component.applyWorkoutPlans([]);
    expect(component.selectedWorkoutActivity).toBeNull();
    expect(component.linkedWorkoutDayId).toBeNull();
  });
});
