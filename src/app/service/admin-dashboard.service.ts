import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

export interface AdminUserStats {
  totalCoaches: number;
  newCoaches: number;
  totalClients: number;
  blockedCoaches: number;
  newCoachesSince: string;
  updatedAt: string;
}

export interface AdminBillingStats {
  trialCoaches: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  blockedCoaches: number;
  revenues: { currency: string; total: number; currentMonth: number; successfulPayments: number }[];
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  constructor(private http: HttpClient) {}
  getUsers() {
    return this.http.get<AdminUserStats>(`${environment.baseApiUrl}/api/admin/dashboard/users`);
  }
  getBilling() {
    return this.http.get<AdminBillingStats>(`${environment.baseApiUrl}/api/admin/dashboard/billing`);
  }
}
