import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, of } from 'rxjs';
import { AssignmentsApiService, CheckinInboxCounts } from 'app/components/forms/services/assignments-api.service';

/** Not read more than once a minute when the coach moves between pages. */
const MIN_REFRESH_MS = 60_000;

/**
 * The coach's check-in counts (2026-11-19): the menu badge (answers to read) and the check-ins page share them.
 * An older server without /owner/counts leaves the badge empty, nothing breaks.
 */
@Injectable({ providedIn: 'root' })
export class CheckinInboxService {
  private readonly countsSubject = new BehaviorSubject<CheckinInboxCounts | null>(null);
  readonly counts$ = this.countsSubject.asObservable();
  private lastRead = 0;
  private reading = false;

  constructor(private api: AssignmentsApiService) {}

  /** Reads the counts again; `force` after an action on the check-ins page. */
  refresh(force = false): void {
    if (this.reading || (!force && Date.now() - this.lastRead < MIN_REFRESH_MS)) return;
    this.reading = true;
    this.lastRead = Date.now();
    this.api.ownerCounts().pipe(catchError(() => of(null))).subscribe((counts) => {
      this.reading = false;
      if (counts) this.countsSubject.next(counts);
    });
  }

  /** The page already knows the counts from its lists: the badge follows at once, without a request. */
  set(counts: CheckinInboxCounts): void {
    this.lastRead = Date.now();
    this.countsSubject.next(counts);
  }
}
