import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-scroll-loader',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="scroll-loader" *ngIf="isLoading">
      <div class="scroll-spinner"></div>
      <span>{{ loadingText | translate }}</span>
    </div>
  `,
  styleUrls: ['./scroll-loader.component.scss']
})
export class ScrollLoaderComponent {
  @Input() isLoading = false;
  @Input() loadingText = 'LOADING_MORE';
}
