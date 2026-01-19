import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutritionSelectionModalComponent } from './nutrition-selection-modal.component';

describe('NutritionSelectionModalComponent', () => {
  let component: NutritionSelectionModalComponent;
  let fixture: ComponentFixture<NutritionSelectionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NutritionSelectionModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NutritionSelectionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
