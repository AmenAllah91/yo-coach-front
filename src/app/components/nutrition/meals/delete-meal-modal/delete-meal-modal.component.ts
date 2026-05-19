import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-delete-meal-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  templateUrl: './delete-meal-modal.component.html',
  styleUrls: ['./delete-meal-modal.component.scss']
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
