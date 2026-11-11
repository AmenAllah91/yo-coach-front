import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { environment } from '@env/environment';
import { WebsiteAiDialogComponent } from './website-ai-dialog.component';

describe('AI website questions (IA-21)', () => {
  let http: HttpTestingController;
  const url = `${environment.baseApiUrl}/api/websites/me/ai-draft`;
  const draft = { title: 't', slogan: 's', bio: 'b', services: [], ctaLabel: 'c', descriptionBlocks: [], preset: 'energy' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WebsiteAiDialogComponent, HttpClientTestingModule, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function start(hasTexts = false) {
    const f = TestBed.createComponent(WebsiteAiDialogComponent);
    f.componentInstance.hasTexts = hasTexts;
    f.detectChanges();
    f.componentInstance.open();
    f.detectChanges();
    return f;
  }

  it('sends only the answers, cleaned, and emits the draft', () => {
    const f = start();
    const c = f.componentInstance;
    let emitted: unknown = null;
    c.drafted.subscribe((d) => (emitted = d));
    c.submit();
    http.expectNone(url); // no audience chosen yet
    c.toggleAudience('WOMEN');
    c.answers.location = 'ONLINE';
    c.answers.city = 'Sousse'; // ignored online
    c.answers.prices = '  ';
    c.submit();
    const req = http.expectOne(url);
    expect(req.request.body).toEqual(jasmine.objectContaining({ audience: ['WOMEN'], city: null, prices: null, specialtyOther: null, language: 'fr' }));
    req.flush(draft);
    expect(emitted).toEqual(draft);
  });

  it('asks before replacing the coach texts', () => {
    const f = start(true);
    const c = f.componentInstance;
    c.toggleAudience('MEN');
    c.submit();
    expect(c.step).toBe('confirm');
    http.expectNone(url);
    c.submit();
    http.expectOne(url).flush(draft);
  });

  it('shows a clear message when the quota is used and does not call the AI', () => {
    const f = start();
    const c = f.componentInstance;
    c.quota = { code: 'ai.website', labelFr: 'Sites IA', limit: 1, used: 1, remaining: 0, resetAt: '2026-12-01T00:00:00Z' };
    c.toggleAudience('MEN');
    f.detectChanges();
    c.submit();
    http.expectNone(url);
    expect(f.nativeElement.textContent).toContain('AI_QUOTA_USED_WEBSITE');
    expect(f.nativeElement.textContent).toContain('AI_GO_PRO');
  });

  it('turns a server refusal into a short message and lets the coach try again', () => {
    const f = start();
    const c = f.componentInstance;
    c.toggleAudience('MEN');
    c.submit();
    http.expectOne(url).flush({ code: 'AI_QUOTA_REACHED', reason: 'PLAN' }, { status: 403, statusText: 'Forbidden' });
    expect(c.error).toBe('AI_ERROR_QUOTA_REACHED');
    expect(c.step).toBe('form');
    c.submit();
    http.expectOne(url).flush({ code: 'AI_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    expect(c.error).toBe('AI_ERROR_UNAVAILABLE');
  });
});
