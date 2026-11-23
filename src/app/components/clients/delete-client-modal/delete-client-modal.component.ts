import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-client-modal',
  standalone: true,
  imports: [CommonModule, FeatherModule, TranslateModule],
  templateUrl: './delete-client-modal.component.html',
  styleUrls: ['./delete-client-modal.component.scss']
})
export class DeleteClientModalComponent {
  @Input() isVisible = false;
  @Input() clientName = '';
  /** The removal is being saved: buttons disabled, a second click does nothing. */
  @Input() busy = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  closeModal() {
    if (this.busy) return;
    this.onClose.emit();
  }

  confirmDelete() {
    if (this.busy) return;
    this.onConfirm.emit();
  }
}
