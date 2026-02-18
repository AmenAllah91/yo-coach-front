import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyCheckinsComponent } from './my-checkins.component';

describe('MyCheckinsComponent', () => {
  let component: MyCheckinsComponent;
  let fixture: ComponentFixture<MyCheckinsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyCheckinsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MyCheckinsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
