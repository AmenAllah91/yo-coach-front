import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of, throwError } from 'rxjs';

import { WorkoutDayService } from 'app/service/workout-day.service';
import { MealplanDayService } from 'app/service/mealplan-day.service';
import { ClientWorkoutsComponent } from '../client-workouts/client-workouts.component';
import { ClientNutritionComponent } from '../client-nutrition/client-nutrition.component';
import { CompletionCelebrationComponent } from './completion-celebration.component';
import { NutritionMacrosSummaryComponent } from './nutrition-macros-summary.component';
import {
  celebrationDuration, nutritionCelebration, nutritionCelebrationMessage, workoutCelebration, workoutCelebrationMessage,
} from './celebration';

const route = {
  provide: ActivatedRoute,
  useValue: {
    paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({})), queryParams: of({}),
    snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}), queryParams: {} },
  },
};
const imports = [HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)];
const day = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
};

describe('celebration texts and figures', () => {
  it('gives the same message to the same day, different ones across days, all short', () => {
    expect(workoutCelebrationMessage('d1', true)).toEqual(workoutCelebrationMessage('d1', true));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => nutritionCelebrationMessage(`day-${i}`, false).headline));
    expect(seen.size).toBeGreaterThan(3);
    for (const fr of [true, false]) {
      for (let i = 0; i < 40; i++) {
        for (const message of [workoutCelebrationMessage(`w${i}`, fr), nutritionCelebrationMessage(`n${i}`, fr)]) {
          expect(message.headline.length).toBeLessThan(60);
          expect(message.body.length).toBeLessThan(140);
        }
      }
    }
  });

  it('picks the same message as the mobile app for the same day', () => {
    // Same hash as Dart (hash * 31 + code unit) & 0x7fffffff.
    expect(workoutCelebrationMessage('day-42', true).headline).toBe('Petites victoires, grands résultats.');
  });

  it('shows a duration only when the workout was timed', () => {
    expect(celebrationDuration(null)).toBeNull();
    expect(celebrationDuration(0)).toBeNull();
    expect(celebrationDuration(45)).toBe('45 s');
    expect(celebrationDuration(42 * 60 + 10)).toBe('42 min');
    expect(celebrationDuration(65 * 60)).toBe('1 h 05');
  });

  it('workout: duration, sets and exercises; logged afterwards has no duration', () => {
    const live = workoutCelebration({ title: 'Day 3 · Legs', durationSeconds: 2520, doneSets: 7, totalSets: 8, doneExercises: 3, totalExercises: 3, seed: 'x' }, false);
    expect(live.title).toBe('Workout Complete!');
    expect(live.stats.map(stat => stat.value)).toEqual(['42 min', '7/8', '3/3']);
    expect(live.ring).toEqual([]);
    const logged = workoutCelebration({ title: 'Jour 3', durationSeconds: null, doneSets: 8, totalSets: 8, doneExercises: 3, totalExercises: 3, seed: 'x' }, true);
    expect(logged.title).toBe('Séance terminée !');
    expect(logged.stats.map(stat => stat.label)).toEqual(['Séries', 'Exercices']);
  });

  it('nutrition: kcal, protein, meals as planned, a ring arc per meal and a legend only when not all as planned', () => {
    const mixed = nutritionCelebration({
      title: 'Prise de masse', date: new Date(2026, 9, 26), meals: ['AS_PLANNED', 'MODIFIED', 'SKIPPED', 'SKIPPED'],
      calories: 2200, protein: 140, targetCalories: 2450, targetProtein: 160, seed: 'n1',
    }, true);
    expect(mixed.title).toBe('Journée terminée !');
    expect(mixed.summarySubtitle).toBe('Lundi 26 octobre');
    expect(mixed.stats.map(stat => stat.label)).toEqual(['kcal', 'Protéines', 'Comme prévu']);
    expect(mixed.stats[2].value).toBe('1/4');
    expect(mixed.ring).toEqual(['#22B573', '#F59E0B', '#CBD5E1', '#CBD5E1']);
    expect(mixed.legend.map(item => item.label)).toEqual(['1 comme prévu', '1 modifié', '2 sautés']);
    const planned = nutritionCelebration({
      title: 'Bulk', date: new Date(2026, 9, 26), meals: ['AS_PLANNED', 'AS_PLANNED'],
      calories: 1200, protein: 70, targetCalories: 2000, targetProtein: 120, seed: 'n2',
    }, false);
    expect(planned.title).toBe('Day Complete!');
    expect(planned.legend).toEqual([]);
    expect(planned.stats[2]).toEqual(jasmine.objectContaining({ value: '2/2', label: 'As planned' }));
  });
});

