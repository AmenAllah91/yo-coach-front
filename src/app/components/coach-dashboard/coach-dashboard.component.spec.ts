import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterLink, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { CoachDashboardComponent } from './coach-dashboard.component';
import { CoachDashboardService } from '../../service/coach-dashboard.service';
import { CoachSettingsService } from '../../service/coach-settings.service';
import { ChatUnreadService } from '../../service/chat-unread.service';
import { WidgetStateComponent } from './shared/widget-state.component';
import { DashboardSummary } from '../../models/coach-dashboard.model';

function summary(partial: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    coachFirstName: 'Sami',
    today: '2026-10-20',
    activeClients: { count: 12, limit: 20, newLast30Days: 3 },
    clientsToWatch: { count: 4, noProgram: 1, expiredPrograms: 2, inactive: 1, overdueCheckIns: 1 },
    checkIns: { toReview: 2, overdue: 1 },
    todoClients: 9,
    alerts: { EXPIRED_PROGRAMS: 2, NO_PROGRAM: 1, CHECK_INS_TO_REVIEW: 2, ENDING_SOON: 0, INACTIVE: 1, NO_NUTRITION: 5, CHECK_INS_OVERDUE: 1 },
    preferences: { hiddenWidgets: [] },
    ...partial,
  };
}

describe('CoachDashboardComponent', () => {
  let fixture: ComponentFixture<CoachDashboardComponent>;
  let component: CoachDashboardComponent;
  let dashboard: jasmine.SpyObj<CoachDashboardService>;
  const unreadCounts = new BehaviorSubject(new Map<string, number>([['conv1', 2], ['conv2', 1], ['conv3', 0]]));
  const synced = new BehaviorSubject<boolean | null>(true);

  function create(result: DashboardSummary | 'error'): void {
    dashboard.getSummary.and.returnValue(result === 'error' ? throwError(() => new Error('down')) : of(result));
    fixture = TestBed.createComponent(CoachDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(() => {
    dashboard = jasmine.createSpyObj<CoachDashboardService>('CoachDashboardService', ['getSummary', 'savePreferences']);
    TestBed.configureTestingModule({
      imports: [CoachDashboardComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [
        provideRouter([]),
        { provide: CoachDashboardService, useValue: dashboard },
        {
          provide: CoachSettingsService,
          useValue: {
            loadConfig: () => of({}),
            getConfig: () => ({ quickActions: { assignAfterNutrition: true, assignAfterWorkout: true, assignAfterCheckIn: true } }),
          },
        },
        { provide: ChatUnreadService, useValue: { unreadCounts$: unreadCounts, synced$: synced, refresh: jasmine.createSpy('refresh') } },
      ],
    });
    // Shallow: the self-loading widgets and the modals have their own tests.
    TestBed.overrideComponent(CoachDashboardComponent, {
      set: { imports: [CommonModule, RouterLink, TranslateModule, FeatherModule, WidgetStateComponent], schemas: [NO_ERRORS_SCHEMA] },
    });
  });

  it('shows the KPIs and the "To do" counters of the summary', () => {
    create(summary());
    expect(text()).toContain('CDASH.WELCOME');
    expect(fixture.nativeElement.querySelectorAll('.kpi').length).toBe(4);
    const counts = Array.from(fixture.nativeElement.querySelectorAll('.todo-count')).map((el: any) => el.textContent.trim());
    expect(counts).toEqual(['2', '1', '2', '0', '1', '5']);
    expect(component.checkInsPending).toBe(3);
    expect(component.watchDetail).toEqual({ key: 'CDASH.KPI.W_EXPIRED', count: 2 });
    expect(component.unreadConversations).toBe(2);
    expect(component.unreadMessages).toBe(3);
  });

  it('keeps the other widgets when the summary fails, and retries', () => {
    create('error');
    expect(component.summaryStatus).toBe('error');
    expect(text()).toContain('CDASH.UNAVAILABLE');
    expect(fixture.nativeElement.querySelector('app-checkins-widget')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-messages-widget')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-recent-activities')).not.toBeNull();

    dashboard.getSummary.and.returnValue(of(summary()));
    component.loadSummary();
    fixture.detectChanges();
    expect(component.summaryStatus).toBe('ready');
  });

  it('hides the widgets and alert categories chosen by the coach', () => {
    create(summary({ preferences: { hiddenWidgets: ['MESSAGES', 'ALERT_NO_NUTRITION'] } }));
    expect(fixture.nativeElement.querySelector('app-messages-widget')).toBeNull();
    expect(component.visibleAlertTypes).not.toContain('NO_NUTRITION');
    expect(fixture.nativeElement.querySelectorAll('.todo-item').length).toBe(5);
  });

  it('saves a preference and restores the previous one when the save fails', () => {
    create(summary());
    dashboard.savePreferences.and.returnValue(of({ hiddenWidgets: ['ACTIVITIES'] }));
    component.toggleWidget('ACTIVITIES');
    expect(dashboard.savePreferences).toHaveBeenCalledWith({ hiddenWidgets: ['ACTIVITIES'] });
    expect(component.isVisible('ACTIVITIES')).toBeFalse();

    dashboard.savePreferences.and.returnValue(throwError(() => new Error('down')));
    component.toggleWidget('ACTIVITIES');
    expect(component.isVisible('ACTIVITIES')).toBeFalse();
    expect(component.preferencesError).toBeTrue();
  });

  it('opens the drawer of a category, and the late check-ins when none is waiting for review', () => {
    create(summary());
    fixture.nativeElement.querySelector('.todo-item').click();
    expect(component.drawerType).toBe('EXPIRED_PROGRAMS');
    component.closeDrawer();

    component.summary = summary({ checkIns: { toReview: 0, overdue: 3 } });
    component.openCheckIns();
    expect(component.drawerType).toBe('CHECK_INS_OVERDUE');
  });
});
