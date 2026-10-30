import { TestBed } from '@angular/core/testing';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';

import { CoachFeedbackCardComponent } from 'app/components/forms/coach-feedback-card/coach-feedback-card.component';
import { FormAssignment } from 'app/components/forms/services/assignments-api.service';
import { CheckinDelta, checkinCelebration, checkinDeltaLine, checkinInsightLines } from './celebration';

const weight: CheckinDelta = {
  questionId: 'w', label: 'Poids', kind: 'NUMBER', current: 78.4, previous: 79.2, previousAt: '2026-10-16T09:00:00Z',
};

describe('Check-in insights (CI-03, CI-04)', () => {
  it('writes a change with its sign and the previous date', () => {
    expect(checkinDeltaLine(weight, true)).toBe('Poids : 78,4 (−0,8 depuis le 16 oct.)');
    expect(checkinDeltaLine({ ...weight, label: 'Énergie', kind: 'RATING', current: 4, previous: 3, maxStars: 5 }, false))
      .toBe('Énergie : 4/5 (+1 since 16 Oct)');
    expect(checkinDeltaLine({ ...weight, current: 80, previous: 80 }, true)).toBe('Poids : 80 (stable depuis le 16 oct.)');
  });

  it('shows nothing without values and the streak from two in a row', () => {
    expect(checkinInsightLines(null, true)).toEqual([]);
    expect(checkinInsightLines({ streak: 1, late: false, deltas: [] }, true)).toEqual([]);
    expect(checkinInsightLines({ streak: 4, late: false, deltas: [] }, true)).toEqual(['4 check-ins d’affilée']);
    expect(checkinInsightLines({ streak: 0, late: true, deltas: [] }, true)[0]).toContain('même après l’échéance');
  });

  it('adds the lines to the « Check-in sent » view', () => {
    const view = checkinCelebration({
      title: 'Bilan', answered: 5, parts: 1, durationSeconds: null, seed: 'a1',
      insights: { streak: 3, late: false, deltas: [weight] },
    }, true);
    expect(view.insights?.length).toBe(2);
    expect(checkinCelebration({ title: 'Bilan', answered: 5, parts: 1, durationSeconds: null, seed: 'a1' }, true).insights)
      .toEqual([]);
  });
});

describe('CoachFeedbackCardComponent (CI-05)', () => {
  const unread: FormAssignment[] = [
    { id: 'a2', formId: 'f', ownerId: 'c', assigneeId: 'u', status: 'REVIEWED', formName: 'bilan hebdo',
      coachName: 'Sami Coach', coachFeedback: 'Bravo pour la régularité !', reviewedAt: '2026-10-29T10:00:00Z' },
    { id: 'a1', formId: 'f', ownerId: 'c', assigneeId: 'u', status: 'REVIEWED', coachFeedback: 'Bien', coachName: 'Sami Coach' },
  ];

  beforeEach(() => TestBed.configureTestingModule({
    imports: [CoachFeedbackCardComponent, FeatherModule.pick(allIcons)],
  }));

  it('opens the newest comment and marks it read when closed', () => {
    const fixture = TestBed.createComponent(CoachFeedbackCardComponent);
    fixture.componentInstance.unread = unread;
    fixture.componentInstance.fr = true;
    const seen: string[] = [];
    fixture.componentInstance.seen.subscribe(item => seen.push(item.id));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Votre coach a répondu à votre check-in');
    expect(element.textContent).toContain('Bilan hebdo · +1 autre');
    expect(element.querySelector('.cf-dot')).not.toBeNull();

    (element.querySelector('.cf-card') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.cf-quote')?.textContent).toContain('Bravo pour la régularité !');
    expect(seen).toEqual([]);

    (element.querySelector('.cf-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(seen).toEqual(['a2']);
    expect(element.querySelector('.cf-dialog')).toBeNull();
  });
});
