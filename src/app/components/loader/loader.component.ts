import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../service/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loader-overlay" *ngIf="loaderService.loading$ | async">
      <div class="loader-container">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    </div>
  `,
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  constructor(public loaderService: LoaderService) {}
}