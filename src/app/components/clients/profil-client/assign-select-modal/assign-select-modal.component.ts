import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export type AssignKind = 'WORKOUT' | 'NUTRITION' | 'CHECKIN';
@Component({
  selector: 'app-assign-select-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './assign-select-modal.component.html',
  styleUrls: ['./assign-select-modal.component.scss'],
})
export class AssignSelectModalComponent {
  constructor(private translate: TranslateService) {}
  @Input() isOpen = false;
  @Input() kind: AssignKind = 'WORKOUT';

  @Output() close = new EventEmitter<void>();
  @Output() existingClick = new EventEmitter<void>();
  @Output() createClick = new EventEmitter<void>();

  get title(): string {
    return this.kind === 'WORKOUT'
      ? this.translate.instant('ASSIGN_WORKOUT_PROGRAM')
      : this.kind === 'NUTRITION'
        ? this.translate.instant('ASSIGN_NUTRITION_PROGRAM')
        : this.translate.instant('ADD_CHECKIN_FORM');
  }

  get existingTitle(): string {
    return this.kind === 'CHECKIN' ? this.translate.instant('EXISTING_FORMS') :
      this.kind === 'WORKOUT' ? this.translate.instant('EXISTING_PROGRAMS') :
      this.kind === 'NUTRITION' ? this.translate.instant('EXISTING_NUTRITION_PROGRAMS')
      : this.translate.instant('EXISTING_PROGRAMS');
  }

  get existingSubtitle(): string {
    return this.kind === 'CHECKIN'
      ? this.translate.instant('CHOOSE_FROM_FORM_LIBRARY'):
      this.kind === 'WORKOUT' ? this.translate.instant('CHOOSE_FROM_PROGRAM_LIBRARY'):
      this.kind === 'NUTRITION'
        ? this.translate.instant('CHOOSE_FROM_NUTRITION_LIBRARY')
      : this.translate.instant('CHOOSE_FROM_PROGRAM_LIBRARY');
  }

  get createTitle(): string {
    return this.kind === 'CHECKIN' ? this.translate.instant('CREATE_NEW_FORM') :
      this.kind === 'WORKOUT' ? this.translate.instant('CREATE_NEW_PROGRAM') :
      this.kind === 'NUTRITION' ? this.translate.instant('CREATE_NEW_NUTRITION_PROGRAM'):
        this.translate.instant('CREATE_NEW_FORM');
  }
  get createSubtitle(): string {
    return this.kind === 'WORKOUT' ? this.translate.instant('BUILD_CUSTOM_PROGRAM')
      : this.kind === 'NUTRITION' ? this.translate.instant('BUILD_CUSTOM_PLAN'):
        this.translate.instant('BUILD_CUSTOM_CHECKIN_FORM');
  }
}
