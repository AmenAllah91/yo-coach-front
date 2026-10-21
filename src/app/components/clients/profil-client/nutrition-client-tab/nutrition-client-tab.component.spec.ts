import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { NutritionClientTabComponent } from './nutrition-client-tab.component';

describe('NutritionClientTabComponent (client profile tab loading)', () => {
  let nutritionService: jasmine.SpyObj<any>;
  let settings: any;
  let fileOption: boolean;

  function open(): NutritionClientTabComponent {
    const tab = TestBed.runInInjectionContext(() =>
      new NutritionClientTabComponent(nutritionService, {} as any, settings, { instant: (k: string) => k } as any));
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

  it('loads the plans once (they were loaded twice), without the full-screen loader', () => {
    const tab = open();

    expect(settings.loadConfig).not.toHaveBeenCalled();
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).toHaveBeenCalledTimes(2); // current + other plans
    nutritionService.getNutritionPlanByCoachIdAndClient.calls.allArgs().forEach((args: any[]) => expect(args[8]).toBeTrue());
    expect(tab.loaded).toBeTrue();
  });

  it('switches to app plans and loads again when files are turned off', () => {
    const tab = open();
    fileOption = false;
    settings.configChanges$.next({});

    expect(tab.activeTab).toBe('APP');
    expect(nutritionService.getNutritionPlanByCoachIdAndClient).toHaveBeenCalledTimes(4);
  });
});
