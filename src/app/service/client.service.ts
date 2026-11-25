import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type ClientStatus = 'ACTIVE' | 'ARCHIVED';

/** Order of the coach's client list (CE: name A→Z by default, name Z→A, newest first). */
export type ClientListSort = 'name' | 'name_desc' | 'recent';

/**
 * 2026-11-23: the message of a refused status change (archive / reactivate). Null for a full plan: the interceptor
 * already opens the plan notice (« Limite atteinte… archivez un client ou changez de plan »).
 */
export function clientStatusErrorKey(error: any): string | null {
  const code = error?.error?.code;
  if (code === 'CLIENT_LIMIT_REACHED') return null;
  if (code === 'CLIENT_LEFT_COACH') return 'CLIENT_LEFT_COACH_ERROR';
  return 'CLIENT_STATUS_CHANGE_FAILED';
}

export interface ClientStatusCounts {
  active: number;
  archived: number;
  total: number;
}

export interface Client {
  id?: string;
  /** The example client of the demo workspace (shown with an "Example" badge). */
  demo?: boolean;
  /** 2026-11-23: no longer coached by you (left, or removed by another coach): cannot be reactivated, only removed. */
  formerClient?: boolean;
  /** 2026-11-23, with formerClient: the client now works with another coach. */
  leftForAnotherCoach?: boolean;
  firstName: string;
  lastName: string;
  email: string;
  gender?: string;
  login?: string;
  activated?: boolean;
  coachId?: string;
  image?: string;
  avatarUrl?: string;
  coach?: {
    id: string;
  };
  workoutDates?: string[];
  coachingSpecialities?: any[];
  authorities?: any[];
  selected?: boolean;
  clientStatus?: ClientStatus;
  program?: string;
  lastProgramName?: string;
  currentProgramName?: string;
  currentProgramStartDate?: string;
  currentProgramEndDate?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private apiUrl = `${environment.baseApiUrl}/gym_coaching/clients`;

  constructor(private http: HttpClient) {}

  getClientsByCoach(
    coachId: string,
    page: number = 0,
    size: number = 10,
    status?: ClientStatus,
    skipLoader = false,
    search?: string,
    sort?: ClientListSort,
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) {
      params = params.set('status', status);
    }
    // 2026-11-23: searched and sorted by the server, in the whole list (not only the page shown).
    const q = search?.trim();
    if (q) {
      params = params.set('q', q);
    }
    if (sort) {
      params = params.set('sort', sort);
    }

    return this.http.get<any>(`${this.apiUrl}/coach/${coachId}`, {
      params,
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  getListClientsByCoachWithoutPagination(coachId: string, skipLoader = false): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/coach/${coachId}/all`, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  getClientStatusCounts(coachId: string, skipLoader = false): Observable<ClientStatusCounts> {
    return this.http.get<ClientStatusCounts>(`${this.apiUrl}/coach/${coachId}/status-counts`, {
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    });
  }

  getActiveClientsForAssignment(coachId: string, skipLoader = false): Observable<(Client & { id: string })[]> {
    return this.http.get<Client[]>(`${this.apiUrl}/coach/${coachId}/all`, {
      params: new HttpParams().set('status', 'ACTIVE'),
      headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {},
    }).pipe(
      map(clients => clients.filter((client): client is Client & { id: string } =>
        !!client.id && (client.clientStatus ?? 'ACTIVE') === 'ACTIVE'
      ))
    );
  }

  getClientById(id: string, silent = false): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`, silent ? {
      headers: {
        'X-Skip-Toast': 'true',
        'X-Skip-Loader': 'true'
      }
    } : {});
  }

  createClient(client: Client): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, client);
  }

  updateClient(id: string, client: Client): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, client);
  }

  /**
   * The callers show their own message on a failure (2026-11-23); a full plan (CLIENT_LIMIT_REACHED) still opens the
   * plan notice of the interceptor.
   */
  updateClientStatus(id: string, status: ClientStatus): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/status`, { status }, { headers: { 'X-Skip-Toast': 'true' } });
  }

  deleteClient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
