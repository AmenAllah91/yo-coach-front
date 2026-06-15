import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutProgramSelectionModalComponent } from './workout-program-selection-modal.component';

describe('WorkoutProgramSelectionModalComponent', () => {
  let component: WorkoutProgramSelectionModalComponent;
  let fixture: ComponentFixture<WorkoutProgramSelectionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutProgramSelectionModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutProgramSelectionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
