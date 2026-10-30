export type CheckInQuestionType =
  | 'multiple-choice'
  | 'star-rating'
  | 'yes-no'
  | 'input-text'
  | 'date'
  | string;

export interface CheckInQuestionDraft {
  id: string;
  type: CheckInQuestionType;
  text: string;
  options?: string[];
  maxStars?: number;
  minDate?: string;
  maxDate?: string;
}

export type CheckInScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CheckInScheduleDraft {
  frequency: CheckInScheduleFrequency | null;
  sendTime: string;
  weeklyDay: string | null;
  biweeklyDay: string | null;
  monthlyDay: number | null;
}

export type CheckInValidationTab = 'form' | 'schedule';

export interface CheckInValidationIssue {
  id: string;
  tab: CheckInValidationTab;
  targetId: string;
  messageKey: string;
  params?: Record<string, string | number>;
  questionId?: string;
  optionIndex?: number;
}

function questionTarget(question: CheckInQuestionDraft): string {
  return `question-text-${question.id}`;
}

export function validateQuestion(
  question: CheckInQuestionDraft,
  questionIndex: number,
): CheckInValidationIssue[] {
  const issues: CheckInValidationIssue[] = [];
  const number = questionIndex + 1;
  const params = { number };

  if (!question.text?.trim()) {
    issues.push({
      id: `question-${question.id}-text`,
      tab: 'form',
      targetId: questionTarget(question),
      messageKey: 'CHECKIN_ERROR_QUESTION_TEXT',
      params,
      questionId: question.id,
    });
  }

  if (question.type === 'multiple-choice') {
    const options = question.options ?? [];

    if (options.length < 2) {
      issues.push({
        id: `question-${question.id}-options-min`,
        tab: 'form',
        targetId: `question-add-option-${question.id}`,
        messageKey: 'CHECKIN_ERROR_MIN_OPTIONS',
        params,
        questionId: question.id,
      });
    }

    options.forEach((option, optionIndex) => {
      if (!option?.trim()) {
        issues.push({
          id: `question-${question.id}-option-${optionIndex}-empty`,
          tab: 'form',
          targetId: `question-option-${question.id}-${optionIndex}`,
          messageKey: 'CHECKIN_ERROR_EMPTY_OPTION',
          params: { number, option: optionIndex + 1 },
          questionId: question.id,
          optionIndex,
        });
      }
    });

    const firstIndexByValue = new Map<string, number>();
    options.forEach((option, optionIndex) => {
      const normalized = option?.trim().toLocaleLowerCase();
      if (!normalized) return;

      if (firstIndexByValue.has(normalized)) {
        issues.push({
          id: `question-${question.id}-option-${optionIndex}-duplicate`,
          tab: 'form',
          targetId: `question-option-${question.id}-${optionIndex}`,
          messageKey: 'CHECKIN_ERROR_DUPLICATE_OPTION',
          params: { number, option: optionIndex + 1 },
          questionId: question.id,
          optionIndex,
        });
        return;
      }

      firstIndexByValue.set(normalized, optionIndex);
    });
  }

  if (question.type === 'star-rating') {
    const maxStars = question.maxStars ?? 5;
    if (!Number.isInteger(maxStars) || maxStars < 1 || maxStars > 5) {
      issues.push({
        id: `question-${question.id}-stars`,
        tab: 'form',
        targetId: `question-${question.id}`,
        messageKey: 'CHECKIN_ERROR_STAR_RANGE',
        params,
        questionId: question.id,
      });
    }
  }

  if (
    question.type === 'date' &&
    question.minDate &&
    question.maxDate &&
    question.minDate > question.maxDate
  ) {
    issues.push({
      id: `question-${question.id}-date-range`,
      tab: 'form',
      targetId: `question-${question.id}`,
      messageKey: 'CHECKIN_ERROR_DATE_RANGE',
      params,
      questionId: question.id,
    });
  }

  return issues;
}

/** "Show if [question] is [answer]": yes for a yes/no question, optionIds for a choice. */
export interface CheckInConditionDraft {
  questionId: string | null;
  yes?: boolean | null;
  optionIds?: string[];
}

export interface CheckInPartDraft {
  id: string;
  title: string;
  condition?: CheckInConditionDraft | null;
}

function conditionComplete(condition: CheckInConditionDraft): boolean {
  if (!condition.questionId) return false;
  return condition.yes === true || condition.yes === false || (condition.optionIds?.length ?? 0) > 0;
}

