import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { HistoryTimelineComponent } from './history-timeline.component';
import { addDays } from './week-strip.component';

@Component({
  standalone: true,
  imports: [HistoryTimelineComponent],
  template: `
    <app-history-timeline [firstDay]="firstDay" [dayTemplate]="day" [fr]="true"></app-history-timeline>
    <ng-template #day let-key="key"><span class="card">{{ key }}</span></ng-template>
  `,
})
class HostComponent {
  firstDay = addDays(new Date(), -200);
}

describe('HistoryTimelineComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let timeline: HistoryTimelineComponent;
  const rows = () => fixture.nativeElement.querySelectorAll('.ht__day').length;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, FeatherModule.pick(allIcons)] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    timeline = fixture.debugElement.children[0].componentInstance;
  });

  it('draws 30 days at first, not the whole history', () => {
    expect(timeline.days.length).toBe(201);
    expect(rows()).toBe(30);
  });

  it('adds 30 days when the bottom of the list comes near', async () => {
    // A tall window: the last of the 30 rows is near its bottom.
    spyOnProperty(window, 'innerHeight').and.returnValue(4000);
    document.dispatchEvent(new Event('scroll'));
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    fixture.detectChanges();
    expect(rows()).toBe(60);
  });

  it('draws the list down to an older day picked in the strip', () => {
    timeline.goTo(addDays(new Date(), -70), false);
    fixture.detectChanges();
    expect(rows()).toBe(90);
    expect(fixture.nativeElement.querySelector('.ht__day.is-selected .card')).not.toBeNull();
  });

  it('never draws more days than the history holds', () => {
    timeline.goTo(addDays(new Date(), -400), false);
    fixture.detectChanges();
    expect(rows()).toBe(201);
    expect(fixture.nativeElement.querySelector('.ht__list--whole')).not.toBeNull();
  });
});
