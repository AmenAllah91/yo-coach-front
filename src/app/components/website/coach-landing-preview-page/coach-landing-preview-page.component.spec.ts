import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoachLandingPreviewPageComponent } from './coach-landing-preview-page.component';

describe('CoachLandingPreviewPageComponent', () => {
  let component: CoachLandingPreviewPageComponent;
  let fixture: ComponentFixture<CoachLandingPreviewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoachLandingPreviewPageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CoachLandingPreviewPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
