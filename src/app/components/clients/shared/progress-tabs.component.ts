import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FeatherModule } from 'angular-feather';

/**
 * Client « Progress » page (menu 2026-11-17): the measurements and the progress pictures are one menu entry,
 * shown as two tabs on top of each page. Each tab keeps its own route (/body-measurements, /progress-pictures),
 * so the old links (notifications, tasks) still work.
 */
@Component({
  selector: 'app-progress-tabs',
  standalone: true,
  imports: [CommonModule, RouterModule, FeatherModule],
  template: `
    <nav class="yc-segmented progress-tabs" role="tablist" [attr.aria-label]="fr ? 'Progression' : 'Progress'">
      <a role="tab" routerLink="/body-measurements" [class.active]="active === 'measurements'" [attr.aria-selected]="active === 'measurements'">
        <i-feather name="activity"></i-feather>{{ fr ? 'Mesures' : 'Measurements' }}
      </a>
      <a role="tab" routerLink="/progress-pictures" [class.active]="active === 'pictures'" [attr.aria-selected]="active === 'pictures'">
        <i-feather name="camera"></i-feather>{{ fr ? 'Photos' : 'Photos' }}
      </a>
    </nav>
  `,
  styles: [`
    :host { display: block; margin: 0 0 14px; }
    .progress-tabs a {
      flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      border-radius: 9px; font-size: 13.5px; font-weight: 500; text-decoration: none; color: var(--yc-text-secondary);
      transition: background-color 0.18s ease, box-shadow 0.18s ease;
    }
    .progress-tabs a.active {
      background: var(--yc-surface); color: var(--yc-primary); font-weight: 600; box-shadow: 0 2px 6px rgba(15, 27, 45, 0.08);
    }
    .progress-tabs i-feather { width: 16px; height: 16px; }
  `],
})
export class ProgressTabsComponent {
  @Input() active: 'measurements' | 'pictures' = 'measurements';
  @Input() fr = false;
}
