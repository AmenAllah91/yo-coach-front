import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { NutritionClientTabComponent } from './nutrition-client-tab.component';

describe('NutritionClientTabComponent (client profile tab loading)', () => {
  let nutritionService: jasmine.SpyObj<any>;
  let settings: any;
  let fileOption: boolean;

  function open(): NutritionClientTabComponent {
    const tab = TestBed.runInInjectionContext(() =>
      new NutritionClientTabComponent(nutritionService, {} as any, settings, { instant: (k: string) => k } as any, {} as any, {} as any));
    tab.clientId = 'client-1';
    tab.coachId = 'coach-1';
    tab.ngOnInit();
    return tab;
  }

  beforeEach(() => {
    fileOption = true;
    nutritionService = jasmine.createSpyObj('NutritionService', ['getNutritionPlanByCoachIdAndClient']);
    nutritionService.getNutritionPlanByCoachIdAndClient.and.returnValue(of({ content: [], totalPages: 0 }));
    settings = {
      configChanges$: new BehaviorSubject({}),
      shouldUseNutritionFiles: () => fileOption,
      loadConfig: jasmine.createSpy('loadConfig'),
    };
  });

  // The plans list (ClientProgramsComponent) loads the plans itself: the tab only reacts to the coach settings.
  it('does not load the plans itself: the list does, with the settings the profile already refreshed', () => {
    const tab = open();

    expect(settings.loadConfig).not.toHaveBeenCalled();
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).not.toHaveBeenCalled();
    expect(tab.loaded).toBeFalse();
  });

  it('switches to app plans and reloads the list when files are turned off', () => {
    const tab = open();
    const reload = spyOn(tab, 'getMealPlanByCoachAndClient').and.callThrough();

    settings.configChanges$.next({});
    expect(reload).not.toHaveBeenCalled();

    fileOption = false;
    settings.configChanges$.next({});
    expect(tab.activeTab).toBe('APP');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(tab.loaded).toBeTrue();
  });
});
