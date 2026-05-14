import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ChooseMacroTypeModalComponent } from '../choose-macro-type-modal/choose-macro-type-modal.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-choose-plan-type-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, ChooseMacroTypeModalComponent],
  templateUrl: './choose-plan-type-modal.component.html',
  styleUrls: ['./choose-plan-type-modal.component.scss'],
})
export class ChoosePlanTypeModalComponent {
  constructor(private router: Router) {}

  @Input() isVisible = false;
  @Input() isAssign = false;
  @Input() idClient: string = null;
  @Input() returnUrl: string | null = null;

  @Output() onClose = new EventEmitter<void>();

  showMacroTypeModal = false;

  closeModal() {
    this.onClose.emit();
  }

  createFullMealPlan() {
    this.closeModal();
    const queryParams: any = { type: 'each' };
    if (this.returnUrl) queryParams.returnUrl = this.returnUrl;

    if (this.isAssign) {
      this.router.navigate([
        `/clients/create-full-plan/${this.idClient}`,
      ]);
    } else {
      this.router.navigate(['/nutrition/create-full-plan'], { queryParams });
    }
  }

  createMacroOnlyPlan() {
    this.closeModal();
    this.showMacroTypeModal = true;
  }

  closeMacroTypeModal() {
    this.showMacroTypeModal = false;
  }
}
