import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-food-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toggle-container">
      <div class="toggle-switch">
        <button 
          class="toggle-option" 
          [class.active]="!customOnly"
          (click)="onToggle(false)">
          All Foods
        </button>
        <button 
          class="toggle-option" 
          [class.active]="customOnly"
          (click)="onToggle(true)">
          Custom Foods
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toggle-container {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }

    .toggle-switch {
      display: flex;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 4px;
      border: 1px solid #dee2e6;
    }

    .toggle-option {
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #6c757d;
      transition: all 0.2s;

      &:hover {
        color: #495057;
      }

      &.active {
        background: #007bff;
        color: white;
        box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
      }
    }
  `]
})
export class FoodToggleComponent {
  @Input() customOnly = false;
  @Output() toggleChange = new EventEmitter<boolean>();

  onToggle(customOnly: boolean) {
    this.customOnly = customOnly;
    this.toggleChange.emit(customOnly);
  }
}