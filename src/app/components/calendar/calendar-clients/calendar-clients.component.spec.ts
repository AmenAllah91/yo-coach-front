import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { ToastService } from 'app/service/toast.service';
import { ClientTasksService } from 'app/service/client-tasks.service';
import { CalendarClientsComponent } from './calendar-clients.component';

describe('CalendarClientsComponent (tab of the client profile)', () => {
  let workoutService: jasmine.SpyObj<any>;
  let nutritionService: jasmine.SpyObj<any>;
  let schedule: { calendar: jasmine.Spy; changed$: Subject<void> };
  let settings: any;

  beforeEach(() => {
    workoutService = jasmine.createSpyObj('WorkoutService', ['getWorkoutByCoachIdAndClient']);
    nutritionService = jasmine.createSpyObj('NutritionService', ['getNutritionPlanByCoachIdAndClient']);
    schedule = {
      calendar: jasmine.createSpy('calendar').and.callFake((_: string, from: string, to: string) =>
        of({ from, to, workoutPlans: [], mealPlans: [] })),
      changed$: new Subject<void>(),
    };
    settings = {
      loadConfig: jasmine.createSpy('loadConfig').and.returnValue(of({})),
      shouldUseWorkoutFiles: () => true,
      shouldUseNutritionFiles: () => true,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ProgramScheduleService, useValue: schedule },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'warning', 'info']) },
        { provide: ClientTasksService, useValue: { calendar: () => of({ items: [], summary: {} }) } },
      ],
    });
  });

  it('reads the month on the screen, then the months around, and again for another client (calendar lot B)', () => {
    const calendar = TestBed.runInInjectionContext(() => new CalendarClientsComponent(
      workoutService, nutritionService, {} as any, {} as any, settings,
      { instant: (k: string) => k, currentLang: 'fr' } as any,
      jasmine.createSpyObj('ClientProfileCacheService', ['forget']),
    ));
    calendar.embeddedClientId = 'client-1';
    calendar.embeddedCoachId = 'coach-1';
    calendar.hideClientFilter = true;
    calendar.currentDate = new Date(2026, 10, 15);
    calendar.currentView = 'month';

    // Angular order: first ngOnChanges, then ngOnInit.
    calendar.ngOnChanges({
      embeddedClientId: new SimpleChange(null, 'client-1', true),
      embeddedCoachId: new SimpleChange(null, 'coach-1', true),
    });
    calendar.ngOnInit();

    const asked = () => schedule.calendar.calls.allArgs().map((args) => args.join(' '));
    expect(asked()).toEqual([
      'client-1 2026-11-01 2026-11-30',
      'client-1 2026-10-01 2026-10-31',
      'client-1 2026-12-01 2026-12-31',
    ]);
    // Never all the client's programs any more.
    expect(workoutService.getWorkoutByCoachIdAndClient).not.toHaveBeenCalled();
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).not.toHaveBeenCalled();
    expect(settings.loadConfig).toHaveBeenCalledWith(true);
    expect(calendar.programsLoaded).toBeTrue();

    // A month already read shows at once: going to December reads only January.
    schedule.calendar.calls.reset();
    calendar.goNext();
    expect(asked()).toEqual(['client-1 2027-01-01 2027-01-31']);

    calendar.embeddedClientId = 'client-2';
    calendar.ngOnChanges({ embeddedClientId: new SimpleChange('client-1', 'client-2', false) });
    expect(schedule.calendar.calls.mostRecent().args[0]).toBe('client-2');
  });
});
