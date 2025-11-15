import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateMacroPlanTotalDayComponent } from './create-macro-plan-total-day.component';

describe('CreateMacroPlanTotalDayComponent', () => {
  let component: CreateMacroPlanTotalDayComponent;
  let fixture: ComponentFixture<CreateMacroPlanTotalDayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateMacroPlanTotalDayComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateMacroPlanTotalDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
