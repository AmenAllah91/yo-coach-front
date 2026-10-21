import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ActivityQuery,
  ClientActivityPage,
  DashboardAlertItem,
  DashboardAlertType,
  DashboardConversation,
  DashboardPage,
  DashboardPreferences,
  DashboardSummary,
} from '../models/coach-dashboard.model';

/** Coach dashboard endpoints. The coach is always the signed-in user (never sent). */
@Injectable({ providedIn: 'root' })
export class CoachDashboardService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/coach/dashboard`;
  /** Each widget shows its own loading and error state (no full-page loader, no error toast). */
  private readonly widgetHeaders = new HttpHeaders({ 'X-Skip-Loader': 'true', 'X-Skip-Toast': 'true' });

  constructor(private http: HttpClient) {}

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/summary`, { headers: this.widgetHeaders });
  }

  getAlerts(type: DashboardAlertType, page = 0, size = 20): Observable<DashboardPage<DashboardAlertItem>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<DashboardPage<DashboardAlertItem>>(`${this.baseUrl}/alerts/${type}`, { params, headers: this.widgetHeaders });
  }

  getActivities(query: ActivityQuery = {}): Observable<ClientActivityPage> {
    let params = new HttpParams().set('limit', query.limit ?? 20);
    if (query.category) params = params.set('category', query.category);
    if (query.clientId) params = params.set('clientId', query.clientId);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.http.get<ClientActivityPage>(`${this.baseUrl}/activities`, { params, headers: this.widgetHeaders });
  }

  getConversations(ids: string[]): Observable<DashboardConversation[]> {
    let params = new HttpParams();
    ids.forEach((id) => (params = params.append('ids', id)));
    return this.http.get<DashboardConversation[]>(`${this.baseUrl}/conversations`, { params, headers: this.widgetHeaders });
  }

  savePreferences(preferences: DashboardPreferences): Observable<DashboardPreferences> {
    return this.http.put<DashboardPreferences>(`${this.baseUrl}/preferences`, preferences, {
      headers: new HttpHeaders({ 'X-Skip-Loader': 'true' }),
    });
  }
}
