import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AssignKind = 'WORKOUT' | 'NUTRITION';

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
      : 'Assign Nutrition Program';
  }

  get existingTitle(): string {
    return this.kind === 'WORKOUT'
      ? 'Existing Programs'
      : 'Existing Nutrition Programs';
  }

  get existingSubtitle(): string {
    return this.kind === 'WORKOUT'
      ? 'Choose from your program library'
      : 'Choose from your nutrition library';
  }

  get createTitle(): string {
    return this.kind === 'WORKOUT'
      ? 'Create New Program'
      : 'Create New Nutrition Program';
  }

  get createSubtitle(): string {
    return this.kind === 'WORKOUT'
      ? 'Build a custom program'
      : 'Build a custom plan';
  }
}
