import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BodyMeasurementsComponent } from './body-measurements.component';

describe('BodyMeasurementsComponent', () => {
  let component: BodyMeasurementsComponent;
  let fixture: ComponentFixture<BodyMeasurementsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BodyMeasurementsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BodyMeasurementsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
