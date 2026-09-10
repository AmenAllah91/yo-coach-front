import {
  CheckInQuestionDraft,
  CheckInScheduleDraft,
  isQuestionValid,
  validateCheckInForm,
} from './check-in-form-validation';

const noSchedule: CheckInScheduleDraft = {
  frequency: null,
  sendTime: '',
  weeklyDay: null,
  biweeklyDay: null,
  monthlyDay: null,
};

function question(overrides: Partial<CheckInQuestionDraft> = {}): CheckInQuestionDraft {
  return {
    id: 'q1',
    type: 'input-text',
    text: 'How are you feeling?',
    ...overrides,
  };
}

const validDailySchedule: CheckInScheduleDraft = {
  frequency: 'daily',
  sendTime: '09:00',
  weeklyDay: null,
  biweeklyDay: null,
  monthlyDay: null,
};

describe('check-in form validation', () => {
  it('requires at least one question', () => {
    expect(validateCheckInForm([], validDailySchedule).map(issue => issue.messageKey))
      .toEqual(['CHECKIN_ERROR_ADD_QUESTION']);
  });

  it('rejects whitespace-only question text', () => {
    expect(isQuestionValid(question({ text: '   ' }))).toBeFalse();
  });

  it('requires two non-empty unique multiple-choice options', () => {
    const issues = validateCheckInForm([
      question({
        type: 'multiple-choice',
        options: ['Good', ' ', 'good'],
      }),
    ], validDailySchedule);

    expect(issues.map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_EMPTY_OPTION');
    expect(issues.map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_DUPLICATE_OPTION');
  });

  it('accepts a complete multiple-choice question', () => {
    expect(isQuestionValid(question({
      type: 'multiple-choice',
      text: 'How was your appetite?',
      options: ['Good', 'Average', 'Poor'],
    }))).toBeTrue();
  });


  it('allows publishing without an automatic schedule', () => {
    expect(validateCheckInForm([question()], noSchedule)).toEqual([]);
  });

  it('validates weekly, biweekly and monthly schedules', () => {
    const validQuestion = [question()];

    expect(validateCheckInForm(validQuestion, {
      ...noSchedule,
      frequency: 'weekly',
      sendTime: '09:00',
    }).map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_WEEKLY_DAY');

    expect(validateCheckInForm(validQuestion, {
      ...noSchedule,
      frequency: 'biweekly',
      sendTime: '09:00',
    }).map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_BIWEEKLY_DAY');

    expect(validateCheckInForm(validQuestion, {
      ...noSchedule,
      frequency: 'monthly',
      sendTime: '09:00',
      monthlyDay: 0,
    }).map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_MONTHLY_DAY');
  });

  it('does not require weekdays for a daily schedule', () => {
    expect(validateCheckInForm([question()], {
      ...noSchedule,
      frequency: 'daily',
      sendTime: '08:30',
    })).toEqual([]);
  });

  it('requires a valid send time when automatic scheduling is enabled', () => {
    expect(validateCheckInForm([question()], {
      ...noSchedule,
      frequency: 'daily',
      sendTime: '',
    }).map(issue => issue.messageKey)).toContain('CHECKIN_ERROR_SEND_TIME');
  });
});
