import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { WorkoutsClientTabComponent } from './workouts-client-tab.component';

describe('WorkoutsClientTabComponent (client profile tab loading)', () => {
  let workoutService: jasmine.SpyObj<any>;
  let settings: any;
  let fileOption: boolean;

  function open(): WorkoutsClientTabComponent {
    const tab = TestBed.runInInjectionContext(() =>
      new WorkoutsClientTabComponent(workoutService, {} as any, settings, { instant: (k: string) => k } as any));
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

  it('loads the programs once, right away, without the full-screen loader', () => {
    const tab = open();

    expect(settings.loadConfig).not.toHaveBeenCalled(); // the profile already refreshed the settings
    expect(workoutService.getWorkoutByCoachIdAndClient).toHaveBeenCalledTimes(2); // current + other programs
    workoutService.getWorkoutByCoachIdAndClient.calls.allArgs().forEach((args: any[]) => expect(args[8]).toBeTrue());
    expect(tab.loaded).toBeTrue();
  });

  it('loads again only when the file option changes', () => {
    open();
    settings.configChanges$.next({});
    expect(workoutService.getWorkoutByCoachIdAndClient).toHaveBeenCalledTimes(2);

    fileOption = false;
    settings.configChanges$.next({});
    expect(workoutService.getWorkoutByCoachIdAndClient).toHaveBeenCalledTimes(4);
    expect(workoutService.getWorkoutByCoachIdAndClient.calls.mostRecent().args[4]).toBe('APP');
  });
});
