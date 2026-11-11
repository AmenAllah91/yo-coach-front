import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { WorkoutAiDialogComponent, workoutPrefillFromClient } from './workout-ai-dialog.component';

describe('AI workout questions (IA-33 / IA-34)', () => {
  let http: HttpTestingController;
  const url = `${environment.baseApiUrl}/api/ai/workout-draft`;
  const quotaUrl = `${environment.baseApiUrl}/api/ai/quota`;
  const draft = { plan: { name: 'P', workoutDays: [] }, warnings: [], carefulModel: false };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkoutAiDialogComponent, HttpClientTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function start(prefill = {}) {
    const f = TestBed.createComponent(WorkoutAiDialogComponent);
    f.detectChanges();
    f.componentInstance.open(prefill);
    http.expectOne(quotaUrl).flush({ active: true, trial: false, planName: 'Pro', periodStart: null, periodEnd: null,
      quotas: [{ code: 'ai.workout', labelFr: 'x', limit: 10, used: 2, remaining: 8, resetAt: null }] });
    f.detectChanges();
    return f;
  }

  it('reads the counter and sends the phases with numbers', () => {
    const f = start();
    const c = f.componentInstance;
    expect(c.quota?.remaining).toBe(8);
    c.answers.phases[0] = { weeks: 4, split: 'FULL_BODY', focus: 'BASICS' };
    c.addPhase();
    c.answers.phases[1].split = 'PPL';
    expect(c.valid).withContext('PPL does not fit 3 days? it does (3 or 6)').toBeTrue();
    c.answers.daysPerWeek = 4;
    expect(c.valid).withContext('PPL on 4 days').toBeFalse();
    c.answers.daysPerWeek = 3;
    let emitted: unknown = null;
    c.drafted.subscribe(d => (emitted = d));
    c.submit();
    const req = http.expectOne(url);
    expect(req.request.body.phases.map((p: any) => [p.weeks, p.split])).toEqual([[4, 'FULL_BODY'], [4, 'PPL']]);
    req.flush(draft);
    expect(emitted).toEqual(draft);
  });

  it('refuses more than 12 weeks and more than 3 phases', () => {
    const c = start().componentInstance;
    c.answers.phases[0].weeks = 8;
    c.addPhase();
    c.answers.phases[1].weeks = 5;
    expect(c.totalWeeks).toBe(13);
    expect(c.valid).toBeFalse();
    c.answers.phases[1].weeks = 2;
    c.addPhase();
    expect(c.answers.phases[2].weeks).withContext('what is left of the 12 weeks').toBe(2);
    c.addPhase();
    expect(c.answers.phases.length).toBe(3);
    c.answers.phases[2].weeks = 3;
    c.submit();
    http.expectNone(url);
  });

  it('fills the questions from the client profile', () => {
    const prefill = workoutPrefillFromClient({ mainObjective: 'BUILD_MUSCLE', gender: 'FEMALE', birthDate: '2010-06-15',
      currentWeight: 132, weightUnit: 'lbs' }, new Date(2026, 10, 1));
    expect(prefill).toEqual({ goal: 'MUSCLE', gender: 'FEMALE', age: 16, minor: true, weightKg: 60 });
    expect(workoutPrefillFromClient(null)).toEqual({});
  });

  it('IA-51: the first program of the example client is free even with no creation left', () => {
    const f = TestBed.createComponent(WorkoutAiDialogComponent);
    f.detectChanges();
    f.componentInstance.open({ exampleClient: true });
    http.expectOne(quotaUrl).flush({ active: true, trial: true, planName: 'Essai', periodStart: null, periodEnd: null,
      quotas: [{ code: 'ai.workout', labelFr: 'x', limit: 3, used: 3, remaining: 0, resetAt: null }] });
    f.detectChanges();
    const c = f.componentInstance;
    expect(c.exhausted).toBeFalse();
    expect(f.nativeElement.textContent).toContain('AI_WORKOUT_EXAMPLE_FREE');
    expect(f.nativeElement.textContent).not.toContain('AI_QUOTA_USED_WORKOUT');
    c.submit();
    expect(http.expectOne(`${environment.baseApiUrl}/api/ai/workout-draft`).request.body.exampleClient).toBeTrue();
  });

  it('shows a short message when the AI fails', () => {
    const c = start().componentInstance;
    c.submit();
    http.expectOne(url).flush({ code: 'AI_RATE_LIMITED' }, { status: 429, statusText: 'Too many' });
    expect(c.error).toBe('AI_ERROR_RATE_LIMITED');
    expect(c.loading).toBeFalse();
  });
});
