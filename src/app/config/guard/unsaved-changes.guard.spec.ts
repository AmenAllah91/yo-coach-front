import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';
import { LEAVE_UNSAVED, SavedContent, unsavedChangesGuard, warnBeforeUnload } from './unsaved-changes.guard';

describe('Leaving an editor with unsaved changes', () => {
  const leave = (dirty: boolean) =>
    TestBed.runInInjectionContext(() => unsavedChangesGuard({ hasUnsavedChanges: () => dirty }, {} as any, {} as any, {} as any));

  it('leaves at once when nothing changed', () => {
    const dialog = TestBed.inject(ConfirmDialogService);
    spyOn(dialog, 'ask');
    expect(leave(false)).toBeTrue();
    expect(dialog.ask).not.toHaveBeenCalled();
  });

  it('asks first, and stays on « Continuer l’édition »', async () => {
    const dialog = TestBed.inject(ConfirmDialogService);
    spyOn(dialog, 'ask').and.returnValue(Promise.resolve(false));
    expect(await leave(true)).toBeFalse();
    expect(dialog.ask).toHaveBeenCalledWith(LEAVE_UNSAVED);
  });

  it('keeps the browser question for a closed tab only when something changed', () => {
    const event = { preventDefault: jasmine.createSpy(), returnValue: undefined } as any;
    warnBeforeUnload(event, { hasUnsavedChanges: () => false });
    expect(event.preventDefault).not.toHaveBeenCalled();
    warnBeforeUnload(event, { hasUnsavedChanges: () => true });
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe('SavedContent', () => {
  it('has nothing to lose before a load', () => {
    expect(new SavedContent().changed('anything')).toBeFalse();
  });

  it('compares with what was last loaded or saved', () => {
    const saved = new SavedContent();
    saved.remember('a');
    expect(saved.changed('a')).toBeFalse();
    expect(saved.changed('b')).toBeTrue();
    saved.remember('b');
    expect(saved.changed('b')).toBeFalse();
  });

  it('takes what the first display fills in by itself as loaded', fakeAsync(() => {
    const saved = new SavedContent();
    let content = 'loaded';
    saved.rememberAfterDisplay(() => content);
    content = 'loaded + empty session';
    tick();
    expect(saved.changed('loaded + empty session')).toBeFalse();
  }));
});
