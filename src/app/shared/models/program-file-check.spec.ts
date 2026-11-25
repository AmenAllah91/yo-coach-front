import {
  fileProgramWeek, isFilePlan, programFileKind, programFileOpenErrorKey, programFileProblem, programFileSaveName,
  programFileTypeOfPlan, programFileUploadErrorKey,
} from './program-file-check';

describe('program-file-check (audit PDF/Excel 2026-11-23)', () => {
  const file = (name: string, size = 1000) => new File([new Uint8Array(size)], name);

  it('accepts a PDF and an .xlsx, refuses an old .xls, another type or a file over 25 MB', () => {
    expect(programFileProblem(file('Programme.PDF'))).toBeNull();
    expect(programFileProblem(file('plan.xlsx'))).toBeNull();
    expect(programFileProblem(file('vieux.xls'))).toBe('PROGRAM_FILES.ERROR_OLD_XLS');
    expect(programFileProblem(file('macros.csv'))).toBe('PROGRAM_FILES.ERROR_TYPE');
    expect(programFileProblem(file('gros.pdf', 25 * 1024 * 1024 + 1))).toBe('PROGRAM_FILES.ERROR_TOO_BIG');
    expect(programFileProblem(null)).toBe('PROGRAM_FILES.CHOOSE_FILE');
  });

  it('reads the kind from the extension, not from a word in the name', () => {
    expect(programFileKind(file('Programme Excel.pdf'))).toBe('pdf');
    expect(programFileKind(file('semaine.xlsx'))).toBe('excel');
  });

  it('turns a failed request into a clear message', () => {
    expect(programFileUploadErrorKey({ status: 0 })).toBe('PROGRAM_FILES.ERROR_NETWORK');
    expect(programFileUploadErrorKey({ status: 413 })).toBe('PROGRAM_FILES.ERROR_TOO_BIG');
    expect(programFileUploadErrorKey({ status: 415 })).toBe('PROGRAM_FILES.ERROR_TYPE');
    expect(programFileUploadErrorKey({ status: 409, error: { code: 'PROGRAM_LOCKED' } })).toBe('PROGRAM_FILES.ERROR_LOCKED');
    expect(programFileUploadErrorKey({ status: 400, error: '{"code":"START_IN_PAST"}' })).toBe('PROGRAM_FILES.ERROR_DATES');
    expect(programFileUploadErrorKey({ status: 500 })).toBe('PROGRAM_FILES.ERROR_UPLOAD');
    expect(programFileOpenErrorKey({ status: 404 }, true)).toBe('PROGRAM_FILES.CLIENT_ERROR_REMOVED');
    expect(programFileOpenErrorKey({ status: 404 })).toBe('PROGRAM_FILES.ERROR_REMOVED');
    expect(programFileOpenErrorKey({ status: 403 })).toBe('PROGRAM_FILES.ERROR_NO_ACCESS');
    expect(programFileOpenErrorKey({ status: 410 }, true)).toBe('PROGRAM_FILES.CLIENT_ERROR_UNAVAILABLE');
    expect(programFileOpenErrorKey({ status: 410 })).toBe('PROGRAM_FILES.ERROR_UNAVAILABLE');
  });

  it('has one rule for « is it a file program »: a program with days never is', () => {
    expect(isFilePlan({ workoutPlanMode: 'FILE' })).toBeTrue();
    expect(isFilePlan({ nutritionPlanMode: 'FILE', resourceType: 'EXCEL' })).toBeTrue();
    expect(isFilePlan({ fileName: 'workout-programs/c/u/plan.pdf', workoutDays: [] })).toBeTrue();
    expect(isFilePlan({ fileName: 'old.pdf', workoutDays: [{ id: 'd1' }] })).toBeFalse();
    expect(isFilePlan({ workoutPlanMode: 'NORMAL', resourceType: 'PDF' })).toBeFalse();
    expect(isFilePlan({ nutritionPlanMode: 'APP' })).toBeFalse();
    expect(isFilePlan(null)).toBeFalse();
  });

  it('reads the type of a plan from its stored type first', () => {
    expect(programFileTypeOfPlan({ resourceType: 'PDF', originalFileName: 'Programme Excel.pdf' })).toBe('PDF');
    expect(programFileTypeOfPlan({ resourceType: 'XLSX' })).toBe('EXCEL');
    expect(programFileTypeOfPlan({ originalFileName: 'Programme Excel.pdf' })).toBe('PDF');
    expect(programFileTypeOfPlan({ originalFileName: 'semaine.xlsx' })).toBe('EXCEL');
  });

  it('gives a downloaded file its own name with the right extension', () => {
    expect(programFileSaveName({ originalFileName: 'Prise de masse.pdf', resourceType: 'PDF' })).toBe('Prise de masse.pdf');
    expect(programFileSaveName({ name: 'Sèche 4/4', resourceType: 'XLSX' })).toBe('Sèche 4_4.xlsx');
    expect(programFileSaveName({ resourceType: 'PDF' })).toBe('programme.pdf');
  });

  it('tells the week of a file program on a day', () => {
    const plan = { startDate: '2026-11-02', endDate: '2026-11-29' };
    expect(fileProgramWeek(plan, '2026-11-02')).toEqual({ week: 1, weeks: 4 });
    expect(fileProgramWeek(plan, '2026-11-12')).toEqual({ week: 2, weeks: 4 });
    expect(fileProgramWeek(plan, '2026-11-29')).toEqual({ week: 4, weeks: 4 });
    expect(fileProgramWeek(plan, '2026-11-01')).toBeNull();
    expect(fileProgramWeek(plan, '2026-11-30')).toBeNull();
    // Stopped early (another program took its place): its real end counts.
    expect(fileProgramWeek({ ...plan, stoppedAt: '2026-11-10' }, '2026-11-12')).toBeNull();
  });
});
