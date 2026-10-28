import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of } from 'rxjs';

import { ClientWorkoutsComponent } from './client-workouts.component';

/** The client's workout page: the coach's plan stays visible, what the client did is entered next to it. */
describe('ClientWorkoutsComponent planned vs done', () => {
  let component: any;
  const day = (offset: number): Date => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  };
  const workoutDay = (extra: any = {}) => ({
    id: 'd1',
    dayNumber: 1,
    status: 'PENDING',
    workoutSessions: [{
      name: 'Push',
      exercises: [
        // A pyramid without weights (the coach's editor saves 0 when the field is left empty).
        { id: 'e1', name: 'Squat', sets: [{ setNumber: 1, reps: 12, weight: 0 }, { setNumber: 2, reps: 10, weight: 0 }, { setNumber: 3, reps: 8, weight: 0 }] },
        { id: 'e2', name: 'Bench', sets: [{ setNumber: 1, reps: 10, weight: 20 }, { setNumber: 2, reps: 10, weight: 22.5 }] },
        { id: 'e3', name: 'Run', type: 'CARDIO', duration: 30, sets: [{ setNumber: 1 }] },
        { id: 'e4', name: 'Bike', type: 'CARDIO', sets: [{ setNumber: 1 }, { setNumber: 2 }] },
        { id: 'e5', name: 'Warm-up stretch', sets: [{ setNumber: 1, reps: 10 }] },
      ],
    }],
    ...extra,
  });
  const open = (offset = 0, extra: any = {}) => {
    const item = { plan: { id: 'p1', name: 'Plan', workoutDays: [] }, day: workoutDay(extra), date: day(offset) };
    component.openDay(item);
    return component.runExercises;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientWorkoutsComponent, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [{
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({})), queryParams: of({}), snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}), queryParams: {} } },
      }],
    }).compileComponents();
    component = TestBed.createComponent(ClientWorkoutsComponent).componentInstance;
  });

  afterEach(() => document.body.classList.remove('client-workout-detail-open'));

  it('shows the plan: every set counts, a weight of 0 is « not set », a cardio without duration is « — »', () => {
    const runs = open();
    expect(component.exerciseVolume(runs[0].exercise)).toBe('3 sets · 12–8 reps');
    expect(component.exerciseVolume(runs[1].exercise)).toBe('2 sets · 10 reps · 20–22.5 kg');
    expect(component.plannedText(runs[0], 0)).toBe('12 reps');
    expect(component.plannedText(runs[1], 1)).toBe('10 reps · 22.5 kg');
    expect(component.plannedText(runs[2], 0)).toBe('30 min');
    expect(component.plannedText(runs[3], 0)).toBe('—');
    expect(component.exerciseVolume(runs[2].exercise)).toBe('30 min');
    // Never pre-filled with 0: the client types a weight only if they used one.
    expect(runs[0].sets[0].weight).toBeNull();
    expect(runs[1].sets[1].weight).toBe(22.5);
    expect(runs[2].sets[0].duration).toBe(30);
  });

  it('keeps what the client did apart from the plan, and says when it differs', () => {
    const runs = open();
    component.startWorkout();
    component.onAmountInput(runs[0], runs[0].sets[0], '10');
    component.onWeightInput(runs[0].sets[0], '22,5');
    expect(runs[0].sets[0].reps).toBe(10);
    expect(runs[0].sets[0].weight).toBe(22.5);
    expect(component.changed(runs[0], 0, 'amount')).toBeTrue();
    expect(component.changed(runs[0], 0, 'weight')).toBeTrue();
    expect(component.changed(runs[0], 1, 'amount')).toBeFalse();
    expect(component.plannedText(runs[0], 0)).toBe('12 reps');
    expect(component.doneText(runs[0], runs[0].sets[0])).toBe('10 reps · 22.5 kg');
    expect(component.payload('COMPLETED', false).clientExerciseLogs[0].sets[0]).toEqual(jasmine.objectContaining({ reps: 10, weight: 22.5 }));
    component.stopTimer();
  });

  it('never takes the log of another exercise', () => {
    const runs = open(-1, {
      status: 'COMPLETED',
      clientExerciseLogs: [{ exerciseId: 'other', displayNumber: '1', sets: [{ setNumber: 1, reps: 99, status: 'COMPLETED' }] }],
    });
    expect(runs[0].sets[0].reps).toBe(12);
    expect(runs[0].sets[0].status).toBe('PENDING');
  });

  it('shows the sets of an exercise named « warm-up » like the others', () => {
    const runs = open();
    expect(component.isWarmup(runs[4])).toBeFalse();
  });

  it('« Log completed » sends nothing before « Save » (no live workout with a running timer)', () => {
    const runs = open(-1);
    expect(component.runStatus).toBe('OVERDUE');
    component.enterLogCompletedMode();
    component.onAmountInput(runs[0], runs[0].sets[0], '9');
    expect(component.hasPendingDraft).toBeFalse();
    component.cancelLog();
    expect(component.runStatus).toBe('OVERDUE');
    expect(component.runExercises[0].sets[0].reps).toBe(12);
  });

  it('cannot start a later workout from the exercise page', () => {
    open(1);
    expect(component.showStartFromExercise).toBeFalse();
    open(0);
    expect(component.showStartFromExercise).toBeTrue();
  });

  it('correcting a missed workout keeps its timed duration', () => {
    open(-1, { status: 'MISSED', workoutElapsedSeconds: 900 });
    component.startEdit();
    component.runExercises.forEach((run: any) => run.sets.forEach((set: any) => (set.status = 'COMPLETED')));
    const update = spyOn(component, 'updateStatus');
    component.saveEdit();
    expect(update).toHaveBeenCalledWith('COMPLETED', false);
  });
});
