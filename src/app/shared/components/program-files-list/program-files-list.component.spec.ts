import { OverviewItem, ProgramOverview } from '@shared/models/program-schedule';
import { fileRows } from './program-files-list.component';

/** Audit PDF/Excel 2026-11-23, lot 3: the « Fichiers » tab takes the file programs out of the overview, once each. */
describe('fileRows', () => {
  const item = (id: string, file: boolean, status: OverviewItem['status']): OverviewItem => ({
    id, name: id, startDate: '2026-11-02', endDate: '2026-11-29', stoppedAt: null, file, fileKind: file ? 'PDF' : null,
    totalDays: 28, readyDays: 0, doneDays: 0, weeks: 4, status,
  });

  it('keeps only the files, current, next, upcoming and finished, without duplicates', () => {
    const current = item('pdf-now', true, 'CURRENT');
    const overview = {
      type: 'WORKOUT', today: '2026-11-12', lastActivity: null, alerts: [],
      current: { program: current, week: 2, weeks: 4, doneThisWeek: 0, plannedThisWeek: 0, days: [] },
      next: { program: item('app-next', false, 'UPCOMING'), firstWeekReady: 0, firstWeekDays: 0 },
      upcoming: [item('app-next', false, 'UPCOMING'), item('xls-later', true, 'UPCOMING')],
      finished: [item('pdf-old', true, 'FINISHED'), item('app-old', false, 'FINISHED')],
      upcomingCount: 2, finishedCount: 2,
    } as unknown as ProgramOverview;

    const rows = fileRows(overview, 'WORKOUT');
    expect(rows.map(row => row.item.id)).toEqual(['pdf-now', 'xls-later', 'pdf-old']);
    expect(rows.every(row => row.kind === 'WORKOUT')).toBeTrue();
    expect(fileRows(null, 'NUTRITION')).toEqual([]);
  });
});
