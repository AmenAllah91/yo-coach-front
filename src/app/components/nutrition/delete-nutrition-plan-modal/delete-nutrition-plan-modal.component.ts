import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-nutrition-plan-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './delete-nutrition-plan-modal.component.html',
  styleUrls: ['./delete-nutrition-plan-modal.component.scss']
})
export class DeleteNutritionPlanModalComponent {
  @Input() isVisible = false;
  @Input() planName = '';

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  closeModal() {
    this.onClose.emit();
  }

  confirmDelete() {
    this.onConfirm.emit();
  }
}
