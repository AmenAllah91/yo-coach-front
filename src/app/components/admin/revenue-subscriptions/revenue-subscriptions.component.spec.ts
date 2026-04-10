import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevenueSubscriptionsComponent } from './revenue-subscriptions.component';

describe('RevenueSubscriptionsComponent', () => {
  let component: RevenueSubscriptionsComponent;
  let fixture: ComponentFixture<RevenueSubscriptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevenueSubscriptionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RevenueSubscriptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
