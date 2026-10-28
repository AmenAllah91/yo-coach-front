import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of } from 'rxjs';

import { ClientNutritionComponent } from './client-nutrition.component';

/** « Upcoming » / « Past » of the client's nutrition: by date as the workouts, never by status. */
describe('ClientNutritionComponent upcoming / past', () => {
  let component: any;
  const iso = (offset: number): string => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const meal = { id: 'm1', name: 'Lunch', foods: [{ name: 'Rice', quantity: 100, unit: 'g', calories: 130 }] };
  const day = (id: string, offset: number, status: string, logged = false) => ({
    id, date: iso(offset), dayNumber: 10 + offset, status, dayTargets: { calories: 2000 }, meals: [meal],
    clientMealLogs: logged ? [{ mealId: 'm1', status: 'AS_PLANNED' }] : [],
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientNutritionComponent, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [{
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({})), queryParams: of({}), snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}), queryParams: {} } },
      }],
    }).compileComponents();
    component = TestBed.createComponent(ClientNutritionComponent).componentInstance;
    component.plans = [{
      id: 'p', name: 'Mass',
      mealDays: [
        day('today-started', 0, 'IN_PROGRESS', true),
        day('today', 0, 'PENDING'),
        day('tomorrow', 1, 'PENDING'),
        day('yesterday-never-logged', -1, 'PENDING'),
        day('yesterday-partial', -1, 'IN_PROGRESS', true),
        day('before-yesterday', -2, 'COMPLETED', true),
      ],
    }];
  });

  const ids = (): string[] => component.visibleItems.map((item: any) => item.day.id);
  // The month shown: each day is looked for in its own month (today may be the 1st or the last day).
  const showMonthOf = (offset: number) => {
    const now = new Date();
    component.month = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    component.month = new Date(component.month.getFullYear(), component.month.getMonth(), 1);
  };

  it('keeps today in « Upcoming », first, even once the client started it', () => {
    component.upcoming = true;
    showMonthOf(0);
    expect(ids()).toContain('today-started');
    expect(ids()).toContain('today');
    expect(ids()).not.toContain('yesterday-never-logged');
    expect(['today-started', 'today']).toContain(ids()[0]);
  });

  it('puts every day before today in « Past », whatever its status', () => {
    component.upcoming = false;
    showMonthOf(-1);
    expect(ids()).toContain('yesterday-never-logged');
    expect(ids()).toContain('yesterday-partial');
    expect(ids()).not.toContain('today-started');
  });

  it('says « Not logged » or « Partial » for a past day, never « Planned » or « In progress »', () => {
    const items = component.dayItems;
    const label = (id: string) => component.listStatus(items.find((item: any) => item.day.id === id)).label;
    expect(label('yesterday-never-logged')).toBe('Not logged');
    expect(label('yesterday-partial')).toBe('Partial');
    expect(label('before-yesterday')).toBe('Completed');
    expect(label('today')).toBe('Today');
  });
});
