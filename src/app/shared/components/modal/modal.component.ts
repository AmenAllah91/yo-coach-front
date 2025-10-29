import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="modal-overlay" [class.show]="show" (click)="onClose()">
      <div class="modal-content" [ngClass]="type" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" (click)="onClose()">
            <i-feather name="x"></i-feather>
          </button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <div class="modal-footer" *ngIf="showFooter">
          <button class="cancel-btn" (click)="onClose()">{{ cancelText }}</button>
          <button class="confirm-btn" [ngClass]="confirmType" (click)="onConfirm()">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() show = false;
  @Input() title = '';
  @Input() type: 'side' | 'center' | 'delete' = 'side';
  @Input() showFooter = true;
  @Input() cancelText = 'Cancel';
  @Input() confirmText = 'Confirm';
  @Input() confirmType: 'primary' | 'danger' = 'primary';
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onConfirm() {
    this.confirm.emit();
  }
}