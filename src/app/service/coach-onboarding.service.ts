import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  CoachOnboardingState,
  CoachOnboardingStep,
  CoachOnboardingStepPayload,
} from '../models/coach-onboarding.model';

@Injectable({ providedIn: 'root' })
export class CoachOnboardingService {
  private readonly apiBase = environment.baseApiUrl.replace(/\/$/, '');
  private readonly baseUrl = `${this.apiBase}/api/coach-onboarding`;
  private readonly stateSubject = new BehaviorSubject<CoachOnboardingState | null>(null);

  readonly state$ = this.stateSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  get currentState(): CoachOnboardingState | null {
    return this.stateSubject.value;
  }

  load(force = false): Observable<CoachOnboardingState> {
    if (!force && this.currentState) {
      return of(this.currentState);
    }
    const headers = new HttpHeaders({ 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' });
    return this.http.get<CoachOnboardingState>(this.baseUrl, { headers }).pipe(
      tap((state) => this.stateSubject.next(state)),
    );
  }

  saveStep(step: Exclude<CoachOnboardingStep, 'completed'>, payload: CoachOnboardingStepPayload): Observable<CoachOnboardingState> {
    return this.http.put<CoachOnboardingState>(`${this.baseUrl}/steps/${step}`, payload).pipe(
      tap((state) => this.stateSubject.next(state)),
    );
  }

  clear(): void {
    this.stateSubject.next(null);
  }
}
