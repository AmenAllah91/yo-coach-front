import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ClientStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface ClientStatusCounts {
  active: number;
  paused: number;
  archived: number;
  total: number;
}

export interface Client {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: string;
  login?: string;
  activated?: boolean;
  coachId?: string;
  image?: string;
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
    status?: ClientStatus
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/coach/${coachId}`, { params });
  }

  getListClientsByCoachWithoutPagination(coachId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/coach/${coachId}/all`);
  }

  getClientStatusCounts(coachId: string): Observable<ClientStatusCounts> {
    return this.http.get<ClientStatusCounts>(`${this.apiUrl}/coach/${coachId}/status-counts`);
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

  updateClientStatus(id: string, status: ClientStatus): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/status`, { status });
  }

  deleteClient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
