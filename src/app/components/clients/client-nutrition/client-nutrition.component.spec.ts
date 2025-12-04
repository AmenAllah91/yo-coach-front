import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientNutritionComponent } from './client-nutrition.component';

describe('ClientNutritionComponent', () => {
  let component: ClientNutritionComponent;
  let fixture: ComponentFixture<ClientNutritionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientNutritionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ClientNutritionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
