import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';

import { CancelSubscriptionDialogComponent } from './cancel-subscription-dialog.component';

describe('CancelSubscriptionDialogComponent (SUB-35)', () => {
  let fixture: ComponentFixture<CancelSubscriptionDialogComponent>;
  let answers: boolean[];
  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancelSubscriptionDialogComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
    }).compileComponents();
    fixture = TestBed.createComponent(CancelSubscriptionDialogComponent);
    fixture.componentInstance.until = '07/11/2026';
    answers = [];
    fixture.componentInstance.answer.subscribe((a) => answers.push(a));
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('shows the last day of access and puts the focus on "Keep my subscription"', () => {
    expect(el('.csd__access strong')?.textContent).toContain('07/11/2026');
    expect(document.activeElement).toBe(el('.csd__btn--dark'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('confirms only with "Cancel my subscription"', () => {
    el('.csd__btn--outline')!.click();
    expect(answers).toEqual([true]);
  });

  it('keeps the subscription with the button, the close icon, a click outside or Escape', () => {
    el('.csd__btn--dark')!.click();
    el('.csd__close')!.click();
    el('.csd-backdrop')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(answers).toEqual([false, false, false, false]);
  });

  it('a click inside the dialog does not close it', () => {
    el('.csd')!.click();
    expect(answers).toEqual([]);
  });

  it('hides the date line when the last day is unknown', () => {
    fixture.componentInstance.until = '';
    fixture.detectChanges();
    expect(el('.csd__access')).toBeNull();
  });
});
