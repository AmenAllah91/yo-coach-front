import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Subscription } from 'rxjs';
import { ConfirmDialogService, ConfirmRequest } from './confirm-dialog.service';

/**
 * The window of ConfirmDialogService, placed once in the main layout. Same look as « Retirer » a client program (P10);
 * « Annuler » has the focus, so that Enter never confirms by mistake.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  template: `
    <div class="cd-backdrop" *ngIf="request as r" (click)="answer(false)">
      <div class="cd" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-text" (click)="$event.stopPropagation()">
        <span class="cd-icon" aria-hidden="true"><i-feather [name]="r.icon || 'alert-triangle'"></i-feather></span>
        <h3 class="cd-title" id="cd-title">{{ r.title | translate: r.params }}</h3>
        <p class="cd-text" id="cd-text">{{ r.text | translate: r.params }}</p>
        <div class="cd-actions">
          <button #cancelButton type="button" class="cd-btn cd-btn--ghost" (click)="answer(false)">{{ (r.cancel || 'CANCEL') | translate }}</button>
          <button type="button" class="cd-btn cd-btn--danger" (click)="answer(true)">{{ r.confirm | translate: r.params }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cd-backdrop { position: fixed; inset: 0; z-index: 42000; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, 0.45); }
    .cd { width: min(440px, 100%); display: grid; gap: 10px; padding: 24px; border-radius: 18px; background: light-dark(#fff, #1d2125); box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25); color: light-dark(#0f172a, #e8ecf6); }
    .cd-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: light-dark(#fee2e2, #4c2426); color: light-dark(#b91c1c, #ff8a7d); }
    .cd-icon ::ng-deep svg { width: 20px; height: 20px; }
    .cd-title { margin: 4px 0 0; font-size: 18px; font-weight: 600; }
    .cd-text { margin: 0; font-size: 14px; line-height: 1.5; color: light-dark(#475569, #bfc5ce); }
    .cd-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .cd-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .cd-btn--ghost { border: 1px solid light-dark(#e2e8f0, #34393f); background: light-dark(#fff, #1d2125); color: light-dark(#0f172a, #e8ecf6); }
    .cd-btn--danger { border: 1px solid #b91c1c; background: #b91c1c; color: #fff; }
    .cd-btn:focus-visible { outline: 2px solid light-dark(#0f172a, #e8ecf6); outline-offset: 2px; }
  `],
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  request: ConfirmRequest | null = null;
  @ViewChild('cancelButton') private cancelButton?: ElementRef<HTMLButtonElement>;
  private subscription?: Subscription;

  constructor(private dialog: ConfirmDialogService) {}

  ngOnInit(): void {
    this.subscription = this.dialog.request$.subscribe((request) => {
      this.request = request;
      if (request) setTimeout(() => this.cancelButton?.nativeElement.focus());
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.dialog.answer(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.request) return;
    // The window under the question (an editor, a modal) stays open.
    event.stopImmediatePropagation();
    this.answer(false);
  }

  answer(confirmed: boolean): void {
    this.dialog.answer(confirmed);
  }
}
