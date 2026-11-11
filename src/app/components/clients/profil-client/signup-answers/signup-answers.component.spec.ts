import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { of, throwError } from 'rxjs';
import { SignupAnswersComponent } from './signup-answers.component';
import { SignupAnswers, SubmissionsApiService } from '../../../forms/services/submissions-api.service';

describe('SignupAnswersComponent', () => {
  const answers: SignupAnswers = {
    formTitle: 'Questionnaire de départ',
    submittedAt: '2026-11-04T09:00:00Z',
    rows: [
      { label: 'Blessures ?', type: 'TEXT', value: 'Genou droit', rating: null, maxStars: null, yes: null },
      { label: 'Motivation', type: 'STAR_RATING', value: null, rating: 4, maxStars: 5, yes: null },
      { label: 'Déjà coaché ?', type: 'YES_NO', value: null, rating: null, maxStars: null, yes: false },
      { label: 'Autre', type: 'TEXT', value: null, rating: null, maxStars: null, yes: null },
    ],
  };
  let api: jasmine.SpyObj<SubmissionsApiService>;

  function render(result: SignupAnswers | null | 'error') {
    api.getSignupAnswers.and.returnValue(result === 'error' ? throwError(() => new Error('down')) : of(result));
    const fixture = TestBed.createComponent(SignupAnswersComponent);
    fixture.componentInstance.clientId = 'client';
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<SubmissionsApiService>('SubmissionsApiService', ['getSignupAnswers']);
    TestBed.configureTestingModule({
      imports: [SignupAnswersComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
      providers: [{ provide: SubmissionsApiService, useValue: api }],
    });
  });

  it('shows each question with the client answer', () => {
    const fixture = render(answers);
    const text = fixture.nativeElement.textContent;
    expect(api.getSignupAnswers).toHaveBeenCalledWith('client');
    expect(text).toContain('Questionnaire de départ');
    expect(text).toContain('Genou droit');
    expect(text).toContain('★★★★☆');
    expect(text).toContain('NO');
    expect(text).toContain('SIGNUP_ANSWERS.NOT_ANSWERED');
    expect(fixture.nativeElement.querySelectorAll('.signup-answers__row').length).toBe(4);
  });

  it('is hidden when there are no answers or the request fails', () => {
    expect(render(null).nativeElement.querySelector('.signup-answers')).toBeNull();
    expect(render('error').nativeElement.querySelector('.signup-answers')).toBeNull();
  });
});
