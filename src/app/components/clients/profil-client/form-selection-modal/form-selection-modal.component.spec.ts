import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormSelectionModalComponent } from './form-selection-modal.component';

describe('FormSelectionModalComponent', () => {
  let component: FormSelectionModalComponent;
  let fixture: ComponentFixture<FormSelectionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormSelectionModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormSelectionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
