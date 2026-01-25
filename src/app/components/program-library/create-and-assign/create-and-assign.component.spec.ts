import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateAndAssignComponent } from './create-and-assign.component';

describe('CreateAndAssignComponent', () => {
  let component: CreateAndAssignComponent;
  let fixture: ComponentFixture<CreateAndAssignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAndAssignComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateAndAssignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
