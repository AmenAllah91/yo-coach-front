import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {map, Observable, of, throwError} from 'rxjs';
import { environment } from '@env/environment';
import { switchMap } from 'rxjs/operators';
import {ClientScheduleItemDto} from "../../../models/client-schedule.model";
export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNSAVED';

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
  showInSignup?: boolean;
}

/** ====== LIST MODEL (ta liste actuelle) ====== */
export interface Form {
  id: string;
  title: string;
  name: string;
  description?: string;
  status: FormStatus;
  previousStatus?: FormStatus | null;
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

  getMyFormsPage(page: number, size: number, status?: FormStatus, excludeArchived?: boolean, clientId?: string | null) {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'updatedAt')
      .set('direction', 'DESC');

    if (status) params = params.set('status', status);
    if (excludeArchived) params = params.set('excludeArchived', 'true');
    if (clientId) params = params.set('clientId', clientId);
    return this.http.get<PageResponse<Form>>(`${this.baseUrl}/page`, { params });
  }

  getCounts() {
    return this.http.get<{active: number; archived: number}>(`${this.baseUrl}/counts`);
  }

  /** ✅ EXISTANT */
  deleteForm(formId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(formId)}`);
  }

  /** ✅ NEW : GET (owner) */
  getForOwner(formId: string): Observable<FormDetails> {
    return this.http.get<FormDetails>(`${this.baseUrl}/${encodeURIComponent(formId)}/owner`);
  }
  getFormById(formId: string, silent = false): Observable<FormDetails> {
    return this.http.get<FormDetails>(`${this.baseUrl}/${encodeURIComponent(formId)}`, silent ? {
      headers: {
        'X-Skip-Toast': 'true',
        'X-Skip-Loader': 'true'
      }
    } : {});
  }
  createForm(payload: FormDetails): Observable<FormDetails> {
    const publishError = this.getPublishValidationError(payload);
    if (payload.status === 'PUBLISHED' && publishError) {
      return throwError(() => new Error(publishError));
    }

    return this.http.post<FormDetails>(
      `${this.baseUrl}`,
      payload,
      {
        headers: {
          'X-Skip-Toast': 'true',
          'X-Skip-Loader': 'true'
        }
      }
    );
  }

  updateForm(formId: string, payload: FormDetails): Observable<FormDetails> {
    const publishError = this.getPublishValidationError(payload);
    if (payload.status === 'PUBLISHED' && publishError) {
      return throwError(() => new Error(publishError));
    }

    return this.http.put<FormDetails>(
      `${this.baseUrl}/${encodeURIComponent(formId)}`,
      payload,
      {
        headers: {
          'X-Skip-Toast': 'true',
          'X-Skip-Loader': 'true'
        }
      }
    );
  }

  private getPublishValidationError(payload: FormDetails): string | null {
    const questions = payload.questions ?? [];
    if (questions.length === 0) return 'A published check-in requires at least one question.';

    for (const question of questions) {
      if (!question.label?.trim()) return 'Every published question requires question text.';

      if (question.type === 'MULTIPLE_CHOICE') {
        const labels = (question.options ?? []).map(option => option.label?.trim() ?? '');
        if (labels.length < 2) return 'Multiple choice questions require at least two options.';
        if (labels.some(label => !label)) return 'Multiple choice options cannot be empty.';
        const normalized = labels.map(label => label.toLocaleLowerCase());
        if (new Set(normalized).size !== normalized.length) return 'Multiple choice options must be unique.';
      }
    }

    const schedule = payload.schedule;
    if (!schedule) return null;
    if (!schedule.frequency) return 'An automatic check-in schedule requires a reminder frequency.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time ?? '')) return 'An automatic check-in schedule requires a valid send time.';

    if (schedule.frequency === 'WEEKLY' && !(schedule.daysOfWeek?.length)) {
      return 'Weekly check-ins require a weekday.';
    }

    if (schedule.frequency === 'BIWEEKLY' && !(schedule.daysOfWeek?.length)) {
      return 'Biweekly check-ins require a weekday.';
    }

    if (schedule.frequency === 'MONTHLY' && (!Number.isInteger(schedule.monthlyDay) || schedule.monthlyDay! < 1 || schedule.monthlyDay! > 31)) {
      return 'Monthly check-ins require a day of month between 1 and 31.';
    }

    return null;
  }

  /** une api provisoire pour recuperer les utilisateurs seulement pour tester l'affectation de formulaire */
  getAllUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.userUrl}`);
  }

  ensurePublished(formId: string) {
    return this.getForOwner(formId).pipe(
      switchMap((details) => {
        if (details.status === 'PUBLISHED') return of(null);

        return this.updateForm(formId, {
          ...details,
          status: 'PUBLISHED',
        }).pipe(map(() => null));
      })
    );
  }

  archiveForm(id: string) {
    return this.http.post<Form>(`${this.baseUrl}/${encodeURIComponent(id)}/archive`, {});
  }

  unarchiveForm(id: string) {
    return this.http.post<Form>(`${this.baseUrl}/${encodeURIComponent(id)}/unarchive`, {});
  }


  getClientScheduleItemsPage(clientId: string, page: number, size: number) {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .set('sortBy', 'dueAt')
      .set('direction', 'ASC');

    return this.http.get<PageResponse<ClientScheduleItemDto>>(
      `${environment.baseApiUrl}/api/v1/client-schedules/clients/${clientId}/schedule-items/page`,
      { params }
    );
  }

  getClientScheduleItems(clientId: string) {
    return this.http.get<ClientScheduleItemDto[]>(
      `${environment.baseApiUrl}/api/v1/client-schedules/clients/${clientId}/schedule-items`
    );
  }

  deleteClientScheduleItem(id: string) {
    return this.http.delete<void>(`${environment.baseApiUrl}/api/v1/client-schedules/client-schedule-items/${id}`);
  }
}
