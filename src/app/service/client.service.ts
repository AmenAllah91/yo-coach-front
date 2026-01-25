import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  selected: boolean;
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
    size: number = 10
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/coach/${coachId}?page=${page}&size=${size}`
    );
  }

  getListClientsByCoachWithoutPagination(coachId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/coach/${coachId}/all`);
  }

  getClientById(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  createClient(client: Client): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, client);
  }

  updateClient(id: string, client: Client): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, client);
  }

  deleteClient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
