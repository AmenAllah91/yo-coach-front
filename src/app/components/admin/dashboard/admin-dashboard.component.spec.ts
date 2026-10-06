import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';

describe('Admin dashboard flow', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent, HttpClientTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps real user totals on a billing outage and reloads both sources on retry', () => {
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.baseApiUrl}/api/admin/dashboard/users`).flush({ totalCoaches: 42, newCoaches: 3, totalClients: 150, blockedCoaches: 2 });
    http.expectOne(`${environment.baseApiUrl}/api/admin/dashboard/billing`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.users?.totalCoaches).toBe(42);
    expect(fixture.componentInstance.billing).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('42');
    fixture.nativeElement.querySelector('.refresh-btn').click();
    http.expectOne(`${environment.baseApiUrl}/api/admin/dashboard/users`).flush({ totalCoaches: 43, newCoaches: 4, totalClients: 151 });
    http.expectOne(`${environment.baseApiUrl}/api/admin/dashboard/billing`).flush({ trialCoaches: 5, activeSubscriptions: 12, expiredSubscriptions: 2, blockedCoaches: 3, revenues: [], updatedAt: '2026-10-05T12:00:00Z' });
    fixture.detectChanges();
    expect(fixture.componentInstance.billingError).toBeFalse();
    expect(fixture.componentInstance.billing?.activeSubscriptions).toBe(12);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ADMIN_NO_PAYMENTS');
  });
});
