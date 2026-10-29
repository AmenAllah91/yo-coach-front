import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('Confirmation window', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialog: ConfirmDialogService;
  const question = { title: 'CONFIRM_ACTION.DELETE_TASK_TITLE', text: 'CONFIRM_ACTION.DELETE_TASK_TEXT', params: { name: 'Marcher' }, confirm: 'DELETE' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent, TranslateModule.forRoot(), FeatherModule.pick(allIcons)],
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    dialog = TestBed.inject(ConfirmDialogService);
    fixture.detectChanges();
  });

  const buttons = () => fixture.nativeElement.querySelectorAll('.cd-btn') as NodeListOf<HTMLButtonElement>;

  it('shows nothing until a question is asked', () => {
    expect(fixture.nativeElement.querySelector('.cd')).toBeNull();
  });

  it('answers true on the red button only', async () => {
    const answer = dialog.ask(question);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cd')).not.toBeNull();
    buttons()[1].click();
    expect(await answer).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cd')).toBeNull();
  });

  it('answers false on « Annuler », the backdrop and Escape', async () => {
    let answer = dialog.ask(question);
    fixture.detectChanges();
    buttons()[0].click();
    expect(await answer).toBeFalse();

    answer = dialog.ask(question);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.cd-backdrop') as HTMLElement).click();
    expect(await answer).toBeFalse();

    answer = dialog.ask(question);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await answer).toBeFalse();
  });

  it('answers « no » to a question still open when another one comes', async () => {
    const first = dialog.ask(question);
    const second = dialog.ask(question);
    expect(await first).toBeFalse();
    dialog.answer(true);
    expect(await second).toBeTrue();
  });
});
