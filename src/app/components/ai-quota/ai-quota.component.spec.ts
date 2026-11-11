import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { AiQuotaComponent } from './ai-quota.component';

describe('AiQuotaComponent (IA-50)', () => {
  let http: HttpTestingController;
  const quotaUrl = `${environment.baseApiUrl}/api/ai/quota`;
  const overview = (trial: boolean, limit: number | null, remaining: number | null, active = true) => ({
    active, trial, planName: 'Essentiel', periodStart: null, periodEnd: '2026-12-01T00:00:00Z',
    quotas: [{ code: 'ai.workout', labelFr: 'x', limit, used: 3, remaining, resetAt: '2026-12-01T00:00:00Z' }],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AiQuotaComponent, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function render(variant: 'badge' | 'line' | 'notice', body: object): string {
    const f = TestBed.createComponent(AiQuotaComponent);
    f.componentInstance.code = 'ai.workout';
    f.componentInstance.variant = variant;
    f.detectChanges();
    http.expectOne(quotaUrl).flush(body);
    f.detectChanges();
    return f.nativeElement.textContent;
  }

  it('shows what is left this month next to a button', () => {
    expect(render('line', overview(false, 3, 2))).toContain('AI_QUOTA_LEFT');
    expect(render('badge', overview(false, 3, 2))).toContain('2/3');
  });

  it('says "during your trial" in the trial', () => {
    expect(render('line', overview(true, 3, 1))).toContain('AI_QUOTA_LEFT_TRIAL');
  });

  it('shows no badge when there is no limit', () => {
    expect(render('badge', overview(false, null, null)).trim()).toBe('');
  });

  it('names the assistant and offers the plans when nothing is left', () => {
    const text = render('notice', overview(false, 3, 0));
    expect(text).toContain('AI_QUOTA_USED_WORKOUT');
    expect(text).toContain('AI_GO_PRO');
    expect(render('notice', overview(true, 3, 0))).toContain('AI_QUOTA_USED_WORKOUT_TRIAL');
  });

  it('says the plan does not include it when the limit is 0, and no subscription when inactive', () => {
    expect(render('notice', overview(false, 0, 0))).toContain('AI_QUOTA_NONE_WORKOUT');
    expect(render('notice', overview(false, 0, 0, false))).toContain('AI_ERROR_NO_SUBSCRIPTION');
  });
});
