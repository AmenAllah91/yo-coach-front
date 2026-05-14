import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigurationCoachngComponent } from './configuration-coachng.component';

describe('ConfigurationCoachngComponent', () => {
  let component: ConfigurationCoachngComponent;
  let fixture: ComponentFixture<ConfigurationCoachngComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurationCoachngComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ConfigurationCoachngComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
