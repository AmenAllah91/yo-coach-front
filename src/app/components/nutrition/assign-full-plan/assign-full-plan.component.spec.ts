import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignFullPlanComponent } from './assign-full-plan.component';

describe('AssignFullPlanComponent', () => {
  let component: AssignFullPlanComponent;
  let fixture: ComponentFixture<AssignFullPlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignFullPlanComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AssignFullPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
