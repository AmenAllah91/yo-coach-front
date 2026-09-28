import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ClientTaskType = 'GENERAL' | 'CLIENT_PROGRESS' | 'BODY_METRICS' | 'FORM';
export type TaskStatus = 'UPCOMING' | 'DONE' | 'MISSED';
export type HabitUnit = 'TIMES' | 'MINUTES' | 'HOURS' | 'LITERS' | 'SERVINGS' | 'STEPS' | 'CUSTOM';

export interface ClientTaskPayload {
  id?: string;
  clientId: string;
  type: ClientTaskType;
  title: string;
  instructions?: string;
  date: string;
  reminderEnabled: boolean;
  reminderTime?: string;
  allowClientComment: boolean;
  formId?: string;
}

export interface HabitPayload {
  id?: string;
  clientId: string;
  name: string;
  goalValue: number | null;
  unit: HabitUnit;
  customUnit?: string;
  startDate: string;
  endDate?: string | null;
  repeatType: 'DAILY' | 'WEEKLY';
  weekDays: string[];
  reminderEnabled: boolean;
  reminderTime?: string;
  allowClientComment: boolean;
}

export interface TaskCalendarItem {
  id: string;
  occurrenceId: string;
  itemType: 'TASK' | 'HABIT';
  taskType?: ClientTaskType;
  title: string;
  instructions?: string;
  date: string;
  status: TaskStatus;
  completedValue?: number;
  goalValue?: number;
  unit?: HabitUnit;
  customUnit?: string;
  startDate?: string;
  endDate?: string;
  repeatType?: 'DAILY' | 'WEEKLY';
  weekDays?: string[];
  reminderEnabled: boolean;
  reminderTime?: string;
  allowClientComment: boolean;
  clientComment?: string;
  formId?: string;
}

export interface TaskCalendarResponse {
  items: TaskCalendarItem[];
  summary: { completionPercent: number; done: number; missed: number; upcoming: number };
}

@Injectable({ providedIn: 'root' })
export class ClientTasksService {
  private readonly url = `${environment.baseApiUrl}/api/client-tasks`;
  constructor(private http: HttpClient) {}

  calendar(clientId: string, from: string, to: string): Observable<TaskCalendarResponse> {
    const params = new HttpParams().set('clientId', clientId).set('from', from).set('to', to);
    return this.http.get<TaskCalendarResponse>(`${this.url}/calendar`, { params });
  }
  createTask(value: ClientTaskPayload) { return this.http.post<ClientTaskPayload>(this.url, value); }
  updateTask(id: string, value: ClientTaskPayload) { return this.http.put<ClientTaskPayload>(`${this.url}/${id}`, value); }
  deleteTask(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
  setTaskCompletion(id: string, completed: boolean) { return this.http.patch<void>(`${this.url}/${id}/completion`, { completed }); }
  createHabit(value: HabitPayload) { return this.http.post<HabitPayload>(`${this.url}/habits`, value); }
  updateHabit(id: string, value: HabitPayload) { return this.http.put<HabitPayload>(`${this.url}/habits/${id}`, value); }
  deleteHabit(id: string) { return this.http.delete<void>(`${this.url}/habits/${id}`); }
  setHabitCompletion(id: string, date: string, completed: boolean, completedValue?: number) {
    return this.http.patch<void>(`${this.url}/habits/${id}/occurrences/${date}/completion`, { completed, completedValue });
  }
}
