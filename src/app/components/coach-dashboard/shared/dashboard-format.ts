import { ClientActivity, ClientActivityCategory, DashboardAlertType } from '../../../models/coach-dashboard.model';

/** Display helpers shared by the dashboard widgets and the "All activities" page. */

export function initials(name: string | null | undefined): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

export function localeOf(lang: string | undefined): string {
  return lang === 'fr' ? 'fr-FR' : 'en-GB';
}

/** yyyy-MM-dd of a local date. */
export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "il y a 5 min", "il y a 3 h", "hier", then the date. Date-only events show their day. */
export function relativeTime(value: string | null | undefined, lang: string | undefined, dateOnly = false, now = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = localeOf(lang);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (!dateOnly && days === 0) {
    const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
    if (minutes < 1) return format.format(0, 'second');
    if (minutes < 60) return format.format(-minutes, 'minute');
    return format.format(-Math.round(minutes / 60), 'hour');
  }
  if (days >= 0 && days < 7) return format.format(-days, 'day');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function shortDate(value: string | null | undefined, lang: string | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

export const CATEGORY_ICONS: Record<ClientActivityCategory, string> = {
  WORKOUT: 'activity',
  NUTRITION: 'coffee',
  CHECK_IN: 'clipboard',
  PROGRESS: 'trending-up',
  TASKS_HABITS: 'check-square',
};

export const ALERT_ICONS: Record<DashboardAlertType, string> = {
  EXPIRED_PROGRAMS: 'calendar',
  NO_PROGRAM: 'activity',
  CHECK_INS_TO_REVIEW: 'clipboard',
  ENDING_SOON: 'clock',
  INACTIVE: 'user-minus',
  NO_NUTRITION: 'coffee',
  CHECK_INS_OVERDUE: 'alert-circle',
};

/** Translation key and parameters of the sentence after the client's name. */
export function activitySentence(activity: ClientActivity): { key: string; params: Record<string, unknown> } {
  const title = activity.title || '';
  const count = activity.count ?? 0;
  switch (activity.type) {
    case 'WORKOUT_PARTIAL':
      return { key: 'CDASH.ACT.WORKOUT_PARTIAL', params: { title, count, total: activity.total ?? 0 } };
    case 'WORKOUT_COMPLETED':
      return { key: 'CDASH.ACT.WORKOUT_COMPLETED', params: { title } };
    case 'NUTRITION_DAY_COMPLETED':
      return { key: 'CDASH.ACT.NUTRITION_DAY_COMPLETED', params: { title } };
    case 'CHECK_IN_SUBMITTED':
      return { key: 'CDASH.ACT.CHECK_IN_SUBMITTED', params: { title } };
    case 'FORM_SUBMITTED':
      return { key: 'CDASH.ACT.FORM_SUBMITTED', params: { title } };
    case 'PROGRESS_PHOTOS_ADDED':
      return { key: count > 1 ? 'CDASH.ACT.PHOTOS_MANY' : 'CDASH.ACT.PHOTOS_ONE', params: { count } };
    case 'MEASUREMENTS_ADDED':
      if (activity.weight != null) {
        return { key: count > 1 ? 'CDASH.ACT.WEIGHT_AND_MORE' : 'CDASH.ACT.WEIGHT', params: { weight: activity.weight, count: count - 1 } };
      }
      return { key: count > 1 ? 'CDASH.ACT.MEASUREMENTS_MANY' : 'CDASH.ACT.MEASUREMENTS_ONE', params: { count } };
    case 'TASK_COMPLETED':
      return { key: 'CDASH.ACT.TASK_COMPLETED', params: { title } };
    case 'HABITS_COMPLETED':
      return { key: count > 1 ? 'CDASH.ACT.HABITS_MANY' : 'CDASH.ACT.HABITS_ONE', params: { count } };
    default:
      return { key: 'CDASH.ACT.UNKNOWN', params: {} };
  }
}

/** Where an activity opens (existing pages). */
export function activityLink(activity: ClientActivity): { commands: string[]; queryParams?: Record<string, string> } {
  const profile = ['/clients/profil-client', activity.clientId];
  switch (activity.category) {
    case 'WORKOUT':
      return { commands: profile, queryParams: activity.refId ? { tab: 'workouts', workoutDayId: activity.refId } : { tab: 'workouts' } };
    case 'NUTRITION':
      return { commands: profile, queryParams: { tab: 'nutrition' } };
    case 'CHECK_IN':
      return activity.refId
        ? { commands: ['/forms/manage-checkins'], queryParams: { assignmentId: activity.refId } }
        : { commands: profile, queryParams: { tab: 'checkins' } };
    case 'PROGRESS':
      return { commands: profile, queryParams: { tab: activity.type === 'PROGRESS_PHOTOS_ADDED' ? 'pictures' : 'measurements' } };
    case 'TASKS_HABITS':
    default:
      return { commands: profile, queryParams: { tab: 'tasks' } };
  }
}

/** Pastel colour of a client avatar, stable for the same client (0 to 4). */
export function avatarTone(id: string | null | undefined): number {
  let hash = 0;
  for (const char of id || '') hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 5;
}

/** 09:42 */
export function clockTime(value: string | null | undefined, lang: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' });
}

/** Day heading of the feed: "Aujourd’hui", "Hier", then the date. */
export function dayLabel(value: string, lang: string | undefined, now = new Date()): string {
  const date = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  if (days === 0 || days === 1) {
    const label = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'auto' }).format(-days, 'day');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const label = date.toLocaleDateString(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Second line of an activity, when the event carries details. */
export function activityDetail(activity: ClientActivity): { key: string; params: Record<string, unknown> } | null {
  if (activity.category === 'WORKOUT' && activity.total) {
    return { key: 'CDASH.DETAIL.EXERCISES', params: { count: activity.count ?? 0, total: activity.total } };
  }
  if (activity.category === 'NUTRITION' && activity.title) {
    return { key: 'CDASH.DETAIL.PLAN', params: { title: activity.title } };
  }
  return null;
}
