import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { ExerciseHistory, ExerciseSummaryList } from '@shared/models/exercise-history';

/**
 * Ce que les clients d'un coach ont fait, exercice par exercice (progression, « la dernière fois »).
 * La liste est légère (une ligne par exercice) ; les séances d'un exercice arrivent seulement quand on l'ouvre.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseHistoryService {
  private readonly url = `${environment.baseApiUrl}/api/program-schedule/exercise-history`;
  /** Une lecture par client est gardée une minute : le profil et l'éditeur la partagent. */
  private readonly summaries = new Map<string, { at: number; read: Observable<ExerciseSummaryList> }>();
  private readonly details = new Map<string, { at: number; read: Observable<ExerciseHistory> }>();

  constructor(private http: HttpClient) {}

  summary(clientId: string): Observable<ExerciseSummaryList> {
    const kept = this.summaries.get(clientId);
    if (kept && Date.now() - kept.at < 60_000) return kept.read;
    const read = this.http.get<ExerciseSummaryList>(`${this.url}/summary`, { params: { clientId } }).pipe(
      map(list => ({ pinned: list?.pinned || [], exercises: list?.exercises || [] })),
      shareReplay(1),
    );
    this.summaries.set(clientId, { at: Date.now(), read });
    // Une lecture ratée n'est pas gardée.
    read.subscribe({ error: () => this.summaries.delete(clientId) });
    return read;
  }

  /** Toutes les séances d'un exercice (nom ou clé). */
  one(clientId: string, exercise: string): Observable<ExerciseHistory> {
    const id = `${clientId}|${exercise.trim().toLowerCase()}`;
    const kept = this.details.get(id);
    if (kept && Date.now() - kept.at < 60_000) return kept.read;
    const read = this.http.get<ExerciseHistory>(`${this.url}/one`, { params: { clientId, exercise } }).pipe(shareReplay(1));
    this.details.set(id, { at: Date.now(), read });
    read.subscribe({ error: () => this.details.delete(id) });
    return read;
  }

  /** Remplace les exercices épinglés de ce client ; renvoie les clés gardées. */
  pin(clientId: string, keys: string[]): Observable<string[]> {
    return this.http.put<string[]>(`${this.url}/pins`, keys, { params: { clientId } }).pipe(
      tap(pinned => {
        const kept = this.summaries.get(clientId);
        if (!kept) return;
        const read = kept.read.pipe(map(list => ({ ...list, pinned })), shareReplay(1));
        this.summaries.set(clientId, { at: kept.at, read });
      }),
    );
  }
}
