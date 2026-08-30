import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { SubscriptionOnboardingService } from '../../../service/subscription-onboarding.service';
import { PlansLandingPageComponent } from './plans-landing-page.component';

describe('PlansLandingPageComponent', () => {
  let component: PlansLandingPageComponent;
  let fixture: ComponentFixture<PlansLandingPageComponent>;
  let router: Router;
  let onboardingService: jasmine.SpyObj<SubscriptionOnboardingService>;

  beforeEach(async () => {
    onboardingService = jasmine.createSpyObj<SubscriptionOnboardingService>('SubscriptionOnboardingService', ['getPlans']);
    onboardingService.getPlans.and.returnValue(of([
      {
        id: 12,
        planCode: 'STARTER',
        name: 'Starter',
        description: 'Starter plan',
        price: 49,
        pricingModel: 'FLAT_FEE',
        billingCycle: 'MONTHLY',
        freeTrialDays: 14,
        productId: 8
      }
    ]));

    await TestBed.configureTestingModule({
      imports: [PlansLandingPageComponent, RouterTestingModule],
      providers: [
        { provide: SubscriptionOnboardingService, useValue: onboardingService }
      ]
    })
    .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(PlansLandingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update the selected plan when a plan is selected', () => {
    component.selectPlan(component.plans[0]);

    expect(component.selectedPlanName).toBe('Starter');
    expect(router.navigate).toHaveBeenCalledWith(['/register'], {
      queryParams: { planId: 12 }
    });
  });
});
