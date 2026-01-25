import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { Router } from '@angular/router';

@Component({
  selector: 'app-choose-macro-type-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  templateUrl: './choose-macro-type-modal.component.html',
  styleUrls: ['./choose-macro-type-modal.component.scss'],
})
export class ChooseMacroTypeModalComponent {
  @Input() isVisible = false;
  @Input() isAssign = false;
  @Input() idClient: string = null;
  @Output() close = new EventEmitter<void>();

  constructor(private router: Router) {}

  closeModal() {
    this.close.emit();
  }

  selectTotalForDay() {
    this.closeModal();

    if (this.isAssign) {
      this.router.navigate([
        `/clients/create-macro-plan-total-day/${this.idClient}`,
      ]);
    } else {
      this.router.navigate(['/nutrition/create-macro-plan-total-day'], {
        queryParams: { type: 'total' },
      });
    }
  }

  selectEachMeal() {
    this.closeModal();

    if (this.isAssign) {
      this.router.navigate([
        `/clients/create-macro-plan/${this.idClient}`,
      ]);
    } else {
      this.router.navigate(['/nutrition/create-macro-plan'], {
        queryParams: { type: 'total' },
      });
    }
  }
}
