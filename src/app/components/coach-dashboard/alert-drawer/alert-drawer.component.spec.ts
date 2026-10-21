import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SimpleChange } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of, throwError } from 'rxjs';
import { AlertDrawerComponent } from './alert-drawer.component';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { DashboardAlertItem } from '../../../models/coach-dashboard.model';

describe('AlertDrawerComponent', () => {
  let fixture: ComponentFixture<AlertDrawerComponent>;
  let component: AlertDrawerComponent;
  let dashboard: jasmine.SpyObj<CoachDashboardService>;
  let router: Router;

  const item = (id: string): DashboardAlertItem => ({
    clientId: id,
    clientName: `Client ${id}`,
    programId: `p-${id}`,
    programName: 'Strength',
    programEndDate: '2026-10-10',
    days: 10,
    conversationId: `conv-${id}`,
  });

  function open(type: AlertDrawerComponent['type']): void {
    component.type = type;
    component.ngOnChanges({ type: new SimpleChange(null, type, true) });
    fixture.detectChanges();
  }

  beforeEach(() => {
    dashboard = jasmine.createSpyObj<CoachDashboardService>('CoachDashboardService', ['getAlerts']);
    TestBed.configureTestingModule({
      imports: [AlertDrawerComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([]), { provide: CoachDashboardService, useValue: dashboard }],
    });
    fixture = TestBed.createComponent(AlertDrawerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('loads the category on demand and pages with "Load more"', () => {
    dashboard.getAlerts.and.returnValues(
      of({ items: [item('a'), item('b')], page: 0, size: 20, total: 3 }),
      of({ items: [item('c')], page: 1, size: 20, total: 3 }),
    );
    open('EXPIRED_PROGRAMS');
    expect(dashboard.getAlerts).toHaveBeenCalledWith('EXPIRED_PROGRAMS', 0, 20);
    expect(fixture.nativeElement.querySelectorAll('.drow').length).toBe(2);
    expect(component.hasMore).toBeTrue();

    component.loadMore();
    fixture.detectChanges();
    expect(dashboard.getAlerts).toHaveBeenCalledWith('EXPIRED_PROGRAMS', 1, 20);
    expect(fixture.nativeElement.querySelectorAll('.drow').length).toBe(3);
    expect(component.hasMore).toBeFalse();
  });

  it('shows an error with retry instead of an empty list', () => {
    dashboard.getAlerts.and.returnValue(throwError(() => new Error('down')));
    open('INACTIVE');
    expect(component.status).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('CDASH.WIDGET_ERROR');
  });

  it('starts the profile assignment flow with the client selected, and closes', () => {
    dashboard.getAlerts.and.returnValue(of({ items: [item('a')], page: 0, size: 20, total: 1 }));
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    open('EXPIRED_PROGRAMS');

    component.assignProgram(item('a'));
    expect(router.navigate).toHaveBeenCalledWith(['/clients/profil-client', 'a'], { queryParams: { tab: 'workouts', openAssign: 'workout' } });
    expect(closed).toHaveBeenCalled();

    component.assignNutrition(item('a'));
    expect(router.navigate).toHaveBeenCalledWith(['/clients/profil-client', 'a'], { queryParams: { tab: 'nutrition', openAssign: 'nutrition' } });
  });

  it('opens the existing conversation of an inactive client', () => {
    dashboard.getAlerts.and.returnValue(of({ items: [item('a')], page: 0, size: 20, total: 1 }));
    open('INACTIVE');
    component.message(item('a'));
    expect(router.navigate).toHaveBeenCalledWith(['/chat'], { queryParams: { conversationId: 'conv-a' } });
    component.message({ ...item('b'), conversationId: undefined });
    expect(router.navigate).toHaveBeenCalledWith(['/chat'], { queryParams: { clientId: 'b' } });
  });

  it('opens a check-in in the review page', () => {
    dashboard.getAlerts.and.returnValue(of({ items: [], page: 0, size: 20, total: 0 }));
    open('CHECK_INS_TO_REVIEW');
    component.review({ clientId: 'a', clientName: 'A', assignmentId: 'as1' });
    expect(router.navigate).toHaveBeenCalledWith(['/forms/manage-checkins'], { queryParams: { assignmentId: 'as1' } });
  });
});
