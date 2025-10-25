import { TestBed } from '@angular/core/testing';

import { ModalUiStateService } from './modal-ui-state.service';

describe('ModalUiStateService', () => {
  let service: ModalUiStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModalUiStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
