import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../service/loader.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="loader-overlay" *ngIf="loaderService.loading$ | async">
      <div class="loader-container">
        <div class="spinner"></div>
        <p>{{ 'LOADING' | translate }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  constructor(public loaderService: LoaderService) {}
}
