import { TestBed } from '@angular/core/testing';
import { CheckinCardComponent } from './checkin-card.component';

describe('CheckinCardComponent', () => {
  function render(inputs: Partial<CheckinCardComponent>): HTMLElement {
    const fixture = TestBed.createComponent(CheckinCardComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CheckinCardComponent] }));

  it('shows the date as a tile (weekday, day, month) with the status tone', () => {
    const element = render({ lang: 'en', date: '2026-09-10T09:00:00', title: 'Weekly check-in', status: 'To review', tone: 'warning' });
    expect(element.querySelector('.ci-tile-day')!.textContent!.trim()).toBe('10');
    expect(element.querySelector('.ci-tile')!.textContent).toContain('Thu');
    expect(element.querySelector('.ci-tile')!.textContent).toContain('Sep');
    expect(element.querySelector('.ci-card')!.getAttribute('data-tone')).toBe('warning');
    expect(element.querySelector('.ci-chip')!.textContent!.trim()).toBe('To review');
  });

  it('keeps a placeholder tile without date', () => {
    const element = render({ date: null, title: 'Form' });
    expect(element.querySelector('.ci-tile-day')!.textContent!.trim()).toBe('--');
    expect(element.querySelector('.ci-chip')).toBeNull();
  });
});
