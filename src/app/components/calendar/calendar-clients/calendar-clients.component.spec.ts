import { SimpleChange } from '@angular/core';
import { of } from 'rxjs';

import { CalendarClientsComponent } from './calendar-clients.component';

describe('CalendarClientsComponent (tab of the client profile)', () => {
  let workoutService: jasmine.SpyObj<any>;
  let nutritionService: jasmine.SpyObj<any>;
  let profileCache: jasmine.SpyObj<any>;
  let settings: any;

  beforeEach(() => {
    workoutService = jasmine.createSpyObj('WorkoutService', ['getWorkoutByCoachIdAndClient']);
    workoutService.getWorkoutByCoachIdAndClient.and.returnValue(of({ content: [] }));
    nutritionService = jasmine.createSpyObj('NutritionService', ['getNutritionPlanByCoachIdAndClient']);
    nutritionService.getNutritionPlanByCoachIdAndClient.and.returnValue(of({ content: [] }));
    // Nothing read yet by the profile dashboard: the calendar loads the plans through the shared cache.
    profileCache = jasmine.createSpyObj('ClientProfileCacheService', ['snapshot', 'isFresh', 'load']);
    profileCache.snapshot.and.returnValue(null);
    profileCache.isFresh.and.returnValue(false);
    profileCache.load.and.returnValue(of([]));
    settings = {
      loadConfig: jasmine.createSpy('loadConfig').and.returnValue(of({})),
      shouldUseWorkoutFiles: () => true,
      shouldUseNutritionFiles: () => true,
    };
  });

  it('loads the client programs once, in place, then again when the client changes', () => {
    const calendar = new CalendarClientsComponent(
      workoutService, nutritionService, {} as any, {} as any, {} as any, settings, {} as any,
      { instant: (k: string) => k, currentLang: 'fr' } as any,
      profileCache,
    );
    calendar.embeddedClientId = 'client-1';
    calendar.embeddedCoachId = 'coach-1';
    calendar.hideClientFilter = true;

    // Angular order: first ngOnChanges, then ngOnInit.
    calendar.ngOnChanges({
      embeddedClientId: new SimpleChange(null, 'client-1', true),
      embeddedCoachId: new SimpleChange(null, 'coach-1', true),
    });
    calendar.ngOnInit();

    expect(profileCache.load).toHaveBeenCalledTimes(2);
    expect(profileCache.load).toHaveBeenCalledWith('workouts', 'coach-1', 'client-1');
    expect(profileCache.load).toHaveBeenCalledWith('nutrition', 'coach-1', 'client-1');
    expect(workoutService.getWorkoutByCoachIdAndClient).not.toHaveBeenCalled();
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).not.toHaveBeenCalled();
    expect(settings.loadConfig).toHaveBeenCalledWith(true);
    expect(calendar.programsLoaded).toBeTrue();

    calendar.embeddedClientId = 'client-2';
    calendar.ngOnChanges({ embeddedClientId: new SimpleChange('client-1', 'client-2', false) });
    expect(profileCache.load).toHaveBeenCalledTimes(4);
    expect(profileCache.load.calls.mostRecent().args[2]).toBe('client-2');
  });
});