/** Each part holds a question; each condition names its question and the answer that shows it. */
export function validateCheckInParts(
  parts: CheckInPartDraft[],
  questions: Array<CheckInQuestionDraft & { sectionId?: string | null; condition?: CheckInConditionDraft | null }>,
): CheckInValidationIssue[] {
  const issues: CheckInValidationIssue[] = [];
  parts.forEach((part, index) => {
    const name = part.title?.trim() || String(index + 1);
    if (!questions.some(q => q.sectionId === part.id)) {
      issues.push({ id: `part-${part.id}-empty`, tab: 'form', targetId: `part-${part.id}`, messageKey: 'CHECKIN_ERROR_EMPTY_PART', params: { part: name } });
    }
    if (part.condition && !conditionComplete(part.condition)) {
      issues.push({ id: `part-${part.id}-condition`, tab: 'form', targetId: `part-${part.id}`, messageKey: 'CHECKIN_ERROR_PART_CONDITION', params: { part: name } });
    } else if (part.condition) {
      // Its question must sit in an earlier part.
      const source = questions.find(q => q.id === part.condition!.questionId);
      const sourcePart = parts.findIndex(p => p.id === source?.sectionId);
      if (sourcePart < 0 || sourcePart >= index) {
        issues.push({ id: `part-${part.id}-condition-order`, tab: 'form', targetId: `part-${part.id}`, messageKey: 'CHECKIN_ERROR_PART_CONDITION_ORDER', params: { part: name } });
      }
    }
  });
  questions.forEach((question, index) => {
    if (question.condition && !conditionComplete(question.condition)) {
      issues.push({
        id: `question-${question.id}-condition`, tab: 'form', targetId: `question-condition-${question.id}`,
        messageKey: 'CHECKIN_ERROR_CONDITION', params: { number: index + 1 }, questionId: question.id,
      });
    } else if (question.condition) {
      // Its question must come before it.
      const sourceIndex = questions.findIndex(q => q.id === question.condition!.questionId);
      if (sourceIndex < 0 || sourceIndex >= index) {
        issues.push({
          id: `question-${question.id}-condition-order`, tab: 'form', targetId: `question-condition-${question.id}`,
          messageKey: 'CHECKIN_ERROR_CONDITION_ORDER', params: { number: index + 1 }, questionId: question.id,
        });
      }
    }
  });
  return issues;
}

export function isQuestionValid(question: CheckInQuestionDraft, questionIndex = 0): boolean {
  return validateQuestion(question, questionIndex).length === 0;
}

export function validateCheckInForm(
  questions: CheckInQuestionDraft[],
  schedule: CheckInScheduleDraft,
): CheckInValidationIssue[] {
  const issues = questions.flatMap((question, index) => validateQuestion(question, index));

  if (questions.length === 0) {
    issues.push({
      id: 'form-no-question',
      tab: 'form',
      targetId: 'add-question-button',
      messageKey: 'CHECKIN_ERROR_ADD_QUESTION',
    });
  }

  // No frequency means no automatic reminder. Schedule rules apply only when automatic sending is configured.
  if (!schedule.frequency) return issues;

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.sendTime ?? '')) {
    issues.push({
      id: 'schedule-send-time',
      tab: 'schedule',
      targetId: 'schedule-send-time',
      messageKey: 'CHECKIN_ERROR_SEND_TIME',
    });
  }

  if (schedule.frequency === 'weekly' && !schedule.weeklyDay) {
    issues.push({
      id: 'schedule-weekly-day',
      tab: 'schedule',
      targetId: 'schedule-days',
      messageKey: 'CHECKIN_ERROR_WEEKLY_DAY',
    });
  }

  if (schedule.frequency === 'biweekly' && !schedule.biweeklyDay) {
    issues.push({
      id: 'schedule-biweekly-day',
      tab: 'schedule',
      targetId: 'schedule-days',
      messageKey: 'CHECKIN_ERROR_BIWEEKLY_DAY',
    });
  }

  if (
    schedule.frequency === 'monthly' &&
    (!Number.isInteger(schedule.monthlyDay) || schedule.monthlyDay! < 1 || schedule.monthlyDay! > 31)
  ) {
    issues.push({
      id: 'schedule-monthly-day',
      tab: 'schedule',
      targetId: 'schedule-monthly-day',
      messageKey: 'CHECKIN_ERROR_MONTHLY_DAY',
    });
  }

  return issues;
}
