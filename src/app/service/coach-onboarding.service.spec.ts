import { of } from 'rxjs';

import { CoachOnboardingState } from '../models/coach-onboarding.model';
import { CoachOnboardingService } from './coach-onboarding.service';

const pendingState: CoachOnboardingState = {
  coachId: 'coach-sub',
  currentStep: 'business-goals',
  completedSteps: [],
  completed: false,
  businessName: '',
  businessType: '',
  businessTypeOther: '',
  businessGoals: [],
  businessGoalOther: '',
  clientManagementMethod: '',
  clientManagementOther: '',
  coachingSoftware: '',
  country: '',
  city: '',
  timezone: '',
  language: 'English',
  weightUnit: 'kg',
  distanceUnit: 'km',
  measurementUnit: 'cm',
};

describe('CoachOnboardingService', () => {
  it('loads and caches the current server state', (done) => {
    const http = jasmine.createSpyObj('HttpClient', ['get', 'put']);
    http.get.and.returnValue(of(pendingState));
    const service = new CoachOnboardingService(http);

    service.load().subscribe((state) => {
      expect(state.currentStep).toBe('business-goals');
      expect(service.currentState).toEqual(pendingState);

      service.load().subscribe(() => {
        expect(http.get).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  it('forces a fresh read when requested', (done) => {
    const http = jasmine.createSpyObj('HttpClient', ['get', 'put']);
    http.get.and.returnValue(of(pendingState));
    const service = new CoachOnboardingService(http);

    service.load().subscribe(() => {
      service.load(true).subscribe(() => {
        expect(http.get).toHaveBeenCalledTimes(2);
        done();
      });
    });
  });

  it('saves a step and replaces the cached state', (done) => {
    const http = jasmine.createSpyObj('HttpClient', ['get', 'put']);
    const nextState = {
      ...pendingState,
      currentStep: 'location-timezone' as const,
      completedSteps: ['business-goals' as const],
      businessName: 'Peak Coaching',
    };
    http.put.and.returnValue(of(nextState));
    const service = new CoachOnboardingService(http);

    service.saveStep('business-goals', {
      businessName: 'Peak Coaching',
      businessType: 'ONLINE',
      businessGoals: ['SAVE_TIME'],
      clientManagementMethod: 'SPREADSHEETS',
    }).subscribe((state) => {
      expect(state.currentStep).toBe('location-timezone');
      expect(service.currentState?.businessName).toBe('Peak Coaching');
      done();
    });
  });
});
