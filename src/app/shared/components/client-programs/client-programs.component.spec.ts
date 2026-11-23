import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { ClientProgramsComponent } from './client-programs.component';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { CoachSubscriptionStateService } from 'app/service/coach-subscription-state.service';
import { ToastService } from 'app/service/toast.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OverviewDay, OverviewItem, ProgramOverview } from '@shared/models/program-schedule';

/** The week of the « Programmes » tab: the arrows, the « + » of an empty day, choosing a day, the empty days line. */
describe('ClientProgramsComponent (the week)', () => {
  const TODAY = '2026-11-23';
  const schedule = {
    changed$: new Subject<void>(),
    overview: jasmine.createSpy('overview'),
    overviewSnapshot: () => null,
    swapDays: jasmine.createSpy('swapDays').and.returnValue(of({ undoId: 'u1', restedDayId: null })),
    copyDays: jasmine.createSpy('copyDays').and.returnValue(of({ copied: [4], skipped: [], undoId: 'u2' })),
    restDays: jasmine.createSpy('restDays').and.returnValue(of({ rested: [5, 6], skipped: [], undoId: 'u3' })),
    announceCalendarChange: jasmine.createSpy('announceCalendarChange'),
  };

  function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** Week 2 of 3 from TODAY - 7: Mon rest (past? no: today), Wed planned, Thu..Sun empty. */
  function overview(withWeeks = true): ProgramOverview {
    const start = addDays(TODAY, -7);
    const program: OverviewItem = {
      id: 'P', name: 'PRG-30 test', startDate: start, endDate: addDays(start, 20), stoppedAt: null, file: false,
      fileKind: null, totalDays: 21, readyDays: 10, doneDays: 0, weeks: 3, status: 'CURRENT',
    } as unknown as OverviewItem;
    const week = (w: number): OverviewDay[] => Array.from({ length: 7 }, (_, i) => {
      const n = (w - 1) * 7 + i + 1;
      const date = addDays(start, n - 1);
      const state = w === 1 ? 'MISSED' : w === 2 ? (i === 0 || i === 1 ? 'REST' : i === 2 ? 'PLANNED' : 'EMPTY') : 'PLANNED';
      return { date, dayNumber: n, state, today: date === TODAY, title: 'Workout', items: 1, dayId: `d${n}` } as unknown as OverviewDay;
    });
    const allWeeks = [week(1), week(2), week(3)];
    return {
      type: 'WORKOUT', today: TODAY, lastActivity: null,
      current: { program, week: 2, weeks: 3, doneThisWeek: 0, plannedThisWeek: 1, days: allWeeks[1], allWeeks: withWeeks ? allWeeks : null },
      next: null,
      alerts: [{ kind: 'EMPTY_DAYS', from: addDays(TODAY, 3), to: null, programId: 'P', otherProgramId: null, dayNumber: 11, count: 4 }],
      upcoming: [], finished: [], upcomingCount: 0, finishedCount: 0,
    } as unknown as ProgramOverview;
  }

  function create(withWeeks = true) {
    schedule.overview.and.returnValue(of(overview(withWeeks)));
    const fixture = TestBed.createComponent(ClientProgramsComponent);
    fixture.componentInstance.clientId = 'client-1';
    fixture.componentInstance.ngOnChanges({ clientId: { firstChange: true } as never });
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    Object.values(schedule).forEach(value => (value as jasmine.Spy).calls?.reset?.());
    TestBed.configureTestingModule({
      imports: [ClientProgramsComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [
        { provide: ProgramScheduleService, useValue: schedule },
        { provide: CoachSubscriptionStateService, useValue: { states$: of(null), getState: () => of(null) } },
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
        { provide: WorkoutService, useValue: workouts },
        { provide: NutritionService, useValue: { getNutritionPlanById: () => of({ id: 'P', mealDays: [] }) } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  /** The program as the editor reads it: day 10 (Wednesday) and day 1 (a past Monday) have a workout. */
  const workouts = {
    getWorkoutById: jasmine.createSpy('getWorkoutById').and.callFake(() => {
      const start = addDays(TODAY, -7);
      const day = (n: number) => ({
        id: `d${n}`, dayNumber: n, date: addDays(start, n - 1),
        workoutSessions: [{ name: 'Push', exercises: [{ name: 'Squat', sets: [{ setNumber: 1, reps: 10, weight: 40 }] }] }],
      });
      return of({ id: 'P', name: 'PRG-30 test', startDate: start, workoutDays: [day(1), day(10)] });
    }),
  };

  it('a workout day to come opens its window in the editor (as in the editor calendar), an empty one too', () => {
    const { component } = create();
    const item = component.overview!.current!.program;
    const emitted: unknown[] = [];
    component.action.subscribe(action => emitted.push(action));
    component.onDay(component.weekDays[2], item, new Event('click'));
    expect(component.preview).toBeNull();
    component.onDay(component.weekDays[3], item, new Event('click')); // empty day: no menu any more, its window
    expect(component.dayMenu).toBeNull();
    expect(emitted).toEqual([
      jasmine.objectContaining({ type: 'edit', dayNumber: 10, open: true }),
      jasmine.objectContaining({ type: 'edit', dayNumber: 11, open: true }),
    ]);
  });

  it('a past workout day opens its window too (it shows what the client did), the same rule everywhere', () => {
    const { component } = create();
    const item = component.overview!.current!.program;
    const emitted: unknown[] = [];
    component.action.subscribe(action => emitted.push(action));
    component.goToWeek(1);
    component.onDay(component.weekDays[0], item, new Event('click'));
    expect(component.preview).toBeNull();
    expect(emitted).toEqual([jasmine.objectContaining({ type: 'edit', dayNumber: 1, open: true })]);
  });

  it('the day preview (nutrition report…) shows planned and done, without « Modifier »; Escape closes it', () => {
    const { component, fixture } = create();
    const item = component.overview!.current!.program;
    component.goToWeek(1);
    component.openPreview(component.weekDays[0], item);
    fixture.detectChanges();
    expect(workouts.getWorkoutById).toHaveBeenCalledWith('P', true);
    expect(component.preview?.workout?.id).toBe('d1');
    expect(component.preview?.edit).toBeNull();
    component.cancelPick();
    expect(component.preview).toBeNull();
  });

  it('« Envoyer un message » from the window goes to the profile', () => {
    const { component } = create();
    const emitted: unknown[] = [];
    component.action.subscribe(action => emitted.push(action));
    component.goToWeek(1);
    component.openPreview(component.weekDays[0], component.overview!.current!.program);
    component.messageFromPreview();
    expect(emitted).toEqual([{ type: 'message' }]);
  });

  it('browses the weeks with the arrows and comes back to this week', () => {
    const { component, element, fixture } = create();
    expect(component.shownWeekNumber).toBe(2);
    expect(element.querySelectorAll('.cp-weeknav button').length).toBe(2);
    component.goToWeek(3);
    fixture.detectChanges();
    expect(component.weekDays[0].dayNumber).toBe(15);
    expect(element.querySelector('.cp-weeknav-back')).not.toBeNull();
    component.goToWeek(2);
    expect(component.shownWeek).toBeNull();
  });

  it('an older server (one week only): no arrows, no quick changes', () => {
    const { component, element } = create(false);
    expect(element.querySelector('.cp-weeknav')).toBeNull();
    expect(component.quickEdit).toBeFalse();
    expect(element.querySelectorAll('.cp-day-plus').length).toBe(4); // the « + » still says « click to fill »
  });

  it('shows a « + » on the empty days to come and the line for them, not the alert', () => {
    const { component, element } = create();
    expect(element.querySelectorAll('.cp-day-plus').length).toBe(4);
    expect(component.emptyComingDays.length).toBe(4);
    expect(element.querySelector('.cp-emptyline')).not.toBeNull();
    expect(component.alerts.length).toBe(0);
  });

  it('rests every empty day of the week at once', () => {
    const { component } = create();
    component.restDays(component.emptyComingDays, component.overview!.current!.program);
    expect(schedule.restDays).toHaveBeenCalledWith('P', [11, 12, 13, 14]);
    expect(schedule.announceCalendarChange).toHaveBeenCalled();
  });

  it('moves a workout: only days to come not done can be chosen, then the swap is saved', () => {
    const { component } = create();
    const item = component.overview!.current!.program;
    const wednesday = component.weekDays[2];
    const thursday = component.weekDays[3];
    component.startPick('MOVE', wednesday, item);
    expect(component.isPickTarget(wednesday)).toBeFalse();
    expect(component.isPickTarget(thursday)).toBeTrue();
    component.goToWeek(1);
    expect(component.isPickTarget(component.weekDays[0])).toBeFalse(); // past
    component.goToWeek(2);
    component.onDay(thursday, item, new Event('click'));
    expect(schedule.swapDays).toHaveBeenCalledWith('P', 'd10', 'd11');
    expect(component.pick).toBeNull();
  });

  it('copies another day onto an empty one (even a past day of an earlier week)', () => {
    const { component } = create();
    const item = component.overview!.current!.program;
    const thursday = component.weekDays[3];
    component.startPick('COPY_FROM', thursday, item);
    component.goToWeek(1);
    const pastMonday = component.weekDays[0];
    expect(component.isPickTarget(pastMonday)).toBeTrue();
    component.onDay(pastMonday, item, new Event('click'));
    expect(schedule.copyDays).toHaveBeenCalledWith('P', [{ from: 1, to: 11 }]);
  });
});
