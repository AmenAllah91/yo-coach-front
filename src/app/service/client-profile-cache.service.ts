import { Injectable } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { ClientService } from './client.service';
import { BodyMeasurementsService } from './body-measurements.service';
import { WorkoutService } from './workout.service';
import { NutritionService } from './nutrition.service';

export type ClientProfilePart = 'client' | 'measurements' | 'workouts' | 'nutrition';

interface Entry {
  at: number;
  value: any;
}

/** Shown without a new request below this age (the coach comes back to the same client). */
const FRESH_MS = 60_000;
/** Shown at once below this age, then refreshed in the background. */
const STALE_MS = 15 * 60_000;
const MAX_CLIENTS = 30;

/**
 * Data of the client profile kept per client: reopening a profile (or switching back to a client) shows it at once,
 * the list of clients can prefetch it on hover, and requests running for the same data are shared.
 */
@Injectable({ providedIn: 'root' })
export class ClientProfileCacheService {
  private readonly entries = new Map<string, Entry>();
  private readonly running = new Map<string, Observable<any>>();

  constructor(
    private clientService: ClientService,
    private bodyMeasurementsService: BodyMeasurementsService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
  ) {}

  /** The last known value (up to 15 min old), null when unknown. */
  snapshot<T>(part: ClientProfilePart, clientId: string): T | null {
    const entry = this.entries.get(this.key(part, clientId));
    return entry && Date.now() - entry.at < STALE_MS ? (entry.value as T) : null;
  }

  isFresh(part: ClientProfilePart, clientId: string): boolean {
    const entry = this.entries.get(this.key(part, clientId));
    return !!entry && Date.now() - entry.at < FRESH_MS;
  }

  /** Reads the part from the server (shared with a request already running) and keeps the answer. */
  load<T>(part: ClientProfilePart, coachId: string, clientId: string): Observable<T> {
    const key = this.key(part, clientId);
    const running = this.running.get(key);
    if (running) return running as Observable<T>;
    const request = this.source(part, coachId, clientId).pipe(
      tap((value) => this.remember(key, value)),
      finalize(() => this.running.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.running.set(key, request);
    return request as Observable<T>;
  }

  /** A change made on the profile (plan assigned, measurement added...): the next read goes to the server. */
  forget(part: ClientProfilePart, clientId: string): void {
    this.entries.delete(this.key(part, clientId));
  }

  /** Clients of the coach (client panel of the profile, with their photos): kept 2 min between profiles. */
  private coachClients: { coachId: string; at: number; clients: any[] } | null = null;

  /** Kept 30 min; `fresh` (under 2 min) means no refresh is needed, otherwise it is shown and refreshed behind. */
  coachClientsSnapshot(coachId: string): { clients: any[]; fresh: boolean } | null {
    const known = this.coachClients;
    if (!known || known.coachId !== coachId) return null;
    const age = Date.now() - known.at;
    return age < 30 * 60_000 ? { clients: known.clients, fresh: age < 120_000 } : null;
  }

  rememberCoachClients(coachId: string, clients: any[]): void {
    this.coachClients = { coachId, at: Date.now(), clients };
  }

  /** Starts loading what the profile opens with (list of clients: hover or focus on a client). */
  prefetch(coachId: string | null, clientId: string | undefined): void {
    if (!coachId || !clientId) return;
    (['client', 'measurements', 'workouts', 'nutrition'] as ClientProfilePart[]).forEach((part) => {
      if (!this.isFresh(part, clientId)) this.load(part, coachId, clientId).subscribe({ error: () => {} });
    });
  }

  private source(part: ClientProfilePart, coachId: string, clientId: string): Observable<any> {
    switch (part) {
      case 'client':
        return this.clientService.getClientById(clientId, true);
      case 'measurements':
        return this.bodyMeasurementsService.getByClient(clientId, true).pipe(map((items) => items || []));
      case 'workouts':
        return this.workoutService
          .getWorkoutByCoachIdAndClient(coachId, clientId, 0, 100, 'ALL', 'ALL', 'ALL', 'RECOMMENDED', true)
          .pipe(map((res: any) => res?.content || []));
      case 'nutrition':
        return this.nutritionService
          .getNutritionPlanByCoachIdAndClient(coachId, clientId, 0, 100, 'ALL', 'ALL', 'ALL', 'RECOMMENDED', true)
          .pipe(map((res: any) => res?.content || []));
    }
  }

  private remember(key: string, value: any): void {
    if (this.entries.size >= MAX_CLIENTS * 4) {
      const oldest = [...this.entries.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) this.entries.delete(oldest[0]);
    }
    this.entries.set(key, { at: Date.now(), value });
  }

  private key(part: ClientProfilePart, clientId: string): string {
    return `${part}:${clientId}`;
  }
}
