import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutsClientTabComponent } from './workouts-client-tab.component';

describe('WorkoutsClientTabComponent', () => {
  let component: WorkoutsClientTabComponent;
  let fixture: ComponentFixture<WorkoutsClientTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutsClientTabComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WorkoutsClientTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
