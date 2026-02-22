import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** ====== BACK MODELS ====== */
export type QuestionTypeBE =
  | 'SCALE'
  | 'MULTIPLE_CHOICE'
  | 'STAR_RATING'
  | 'YES_NO'
  | 'TEXT'
  | 'OPINION_RATING'
  | 'SIGNATURE'
  | 'MEDIA'
  | 'DATE'
  | 'PROGRESS_PHOTO';

export interface OptionItemBE {
  id: string;
  label: string;
}

export interface QuestionBE {
  id: string;
  type: QuestionTypeBE;
  label: string;
  required: boolean;
  order: number;
  options?: OptionItemBE[] | null;
}

export interface FormSchedule {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  time: string;
  daysOfWeek?: string[];
  biweeklyWeeks?: 'W1_3' | 'W2_4';
  monthlyMode?: 'START' | 'END' | 'SPECIFIC';
  monthlyDay?: number;
}

export interface FormDetails {
  id?: string;
  title: string;
  description?: string;
  status?: FormStatus;
  createdAt?: string;
  updatedAt?: string;
  questions: QuestionBE[];
  schedule?: FormSchedule;
}

/** ====== LIST MODEL (ta liste actuelle) ====== */
export interface Form {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  updatedAt?: string;
  createdAt?: string;
  schedule?: FormSchedule | null;

}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
export interface UserDto {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  login?: string;
}
@Injectable({ providedIn: 'root' })
export class FormsApiService {
  private baseUrl = `${environment.baseApiUrl}/api/v1/forms`;
  private userUrl = `${environment.baseApiUrl}/clients/clients`;
  constructor(private http: HttpClient) {}

  /** ✅ EXISTANT */
  getMyFormsPage(page: number, size: number): Observable<PageResponse<Form>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'updatedAt')
      .set('direction', 'DESC');

    return this.http.get<PageResponse<Form>>(`${this.baseUrl}/page`, { params });
  }

  /** ✅ EXISTANT */
  deleteForm(formId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(formId)}`);
  }

  /** ✅ NEW : GET (owner) */
  getForOwner(formId: string): Observable<FormDetails> {
    return this.http.get<FormDetails>(`${this.baseUrl}/${encodeURIComponent(formId)}/owner`);
  }
  getFormById(formId: string): Observable<FormDetails> {
    return this.http.get<FormDetails>(`${this.baseUrl}/${encodeURIComponent(formId)}`);
  }
  /** ✅ NEW : CREATE */
  createForm(payload: FormDetails): Observable<FormDetails> {
    return this.http.post<FormDetails>(`${this.baseUrl}`, payload);
  }

  /** ✅ NEW : UPDATE */
  updateForm(formId: string, payload: FormDetails): Observable<FormDetails> {
    return this.http.put<FormDetails>(`${this.baseUrl}/${encodeURIComponent(formId)}`, payload);
  }

  /** une api provisoire pour recuperer les utilisateurs seulement pour tester l'affectation de formulaire */
  getAllUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.userUrl}`);
  }


}
