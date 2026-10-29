import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** A question asked before an action that loses something: deleting, emptying a day, leaving unsaved changes. */
export interface ConfirmOptions {
  /** i18n keys; `params` fill the title, the text and the confirm button. */
  title: string;
  text: string;
  params?: Record<string, unknown>;
  /** The red button. */
  confirm: string;
  /** « Annuler » by default. */
  cancel?: string;
  /** Feather icon, « alert-triangle » by default. */
  icon?: string;
}

export interface ConfirmRequest extends ConfirmOptions {
  answer: (confirmed: boolean) => void;
}

/**
 * Asks the question in the window placed once in the main layout (`app-confirm-dialog`): true on the red button only,
 * false on « Annuler », the backdrop or Escape.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly current = new BehaviorSubject<ConfirmRequest | null>(null);
  readonly request$ = this.current.asObservable();

  ask(options: ConfirmOptions): Promise<boolean> {
    // One window at a time: a question still open is answered « no ».
    this.answer(false);
    return new Promise((resolve) => this.current.next({ ...options, answer: resolve }));
  }

  answer(confirmed: boolean): void {
    const request = this.current.value;
    if (!request) return;
    this.current.next(null);
    request.answer(confirmed);
  }
}