describe('CompletionCelebrationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CompletionCelebrationComponent] }).compileComponents();
  });

  afterEach(() => (document.body.style.overflow = ''));

  const render = (view: any) => {
    const fixture = TestBed.createComponent(CompletionCelebrationComponent);
    fixture.componentInstance.view = view;
    fixture.detectChanges();
    return fixture;
  };

  it('shows the title, the message, the figures, the legend and one arc per meal', () => {
    const view = nutritionCelebration({
      title: 'Prise de masse', date: new Date(2026, 9, 26), meals: ['AS_PLANNED', 'MODIFIED', 'AS_PLANNED'],
      calories: 2200, protein: 140, targetCalories: 2450, targetProtein: 160, seed: 'n1',
    }, true);
    const fixture = render(view);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(element.querySelector('#cc-title')?.textContent).toContain('Journée terminée !');
    expect(element.textContent).toContain(view.message.headline);
    expect(element.textContent).toContain('Comme prévu');
    expect(element.textContent).toContain('1 modifié');
    expect(element.querySelectorAll('.cc__arc').length).toBe(3);
    expect(element.querySelector('.cc__pulse')).toBeNull();
    // The page behind does not scroll while it is shown.
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('a workout has the fading ring, no arc; « Done » and Escape close it once', () => {
    const fixture = render(workoutCelebration({ title: 'Legs', durationSeconds: 600, doneSets: 3, totalSets: 3, doneExercises: 1, totalExercises: 1, seed: 'w' }, false));
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.cc__pulse')).not.toBeNull();
    expect(element.querySelectorAll('.cc__arc').length).toBe(0);
    let closed = 0;
    fixture.componentInstance.done.subscribe(() => closed++);
    (element.querySelector('.cc__done') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
    fixture.destroy();
  });
});

describe('ClientWorkoutsComponent celebration', () => {
  let component: any;
  let save: jasmine.Spy;

  const open = (offset = 0, extra: any = {}) => {
    const item = {
      plan: { id: 'p1', name: 'Plan', workoutDays: [] },
      day: {
        id: 'd1', dayNumber: 3, title: 'Legs', status: 'PENDING',
        workoutSessions: [{ name: 'Legs', exercises: [{ id: 'e1', name: 'Squat', sets: [{ setNumber: 1, reps: 10 }, { setNumber: 2, reps: 8 }] }] }],
        ...extra,
      },
      date: day(offset),
    };
    component.openDay(item);
  };
  const doAllSets = () => component.runExercises.forEach((run: any) => run.sets.forEach((set: any) => (set.status = 'COMPLETED')));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ClientWorkoutsComponent, ...imports], providers: [route] }).compileComponents();
    component = TestBed.createComponent(ClientWorkoutsComponent).componentInstance;
    save = spyOn(TestBed.inject(WorkoutDayService), 'updateWorkoutDay').and.returnValue(of({}) as any);
  });

  afterEach(() => { component.stopTimer(); document.body.classList.remove('client-workout-detail-open'); });

  it('« Finish workout »: celebrated once the server kept it, « Done » goes back to the program', () => {
    open();
    component.startWorkout();
    component.elapsedSeconds = 2520;
    doAllSets();
    component.finishWorkout();
    expect(save.calls.mostRecent().args[0].status).toBe('COMPLETED');
    expect(component.celebration.title).toBe('Workout Complete!');
    expect(component.celebration.summaryTitle).toBe(component.dayHeaderTitle);
    expect(component.celebration.stats.map((stat: any) => stat.value)).toEqual(['42 min', '2/2', '1/1']);
    // No « Workout saved » under it.
    expect(component.toast).toBeNull();
    component.closeCelebration();
    expect(component.celebration).toBeNull();
    expect(component.item).toBeNull();
  });

  it('« Log completed »: celebrated too, without a duration', () => {
    open(-1);
    component.enterLogCompletedMode();
    doAllSets();
    component.finishWorkout();
    expect(save.calls.mostRecent().args[0].clientCompletionMode).toBe('ALREADY_COMPLETED');
    expect(component.celebration.stats.map((stat: any) => stat.label)).toEqual(['Sets', 'Exercises']);
  });

  it('finished with sets left: celebrated with what was done', () => {
    open();
    component.startWorkout();
    component.runExercises[0].sets[0].status = 'COMPLETED';
    component.finishWorkout();
    expect(component.showFinishSheet).toBeTrue();
    component.confirmFinish();
    expect(component.celebration.stats.find((stat: any) => stat.label === 'Sets').value).toBe('1/2');
  });

  it('refused by the server: no celebration, the reason is shown', () => {
    save.and.returnValue(throwError(() => ({ status: 403, error: { message: 'This workout can no longer be changed' } })));
    open();
    component.startWorkout();
    doAllSets();
    component.finishWorkout();
    expect(component.celebration).toBeNull();
    expect(component.toast?.tone).toBe('error');
  });

  it('a missed workout or a correction is never celebrated', () => {
    open();
    component.startWorkout();
    component.runExercises.forEach((run: any) => run.sets.forEach((set: any) => (set.status = 'MISSED')));
    component.confirmFinish();
    expect(save.calls.mostRecent().args[0].status).toBe('MISSED');
    expect(component.celebration).toBeNull();

    open(-1, { status: 'COMPLETED', clientExerciseLogs: [{ exerciseId: 'e1', displayNumber: '1', sets: [{ setNumber: 1, reps: 10, status: 'COMPLETED' }, { setNumber: 2, reps: 8, status: 'COMPLETED' }] }] });
    component.startEdit();
    component.saveEdit();
    expect(save.calls.mostRecent().args[0].status).toBe('COMPLETED');
    expect(component.celebration).toBeNull();
  });
});

