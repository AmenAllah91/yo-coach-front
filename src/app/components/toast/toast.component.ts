import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { ToastService, Toast } from '../../service/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, FeatherModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toastService.toasts$ | async" 
        class="toast"
        [class]="'toast-' + toast.type">
        <div class="toast-icon">
          <i-feather 
            [name]="getIcon(toast.type)" 
            size="20">
          </i-feather>
        </div>
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message" *ngIf="toast.message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" (click)="toastService.remove(toast.id)">
          <i-feather name="x" size="16"></i-feather>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}