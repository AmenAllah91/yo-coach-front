import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AppThemeColors,
  AppThemeColorsPage,
} from '../models/app-theme-colors.model';

@Injectable({
  providedIn: 'root',
})
export class AppThemeColorsService {
  private readonly baseUrl = `${environment.baseApiUrl}/api/app-colors`;

  /** Last answers of the Branding page: shown at once on the next visit, then refreshed. */
  currentSnapshot: AppThemeColors | null = null;
  listSnapshot: AppThemeColorsPage | AppThemeColors[] | null = null;

  constructor(private http: HttpClient) {}

  getCurrent(skipLoader = false): Observable<AppThemeColors> {
    return this.http
      .get<AppThemeColors>(`${this.baseUrl}/current`, { headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {} })
      .pipe(tap((theme) => (this.currentSnapshot = theme)));
  }

  getAll(page = 0, size = 50, skipLoader = false): Observable<AppThemeColorsPage | AppThemeColors[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<AppThemeColorsPage | AppThemeColors[]>(this.baseUrl, { params, headers: skipLoader ? { 'X-Skip-Loader': 'true' } : {} })
      .pipe(tap((response) => (this.listSnapshot = response)));
  }

  getOne(id: string): Observable<AppThemeColors> {
    return this.http.get<AppThemeColors>(`${this.baseUrl}/${id}`);
  }

  create(theme: AppThemeColors): Observable<AppThemeColors> {
    return this.http.post<AppThemeColors>(this.baseUrl, theme);
  }

  update(id: string, theme: AppThemeColors): Observable<AppThemeColors> {
    return this.http.put<AppThemeColors>(`${this.baseUrl}/${id}`, theme);
  }

  patch(id: string, theme: Partial<AppThemeColors>): Observable<AppThemeColors> {
    return this.http.patch<AppThemeColors>(`${this.baseUrl}/${id}`, theme);
  }

  activate(id: string): Observable<AppThemeColors> {
    return this.http.put<AppThemeColors>(`${this.baseUrl}/${id}/activate`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** `objectPath` is what the theme saves (mobileLogoPath); `url` is what the page shows right away. */
  uploadMobileLogo(file: File): Observable<{ url: string; objectPath?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ url: string; objectPath?: string }>(
      `${this.baseUrl}/mobile-logo`,
      formData
    );
  }
}
