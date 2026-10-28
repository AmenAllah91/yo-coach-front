import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of, throwError } from 'rxjs';
import { ClientActivity } from '../../../models/coach-dashboard.model';
import { ClientProfileCacheService } from 'app/service/client-profile-cache.service';
import { ActivityListComponent } from './activity-list.component';

/** A workout or nutrition day opens its detail over the feed, read from the client's plans. */
describe('ActivityListComponent detail', () => {
  let component: ActivityListComponent;
  let cache: jasmine.SpyObj<ClientProfileCacheService>;
  const activity = (partial: Partial<ClientActivity> = {}): ClientActivity => ({
    id: '1', type: 'WORKOUT_COMPLETED', category: 'WORKOUT', clientId: 'c1', clientName: 'Sami', occurredAt: '2026-10-20T08:00:00Z',
    dateOnly: false, refId: 'day1', ...partial,
  });
  const click = (extra: Partial<MouseEvent> = {}) => ({ button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    preventDefault: jasmine.createSpy('preventDefault'), ...extra }) as any;
  const plans = [{
    id: 'plan', name: 'Hypertrophie', startDate: new Date().toISOString(),
    workoutDays: [{ id: 'day1', dayNumber: 1, status: 'COMPLETED', workoutSessions: [{ name: 'Push', exercises: [{ id: 'e1', sets: [{ setNumber: 1 }] }] }] }],
    mealDays: [{ id: 'meal1', dayNumber: 1, meals: [{ id: 'm1' }] }],
  }];

  beforeEach(async () => {
    cache = jasmine.createSpyObj('ClientProfileCacheService', ['isFresh', 'snapshot', 'load']);
    cache.isFresh.and.returnValue(false);
    cache.load.and.returnValue(of(plans));
    await TestBed.configureTestingModule({
      imports: [ActivityListComponent, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [{ provide: ClientProfileCacheService, useValue: cache }],
    }).compileComponents();
    component = TestBed.createComponent(ActivityListComponent).componentInstance;
  });

  afterEach(() => { document.body.style.overflow = ''; });

  function row(item: ClientActivity) {
    component.activities = [item];
    return component.days[0].rows[0];
  }

  it('opens the workout day the activity points to', () => {
    const event = click();
    component.openRow(event, row(activity()));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(cache.load).toHaveBeenCalledWith('workouts', jasmine.any(String), 'c1');
    expect(component.detail?.workout?.id).toBe('day1');
    expect(component.detail?.loading).toBeFalse();
    expect(document.body.style.overflow).toBe('hidden');
    component.closeDetail();
    expect(component.detail).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('opens the nutrition day from plans read in the last minute', () => {
    cache.isFresh.and.returnValue(true);
    cache.snapshot.and.returnValue(plans);
    component.openRow(click(), row(activity({ type: 'NUTRITION_DAY_COMPLETED', category: 'NUTRITION', refId: 'meal1' })));
    expect(cache.load).not.toHaveBeenCalled();
    expect(component.detail?.nutrition?.id).toBe('meal1');
  });

  it('says so when the day is gone or cannot be read', () => {
    component.openRow(click(), row(activity({ refId: 'deleted' })));
    expect(component.detail?.notice).toBe('CDASH.ACTIVITY_DETAIL_NOT_FOUND');
    cache.load.and.returnValue(throwError(() => new Error('down')));
    component.openRow(click(), row(activity()));
    expect(component.detail?.notice).toBe('CDASH.ACTIVITY_DETAIL_ERROR');
  });

  it('keeps the link for Ctrl+click and for the other kinds of activity', () => {
    const ctrl = click({ ctrlKey: true });
    component.openRow(ctrl, row(activity()));
    const checkIn = click();
    component.openRow(checkIn, row(activity({ type: 'CHECK_IN_SUBMITTED', category: 'CHECK_IN', refId: 'as1' })));
    expect(ctrl.preventDefault).not.toHaveBeenCalled();
    expect(checkIn.preventDefault).not.toHaveBeenCalled();
    expect(component.detail).toBeNull();
  });
});
