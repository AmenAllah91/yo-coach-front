import { TestBed } from '@angular/core/testing';

import { EventRefreshService } from './event-refresh.service';

describe('EventRefreshService', () => {
  let service: EventRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventRefreshService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
