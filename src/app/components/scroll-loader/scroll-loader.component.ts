import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scroll-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scroll-loader" *ngIf="isLoading">
      <div class="scroll-spinner"></div>
      <span>{{ loadingText }}</span>
    </div>
  `,
  styleUrls: ['./scroll-loader.component.scss']
})
export class ScrollLoaderComponent {
  @Input() isLoading = false;
  @Input() loadingText = 'Loading more...';
}