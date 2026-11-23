import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';

/**
 * The program of the client's week card, read ahead (2026-11-23): a click on a day opens its window over the profile
 * (day-outlet.ts) without waiting for the editor to read the whole program again.
 *
 * - The card reads the program as soon as it shows it (and again when the mouse comes on the week, if too old).
 * - The editor opened in the window takes it from here (a copy: what it changes never comes back here).
 * - The editor forgets it when its window closes: the next click reads the program saved since.
 */
const MAX_AGE_MS = 60_000;

interface Entry {
  plan$: Observable<unknown>;
  at: number;
}

const entries = new Map<string, Entry>();

/** Reads the program ahead (once: a read still fresh, or still running, is kept). */
export function prefetchDayWindowPlan<T>(planId: string, read: () => Observable<T>, maxAgeMs = MAX_AGE_MS / 2): void {
  if (!planId) return;
  const known = entries.get(planId);
  if (known && Date.now() - known.at <= maxAgeMs) return;
  const plan$ = read().pipe(
    catchError((error) => {
      if (entries.get(planId)?.plan$ === plan$) entries.delete(planId);
      return throwError(() => error);
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  entries.set(planId, { plan$, at: Date.now() });
  plan$.subscribe({ error: () => undefined });
}

/** The program read ahead (a copy), or read now. */
export function dayWindowPlan<T>(planId: string, read: () => Observable<T>): Observable<T> {
  const known = entries.get(planId);
  if (!known || Date.now() - known.at > MAX_AGE_MS) return read();
  return (known.plan$ as Observable<T>).pipe(map((plan) => structuredClone(plan)));
}

/** The window closed (maybe after a save): the next click reads the program again. */
export function forgetDayWindowPlan(planId: string | null | undefined): void {
  if (planId) entries.delete(planId);
}
