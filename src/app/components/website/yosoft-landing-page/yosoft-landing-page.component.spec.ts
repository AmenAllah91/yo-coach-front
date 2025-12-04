import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YosoftLandingPageComponent } from './yosoft-landing-page.component';

describe('YosoftLandingPageComponent', () => {
  let component: YosoftLandingPageComponent;
  let fixture: ComponentFixture<YosoftLandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YosoftLandingPageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(YosoftLandingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
