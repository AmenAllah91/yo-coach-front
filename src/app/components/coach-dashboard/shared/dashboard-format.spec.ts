import { ClientActivity } from '../../../models/coach-dashboard.model';
import { activityLink, activitySentence, initials, relativeTime, toDateInput } from './dashboard-format';

function activity(partial: Partial<ClientActivity>): ClientActivity {
  return {
    id: '1',
    type: 'WORKOUT_COMPLETED',
    category: 'WORKOUT',
    clientId: 'c1',
    clientName: 'Alice Martin',
    occurredAt: '2026-10-20T08:00:00Z',
    dateOnly: false,
    ...partial,
  };
}

describe('dashboard-format', () => {
  it('builds initials', () => {
    expect(initials('Alice Martin')).toBe('AM');
    expect(initials('  ')).toBe('?');
    expect(initials('jean paul sartre')).toBe('JP');
  });

  it('describes grouped events with their counters', () => {
    expect(activitySentence(activity({ type: 'WORKOUT_PARTIAL', count: 3, total: 5, title: 'Push' })))
      .toEqual({ key: 'CDASH.ACT.WORKOUT_PARTIAL', params: { title: 'Push', count: 3, total: 5 } });
    expect(activitySentence(activity({ type: 'HABITS_COMPLETED', category: 'TASKS_HABITS', count: 1 })).key).toBe('CDASH.ACT.HABITS_ONE');
    expect(activitySentence(activity({ type: 'HABITS_COMPLETED', category: 'TASKS_HABITS', count: 4 })).key).toBe('CDASH.ACT.HABITS_MANY');
    expect(activitySentence(activity({ type: 'MEASUREMENTS_ADDED', category: 'PROGRESS', count: 3, weight: 72.4 })))
      .toEqual({ key: 'CDASH.ACT.WEIGHT_AND_MORE', params: { weight: 72.4, count: 2 } });
    expect(activitySentence(activity({ type: 'PROGRESS_PHOTOS_ADDED', category: 'PROGRESS', count: 2 })).key).toBe('CDASH.ACT.PHOTOS_MANY');
  });

  it('opens the existing pages', () => {
    expect(activityLink(activity({ refId: 'day1' }))).toEqual({
      commands: ['/clients/profil-client', 'c1'],
      queryParams: { tab: 'workouts', workoutDayId: 'day1' },
    });
    expect(activityLink(activity({ type: 'CHECK_IN_SUBMITTED', category: 'CHECK_IN', refId: 'as1' }))).toEqual({
      commands: ['/forms/manage-checkins'],
      queryParams: { assignmentId: 'as1' },
    });
    expect(activityLink(activity({ type: 'PROGRESS_PHOTOS_ADDED', category: 'PROGRESS' })).queryParams).toEqual({ tab: 'pictures' });
  });

  it('shows relative times, and the day only for recovered history', () => {
    const now = new Date(2026, 9, 20, 12, 0, 0);
    expect(relativeTime(new Date(2026, 9, 20, 11, 30).toISOString(), 'en', false, now)).toContain('30 minutes');
    expect(relativeTime(new Date(2026, 9, 19, 9, 0).toISOString(), 'en', false, now)).toBe('yesterday');
    expect(relativeTime(new Date(2026, 9, 20, 11, 30).toISOString(), 'en', true, now)).toBe('today');
    expect(relativeTime(null, 'en')).toBe('');
  });

  it('formats input dates locally', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
