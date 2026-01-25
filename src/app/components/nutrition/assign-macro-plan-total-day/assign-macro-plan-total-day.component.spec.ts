import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignMacroPlanTotalDayComponent } from './assign-macro-plan-total-day.component';

describe('AssignMacroPlanTotalDayComponent', () => {
  let component: AssignMacroPlanTotalDayComponent;
  let fixture: ComponentFixture<AssignMacroPlanTotalDayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignMacroPlanTotalDayComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AssignMacroPlanTotalDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
