import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';
import { WriteActionDirective } from 'app/shared/subscription/write-action.directive';

/**
 * Empty list for a new coach (2026-11-18): instead of « Aucun … trouvé », one sentence that says what the page is
 * for and the button that starts it (« Créez votre premier programme »).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule, WriteActionDirective],
  template: `
    <div class="empty-state-box">
      <span class="empty-state-icon" aria-hidden="true"><i-feather [name]="icon"></i-feather></span>
      <h3>{{ title | translate }}</h3>
      <p *ngIf="text">{{ text | translate }}</p>
      <button *ngIf="actionLabel" type="button" class="empty-state-action" appWriteAction (click)="action.emit()">
        <i-feather name="plus"></i-feather>
        {{ actionLabel | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .empty-state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      max-width: 26rem;
      margin: 0 auto;
      padding: 2.5rem 1rem;
      text-align: center;
    }
    .empty-state-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      margin-bottom: 0.25rem;
      border-radius: 50%;
      background: light-dark(#f1f4f8, #262b31);
      color: light-dark(#4b5563, #c3c9d2);
    }
    .empty-state-icon i-feather { width: 1.375rem; height: 1.375rem; }
    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: light-dark(#111827, #f3f4f6);
    }
    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: light-dark(#6b7280, #9aa3af);
    }
    .empty-state-action {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.75rem;
      min-height: 2.25rem;
      padding: 0.5rem 1rem;
      border: 0;
      border-radius: 0.375rem;
      background: light-dark(#020c20, #f3f4f6);
      color: light-dark(#ffffff, #020c20);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
    }
    .empty-state-action:hover { opacity: 0.9; }
    .empty-state-action i-feather { width: 0.875rem; height: 0.875rem; }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input({ required: true }) title = '';
  @Input() text = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
