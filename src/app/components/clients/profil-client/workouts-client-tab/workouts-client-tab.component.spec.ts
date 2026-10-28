import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { WorkoutsClientTabComponent } from './workouts-client-tab.component';

describe('WorkoutsClientTabComponent (client profile tab loading)', () => {
  let workoutService: jasmine.SpyObj<any>;
  let settings: any;
  let fileOption: boolean;

  function open(): WorkoutsClientTabComponent {
    const tab = TestBed.runInInjectionContext(() =>
      new WorkoutsClientTabComponent(workoutService, {} as any, settings, { instant: (k: string) => k } as any, {} as any, {} as any));
    tab.clientId = 'client-1';
    tab.coachId = 'coach-1';
    tab.ngOnInit();
    return tab;
  }

  beforeEach(() => {
    fileOption = true;
    workoutService = jasmine.createSpyObj('WorkoutService', ['getWorkoutByCoachIdAndClient']);
    workoutService.getWorkoutByCoachIdAndClient.and.returnValue(of({ content: [], totalPages: 1 }));
    settings = {
      configChanges$: new BehaviorSubject({}),
      shouldUseWorkoutFiles: () => fileOption,
      loadConfig: jasmine.createSpy('loadConfig'),
    };
  });

  // The programs list (ClientProgramsComponent) loads the programs itself: the tab only reacts to the coach settings.
  it('does not load the programs itself: the list does, with the settings the profile already refreshed', () => {
    const tab = open();

    expect(settings.loadConfig).not.toHaveBeenCalled();
    expect(workoutService.getWorkoutByCoachIdAndClient).not.toHaveBeenCalled();
    expect(tab.loaded).toBeFalse();
  });

  it('reloads the list only when the file option changes', () => {
    const tab = open();
    const reload = spyOn(tab, 'getWorkOutPlanByCoachAndClient').and.callThrough();

    settings.configChanges$.next({});
    expect(reload).not.toHaveBeenCalled();

    fileOption = false;
    settings.configChanges$.next({});
    expect(reload).toHaveBeenCalledTimes(1);
    expect(tab.loaded).toBeTrue();
  });
});
