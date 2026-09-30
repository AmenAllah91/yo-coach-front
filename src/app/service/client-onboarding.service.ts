import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ClientOnboardingState, ClientOnboardingStep } from '../models/client-onboarding.model';

@Injectable({ providedIn: 'root' })
export class ClientOnboardingService {
  private readonly url = `${environment.baseApiUrl.replace(/\/$/, '')}/api/client-onboarding`;
  private readonly subject = new BehaviorSubject<ClientOnboardingState | null>(null);
  readonly state$ = this.subject.asObservable();

  constructor(private readonly http: HttpClient) {}

  load(force = false): Observable<ClientOnboardingState> {
    if (!force && this.subject.value) return of(this.subject.value);
    const headers = new HttpHeaders({ 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' });
    return this.http.get<ClientOnboardingState>(this.url, { headers }).pipe(tap(state => this.subject.next(state)));
  }

  saveStep(step: Exclude<ClientOnboardingStep, 'completed'>, payload: unknown): Observable<ClientOnboardingState> {
    return this.http.put<ClientOnboardingState>(`${this.url}/steps/${step}`, payload).pipe(tap(state => this.subject.next(state)));
  }

  clear(): void { this.subject.next(null); }
}
