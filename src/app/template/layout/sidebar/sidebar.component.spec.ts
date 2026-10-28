import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [SidebarComponent]
}).compileComponents();
  }));
  beforeEach(() => {
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('SidebarComponent trial days (SUB-21)', () => {
  const keyOf = (trialDaysLeft: number | null): string =>
    Object.getOwnPropertyDescriptor(SidebarComponent.prototype, 'trialDaysLeftKey')!.get!.call({ trialDaysLeft });

  it('YoSales counts today: 1 is the last day, 0 the end of the trial', () => {
    expect(keyOf(5)).toBe('TRIAL_DAYS_LEFT');
    expect(keyOf(2)).toBe('TRIAL_DAYS_LEFT');
    expect(keyOf(1)).toBe('TRIAL_LAST_DAY');
    expect(keyOf(0)).toBe('COACH_TRIAL_ENDED');
  });
});
