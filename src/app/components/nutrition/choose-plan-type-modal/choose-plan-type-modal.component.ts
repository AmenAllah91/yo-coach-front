import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ChooseMacroTypeModalComponent } from '../choose-macro-type-modal/choose-macro-type-modal.component';

@Component({
  selector: 'app-choose-plan-type-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, ChooseMacroTypeModalComponent],
  templateUrl: './choose-plan-type-modal.component.html',
  styleUrls: ['./choose-plan-type-modal.component.scss']
})
export class ChoosePlanTypeModalComponent {
  @Input() isVisible = false;
  
  @Output() onClose = new EventEmitter<void>();
  @Output() onCreateFullMeal = new EventEmitter<void>();
  @Output() onCreateMacroOnly = new EventEmitter<void>();

  showMacroTypeModal = false;

  closeModal() {
    this.onClose.emit();
  }

  createFullMealPlan() {
    this.onCreateFullMeal.emit();
  }

  createMacroOnlyPlan() {
    this.closeModal();
    this.showMacroTypeModal = true;
  }

  closeMacroTypeModal() {
    this.showMacroTypeModal = false;
  }
}