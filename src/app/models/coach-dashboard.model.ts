/** Coach dashboard API (coach-empire /api/coach/dashboard), shared by the web dashboard and the mobile app. */

export type DashboardAlertType =
  | 'EXPIRED_PROGRAMS'
  | 'NO_PROGRAM'
  | 'CHECK_INS_TO_REVIEW'
  | 'ENDING_SOON'
  | 'INACTIVE'
  | 'NO_NUTRITION'
  | 'CHECK_INS_OVERDUE';

/** The six categories of the "To do" section, in display order (two columns). */
export const TODO_ALERT_TYPES: DashboardAlertType[] = [
  'EXPIRED_PROGRAMS',
  'NO_PROGRAM',
  'CHECK_INS_TO_REVIEW',
  'ENDING_SOON',
  'INACTIVE',
  'NO_NUTRITION',
];

export type DashboardWidgetKey = 'KPIS' | 'TODO' | 'ACTIVITIES' | 'CHECK_INS' | 'MESSAGES';

export const DASHBOARD_WIDGETS: DashboardWidgetKey[] = ['KPIS', 'TODO', 'ACTIVITIES', 'CHECK_INS', 'MESSAGES'];

/** Preference key hiding one "To do" category. */
export function alertWidgetKey(type: DashboardAlertType): string {
  return `ALERT_${type}`;
}

export interface DashboardPreferences {
  hiddenWidgets: string[];
}

export interface DashboardSummary {
  coachFirstName: string | null;
  today: string;
  activeClients: { count: number; limit: number | null; newLast30Days: number | null };
  clientsToWatch: { count: number; noProgram: number; expiredPrograms: number; inactive: number; overdueCheckIns: number };
  checkIns: { toReview: number; overdue: number };
  /** Distinct clients in at least one "To do" category. */
  todoClients: number;
  alerts: Partial<Record<DashboardAlertType, number>>;
  preferences: DashboardPreferences;
}

export interface DashboardAlertItem {
  clientId: string;
  clientName: string;
  avatarUrl?: string;
  conversationId?: string;
  programId?: string;
  programName?: string;
  programStartDate?: string;
  programEndDate?: string;
  /** Days since the end, days left, days without activity or days late, depending on the category. */
  days?: number;
  lastActivityAt?: string;
  assignmentId?: string;
  formId?: string;
  formName?: string;
  submittedAt?: string;
  dueAt?: string;
}

export interface DashboardPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export type ClientActivityCategory = 'WORKOUT' | 'NUTRITION' | 'CHECK_IN' | 'PROGRESS' | 'TASKS_HABITS';

export const ACTIVITY_CATEGORIES: ClientActivityCategory[] = ['WORKOUT', 'NUTRITION', 'CHECK_IN', 'PROGRESS', 'TASKS_HABITS'];

export type ClientActivityType =
  | 'WORKOUT_COMPLETED'
  | 'WORKOUT_PARTIAL'
  | 'NUTRITION_DAY_COMPLETED'
  | 'CHECK_IN_SUBMITTED'
  | 'FORM_SUBMITTED'
  | 'PROGRESS_PHOTOS_ADDED'
  | 'MEASUREMENTS_ADDED'
  | 'TASK_COMPLETED'
  | 'HABITS_COMPLETED';

export interface ClientActivity {
  id: string;
  type: ClientActivityType;
  category: ClientActivityCategory;
  clientId: string;
  clientName: string;
  avatarUrl?: string;
  occurredAt: string;
  /** Recovered history without time: show the day only. */
  dateOnly: boolean;
  day?: string;
  title?: string;
  count?: number;
  total?: number;
  kinds?: string[];
  weight?: number;
  refId?: string;
  parentRefId?: string;
}

export interface ClientActivityPage {
  items: ClientActivity[];
  nextCursor: string | null;
}

export interface ActivityQuery {
  category?: ClientActivityCategory | null;
  clientId?: string | null;
  from?: string | null;
  to?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface DashboardConversation {
  id: string;
  clientId: string | null;
  clientName: string | null;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  group: boolean;
  name: string | null;
}

/** Loading / error / content of one widget: an error never blocks the rest of the dashboard. */
export type WidgetStatus = 'loading' | 'ready' | 'error';
