import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface BodyMeasurement {
  id?: string;
  clientId: string;
  measurementType: string;
  value: number;
  unit?: string;
  date: string;
  note?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BodyMeasurementUserProfile {
  id?: string;
  targetWeight?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class BodyMeasurementsService {
  private baseUrl = `${environment.baseApiUrl}/api/body-measurements`;
  private usersUrl = `${environment.baseApiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getByClient(clientId: string): Observable<BodyMeasurement[]> {
    return this.http.get<BodyMeasurement[]>(`${this.baseUrl}/client/${clientId}`);
  }

  getByClientAndType(clientId: string, measurementType: string): Observable<BodyMeasurement[]> {
    return this.http.get<BodyMeasurement[]>(
      `${this.baseUrl}/client/${clientId}/type/${measurementType}`
    );
  }

  getClientProfile(clientId: string): Observable<BodyMeasurementUserProfile> {
    return this.http.get<BodyMeasurementUserProfile>(`${this.usersUrl}/${clientId}`);
  }

  create(payload: BodyMeasurement): Observable<BodyMeasurement> {
    return this.http.post<BodyMeasurement>(this.baseUrl, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
