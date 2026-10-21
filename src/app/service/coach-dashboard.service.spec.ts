import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { CoachDashboardService } from './coach-dashboard.service';

describe('CoachDashboardService', () => {
  let service: CoachDashboardService;
  let http: HttpTestingController;
  const base = `${environment.baseApiUrl}/api/coach/dashboard`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CoachDashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the summary without the full-page loader nor error toast (the widget shows its own state)', () => {
    service.getSummary().subscribe();
    const request = http.expectOne(`${base}/summary`);
    expect(request.request.headers.has('X-Skip-Loader')).toBeTrue();
    expect(request.request.headers.has('X-Skip-Toast')).toBeTrue();
    request.flush({});
  });

  it('pages a "To do" category', () => {
    service.getAlerts('EXPIRED_PROGRAMS', 2, 20).subscribe();
    const request = http.expectOne((req) => req.url === `${base}/alerts/EXPIRED_PROGRAMS`);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({ items: [], page: 2, size: 20, total: 0 });
  });

  it('sends only the activity filters that are set, and the cursor', () => {
    service.getActivities({ category: 'WORKOUT', clientId: null, from: '2026-10-01', cursor: 'abc', limit: 20 }).subscribe();
    const request = http.expectOne((req) => req.url === `${base}/activities`);
    expect(request.request.params.get('category')).toBe('WORKOUT');
    expect(request.request.params.has('clientId')).toBeFalse();
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.has('to')).toBeFalse();
    expect(request.request.params.get('cursor')).toBe('abc');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ items: [], nextCursor: null });
  });

  it('asks the conversations by id', () => {
    service.getConversations(['a', 'b']).subscribe();
    const request = http.expectOne((req) => req.url === `${base}/conversations`);
    expect(request.request.params.getAll('ids')).toEqual(['a', 'b']);
    request.flush([]);
  });

  it('saves the preferences', () => {
    service.savePreferences({ hiddenWidgets: ['MESSAGES'] }).subscribe();
    const request = http.expectOne(`${base}/preferences`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ hiddenWidgets: ['MESSAGES'] });
    request.flush({ hiddenWidgets: ['MESSAGES'] });
  });
});
