import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { NutritionAiDialogComponent, nutritionPrefillFromClient } from './nutrition-ai-dialog.component';

describe('AI meal plan questions (IA-41 / IA-43)', () => {
  let http: HttpTestingController;
  const api = `${environment.baseApiUrl}/api/ai`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NutritionAiDialogComponent, HttpClientTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function start() {
    const f = TestBed.createComponent(NutritionAiDialogComponent);
    f.detectChanges();
    f.componentInstance.open({ weeks: 6 });
    http.expectOne(`${api}/quota`).flush({ active: true, trial: false, planName: 'Pro', periodStart: null, periodEnd: null,
      quotas: [{ code: 'ai.nutrition', labelFr: 'x', limit: 3, used: 0, remaining: 3, resetAt: null }] });
    return f;
  }

  it('computes the targets first (no AI), then sends the meal answers with the targets the coach kept', () => {
    const c = start().componentInstance;
    expect(c.profileValid).toBeFalse();
    c.profile = { ...c.profile, gender: 'MALE', age: 30, weightKg: 80, heightCm: 180, activity: 'ACTIVE', goal: 'WEIGHT_LOSS' };
    c.submit();
    http.expectOne(`${api}/nutrition-targets`).flush({ calories: 2210, proteinG: 160, carbsG: 235, fatG: 70, maintenance: 2760, warnings: [] });
    expect(c.step).toBe('meals');
    expect(c.answers.weeks).toBe(6);
    expect(c.caloriesFromMacros).toBe(2210);
    c.answers.calories = 2100; // changed by the coach
    c.toggleAllergy('NUTS');
    c.answers.avoid = '  ';
    let emitted: unknown = null;
    c.drafted.subscribe(d => (emitted = d));
    c.submit();
    const req = http.expectOne(`${api}/nutrition-draft`);
    expect(req.request.body).toEqual(jasmine.objectContaining({ calories: 2100, proteinG: 160, goal: 'WEIGHT_LOSS',
      allergies: ['NUTS'], avoid: null, weeks: 6 }));
    req.flush({ plan: { mealDays: [] }, warnings: [], carefulModel: false });
    expect(emitted).toBeTruthy();
  });

  it('keeps the coach on the questions when the AI fails', () => {
    const c = start().componentInstance;
    c.step = 'meals';
    c.submit();
    http.expectOne(`${api}/nutrition-draft`).flush({ code: 'AI_QUOTA_REACHED', reason: 'TRIAL' }, { status: 403, statusText: 'x' });
    expect(c.step).toBe('meals');
    expect(c.error).toBe('AI_ERROR_QUOTA_REACHED');
  });

  it('fills the needs from the client profile', () => {
    expect(nutritionPrefillFromClient({ gender: 'MALE', mainObjective: 'LOSE_WEIGHT', birthDate: '1990-01-10', currentWeight: 82 },
      new Date(2026, 10, 1))).toEqual({ gender: 'MALE', goal: 'WEIGHT_LOSS', age: 36, weightKg: 82 });
  });
});
