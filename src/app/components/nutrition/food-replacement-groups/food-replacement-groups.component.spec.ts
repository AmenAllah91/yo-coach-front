import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoodReplacementGroupsComponent } from './food-replacement-groups.component';

describe('FoodReplacementGroupsComponent', () => {
  let component: FoodReplacementGroupsComponent;
  let fixture: ComponentFixture<FoodReplacementGroupsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoodReplacementGroupsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FoodReplacementGroupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
