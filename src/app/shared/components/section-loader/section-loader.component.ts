import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Loading state of one section of a page (a tab of the client profile, for instance), shown in place of its content
 * on the first load. The rest of the page stays usable, unlike the full-screen loader.
 */
@Component({
  selector: 'app-section-loader',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="section-loader" role="status" aria-live="polite">
      <span class="section-loader__spinner" aria-hidden="true"></span>
      <span>{{ 'LOADING' | translate }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .section-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 160px;
      color: light-dark(#64748b, #a5abb4);
      font-size: 13px;
    }
    .section-loader__spinner {
      width: 20px;
      height: 20px;
      border: 2px solid light-dark(#dbeafe, #313943);
      border-top-color: #44b4df;
      border-radius: 50%;
      animation: section-loader-spin 0.7s linear infinite;
    }
    @keyframes section-loader-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .section-loader__spinner { animation-duration: 1.6s; }
    }
  `],
})
export class SectionLoaderComponent {}
