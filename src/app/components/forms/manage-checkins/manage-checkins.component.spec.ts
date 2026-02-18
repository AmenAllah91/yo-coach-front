import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageCheckinsComponent } from './manage-checkins.component';

describe('ManageCheckinsComponent', () => {
  let component: ManageCheckinsComponent;
  let fixture: ComponentFixture<ManageCheckinsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageCheckinsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ManageCheckinsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
