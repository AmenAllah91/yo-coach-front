import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignMacroPlanComponent } from './assign-macro-plan.component';

describe('AssignMacroPlanComponent', () => {
  let component: AssignMacroPlanComponent;
  let fixture: ComponentFixture<AssignMacroPlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignMacroPlanComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AssignMacroPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
