/**
 * The client's workout on the web (audit workouts 2026-11-23, M14 and M16). Pure functions: no Angular import, tested
 * by tests/workout-local-draft.test.cjs.
 */

/** M14: seconds of a running timer from the real clock, right even when the tab slept (screen locked, background). */
export function elapsedSince(fromSeconds: number, startedAtMs: number, nowMs: number): number {
  const base = Math.max(0, Math.floor(Number(fromSeconds) || 0));
  return base + Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/** M16: what the browser keeps of a draft not received by the server yet (one per day of a program). */
export interface LocalWorkoutDraft {
  planId: string;
  dayKey: string;
  /** When it was written (Date.now()): only the copy that was sent is erased once the server has it. */
  savedAt: number;
  /** The body of PUT /api/workout-plan/{planId}/days, as sent (status IN_PROGRESS). */
  payload: any;
}

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'yc.workoutDraft.';
/** A copy older than this is dropped (the client can no longer change the day after 7 days anyway). */
export const LOCAL_DRAFT_MAX_AGE_MS = 8 * 24 * 3600 * 1000;

/** The day in the key: its id, else its number. */
export function workoutDayKey(day: { id?: string | null; dayNumber?: number | null } | null | undefined): string {
  return day?.id ? String(day.id) : `n${day?.dayNumber ?? 0}`;
}

export function localDraftKey(planId: string, dayKey: string): string {
  return `${PREFIX}${planId}.${dayKey}`;
}

/** The copy kept for this day, or null (nothing, unreadable, too old, storage blocked). */
export function readLocalDraft(store: ReadStore | null | undefined, planId: string, dayKey: string, nowMs = Date.now()): LocalWorkoutDraft | null {
  if (!store || !planId) return null;
  try {
    const raw = store.getItem(localDraftKey(planId, dayKey));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalWorkoutDraft;
    if (!draft || draft.planId !== planId || draft.dayKey !== dayKey || typeof draft.payload !== 'object' || !draft.payload) return null;
    if (!(Number(draft.savedAt) > 0) || nowMs - Number(draft.savedAt) > LOCAL_DRAFT_MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

/** Kept on this device; false when the browser refuses (private mode, full storage). */
export function writeLocalDraft(store: WriteStore | null | undefined, draft: LocalWorkoutDraft): boolean {
  if (!store || !draft.planId) return false;
  try {
    store.setItem(localDraftKey(draft.planId, draft.dayKey), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/**
 * Erased once the server has it. With `savedAt`: only that copy (a newer one written meanwhile stays, it was not sent
 * yet).
 */
export function clearLocalDraft(store: WriteStore | null | undefined, planId: string, dayKey: string, savedAt?: number): void {
  if (!store || !planId) return;
  try {
    const key = localDraftKey(planId, dayKey);
    if (savedAt != null) {
      const raw = store.getItem(key);
      const kept = raw ? (JSON.parse(raw) as LocalWorkoutDraft) : null;
      if (kept && Number(kept.savedAt) !== savedAt) return;
    }
    store.removeItem(key);
  } catch {
    // Nothing to do: the copy is dropped at the next read if it is too old.
  }
}

const FINISHED = ['COMPLETED', 'MISSED', 'OFF_PLAN'];

/**
 * The server does not have this copy yet: send it again. Not when the day is finished on the server (its version
 * wins) nor when the server already holds a longer workout (done meanwhile on another device).
 */
export function localDraftNeeded(draft: LocalWorkoutDraft | null, day: any): boolean {
  if (!draft || !day) return false;
  const status = String(day.status || 'PENDING').toUpperCase();
  if (FINISHED.includes(status)) return false;
  const sent = draft.payload || {};
  const localSeconds = Number(sent.workoutElapsedSeconds) || 0;
  const serverSeconds = Number(day.workoutElapsedSeconds) || 0;
  if (serverSeconds > localSeconds) return false;
  return status !== String(sent.status || '').toUpperCase()
    || localSeconds > serverSeconds
    || String(sent.overallWorkoutNote ?? '') !== String(day.overallWorkoutNote ?? '')
    || JSON.stringify(sent.clientExerciseLogs ?? []) !== JSON.stringify(day.clientExerciseLogs ?? []);
}

/** No answer from the server (offline, network cut): status 0. */
export function isNetworkError(error: any): boolean {
  return !!error && Number(error.status) === 0;
}
