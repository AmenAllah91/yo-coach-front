export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  STAR_RATING = 'STAR_RATING',
  YES_NO = 'YES_NO',
  TEXT = 'TEXT',
  DATE = 'DATE',
}

export type Answer =
  | { questionId: string; type: QuestionType.MULTIPLE_CHOICE; selectedOptionId: string | null }
  | { questionId: string; type: QuestionType.STAR_RATING; rating: number | null }
  | { questionId: string; type: QuestionType.YES_NO; yes: boolean | null }
  | { questionId: string; type: QuestionType.TEXT; text: string | null }
  | { questionId: string; type: QuestionType.DATE; date: string | null };

export interface SubmissionPayload {
  answers: Answer[];
}

export interface Submission {
  id: string;
  assignmentId: string;
  formId: string;
  respondentId: string;
  ownerId: string;
  answers: Answer[];
  submittedAt?: string;
}
