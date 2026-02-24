import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AssignKind = 'WORKOUT' | 'NUTRITION' | 'CHECKIN';
@Component({
  selector: 'app-assign-select-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assign-select-modal.component.html',
  styleUrls: ['./assign-select-modal.component.scss'],
})
export class AssignSelectModalComponent {
  @Input() isOpen = false;
  @Input() kind: AssignKind = 'WORKOUT';

  @Output() close = new EventEmitter<void>();
  @Output() existingClick = new EventEmitter<void>();
  @Output() createClick = new EventEmitter<void>();

  get title(): string {
    return this.kind === 'WORKOUT'
      ? 'Assign Workout Program'
      : this.kind === 'NUTRITION'
        ? 'Assign Nutrition Program'
        : 'Add Check-in Form';
  }

  get existingTitle(): string {
    return this.kind === 'CHECKIN' ? 'Existing Forms' :
      this.kind === 'WORKOUT' ? 'Existing Programs' :
      this.kind === 'NUTRITION' ? 'Existing Nutrition Programs'
      : 'Existing Programs';
  }

  get existingSubtitle(): string {
    return this.kind === 'CHECKIN'
      ? 'Choose from your form library':
      this.kind === 'WORKOUT' ? 'Choose from your program library':
      this.kind === 'NUTRITION'
        ? 'Choose from your nutrition library'
      : 'Choose from your program library';
  }

  get createTitle(): string {
    return this.kind === 'CHECKIN' ? 'Create New Form' :
      this.kind === 'WORKOUT' ? 'Create New Program' :
      this.kind === 'NUTRITION' ? 'Create New Nutrition Program':
        'Create New Form';
  }
  get createSubtitle(): string {
    return this.kind === 'WORKOUT' ? 'Build a custom program'
      : this.kind === 'NUTRITION' ? 'Build a custom plan':
        this.kind === 'CHECKIN' ? 'Build a custom check-in form'
        : 'Build a custom check-in form';
  }
}
