import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss']
})
export class AddClientModalComponent {
  @Input() isVisible = false;
  @Input() firstName = '';
  @Input() lastName = '';
  @Input() email = '';
  @Input() gender = 'MALE';
  
  @Output() onClose = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{firstName: string, lastName: string, email: string, gender: string}>();

  closeModal() {
    this.onClose.emit();
  }

  createClient() {
    this.onCreate.emit({
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      gender: this.gender
    });
  }
}