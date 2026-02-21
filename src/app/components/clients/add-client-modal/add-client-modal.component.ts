import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss'],
})
export class AddClientModalComponent {
  @Input() isVisible = false;

  @Output() onClose  = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{ email: string }>();

  email      = '';
  copied     = false;
  inviteLink = 'https://app.yourcoach.com/join';

  closeModal(): void {
    this.email  = '';
    this.copied = false;
    this.onClose.emit();
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.inviteLink).catch(() => {});
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  sendInvitation(): void {
    if (!this.email.trim()) return;
    this.onCreate.emit({ email: this.email.trim() });
    this.closeModal();
  }
}
