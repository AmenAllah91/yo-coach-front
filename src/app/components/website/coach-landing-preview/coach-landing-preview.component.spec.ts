import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoachLandingPreviewComponent } from './coach-landing-preview.component';

describe('CoachLandingPreviewComponent', () => {
  let component: CoachLandingPreviewComponent;
  let fixture: ComponentFixture<CoachLandingPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoachLandingPreviewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CoachLandingPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
