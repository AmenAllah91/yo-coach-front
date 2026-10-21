import { Injectable } from '@angular/core';
import { ClientActivity } from '../../../models/coach-dashboard.model';

export interface ActivityFilters {
  category: string | null;
  clientId: string | null;
  period: string;
  from: string | null;
  to: string | null;
}

interface ActivityFeedSnapshot {
  key: string;
  items: ClientActivity[];
  nextCursor: string | null;
  scrollY: number;
  savedAt: number;
}

/** A list older than this is read again (it would no longer be "where the coach left it"). */
const KEEP_MS = 10 * 60_000;

/**
 * Keeps the "All activities" list (loaded pages and scroll position) while the coach opens an activity, so coming
 * back shows the same place instead of the first page. Memory only: a new session starts from the top.
 */
@Injectable({ providedIn: 'root' })
export class ActivityFeedStateService {
  private snapshot: ActivityFeedSnapshot | null = null;

  static keyOf(filters: ActivityFilters): string {
    return [filters.category, filters.clientId, filters.period, filters.from, filters.to].map((value) => value ?? '').join('|');
  }

  save(filters: ActivityFilters, items: ClientActivity[], nextCursor: string | null, scrollY: number): void {
    this.snapshot = { key: ActivityFeedStateService.keyOf(filters), items, nextCursor, scrollY, savedAt: Date.now() };
  }

  restore(filters: ActivityFilters): Omit<ActivityFeedSnapshot, 'key'> | null {
    const snapshot = this.snapshot;
    if (!snapshot || Date.now() - snapshot.savedAt > KEEP_MS) return null;
    return snapshot.key === ActivityFeedStateService.keyOf(filters) ? snapshot : null;
  }

  clear(): void {
    this.snapshot = null;
  }
}
