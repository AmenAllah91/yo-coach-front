import { formatSeconds, workoutPdfDays } from './workout-pdf';

/** Audit PDF/Excel 2026-11-23, lot 4: the workout program PDF. */
describe('workoutPdfDays', () => {
  const options = (fr = true) => ({
    fr,
    dateOf: (day: any) => new Date(2026, 10, day.dayNumber),
    weight: (kg: number) => `${kg}`,
    showWeight: true,
  });

  const set = (extra: any) => ({ reps: 10, restSec: 60, ...extra });

  it('puts the warm-up apart and numbers the working sets from 1', () => {
    const plan = { workoutDays: [{ dayNumber: 2, workoutSessions: [{ name: 'Leg day', exercises: [
      { name: 'Vélo', type: 'CARDIO', sets: [{ type: 'WARM_UP', duration: 5 }] },
      { name: 'Squat', sets: [set({ type: 'WARM_UP', weight: 20 }), set({ weight: 80 }), set({ weight: 80, restMin: 1, restSec: 30 })] },
    ] }] }] };
    const [day] = workoutPdfDays(plan, options());
    expect(day.title).toBe('Leg day');
    expect(day.warmup.map(e => e.name)).toEqual(['Vélo']);
    expect(day.warmup[0].rows[0].value).toBe('5 min');
    const squat = day.blocks[0].exercises[0];
    expect(squat.label).toBe('1');
    expect(squat.rows.map(r => r.label)).toEqual(['É1', '1', '2']);
    expect(squat.rows.map(r => r.rest)).toEqual(['1 min', '1 min', '1 min 30']);
    expect(squat.rows[1].weight).toBe('80');
  });

  it('titles a superset and a circuit, with its rounds and its rest between rounds', () => {
    const plan = { workoutDays: [{ dayNumber: 3, workoutSessions: [{ exercises: [
      { name: 'Curl', supersetGroupId: 'a', sets: [set({}), set({})] },
      { name: 'Dips', supersetGroupId: 'a', sets: [set({}), set({})] },
      { name: 'Burpees', supersetGroupId: 'c', groupType: 'CIRCUIT', groupRestSec: 90, measure: 'TIME',
        sets: [{ durationSec: 45 }, { durationSec: 45 }, { durationSec: 45 }] },
      { name: 'Gainage', supersetGroupId: 'c', groupType: 'CIRCUIT', measure: 'TIME', sets: [{ durationSec: 30 }] },
    ] }] }] };
    const [day] = workoutPdfDays(plan, options());
    expect(day.blocks.map(b => b.kind)).toEqual(['SUPERSET', 'CIRCUIT']);
    expect(day.blocks[0].title).toBe('Superset');
    expect(day.blocks[0].exercises.map(e => e.label)).toEqual(['1A', '1B']);
    expect(day.blocks[1].title).toBe('Circuit · 3 tours · 1 min 30 entre les tours');
    expect(day.blocks[1].exercises[0].rows[0].value).toBe('45 s');
  });

  it('tells a rest day from a day still to fill', () => {
    const plan = { workoutDays: [
      { dayNumber: 5, restDay: true, workoutSessions: [] },
      { dayNumber: 4, workoutSessions: [{ exercises: [] }] },
    ] };
    const days = workoutPdfDays(plan, options(false));
    expect(days.map(d => d.state)).toEqual(['EMPTY', 'REST']);
  });

  it('writes seconds as a person reads them', () => {
    expect(formatSeconds(45, true)).toBe('45 s');
    expect(formatSeconds(60, true)).toBe('1 min');
    expect(formatSeconds(95, true)).toBe('1 min 35');
    expect(formatSeconds(null, true)).toBe('');
  });
});
