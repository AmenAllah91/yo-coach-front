import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { FeatherModule } from 'angular-feather';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [FeatherModule],
  template: `
    <button class="back-btn" (click)="goBack()" type="button" aria-label="Back">
      <i-feather name="arrow-left" class="back-icon"></i-feather>
      <span class="back-label">Back</span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1rem 2rem 0;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem 0.5rem 0.625rem;
      border: 1px solid #e5e7eb;
      border-radius: 9999px;
      background: rgba(255,255,255,0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #374151;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .back-btn:hover {
      background: #fff;
      border-color: #d1d5db;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      color: #111827;
      transform: translateX(-2px);
    }
    .back-btn:active {
      transform: translateX(-1px) scale(0.98);
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .back-icon {
      width: 1.125rem;
      height: 1.125rem;
      transition: transform 0.2s ease;
    }
    .back-btn:hover .back-icon {
      transform: translateX(-2px);
    }
    .back-label {
      line-height: 1;
    }
  `]
})
export class BackButtonComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
