import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ProgressPicture {
  id: string;
  imageUrl: string;
  weight: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveProgressPictureRequest {
  imageUrl: string;
  weight: number;
  date: string;
  clientId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressPicturesService {
  private apiUrl = `${environment.baseApiUrl}/api/progress-pictures/`;

  constructor(private http: HttpClient) {}

  createProgressPicture(body: SaveProgressPictureRequest): Observable<ProgressPicture> {
    return this.http.post<ProgressPicture>(this.apiUrl, body);
  }

  updateProgressPicture(id: string, body: SaveProgressPictureRequest): Observable<ProgressPicture> {
    return this.http.put<ProgressPicture>(`${this.apiUrl}${id}`, body);
  }

  getProgressPicturesByClient(clientId: string): Observable<ProgressPicture[]> {
    return this.http.get<ProgressPicture[]>(`${this.apiUrl}client/${clientId}`);
  }

  deleteProgressPicture(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}`);
  }
}
