import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { BehaviorSubject, of } from 'rxjs';
import { AllActivitiesComponent } from './all-activities.component';
import { ActivityFeedStateService } from './activity-feed-state.service';
import { CoachDashboardService } from '../../../service/coach-dashboard.service';
import { ClientService } from '../../../service/client.service';
import { ClientActivity } from '../../../models/coach-dashboard.model';
import { ClientProfileCacheService } from '../../../service/client-profile-cache.service';

const row = (id: string): ClientActivity => ({
  id,
  type: 'TASK_COMPLETED',
  category: 'TASKS_HABITS',
  clientId: 'c1',
  clientName: 'Alice',
  occurredAt: '2026-10-20T08:00:00Z',
  dateOnly: false,
  title: 'Walk',
});

describe('AllActivitiesComponent', () => {
  let fixture: ComponentFixture<AllActivitiesComponent>;
  let component: AllActivitiesComponent;
  let dashboard: jasmine.SpyObj<CoachDashboardService>;
  let params: BehaviorSubject<any>;
  let router: Router;

  beforeEach(() => {
    sessionStorage.setItem('userId', 'coach');
    params = new BehaviorSubject(convertToParamMap({ category: 'TASKS_HABITS' }));
    dashboard = jasmine.createSpyObj<CoachDashboardService>('CoachDashboardService', ['getActivities']);
    TestBed.configureTestingModule({
      imports: [AllActivitiesComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [
        provideRouter([]),
        { provide: CoachDashboardService, useValue: dashboard },
        { provide: ClientService, useValue: { getActiveClientsForAssignment: () => of([{ id: 'c1', firstName: 'Alice', lastName: 'M' }]) } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        // The feed opens workout / nutrition details from the cached plans; not used here.
        { provide: ClientProfileCacheService, useValue: {} },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => sessionStorage.removeItem('userId'));

  function create(): void {
    fixture = TestBed.createComponent(AllActivitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('reads the filters from the address and pages 20 by 20 with the cursor', () => {
    dashboard.getActivities.and.returnValues(of({ items: [row('1'), row('2')], nextCursor: 'next' }), of({ items: [row('3')], nextCursor: null }));
    create();
    expect(dashboard.getActivities).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'TASKS_HABITS', cursor: null, limit: 20 }));
    expect(component.items.length).toBe(2);

    component.loadMore();
    expect(dashboard.getActivities).toHaveBeenCalledWith(jasmine.objectContaining({ cursor: 'next' }));
    expect(component.items.map((item) => item.id)).toEqual(['1', '2', '3']);
    expect(component.nextCursor).toBeNull();
  });

  it('puts a filter change in the address', () => {
    dashboard.getActivities.and.returnValue(of({ items: [], nextCursor: null }));
    create();
    component.setClient('c1');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ category: 'TASKS_HABITS', clientId: 'c1' }),
      replaceUrl: true,
    }));
  });

  it('turns a period into dates of the coach calendar', () => {
    params.next(convertToParamMap({ period: '7' }));
    dashboard.getActivities.and.returnValue(of({ items: [], nextCursor: null }));
    create();
    const query = dashboard.getActivities.calls.mostRecent().args[0]!;
    expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(query.to!).getTime() - new Date(query.from!).getTime()).toBe(6 * 86_400_000);
  });

  it('comes back to the same list and scroll position', fakeAsync(() => {
    const state = TestBed.inject(ActivityFeedStateService);
    state.save({ category: 'TASKS_HABITS', clientId: null, period: 'all', from: null, to: null }, [row('1'), row('2')], 'cur', 420);
    const scroll = spyOn(window, 'scrollTo');
    create();
    tick();
    expect(dashboard.getActivities).not.toHaveBeenCalled();
    expect(component.items.length).toBe(2);
    expect(component.nextCursor).toBe('cur');
    expect((scroll as jasmine.Spy).calls.mostRecent().args[0]).toEqual({ top: 420 });
  }));
});
