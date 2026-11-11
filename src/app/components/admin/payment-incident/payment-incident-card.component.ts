import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

import { PaymentIncidentService, PaymentIncidentState } from 'app/service/payment-incident.service';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';

export const MAX_EXTRA_DAYS = 14;

/** Extra days proposed when switching off: length of the incident (rounded up, at least 1) + 2, as YoSales does. */
export function defaultExtraDays(startedAt: string, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(startedAt).getTime()) / 3_600_000);
  const days = Math.max(1, Math.ceil(hours / 24)) + 2;
  return Math.min(days, MAX_EXTRA_DAYS);
}

/**
 * Admin switch "payment incident": while it is on, no coach is cut (trial end, grace end) and the payment buttons
 * show a notice; when it is switched off, the cut-offs stay paused some extra days so the coaches have time to pay.
 */
@Component({
  selector: 'app-payment-incident-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FeatherModule],
  templateUrl: './payment-incident-card.component.html',
  styleUrl: './payment-incident-card.component.scss',
})
export class PaymentIncidentCardComponent implements OnInit {
  readonly maxExtraDays = MAX_EXTRA_DAYS;

  state: PaymentIncidentState | null = null;
  loading = true;
  error = false;
  busy = false;
  actionError = '';
  /** 'start' or 'end' form open. */
  form: 'start' | 'end' | null = null;
  reason = '';
  extraDays = 3;
  showHistory = false;

  constructor(
    private api: PaymentIncidentService,
    private confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.api.state().subscribe({
      next: (s) => {
        this.state = s;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      },
    });
  }

  get pausedUntilFuture(): string | null {
    const until = this.state?.cutoffsPausedUntil;
    return until && new Date(until).getTime() > Date.now() ? until : null;
  }

  openStart(): void {
    this.form = 'start';
    this.reason = '';
    this.actionError = '';
  }

  openEnd(): void {
    this.form = 'end';
    this.actionError = '';
    this.extraDays = this.state?.current ? defaultExtraDays(this.state.current.startedAt) : 3;
  }

  cancel(): void {
    if (!this.busy) this.form = null;
  }

  get validStart(): boolean {
    return !!this.reason.trim() && this.reason.length <= 1000;
  }

  get validEnd(): boolean {
    return Number.isInteger(this.extraDays) && this.extraDays >= 0 && this.extraDays <= MAX_EXTRA_DAYS;
  }

  async start(): Promise<void> {
    if (!this.validStart || this.busy) return;
    const ok = await this.confirm.ask({
      title: 'PAYMENT_INCIDENT_START_TITLE',
      text: 'PAYMENT_INCIDENT_START_TEXT',
      confirm: 'PAYMENT_INCIDENT_START',
      icon: 'alert-octagon',
    });
    if (!ok) return;
    this.run(this.api.start(this.reason.trim()));
  }

  end(): void {
    if (!this.validEnd || this.busy) return;
    this.run(this.api.end(this.extraDays));
  }

  private run(call: ReturnType<PaymentIncidentService['state']>): void {
    this.busy = true;
    this.actionError = '';
    call.subscribe({
      next: (s) => {
        this.state = s;
        this.busy = false;
        this.form = null;
      },
      error: (e) => {
        this.busy = false;
        this.actionError = e?.status === 409 ? 'PAYMENT_INCIDENT_ERR_CHANGED' : 'PAYMENT_INCIDENT_ERR';
        if (e?.status === 409) this.load();
      },
    });
  }
}
