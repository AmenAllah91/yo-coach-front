import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-meal-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './delete-meal-modal.component.html',
  // Same look as the workout program and nutrition plan delete modals.
  styleUrls: ['../../../program-library/delete-modal/delete-modal.component.scss']
})
export class DeleteMealModalComponent {
  @Input() isVisible = false;
  @Input() mealName = '';

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  closeModal() {
    this.onClose.emit();
  }

  confirmDelete() {
    this.onConfirm.emit();
  }
}
