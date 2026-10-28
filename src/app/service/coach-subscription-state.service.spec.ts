import { TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  it('gives null when YoSales does not answer, and asks again a minute later', fakeAsync(() => {
    let state: unknown = 'unset';
    service.getState().subscribe((s) => (state = s));
    http.expectOne(url).flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(state).toBeNull();

    // Not on every screen.
    service.getState().subscribe();
    http.expectNone(url);

    tick(60000);
    service.getState().subscribe();
    http.expectOne(url).flush({ status: 'TRIAL', readOnly: false, brandingAllowed: false });
  }));

  it('back on the window, reads the state again when the last read is over a minute old', () => {
    let now = 1_000_000;
    spyOn(Date, 'now').and.callFake(() => now);
    const statuses: (string | undefined)[] = [];
    service.states$.subscribe((s) => statuses.push(s?.status));
    service.getState().subscribe();
    http.expectOne(url).flush({ status: 'PAST_DUE', readOnly: false, brandingAllowed: true });

    // Under a minute: the answer is reused.
    now += 30000;
    window.dispatchEvent(new Event('focus'));
    http.expectNone(url);

    now += 31000;
    document.dispatchEvent(new Event('visibilitychange'));
    http.expectOne(url).flush({ status: 'ACTIVE', readOnly: false, brandingAllowed: true });
    // Several events in a row: one read.
    window.dispatchEvent(new Event('focus'));
    http.expectNone(url);

    expect(statuses).toEqual(['PAST_DUE', 'ACTIVE']);
  });

  it('never reads the state on window events if no screen asked for it, nor after a 404 (no subscription)', () => {
    let now = 10_000_000;
    spyOn(Date, 'now').and.callFake(() => now);
    window.dispatchEvent(new Event('focus'));
    service.refreshIfStale();
    http.expectNone(url);

    service.getState().subscribe();
    http.expectOne(url).flush('none', { status: 404, statusText: 'Not Found' });
    now += 120000;
    window.dispatchEvent(new Event('focus'));
    http.expectNone(url);
  });
});
