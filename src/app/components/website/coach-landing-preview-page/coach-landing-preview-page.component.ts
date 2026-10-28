import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { toWebsiteVideoEmbedUrl } from '../models/website-video';
import { CoachLandingPreviewComponent } from "../coach-landing-preview/coach-landing-preview.component";

/** Full-screen preview of the draft the builder handed over (nothing is sent to the server). */
@Component({
  selector: 'app-coach-landing-preview-page',
  standalone: true,
  imports: [CommonModule, CoachLandingPreviewComponent],
  template: `
    <app-coach-landing-preview
      [themeKey]="data.themeKey"
      [themeName]="data.themeName"
      [profile]="data.profile"
      [videoEmbedUrl]="videoEmbedUrl"
      [announcement]="data.announcement"
      [cta]="data.cta"
      [leadFields]="data.leadFields"
      [colors]="data.colors"
      [design]="data.design"
      [socialLinks]="data.socialLinks"
      [stats]="data.stats || []"
      [services]="data.services"
      [results]="data.results"
      [certificates]="data.certificates"
      [testimonials]="data.testimonials"
      [descriptionBlocks]="data.descriptionBlocks">
    </app-coach-landing-preview>
  `
})
export class CoachLandingPreviewPageComponent {
  data = history.state || {};
  videoEmbedUrl: SafeResourceUrl | null = null;

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    // Opened directly (no draft in the history state): back to the builder instead of an empty page.
    if (!this.data?.profile) {
      this.router.navigateByUrl('/websites/create');
      return;
    }
    this.videoEmbedUrl = this.buildSafeVideoUrl(this.data.videoUrl);
  }

  private buildSafeVideoUrl(url: string): SafeResourceUrl | null {
    const embedUrl = toWebsiteVideoEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }
}
