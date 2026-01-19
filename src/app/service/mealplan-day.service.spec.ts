import { TestBed } from '@angular/core/testing';

import { MealplanDayService } from './mealplan-day.service';

describe('MealplanDayService', () => {
  let service: MealplanDayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MealplanDayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
