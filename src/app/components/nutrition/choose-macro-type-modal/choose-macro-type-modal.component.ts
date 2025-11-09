import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';

@Component({
  selector: 'app-choose-macro-type-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  templateUrl: './choose-macro-type-modal.component.html',
  styleUrls: ['./choose-macro-type-modal.component.scss']
})
export class ChooseMacroTypeModalComponent {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  constructor(private router: Router) {}

  closeModal() {
    this.close.emit();
  }

  selectTotalForDay() {
    this.closeModal();
    // TODO: Implement total for day functionality
    console.log('Total for day selected - functionality not implemented yet');
    this.router.navigate(['/nutrition/create-macro-plan-total-day'], {
      queryParams: { type: 'total' }
    });
  }

  selectEachMeal() {
    this.closeModal();
    this.router.navigate(['/nutrition/create-macro-plan'], {
      queryParams: { type: 'each' }
    });
  }
}
