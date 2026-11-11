import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

export interface PaymentIncident {
  id: number;
  startedAt: string;
  startedBy: string;
  reason: string;
  endedAt: string | null;
  endedBy: string | null;
  extraDays: number | null;
  cutoffsPausedUntil: string | null;
}

/** YoSales CutoffGuardService.IncidentState, relayed by CE /api/admin/payment-incident. */
export interface PaymentIncidentState {
  active: boolean;
  current: PaymentIncident | null;
  /** Extra days after the last incident: no cut-off before this instant. */
  cutoffsPausedUntil: string | null;
  history: PaymentIncident[];
}

@Injectable({ providedIn: 'root' })
export class PaymentIncidentService {
  private readonly url = `${environment.baseApiUrl}/api/admin/payment-incident`;

  constructor(private http: HttpClient) {}

  state() {
    return this.http.get<PaymentIncidentState>(this.url);
  }

  start(reason: string) {
    return this.http.post<PaymentIncidentState>(`${this.url}/start`, { reason });
  }

  end(extraDays: number | null) {
    return this.http.post<PaymentIncidentState>(`${this.url}/end`, { extraDays });
  }
}
