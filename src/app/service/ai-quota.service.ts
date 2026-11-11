import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

/** IA-15: one counter of the coach. Null limit = no limit. */
export interface AiQuotaStatus {
  code: string; labelFr: string; labelEn?: string | null; limit: number | null; used: number; remaining: number | null;
  resetAt: string | null;
  /** IA-50: copied from the overview by quotaOf (the texts say "during your trial" or "this month"). */
  trial?: boolean; active?: boolean;
}
export interface AiQuotaOverview {
  active: boolean; trial: boolean; planName: string | null; periodStart: string | null; periodEnd: string | null;
  quotas: AiQuotaStatus[];
}

/** IA-15: AI counters of the connected coach (used, limit, remaining, reset date). */
@Injectable({ providedIn: 'root' })
export class AiQuotaService {
  private url = `${environment.baseApiUrl}/api/ai/quota`;
  constructor(private http: HttpClient) {}

  overview(): Observable<AiQuotaOverview> {
    return this.http.get<AiQuotaOverview>(this.url, { headers: { 'X-Skip-Loader': 'true' } });
  }
}

/** The counter of one code; a code missing from the plan means "not allowed" (limit 0). */
export function quotaOf(overview: AiQuotaOverview | null | undefined, code: string): AiQuotaStatus | null {
  if (!overview) return null;
  const quota = overview.quotas.find(q => q.code === code)
    ?? { code, labelFr: code, limit: 0, used: 0, remaining: 0, resetAt: overview.periodEnd };
  return { ...quota, trial: overview.trial, active: overview.active };
}

/** IA-50: no creation left (a null limit is no limit). */
export function quotaExhausted(quota: AiQuotaStatus | null | undefined): boolean {
  return !!quota && quota.limit !== null && (quota.remaining ?? 0) <= 0;
}

/** IA-10..15: translation key of an AI error answered by CE ({code, error, ...}). */
export function aiErrorKey(error: unknown): string {
  const code = error instanceof HttpErrorResponse ? error.error?.code : null;
  switch (code) {
    case 'AI_QUOTA_REACHED': return error instanceof HttpErrorResponse && error.error?.reason === 'READ_ONLY'
      ? 'AI_ERROR_NO_SUBSCRIPTION' : 'AI_ERROR_QUOTA_REACHED';
    case 'AI_RATE_LIMITED': return 'AI_ERROR_RATE_LIMITED';
    case 'AI_REFUSED': return 'AI_ERROR_REFUSED';
    case 'AI_INPUT_TOO_LONG': return 'AI_ERROR_INPUT_TOO_LONG';
    case 'AI_DISABLED':
    case 'AI_BUDGET_REACHED': return 'AI_ERROR_PAUSED';
    default: return 'AI_ERROR_UNAVAILABLE'; // AI_UNAVAILABLE, AI_QUOTA_UNAVAILABLE, network
  }
}
