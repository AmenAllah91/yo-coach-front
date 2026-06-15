import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientWorkoutsComponent } from './client-workouts.component';

describe('ClientWorkoutsComponent', () => {
  let component: ClientWorkoutsComponent;
  let fixture: ComponentFixture<ClientWorkoutsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientWorkoutsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientWorkoutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
