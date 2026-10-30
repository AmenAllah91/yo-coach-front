/**
 * A check-in in parts, page by page, with questions shown under conditions: the same rule as the server
 * (CheckInVisibility.java) and the mobile app. A form without parts is one page.
 */

export interface PageQuestion {
  id: string;
  type: string;
  order?: number;
  sectionId?: string | null;
  condition?: { questionId: string; yes?: boolean | null; optionIds?: string[] | null } | null;
  [key: string]: any;
}

export interface PagePart {
  id: string;
  title: string;
  description?: string | null;
  endMessage?: string | null;
  condition?: PageQuestion['condition'];
}

export interface PageAnswer {
  questionId: string;
  yes?: boolean | null;
  selectedOptionId?: string | null;
  [key: string]: any;
}

/** The id of the single page of a form without parts. */
export const SINGLE_PAGE = '__single';

/** The parts in page order; a form without parts gets one page named after the check-in. */
export function pagesOf(sections: PagePart[] | null | undefined, title: string): PagePart[] {
  return sections?.length ? sections : [{ id: SINGLE_PAGE, title }];
}

/** The page a question is on: its part, else the first one. */
export function pageOf(question: PageQuestion, pages: PagePart[]): string {
  return pages.some(p => p.id === question.sectionId) ? question.sectionId! : pages[0].id;
}

/** The questions in the client's order: page by page, then by order inside a page. */
export function orderedQuestions<Q extends PageQuestion>(questions: Q[], pages: PagePart[]): Q[] {
  const byOrder = (a: Q, b: Q) => (a.order ?? 0) - (b.order ?? 0);
  return pages.flatMap(page => questions.filter(q => pageOf(q, pages) === page.id).sort(byOrder));
}

function met(condition: PageQuestion['condition'], byId: Map<string, PageQuestion>,
             answers: Map<string, PageAnswer>, visible: Set<string>): boolean {
  if (!condition?.questionId) return true;
  const source = byId.get(condition.questionId);
  if (!source || !visible.has(source.id)) return false;
  const answer = answers.get(source.id);
  if (!answer) return false;
  if (source.type === 'YES_NO') return condition.yes != null && answer.yes === condition.yes;
  if (source.type === 'MULTIPLE_CHOICE') {
    return !!answer.selectedOptionId && (condition.optionIds ?? []).includes(answer.selectedOptionId);
  }
  return false;
}

/** The ids of the questions shown for these answers (questions already in page order). */
export function visibleQuestionIds(ordered: PageQuestion[], pages: PagePart[], answers: PageAnswer[]): Set<string> {
  const byId = new Map(ordered.map(q => [q.id, q] as const));
  const answerById = new Map(answers.filter(a => a?.questionId).map(a => [a.questionId, a] as const));
  const partShown = new Map<string, boolean>();
  const visible = new Set<string>();
  for (const question of ordered) {
    const pageId = pageOf(question, pages);
    if (!partShown.has(pageId)) {
      const page = pages.find(p => p.id === pageId);
      partShown.set(pageId, met(page?.condition, byId, answerById, visible));
    }
    if (partShown.get(pageId) && met(question.condition, byId, answerById, visible)) visible.add(question.id);
  }
  return visible;
}
