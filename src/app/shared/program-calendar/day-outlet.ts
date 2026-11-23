import { ActivatedRoute, Router, UrlSegment, UrlSegmentGroup } from '@angular/router';

/**
 * A day of a client's program edited over the page that asked for it (the client's profile): the editor is shown in
 * the layout's named outlet `day` (app.routes.ts, main-layout), only its day window, the page stays underneath.
 * URL: `/clients/profil-client/ID(day:workout/CLIENT/PLAN/10)`.
 */
export const DAY_OUTLET = 'day';

/** The editors that open in the outlet: the first segment of its URL. */
export type DayOutletKind = 'workout' | 'full-plan' | 'macro-plan' | 'macro-day';

const FULL_EDITOR: Record<DayOutletKind, string> = {
  'workout': 'create-workout',
  'full-plan': 'create-full-plan',
  'macro-plan': 'create-macro-plan',
  'macro-day': 'create-macro-plan-total-day',
};

/** Opens the day's window over the current page. */
export function openDayOutlet(router: Router, kind: DayOutletKind, clientId: string, planId: string, dayNumber: number): void {
  const tree = router.parseUrl(router.url);
  const segments = [kind, clientId, planId, String(dayNumber)].map((path) => new UrlSegment(path, {}));
  tree.root.children[DAY_OUTLET] = new UrlSegmentGroup(segments, {});
  void router.navigateByUrl(tree);
}

/** The page underneath, without the day window (its URL as text). */
export function pageUnderneath(router: Router): string {
  const tree = router.parseUrl(router.url);
  delete tree.root.children[DAY_OUTLET];
  return router.serializeUrl(tree);
}

/** Closes the day window: the page underneath stays as it was. */
export function closeDayOutlet(router: Router): void {
  void router.navigateByUrl(pageUnderneath(router));
}

export function inDayOutlet(route: ActivatedRoute): boolean {
  return route.outlet === DAY_OUTLET;
}

/** The day asked for: in the outlet's path, or `?day=N` on a full page. */
export function requestedDayNumber(route: ActivatedRoute): number {
  return Number(route.snapshot.paramMap.get('day') || route.snapshot.queryParamMap.get('day')) || 0;
}

/** « Tout le programme » from the window: the editor's full page on this day, back to the page underneath after. */
export function openFullEditor(router: Router, route: ActivatedRoute, dayNumber: number): void {
  const kind = (route.snapshot.url[0]?.path || 'workout') as DayOutletKind;
  const clientId = route.snapshot.paramMap.get('idClient') || '';
  const planId = route.snapshot.paramMap.get('id') || '';
  const returnUrl = pageUnderneath(router);
  const tree = router.createUrlTree(['/clients', FULL_EDITOR[kind] || 'create-workout', clientId, 'edit', planId], {
    queryParams: { day: dayNumber || null, returnUrl },
  });
  // The full page only: the day window is not kept over it.
  delete tree.root.children[DAY_OUTLET];
  void router.navigateByUrl(tree);
}
