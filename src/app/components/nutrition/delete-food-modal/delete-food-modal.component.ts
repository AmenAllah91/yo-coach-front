import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-food-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './delete-food-modal.component.html',
  styleUrls: ['./delete-food-modal.component.scss']
})
export class DeleteFoodModalComponent {
  @Input() isVisible = false;
  @Input() foodName = '';

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  closeModal() {
    this.onClose.emit();
  }

  confirmDelete() {
    this.onConfirm.emit();
  }
}
