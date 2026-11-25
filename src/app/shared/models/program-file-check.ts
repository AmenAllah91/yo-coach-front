import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { OperatorFunction, filter, map, tap } from 'rxjs';

/**
 * Program files (PDF / Excel workout or nutrition programs): what the coach may send, and the message of a failed
 * request (audit PDF/Excel 2026-11-23). Every import screen uses these instead of its own English texts.
 */

/** For <input type="file" accept>: PDF and .xlsx only (an old .xls cannot be shown in the mobile app). */
export const PROGRAM_FILE_ACCEPT = '.pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const PROGRAM_FILE_MAX_BYTES = 25 * 1024 * 1024;

/** null when the file can be sent, else the translation key of the reason. */
export function programFileProblem(file: File | null | undefined): string | null {
  if (!file) return 'PROGRAM_FILES.CHOOSE_FILE';
  const name = (file.name || '').toLowerCase().trim();
  if (name.endsWith('.xls')) return 'PROGRAM_FILES.ERROR_OLD_XLS';
  if (!name.endsWith('.pdf') && !name.endsWith('.xlsx')) return 'PROGRAM_FILES.ERROR_TYPE';
  if (file.size > PROGRAM_FILE_MAX_BYTES) return 'PROGRAM_FILES.ERROR_TOO_BIG';
  return null;
}

/** 'pdf' or 'excel', read from the name of a file that passed {@link programFileProblem}. */
export function programFileKind(file: File): 'pdf' | 'excel' {
  return (file.name || '').toLowerCase().trim().endsWith('.pdf') ? 'pdf' : 'excel';
}

/** The code the server puts in a JSON error body ({ code: 'PROGRAM_LOCKED' }…), if any. */
function errorCode(error: any): string {
  const body = error?.error;
  if (body && typeof body === 'object') return String(body.code || '');
  if (typeof body === 'string') {
    try { return String(JSON.parse(body)?.code || ''); } catch { return ''; }
  }
  return '';
}

/** Translation key of a failed upload (import or replacement). */
export function programFileUploadErrorKey(error: any): string {
  const status = Number(error?.status);
  const code = errorCode(error);
  if (code === 'PROGRAM_LOCKED') return 'PROGRAM_FILES.ERROR_LOCKED';
  if (code === 'START_IN_PAST') return 'PROGRAM_FILES.ERROR_DATES';
  if (status === 0) return 'PROGRAM_FILES.ERROR_NETWORK';
  if (status === 413) return 'PROGRAM_FILES.ERROR_TOO_BIG';
  if (status === 415) return 'PROGRAM_FILES.ERROR_TYPE';
  if (status === 403) return 'PROGRAM_FILES.ERROR_NO_ACCESS';
  if (status === 400) return 'PROGRAM_FILES.ERROR_CHECK_FORM';
  return 'PROGRAM_FILES.ERROR_UPLOAD';
}

/** Translation key of a file that could not be opened or downloaded ({@code client}: the client's words). */
export function programFileOpenErrorKey(error: any, client = false): string {
  const status = Number(error?.status);
  if (status === 0) return 'PROGRAM_FILES.ERROR_NETWORK';
  if (status === 404) return client ? 'PROGRAM_FILES.CLIENT_ERROR_REMOVED' : 'PROGRAM_FILES.ERROR_REMOVED';
  // The program still has its file but storage lost it (CE 2026-11-24): not « your coach removed it ».
  if (status === 410) return client ? 'PROGRAM_FILES.CLIENT_ERROR_UNAVAILABLE' : 'PROGRAM_FILES.ERROR_UNAVAILABLE';
  if (status === 403 || status === 401) return 'PROGRAM_FILES.ERROR_NO_ACCESS';
  return 'PROGRAM_FILES.ERROR_OPEN';
}

/**
 * The one rule « is this program a file program? » (audit PDF/Excel 2026-11-23, M18), the calendar's: a program with
 * days (or marked NORMAL / APP) is an app program, even when a copy kept old file fields; otherwise the FILE mode, a
 * file type or a stored file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFilePlan(plan: any): boolean {
  if (!plan) return false;
  const mode = String(plan.workoutPlanMode || plan.nutritionPlanMode || '').toUpperCase();
  const days = (plan.workoutDays || plan.mealDays || []) as unknown[];
  if (mode === 'NORMAL' || mode === 'APP' || (Array.isArray(days) && days.length > 0)) return false;
  if (mode === 'FILE') return true;
  const type = String(plan.resourceType || '').toUpperCase();
  return ['PDF', 'EXCEL', 'XLS', 'XLSX'].includes(type) || !!(plan.fileName || plan.fileUrl || plan.originalFileName);
}

/** PDF or EXCEL: the stored type first, then the extension, then the content type. Never a word inside the name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function programFileTypeOfPlan(plan: any): 'PDF' | 'EXCEL' {
  const type = String(plan?.resourceType || '').toUpperCase();
  if (['XLS', 'XLSX', 'EXCEL'].includes(type)) return 'EXCEL';
  if (type === 'PDF') return 'PDF';
  const name = String(plan?.originalFileName || plan?.fileName || '').toLowerCase().trim();
  if (/\.xlsx?$/.test(name)) return 'EXCEL';
  if (name.endsWith('.pdf')) return 'PDF';
  return /spreadsheet|excel/.test(String(plan?.fileContentType || '').toLowerCase()) ? 'EXCEL' : 'PDF';
}

/** The name a downloaded file gets: the coach's own file name, with the right extension, nothing Windows refuses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function programFileSaveName(plan: any, type: 'PDF' | 'EXCEL' = programFileTypeOfPlan(plan)): string {
  const clean = (value: unknown) => String(value ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_');
  let base = clean(plan?.originalFileName) || clean(plan?.name) || 'programme';
  const original = base.toLowerCase();
  const fits = type === 'PDF' ? original.endsWith('.pdf') : /\.xlsx?$/.test(original);
  if (!fits) base = `${base}.${type === 'PDF' ? 'pdf' : 'xlsx'}`;
  return base;
}

/** « Semaine 2 sur 4 » of a file program on a day (ISO dates), or null when the day is outside the program. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fileProgramWeek(plan: any, dayIso: string): { week: number; weeks: number } | null {
  const start = String(plan?.startDate || '').slice(0, 10);
  const end = String(plan?.stoppedAt || plan?.endDate || '').slice(0, 10);
  if (!start || !dayIso || dayIso < start || (end && dayIso > end)) return null;
  const days = (from: string, to: string) =>
    Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
      - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);
  const week = Math.floor(days(start, dayIso) / 7) + 1;
  const weeks = end ? Math.max(week, Math.ceil((days(start, end) + 1) / 7)) : week;
  return { week, weeks };
}

/**
 * An upload that tells how far it is (audit PDF/Excel 2026-11-23, lot 3): the request is sent with
 * `reportProgress: true, observe: 'events'`, {@code onProgress} gets 0-100, the observable gives the saved plan.
 */
export function withUploadProgress<T>(onProgress?: (percent: number) => void): OperatorFunction<HttpEvent<T>, T> {
  return source => source.pipe(
    tap(event => {
      if (onProgress && event.type === HttpEventType.UploadProgress) {
        onProgress(event.total ? Math.min(100, Math.round((100 * event.loaded) / event.total)) : 0);
      }
    }),
    filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response),
    map(event => event.body as T),
  );
}
