import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignSelectModalComponent } from './assign-select-modal.component';

describe('AssignSelectModalComponent', () => {
  let component: AssignSelectModalComponent;
  let fixture: ComponentFixture<AssignSelectModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignSelectModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AssignSelectModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
