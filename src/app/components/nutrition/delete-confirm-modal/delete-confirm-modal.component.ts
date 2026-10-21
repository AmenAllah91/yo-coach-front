import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

/** Delete confirmation with the look of the workout program / nutrition plan / meal delete modals. */
@Component({
  selector: 'app-delete-confirm-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  template: `
    <div class="modal-overlay" [class.show]="isVisible" (click)="cancel.emit()">
      <div class="modal-content delete" role="alertdialog" aria-modal="true" [attr.aria-label]="title | translate" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ title | translate }}</h2>
          <button class="close-btn" type="button" [attr.aria-label]="'CLOSE' | translate" (click)="cancel.emit()">
            <i-feather name="x"></i-feather>
          </button>
        </div>
        <div class="modal-body">
          <div class="delete-icon"><i-feather name="trash-2" size="24"></i-feather></div>
          <h3>{{ 'ARE_YOU_SURE' | translate }}</h3>
          <p>{{ message | translate: { name: name } }}</p>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" type="button" (click)="cancel.emit()">{{ 'CANCEL' | translate }}</button>
          <button class="confirm-btn danger" type="button" (click)="confirm.emit()">{{ 'DELETE' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../../program-library/delete-modal/delete-modal.component.scss'],
})
export class DeleteConfirmModalComponent {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() message = '';
  @Input() name = '';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
