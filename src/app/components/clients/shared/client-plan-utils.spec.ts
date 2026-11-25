import { instantDay, planDate } from './client-plan-utils';

describe('Check-in due day (instant from the API)', () => {
  it('reads the due instant as the local day, like the coach pages', () => {
    // Midnight in Tunis on the 24th, as the CE stores it.
    const due = '2026-11-23T23:00:00Z';
    const local = new Date(due);
    expect(instantDay(due)!.getDate()).toBe(local.getDate());
    expect(instantDay(due)!.getHours()).toBe(0);
    // planDate keeps the day written in the text: the bug that showed check-ins a day early.
    expect(planDate(due)!.getDate()).toBe(23);
  });

  it('keeps a plain day and refuses empty or invalid values', () => {
    expect(instantDay('2026-11-24')!.getDate()).toBe(24);
    expect(instantDay(null)).toBeNull();
    expect(instantDay('')).toBeNull();
    expect(instantDay('not a date')).toBeNull();
    expect(instantDay({ $date: '2026-11-24' })!.getDate()).toBe(24);
  });
});
