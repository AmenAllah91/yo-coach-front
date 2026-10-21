import { SimpleChange } from '@angular/core';
import { of } from 'rxjs';

import { CalendarClientsComponent } from './calendar-clients.component';

describe('CalendarClientsComponent (tab of the client profile)', () => {
  let workoutService: jasmine.SpyObj<any>;
  let nutritionService: jasmine.SpyObj<any>;
  let settings: any;

  beforeEach(() => {
    workoutService = jasmine.createSpyObj('WorkoutService', ['getWorkoutByCoachIdAndClient']);
    workoutService.getWorkoutByCoachIdAndClient.and.returnValue(of({ content: [] }));
    nutritionService = jasmine.createSpyObj('NutritionService', ['getNutritionPlanByCoachIdAndClient']);
    nutritionService.getNutritionPlanByCoachIdAndClient.and.returnValue(of({ content: [] }));
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

    expect(workoutService.getWorkoutByCoachIdAndClient).toHaveBeenCalledTimes(1);
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).toHaveBeenCalledTimes(1);
    expect(workoutService.getWorkoutByCoachIdAndClient.calls.mostRecent().args[8]).toBeTrue();
    expect(nutritionService.getNutritionPlanByCoachIdAndClient.calls.mostRecent().args[8]).toBeTrue();
    expect(settings.loadConfig).toHaveBeenCalledWith(true);
    expect(calendar.programsLoaded).toBeTrue();

    calendar.embeddedClientId = 'client-2';
    calendar.ngOnChanges({ embeddedClientId: new SimpleChange('client-1', 'client-2', false) });
    expect(workoutService.getWorkoutByCoachIdAndClient).toHaveBeenCalledTimes(2);
    expect(workoutService.getWorkoutByCoachIdAndClient.calls.mostRecent().args[1]).toBe('client-2');
  });
});
