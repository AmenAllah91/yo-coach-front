import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '@env/environment';
import { CoachSubscriptionStateService } from './coach-subscription-state.service';

describe('CoachSubscriptionStateService (SUB-21)', () => {
  const url = `${environment.baseApiUrl}/api/billing/subscription-state`;
  let service: CoachSubscriptionStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CoachSubscriptionStateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the state once per session', () => {
    const seen: (string | null | undefined)[] = [];
    service.getState().subscribe((s) => seen.push(s?.status));
    service.getState().subscribe((s) => seen.push(s?.status));

    http.expectOne(url).flush({ status: 'TRIAL', trialDaysLeft: 9, readOnly: false, brandingAllowed: false });
    service.getState().subscribe((s) => seen.push(s?.status));

    expect(seen).toEqual(['TRIAL', 'TRIAL', 'TRIAL']);
  });

  it('reloads after refresh()', () => {
    service.getState().subscribe();
    http.expectOne(url).flush({ status: 'TRIAL', readOnly: false, brandingAllowed: false });

    let status: string | null | undefined;
    service.refresh().subscribe((s) => (status = s?.status));
    http.expectOne(url).flush({ status: 'ACTIVE', readOnly: false, brandingAllowed: true });

    expect(status).toBe('ACTIVE');
  });

  it('gives null when YoSales does not answer, and retries next time', () => {
    let state: unknown = 'unset';
    service.getState().subscribe((s) => (state = s));
    http.expectOne(url).flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(state).toBeNull();

    service.getState().subscribe();
    http.expectOne(url).flush({ status: 'TRIAL', readOnly: false, brandingAllowed: false });
  });
});
