import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CoachGuideService, CoachGuideStatus } from '../../../service/coach-guide.service';
import { FirstStepsComponent } from './first-steps.component';

describe('First steps checklist', () => {
  let fixture: ComponentFixture<FirstStepsComponent>;
  let guide: jasmine.SpyObj<CoachGuideService>;

  const status = (patch: Partial<CoachGuideStatus> = {}): CoachGuideStatus => ({
    started: true, startChoice: 'EXAMPLE', hidden: false, challenge: '', coachFirstName: 'Karim',
    example: { active: true, clientId: 'sami', clientName: 'Sami Trabelsi' },
    discover: [
      { key: 'OPEN_CLIENT', done: true, optional: false },
      { key: 'VIEW_PROGRAM', done: false, optional: false },
      { key: 'REPLY_MESSAGE', done: false, optional: false },
      { key: 'REVIEW_CHECKIN', done: false, optional: false },
    ],
    start: [
      { key: 'PROFILE', done: false, optional: false },
      { key: 'BRANDING', done: false, optional: false },
      { key: 'PROGRAM', done: false, optional: false },
      { key: 'INVITE', done: false, optional: false },
      { key: 'WEBSITE', done: false, optional: true },
    ],
    completed: false,
    ...patch,
  });

  beforeEach(() => {
    guide = jasmine.createSpyObj<CoachGuideService>('CoachGuideService', ['load', 'start', 'visit', 'setHidden']);
    guide.load.and.returnValue(of(status()));
    TestBed.configureTestingModule({
      imports: [FirstStepsComponent, TranslateModule.forRoot()],
      providers: [provideRouter([]), provideHttpClient(), { provide: CoachGuideService, useValue: guide }],
    });
    // The invitation modal is not under test (it needs the whole sign-in stack).
    TestBed.overrideComponent(FirstStepsComponent, { set: { imports: [CommonModule, TranslateModule], schemas: [NO_ERRORS_SCHEMA] } });
    fixture = TestBed.createComponent(FirstStepsComponent);
    fixture.detectChanges();
  });

  it('counts the discovery steps and the required real steps, not the optional website', () => {
    const component = fixture.componentInstance;
    expect(component.steps.length).toBe(8);
    expect(component.doneCount).toBe(1);
    expect(component.exampleName).toBe('Sami');
    expect(fixture.nativeElement.querySelector('.first-steps')).not.toBeNull();
  });

  it('opens the example client and records the step', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    guide.visit.and.returnValue(of(status()));
    fixture.componentInstance.openDiscover('VIEW_PROGRAM');
    expect(guide.visit).toHaveBeenCalledWith('VIEW_PROGRAM');
    expect(router.navigate).toHaveBeenCalledWith(['/clients/profil-client', 'sami'], { queryParams: { tab: 'workouts' } });
  });

  it('removes the example client after confirmation and tells the dashboard', () => {
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.exampleChanged.subscribe(changed);
    guide.start.and.returnValue(of(status({ example: { active: false }, discover: [] })));
    fixture.componentInstance.removeExample();
    expect(guide.start).toHaveBeenCalledWith('SCRATCH');
    expect(changed).toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('COACH_GUIDE.RESTORE_EXAMPLE');
  });

  it('brings the example client back', () => {
    guide.start.and.returnValue(of(status()));
    fixture.componentInstance.restoreExample();
    expect(guide.start).toHaveBeenCalledWith('EXAMPLE');
  });

  it('is not shown to a coach who never saw the welcome screen, nor once hidden', () => {
    fixture.componentInstance.status = status({ started: false });
    expect(fixture.componentInstance.visible).toBeFalse();
    fixture.componentInstance.status = status({ hidden: true });
    expect(fixture.componentInstance.visible).toBeFalse();
  });
});
