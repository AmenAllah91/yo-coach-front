import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutritionClientTabComponent } from './nutrition-client-tab.component';

describe('NutritionClientTabComponent', () => {
  let component: NutritionClientTabComponent;
  let fixture: ComponentFixture<NutritionClientTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NutritionClientTabComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NutritionClientTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
