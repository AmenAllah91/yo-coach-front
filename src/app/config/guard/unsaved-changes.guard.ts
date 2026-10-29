import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService, ConfirmOptions } from '@shared/components/confirm-dialog/confirm-dialog.service';

/** An editor that can lose what the coach typed: program builders, meal editor. */
export interface LeavesUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** The question asked before losing unsaved changes (leaving an editor, closing the meal editor). */
export const LEAVE_UNSAVED: ConfirmOptions = {
  title: 'UNSAVED_LEAVE.TITLE',
  text: 'UNSAVED_LEAVE.TEXT',
  confirm: 'UNSAVED_LEAVE.CONFIRM',
  cancel: 'UNSAVED_LEAVE.STAY',
};

/** Leaving an editor with unsaved changes (back button, menu, any link) asks first. */
export const unsavedChangesGuard: CanDeactivateFn<LeavesUnsavedChanges> = (component) =>
  !component?.hasUnsavedChanges() || inject(ConfirmDialogService).ask(LEAVE_UNSAVED);

/**
 * What an editor last loaded or saved, as text, to tell whether something changed since. Each editor says what its
 * content is (what the coach edits, without the display-only fields).
 */
export class SavedContent {
  private saved: string | null = null;

  remember(content: string): void {
    this.saved = content;
  }

  /**
   * After a load: once now, then again after the first display, which fills a few fields by itself (an empty session on
   * the selected day…) that are not a change of the coach.
   */
  rememberAfterDisplay(content: () => string): void {
    this.remember(content());
    setTimeout(() => this.remember(content()));
  }

  /** Nothing loaded yet (or loading failed): nothing to lose. */
  changed(content: string): boolean {
    return this.saved !== null && content !== this.saved;
  }
}

/** The browser's own question when the tab is closed or reloaded with unsaved changes. */
export function warnBeforeUnload(event: BeforeUnloadEvent, editor: LeavesUnsavedChanges): void {
  if (!editor.hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
}
