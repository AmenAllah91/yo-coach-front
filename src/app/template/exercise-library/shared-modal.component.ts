import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-shared-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="modal-overlay" [class.show]="isVisible" (click)="onOverlayClick()">
      <div class="modal-content" [ngClass]="modalClass" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" (click)="close()">
            <i-feather name="x"></i-feather>
          </button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <div class="modal-footer" *ngIf="showFooter">
          <button class="cancel-btn" (click)="close()">{{ cancelText }}</button>
          <button class="confirm-btn" [ngClass]="confirmButtonClass" (click)="confirm()">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  `
})
export class SharedModalComponent {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() modalClass = '';
  @Input() showFooter = true;
  @Input() cancelText = 'Cancel';
  @Input() confirmText = 'Confirm';
  @Input() confirmButtonClass = 'primary';
  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  close() {
    this.onClose.emit();
  }

  confirm() {
    this.onConfirm.emit();
  }

  onOverlayClick() {
    this.close();
  }
}