describe('ClientNutritionComponent celebration', () => {
  let component: any;
  let save: jasmine.Spy;

  const open = (meals: any[], logs: any[] = [], targets: any = { calories: 2000, proteinG: 120, carbsG: 220, fatG: 70 }) => {
    component.openDay({
      plan: { id: 'p1', name: 'masse', mealDays: [] },
      day: { id: 'nd7', dayNumber: 7, name: 'prise de masse', status: 'IN_PROGRESS', dayTargets: targets, meals, clientMealLogs: logs },
      date: day(0),
    });
  };
  const meal = (id: string, name: string, calories: number, proteinG: number) =>
    ({ id, name, mealTargets: { calories, proteinG, carbsG: 0, fatG: 0 } });
  const meals = [meal('b', 'Breakfast', 500, 30), meal('l', 'Lunch', 700, 40), meal('d', 'Dinner', 800, 50)];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ClientNutritionComponent, ...imports], providers: [route] }).compileComponents();
    component = TestBed.createComponent(ClientNutritionComponent).componentInstance;
    save = spyOn(TestBed.inject(MealplanDayService), 'updatePlanDay').and.returnValue(of({}) as any);
  });

  afterEach(() => document.body.classList.remove('client-workout-detail-open'));

  it('« Complete day »: celebrated once the server kept it, the meals not reported counted « as planned »', () => {
    open(meals, [{ mealId: 'b', status: 'AS_PLANNED' }, { mealId: 'l', status: 'MODIFIED' }]);
    component.saveDayStatus('COMPLETED');
    expect(save.calls.mostRecent().args[0].status).toBe('COMPLETED');
    const view = component.celebration;
    expect(view.title).toBe('Day Complete!');
    expect(view.summaryTitle).toBe('Prise de masse');
    expect(view.ring.length).toBe(3);
    expect(view.stats.map((stat: any) => stat.value)).toEqual(['2,000', '120 g', '2/3']);
    expect(view.legend.map((item: any) => item.label)).toEqual(['2 as planned', '1 modified']);
    // Back to the list behind it, no « day completed » toast on top.
    expect(component.item).toBeNull();
    expect(component.toast).toBeNull();
    component.closeCelebration();
    expect(component.celebration).toBeNull();
  });

  it('a day with only a total: the total counts as eaten', () => {
    open([]);
    component.saveDayStatus('COMPLETED');
    expect(component.celebration.stats.map((stat: any) => stat.value)).toEqual(['2,000', '120 g']);
  });

  it('off-plan or refused: never celebrated', () => {
    open(meals);
    component.saveDayStatus('OFF_PLAN');
    expect(component.celebration).toBeNull();
    expect(component.toast?.tone).toBe('success');

    save.and.returnValue(throwError(() => ({ status: 403 })));
    open(meals);
    component.saveDayStatus('COMPLETED');
    expect(component.celebration).toBeNull();
    expect(component.item).not.toBeNull();
    expect(component.toast?.tone).toBe('error');
  });
});

describe('NutritionMacrosSummaryComponent', () => {
  it('shows the calories ring and the three macro bars, like the nutrition day', async () => {
    await TestBed.configureTestingModule({ imports: [NutritionMacrosSummaryComponent] }).compileComponents();
    const fixture = TestBed.createComponent(NutritionMacrosSummaryComponent);
    fixture.componentInstance.consumed = { calories: 1200, protein: 70, carbs: 140, fat: 40 };
    fixture.componentInstance.target = { calories: 2000, protein: 120, carbs: 220, fat: 70 };
    fixture.componentInstance.fr = true;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const flat = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
    expect(flat(element.querySelector('.nms__label strong')?.textContent)).toBe(flat(new Intl.NumberFormat('fr-FR').format(1200)));
    expect(flat(element.querySelector('.nms__label small')?.textContent)).toBe(flat(`sur ${new Intl.NumberFormat('fr-FR').format(2000)}`));
    expect(Array.from(element.querySelectorAll('.nms__row')).map(row => row.textContent?.replace(/\s+/g, ' ').trim()))
      .toEqual(['Protéines70 / 120g', 'Glucides140 / 220g', 'Lipides40 / 70g']);
    const widths = Array.from(element.querySelectorAll('.nms__track-bar span')).map(bar => (bar as HTMLElement).style.width);
    expect(parseFloat(widths[0])).toBeCloseTo((70 / 120) * 100, 1);
  });
});
