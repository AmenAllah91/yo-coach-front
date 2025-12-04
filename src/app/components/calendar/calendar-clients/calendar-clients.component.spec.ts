import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarClientsComponent } from './calendar-clients.component';

describe('CalendarClientsComponent', () => {
  let component: CalendarClientsComponent;
  let fixture: ComponentFixture<CalendarClientsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarClientsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CalendarClientsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
